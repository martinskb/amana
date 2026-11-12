-- Agenda Fácil — endurecimento do link público (auditoria de segurança R1: SEC-001 e SEC-002).
-- Aplicar por cima da 0003, sem apagar dados.

-- SEC-001: o número de WhatsApp identifica o cliente que volta (sem cadastro repetido), mas quem
-- agenda pelo link não prova que é dono do número. Guarda o nome digitado para o dono conferir
-- quando ele não bate com o cadastro.
alter table agendamentos add column nome_informado text check (char_length(nome_informado) <= 80);

-- Mesma função da 0002 com dois freios a mais (SEC-002), que não dependem do IP:
--   * no máximo 2 horários futuros ativos pelo link por WhatsApp;
--   * no máximo 10 agendamentos pelo link por hora, somando todo mundo.
-- Os três limites respondem 'limite', sem dizer qual: não revela a estranhos se um número tem horários.
create or replace function agendar_publico_em(p_nome text, p_telefone text, p_inicio timestamptz, p_agora timestamptz, p_ip text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  cfg configuracoes;
  nome_limpo text := btrim(coalesce(p_nome, ''));
  tel text := normalizar_telefone(p_telefone);
  id_cliente uuid;
begin
  select * into cfg from configuracoes where id = 1;

  if not cfg.link_ativo then
    return jsonb_build_object('ok', false, 'erro', 'link_fechado');
  end if;
  if char_length(nome_limpo) not between 1 and 80 or tel is null then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;
  -- trava única: o teto geral e o limite por WhatsApp contam o mesmo conjunto; sem ela, pedidos
  -- simultâneos leriam a contagem ao mesmo tempo
  perform pg_advisory_xact_lock(hashtext('agendar_publico'));
  -- serializa os pedidos do mesmo IP: sem isso, pedidos simultâneos leriam a contagem ao mesmo tempo
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
  if not exists (select 1 from horarios_livres_em(p_agora) h where h = p_inicio) then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end if;

  begin
    -- dentro do bloco protegido: se a trava do banco recusar o horário, o cliente novo também é desfeito
    insert into clientes (nome, telefone) values (nome_limpo, tel) on conflict (telefone) do nothing;
    select c.id into id_cliente from clientes c where c.telefone = tel;
    insert into agendamentos (cliente_id, inicio, fim, status, origem, nome_informado)
    values (id_cliente, p_inicio, p_inicio + make_interval(mins => cfg.passo_min), 'marcado', 'link', nome_limpo);
  exception when exclusion_violation then
    -- duas pessoas no mesmo horário ao mesmo tempo: a trava do banco deixou só uma passar
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end;

  delete from tentativas_publicas where criado_em < p_agora - interval '30 days';
  insert into tentativas_publicas (ip, criado_em) values (p_ip, p_agora);

  return jsonb_build_object('ok', true, 'inicio', to_char(p_inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
end
$$;

-- create or replace mantém os privilégios, mas reforça: só a função pública chama esta
revoke execute on function agendar_publico_em(text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
