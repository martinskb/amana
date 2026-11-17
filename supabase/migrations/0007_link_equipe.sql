-- Amana — 0007: link da equipe.
-- Aplicar por cima da 0006, sem apagar dados.
--
-- Cada pessoa pode ter um link secreto (/#/equipe/<código>) que abre, sem login, os clientes dela de
-- hoje e de amanhã, só para leitura. O dono gera e troca o link em Ajustes; o código fica guardado em
-- `pessoas` (só o dono lê, pela RLS da 0006). O telefone dos clientes só sai com `link_whatsapp`.

alter table pessoas
  add column link_codigo text unique,
  add column link_whatsapp boolean not null default false;

-- Grava um código novo (64 hex, de dois uuid aleatórios: não depende de pgcrypto) e devolve.
-- Security invoker: só o dono consegue atualizar a pessoa (RLS).
create function gerar_link_pessoa(p uuid) returns text
language plpgsql volatile security invoker set search_path = public
as $$
declare
  codigo text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  update pessoas set link_codigo = codigo where id = p;
  if not found then
    raise exception 'pessoa não encontrada' using errcode = 'P0002';
  end if;
  return codigo;
end
$$;

revoke execute on function gerar_link_pessoa(uuid) from public, anon;
grant execute on function gerar_link_pessoa(uuid) to authenticated;

-- A agenda da pessoa dona do código, num instante dado (a pública passa now()). Código inválido,
-- trocado ou de pessoa desativada: sempre {"ok": false}, sem dizer o motivo.
create function agenda_da_equipe_em(codigo text, agora timestamptz) returns jsonb
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
                'cliente', c.nome,
                'servico', s.nome,
                'status', a.status
              ) || case when p.link_whatsapp then jsonb_build_object('telefone', c.telefone) else '{}'::jsonb end
              order by a.inicio)
            from agendamentos a
            join clientes c on c.id = a.cliente_id
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

create function agenda_da_equipe(codigo text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select agenda_da_equipe_em(codigo, now())
$$;

revoke execute on function agenda_da_equipe_em(text, timestamptz) from public, anon, authenticated;
revoke execute on function agenda_da_equipe(text) from public;
grant execute on function agenda_da_equipe(text) to anon, authenticated;
