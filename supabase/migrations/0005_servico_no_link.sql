-- Agenda Fácil — o cliente escolhe o serviço no link (duração certa na agenda).
-- Aplicar por cima da 0004, sem apagar dados.

-- ---------------------------------------------------------------------------
-- Horários de início para uma duração: todos os blocos (de passo_min) que ela ocupa precisam estar
-- livres em horarios_livres_em. Assim um serviço de 60 min não começa antes do almoço, de um
-- horário fechado, de outro agendamento ou do fim do expediente. Interna, como horarios_livres_em.
create function inicios_para_duracao_em(agora timestamptz, duracao_min integer) returns setof timestamptz
language sql stable security definer set search_path = public
as $$
  with c as (
    select passo_min, greatest(1, ceil(duracao_min::numeric / passo_min)::int) as blocos
    from configuracoes where id = 1
  ),
  livres as (select h from horarios_livres_em(agora) h)
  select l.h
  from livres l, c
  where not exists (
    select 1 from generate_series(1, c.blocos - 1) k
    where not exists (select 1 from livres l2 where l2.h = l.h + make_interval(mins => c.passo_min * k))
  )
  order by l.h
$$;

revoke execute on function inicios_para_duracao_em(timestamptz, integer) from public, anon, authenticated;

-- Pública: agora também os serviços ativos, cada um com os horários em que cabe.
create or replace function horarios_publicos() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'nome_negocio', c.nome_negocio,
    'telefone_negocio', c.telefone_negocio,
    'link_ativo', c.link_ativo,
    'horarios', coalesce(
      (select jsonb_agg(to_char(h at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by h)
       from horarios_livres_em(now()) h),
      '[]'::jsonb),
    'servicos', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'id', s.id, 'nome', s.nome, 'duracao_min', s.duracao_min,
         'horarios', coalesce(
           (select jsonb_agg(to_char(h at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by h)
            from inicios_para_duracao_em(now(), s.duracao_min) h),
           '[]'::jsonb)
       ) order by s.nome)
       from servicos s where s.ativo),
      '[]'::jsonb)
  )
  from configuracoes c where c.id = 1
$$;

-- Agendar pelo link com o serviço: mesmas regras da 0004 e mais o serviço. Com serviços ativos ele é
-- obrigatório e precisa estar ativo; a duração dele decide os blocos ocupados e o fim do agendamento.
-- Sem nenhum serviço ativo, continua como antes (um bloco, sem serviço).
drop function agendar_publico(text, text, timestamptz);
drop function agendar_publico_em(text, text, timestamptz, timestamptz, text);

create function agendar_publico_em(p_nome text, p_telefone text, p_inicio timestamptz, p_agora timestamptz, p_ip text,
                                   p_servico uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  cfg configuracoes;
  nome_limpo text := btrim(coalesce(p_nome, ''));
  tel text := normalizar_telefone(p_telefone);
  id_cliente uuid;
  srv servicos;
  duracao integer;
begin
  select * into cfg from configuracoes where id = 1;

  if not cfg.link_ativo then
    return jsonb_build_object('ok', false, 'erro', 'link_fechado');
  end if;
  if char_length(nome_limpo) not between 1 and 80 or tel is null then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;
  if exists (select 1 from servicos where ativo) then
    select * into srv from servicos where id = p_servico and ativo;
    if srv.id is null then
      return jsonb_build_object('ok', false, 'erro', 'servico_invalido');
    end if;
  end if;
  duracao := coalesce(srv.duracao_min, cfg.passo_min);

  -- trava única: o teto geral e o limite por WhatsApp contam o mesmo conjunto
  perform pg_advisory_xact_lock(hashtext('agendar_publico'));
  -- serializa os pedidos do mesmo IP
  perform pg_advisory_xact_lock(hashtext('agendar_publico:' || p_ip));
  if (select count(*) from tentativas_publicas t
      where t.ip = p_ip and t.criado_em > p_agora - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'erro', 'limite');
  end if;
  if (select count(*) from tentativas_publicas t where t.criado_em > p_agora - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'erro', 'limite');
  end if;
  if (select count(*) from agendamentos a join clientes c on c.id = a.cliente_id
      where c.telefone = tel and a.origem = 'link' and a.status in ('marcado', 'confirmado')
        and a.inicio > p_agora) >= 2 then
    return jsonb_build_object('ok', false, 'erro', 'limite');
  end if;
  if not exists (select 1 from inicios_para_duracao_em(p_agora, duracao) h where h = p_inicio) then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end if;

  begin
    -- dentro do bloco protegido: se a trava do banco recusar o horário, o cliente novo também é desfeito
    insert into clientes (nome, telefone) values (nome_limpo, tel) on conflict (telefone) do nothing;
    select c.id into id_cliente from clientes c where c.telefone = tel;
    insert into agendamentos (cliente_id, servico_id, inicio, fim, status, origem, nome_informado)
    values (id_cliente, srv.id, p_inicio, p_inicio + make_interval(mins => duracao), 'marcado', 'link', nome_limpo);
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end;

  delete from tentativas_publicas where criado_em < p_agora - interval '30 days';
  insert into tentativas_publicas (ip, criado_em) values (p_ip, p_agora);

  return jsonb_build_object('ok', true, 'inicio', to_char(p_inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
end
$$;

-- Pública: o app instalado antes desta versão chama sem `servico` e recebe servico_invalido quando há
-- serviços (a página atualizada pede o serviço).
create function agendar_publico(nome text, telefone text, inicio timestamptz, servico uuid default null) returns jsonb
language sql volatile security definer set search_path = public
as $$
  select agendar_publico_em(nome, telefone, inicio, now(), ip_cliente(), servico)
$$;

revoke execute on function agendar_publico_em(text, text, timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function agendar_publico(text, text, timestamptz, uuid) to anon, authenticated;
