-- Amana — pessoas: mais de um profissional por negócio.
-- Aplicar por cima da 0005, sem apagar dados. Os agendamentos e extras que já existem ficam com a
-- "Pessoa 1", criada aqui sem nome e ligada a todos os serviços.

-- a trava por pessoa compara uuid (=) junto com o intervalo (&&) num índice gist
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Pessoas e quem faz o quê

create table pessoas (
  id uuid primary key default gen_random_uuid(),
  -- sem nome, o app mostra "Pessoa N"; nome vazio vira null no app
  nome text check (nome is null or char_length(nome) between 1 and 40),
  ativo boolean not null default true,
  ordem integer not null,
  -- dias de folga só desta pessoa ("YYYY-MM-DD"), como configuracoes.folgas
  folgas jsonb not null default '[]',
  criado_em timestamptz not null default now()
);

create table pessoa_servicos (
  pessoa_id uuid not null references pessoas (id) on delete cascade,
  servico_id uuid not null references servicos (id) on delete cascade,
  primary key (pessoa_id, servico_id)
);

alter table pessoas enable row level security;
create policy dono_pessoas on pessoas for all to authenticated
  using (eh_dono()) with check (eh_dono());
grant select, insert, update, delete on pessoas to authenticated;

alter table pessoa_servicos enable row level security;
create policy dono_pessoa_servicos on pessoa_servicos for all to authenticated
  using (eh_dono()) with check (eh_dono());
grant select, insert, update, delete on pessoa_servicos to authenticated;

insert into pessoas (nome, ordem) values (null, 1);
insert into pessoa_servicos (pessoa_id, servico_id)
select p.id, s.id from pessoas p, servicos s;

-- ---------------------------------------------------------------------------
-- Agendamento com pessoa: a trava de horário passa a ser por pessoa

alter table agendamentos add column pessoa_id uuid references pessoas (id);
update agendamentos set pessoa_id = (select id from pessoas order by ordem limit 1);
alter table agendamentos alter column pessoa_id set not null;

alter table agendamentos drop constraint agendamentos_sem_sobreposicao;
alter table agendamentos add constraint agendamentos_sem_sobreposicao
  exclude using gist (pessoa_id with =, tstzrange(inicio, fim, '[)') with &&)
  where (status in ('marcado', 'confirmado'));

create index agendamentos_pessoa_idx on agendamentos (pessoa_id, inicio);

-- ---------------------------------------------------------------------------
-- Horários fechados e extras com pessoa (null = o negócio todo; extra sempre tem pessoa)

alter table horarios_ajuste add column pessoa_id uuid references pessoas (id) on delete cascade;
update horarios_ajuste set pessoa_id = (select id from pessoas order by ordem limit 1) where tipo = 'extra';
alter table horarios_ajuste drop constraint horarios_ajuste_inicio_tipo_key;
alter table horarios_ajuste add constraint horarios_ajuste_unico unique nulls not distinct (inicio, tipo, pessoa_id);
alter table horarios_ajuste add constraint horarios_ajuste_extra_com_pessoa check (tipo <> 'extra' or pessoa_id is not null);

-- ---------------------------------------------------------------------------
-- Compatibilidade com o app instalado antes desta versão (não manda pessoa_id)

-- Agendamento sem pessoa: a primeira ativa (por ordem) sem agendamento ativo cruzando o horário.
-- Se ninguém estiver livre, a primeira ativa, e a trava recusa como antes.
create function pessoa_padrao_agendamento() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.pessoa_id is null then
    select p.id into new.pessoa_id
    from pessoas p
    where p.ativo
      and not exists (
        select 1 from agendamentos a
        where a.pessoa_id = p.id and a.status in ('marcado', 'confirmado')
          and a.inicio < new.fim and new.inicio < a.fim
      )
    order by p.ordem
    limit 1;
    if new.pessoa_id is null then
      select p.id into new.pessoa_id from pessoas p where p.ativo order by p.ordem limit 1;
    end if;
  end if;
  return new;
end
$$;

create trigger agendamentos_pessoa_padrao before insert on agendamentos
  for each row execute function pessoa_padrao_agendamento();

-- Extra sem pessoa: a primeira ativa. Fechado sem pessoa continua valendo para o negócio todo.
create function pessoa_padrao_extra() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.tipo = 'extra' and new.pessoa_id is null then
    select p.id into new.pessoa_id from pessoas p where p.ativo order by p.ordem limit 1;
  end if;
  return new;
end
$$;

create trigger horarios_ajuste_pessoa_padrao before insert on horarios_ajuste
  for each row execute function pessoa_padrao_extra();

-- Serviço novo: todas as pessoas ativas fazem (o dono desmarca depois). Assim, com uma pessoa só,
-- nenhum serviço fica "sem ninguém", mesmo criado pelo app antigo.
create function ligar_servico_novo() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into pessoa_servicos (pessoa_id, servico_id)
  select p.id, new.id from pessoas p where p.ativo
  on conflict do nothing;
  return new;
end
$$;

create trigger servicos_ligar_pessoas after insert on servicos
  for each row execute function ligar_servico_novo();

revoke execute on function pessoa_padrao_agendamento() from public, anon, authenticated;
revoke execute on function pessoa_padrao_extra() from public, anon, authenticated;
revoke execute on function ligar_servico_novo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Desativar uma pessoa (pelo app do dono; o RLS vale aqui dentro)

create function desativar_pessoa(p uuid) returns jsonb
language plpgsql volatile security invoker set search_path = public
as $$
begin
  if not exists (select 1 from pessoas where ativo and id <> p) then
    return jsonb_build_object('ok', false, 'erro', 'ultima');
  end if;
  if exists (
    select 1 from agendamentos
    where pessoa_id = p and status in ('marcado', 'confirmado') and inicio >= now()
  ) then
    return jsonb_build_object('ok', false, 'erro', 'clientes_futuros');
  end if;
  -- extras e fechados futuros dela não servem mais; as folgas ficam para uma reativação
  delete from horarios_ajuste where pessoa_id = p and inicio >= now();
  update pessoas set ativo = false where id = p;
  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function desativar_pessoa(uuid) from public, anon;
grant execute on function desativar_pessoa(uuid) to authenticated;
