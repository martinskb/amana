-- Amana — 0009: limpeza automática de clientes e atendimentos antigos.
-- Aplicar por cima da 0008, sem apagar dados.
--
-- Todo dia (pg_cron, ver supabase/cron/limpeza.sql) saem os clientes sem atendimento nos últimos 7 dias
-- (nem agendado para a frente, qualquer status) e cadastrados há mais de 7 dias, e os atendimentos de
-- mais de 3 meses. O atendimento de um cliente apagado fica com o nome (`cliente_nome`) e sem `cliente_id`.

alter table agendamentos add column cliente_nome text;
update agendamentos a set cliente_nome = c.nome from clientes c where c.id = a.cliente_id;

-- Cópia do nome no atendimento: preenchida ao gravar e mantida quando o cliente é renomeado.
create function copiar_nome_cliente() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.cliente_id is not null then
    select c.nome into new.cliente_nome from clientes c where c.id = new.cliente_id;
  end if;
  return new;
end
$$;

create trigger agendamentos_cliente_nome
before insert or update of cliente_id on agendamentos
for each row execute function copiar_nome_cliente();

create function atualizar_nome_nos_agendamentos() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update agendamentos set cliente_nome = new.nome where cliente_id = new.id;
  return new;
end
$$;

create trigger clientes_nome_nos_agendamentos
after update of nome on clientes
for each row execute function atualizar_nome_nos_agendamentos();

revoke execute on function copiar_nome_cliente() from public, anon, authenticated;
revoke execute on function atualizar_nome_nos_agendamentos() from public, anon, authenticated;

-- Apagar o cliente não apaga mais o atendimento: só solta o vínculo.
alter table agendamentos alter column cliente_id drop not null;
alter table agendamentos drop constraint agendamentos_cliente_id_fkey;
alter table agendamentos add constraint agendamentos_cliente_id_fkey
  foreign key (cliente_id) references clientes (id) on delete set null;

-- A limpeza, num instante dado (o agendado passa now()). Primeiro os atendimentos de mais de 3 meses,
-- depois os clientes: sem atendimento que termine nos últimos 7 dias ou à frente, e cadastrados há mais
-- de 7 dias. Devolve quantos de cada saíram.
create function limpar_dados_antigos_em(agora timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  n_agendamentos integer;
  n_clientes integer;
begin
  delete from agendamentos where inicio < agora - interval '3 months';
  get diagnostics n_agendamentos = row_count;

  delete from clientes c
  where c.criado_em < agora - interval '7 days'
    and not exists (
      select 1 from agendamentos a
      where a.cliente_id = c.id and a.fim >= agora - interval '7 days'
    );
  get diagnostics n_clientes = row_count;

  return jsonb_build_object('clientes', n_clientes, 'agendamentos', n_agendamentos);
end
$$;

create function limpar_dados_antigos() returns jsonb
language sql volatile security definer set search_path = public
as $$
  select limpar_dados_antigos_em(now())
$$;

revoke execute on function limpar_dados_antigos_em(timestamptz) from public, anon, authenticated;
revoke execute on function limpar_dados_antigos() from public, anon, authenticated;

-- Como na 0007, mas o atendimento de um cliente já apagado aparece com o nome guardado e sem telefone.
create or replace function agenda_da_equipe_em(codigo text, agora timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  p pessoas;
  fuso_negocio text;
  negocio text;
  hoje date;
  posicao integer;
begin
  select * into p from pessoas
  where link_codigo = nullif(btrim(coalesce(codigo, ''), E' \t\r\n'), '') and ativo;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select c.fuso, c.nome_negocio into fuso_negocio, negocio from configuracoes c where c.id = 1;
  hoje := (agora at time zone fuso_negocio)::date;
  -- nome de exibição como no app: o nome; sem nome, "Pessoa N" pela posição entre as ativas
  select count(*) into posicao from pessoas where ativo and ordem <= p.ordem;

  return jsonb_build_object(
    'ok', true,
    'negocio', negocio,
    'pessoa', coalesce(p.nome, 'Pessoa ' || posicao),
    'whatsapp', p.link_whatsapp,
    'hoje', hoje,
    'amanha', hoje + 1,
    'dias', (
      select jsonb_agg(
        jsonb_build_object(
          'data', v.dia,
          'clientes', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'inicio', a.inicio,
                'fim', a.fim,
                'cliente', coalesce(c.nome, a.cliente_nome),
                'servico', s.nome,
                'status', a.status
              ) || case when p.link_whatsapp and c.telefone is not null then jsonb_build_object('telefone', c.telefone) else '{}'::jsonb end
              order by a.inicio)
            from agendamentos a
            left join clientes c on c.id = a.cliente_id
            left join servicos s on s.id = a.servico_id
            where a.pessoa_id = p.id
              and a.status <> 'cancelado'
              and (a.inicio at time zone fuso_negocio)::date = v.dia
          ), '[]'::jsonb)
        ) order by v.dia)
      from (values (hoje), (hoje + 1)) as v (dia)
    )
  );
end
$$;

revoke execute on function agenda_da_equipe_em(text, timestamptz) from public, anon, authenticated;
