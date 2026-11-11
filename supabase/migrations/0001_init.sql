-- Agenda Fácil — esquema inicial (spec seção 5)

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  telefone text not null unique check (telefone ~ '^55[0-9]{10,11}$'),
  criado_em timestamptz not null default now()
);

create table servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  duracao_min integer not null check (duracao_min > 0),
  ativo boolean not null default true
);

create table agendamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id),
  servico_id uuid not null references servicos (id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'marcado'
    check (status in ('marcado', 'confirmado', 'cancelado', 'concluido', 'faltou')),
  observacao text,
  criado_em timestamptz not null default now(),
  check (fim > inicio),
  -- impede horário duplicado entre agendamentos ativos, mesmo com erro de tela
  constraint agendamentos_sem_sobreposicao
    exclude using gist (tstzrange(inicio, fim, '[)') with &&)
    where (status in ('marcado', 'confirmado'))
);

create index agendamentos_cliente_idx on agendamentos (cliente_id, inicio desc);

create table configuracoes (
  id integer primary key default 1 check (id = 1),
  nome_negocio text not null default '',
  fuso text not null default 'America/Sao_Paulo',
  expediente jsonb not null default '{"0":[],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}',
  folgas jsonb not null default '[]',
  passo_min integer not null default 30 check (passo_min > 0),
  antecedencia_min integer not null default 60 check (antecedencia_min >= 0),
  modelo_livres text not null default '',
  modelo_lembrete text not null default '',
  ultimo_backup timestamptz
);

-- Quem é o dono. Preenchido uma vez na implantação (ver docs/implantacao.md):
--   insert into donos (user_id) values ('<id do usuário em Authentication > Users>');
create table donos (
  user_id uuid primary key
);

-- security definer: lê donos mesmo sem política de leitura para o usuário
create function eh_dono() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from donos where user_id = auth.uid()) $$;

-- Row Level Security: só o dono lê e escreve. Qualquer outra conta logada não vê nada.
alter table donos enable row level security; -- sem políticas: ninguém mexe pela API
alter table clientes enable row level security;
alter table servicos enable row level security;
alter table agendamentos enable row level security;
alter table configuracoes enable row level security;

create policy dono_clientes on clientes for all to authenticated using (eh_dono()) with check (eh_dono());
create policy dono_servicos on servicos for all to authenticated using (eh_dono()) with check (eh_dono());
create policy dono_agendamentos on agendamentos for all to authenticated using (eh_dono()) with check (eh_dono());
create policy dono_configuracoes on configuracoes for all to authenticated using (eh_dono()) with check (eh_dono());

revoke all on donos from anon, authenticated;
grant select, insert, update, delete on clientes, servicos, agendamentos, configuracoes to authenticated;
