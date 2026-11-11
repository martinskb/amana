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
