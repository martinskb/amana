-- Agenda Fácil v2 — link público de agendamento (spec v2, seção 4).
-- Aplicar por cima da 0001, sem apagar dados.

-- Configurações novas
alter table configuracoes
  add column dias_abertos integer not null default 14 check (dias_abertos between 1 and 60),
  add column link_ativo boolean not null default true,
  add column telefone_negocio text check (telefone_negocio ~ '^[0-9]{8,15}$'),
  add column modelo_cancelamento text not null default
    'Oi {nome}, infelizmente não vou conseguir te atender {dia} às {hora}. Quer marcar outro horário? {link}';

-- Telefone internacional: só dígitos, 8 a 15 (a regra brasileira fica no app e em normalizar_telefone)
alter table clientes drop constraint clientes_telefone_check;
alter table clientes add constraint clientes_telefone_check check (telefone ~ '^[0-9]{8,15}$');

-- Serviço opcional e origem do agendamento
alter table agendamentos alter column servico_id drop not null;
alter table agendamentos
  add column origem text not null default 'dono' check (origem in ('dono', 'link'));

-- Horários fechados (bloco de passo_min a partir do início) e extras (fora do expediente)
create table horarios_ajuste (
  id uuid primary key default gen_random_uuid(),
  inicio timestamptz not null,
  tipo text not null check (tipo in ('fechado', 'extra')),
  criado_em timestamptz not null default now(),
  unique (inicio, tipo)
);
alter table horarios_ajuste enable row level security;
create policy dono_horarios_ajuste on horarios_ajuste for all to authenticated
  using (eh_dono()) with check (eh_dono());
grant select, insert, update, delete on horarios_ajuste to authenticated;

-- Tentativas pelo link, só para o limite por IP. Sem nome nem telefone.
-- Ninguém lê pela API: só as funções públicas (security definer) escrevem aqui.
create table tentativas_publicas (
  id bigint generated always as identity primary key,
  ip text not null,
  criado_em timestamptz not null default now()
);
create index tentativas_publicas_ip_idx on tentativas_publicas (ip, criado_em);
alter table tentativas_publicas enable row level security;
revoke all on tentativas_publicas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Horários livres do link (spec v2, seção 3). Mesma regra de gerarHorarios/freeSlots
-- em src/lib/slots.ts; o teste tests/db/concordancia.test.ts mantém as duas iguais.
-- Interna: recebe `agora` para poder ser testada; o público usa horarios_publicos().
create function horarios_livres_em(agora timestamptz) returns setof timestamptz
language sql stable security definer set search_path = public
as $$
  with c as (
    select *, make_interval(mins => passo_min) as passo, (agora at time zone fuso)::date as hoje
    from configuracoes where id = 1
  ),
  dias as (
    select d::date as dia
    from c, generate_series(c.hoje, c.hoje + (c.dias_abertos - 1), interval '1 day') d
  ),
  do_expediente as (
    select (h at time zone c.fuso) as inicio
    from c, dias,
      jsonb_array_elements(c.expediente -> extract(dow from dias.dia)::int::text) iv,
      generate_series(dias.dia + (iv ->> 'inicio')::time, dias.dia + (iv ->> 'fim')::time - c.passo, c.passo) h
    where not (c.folgas ? to_char(dias.dia, 'YYYY-MM-DD'))
  ),
  extras as (
    select a.inicio
    from c, horarios_ajuste a
    where a.tipo = 'extra'
      and (a.inicio at time zone c.fuso)::date between c.hoje and c.hoje + (c.dias_abertos - 1)
  ),
  ofertados as (
    select inicio from do_expediente
    union
    select inicio from extras
  )
  select o.inicio
  from ofertados o, c
  where c.link_ativo
    and o.inicio >= agora + make_interval(mins => c.antecedencia_min)
    and not exists (
      select 1 from horarios_ajuste f
      where f.tipo = 'fechado' and f.inicio < o.inicio + c.passo and o.inicio < f.inicio + c.passo
    )
    and not exists (
      select 1 from agendamentos a
      where a.status in ('marcado', 'confirmado') and a.inicio < o.inicio + c.passo and o.inicio < a.fim
    )
  order by o.inicio
$$;

-- Pública: o que a página /#/agendar vê. Nunca devolve dado de cliente.
create function horarios_publicos() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'nome_negocio', c.nome_negocio,
    'telefone_negocio', c.telefone_negocio,
    'link_ativo', c.link_ativo,
    'horarios', coalesce(
      (select jsonb_agg(to_char(h at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by h)
       from horarios_livres_em(now()) h),
      '[]'::jsonb)
  )
  from configuracoes c where c.id = 1
$$;

-- O Supabase concede execute a anon/authenticated em funções novas: fechar as internas.
revoke execute on function horarios_livres_em(timestamptz) from public, anon, authenticated;
grant execute on function horarios_publicos() to anon, authenticated;
