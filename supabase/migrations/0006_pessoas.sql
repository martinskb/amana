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

-- ---------------------------------------------------------------------------
-- Horários livres por pessoa. Mesma regra de gerarHorarios/freeSlots em src/lib/slots.ts; o teste
-- tests/db/concordancia.test.ts mantém as duas iguais. Só pessoas ativas; expediente do negócio menos
-- as folgas do negócio e as dela; mais os extras dela (mesmo em dia de folga); sem fechado do negócio
-- todo (pessoa_id null) nem dela; sem agendamento ativo dela. Continuam internas.
drop function inicios_para_duracao_em(timestamptz, integer);
drop function horarios_livres_em(timestamptz);

create function horarios_livres_em(agora timestamptz) returns table (pessoa_id uuid, inicio timestamptz)
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
  ps as (select p.id, p.ordem, p.folgas from pessoas p where p.ativo),
  do_expediente as (
    select ps.id as pessoa_id, (h at time zone c.fuso) as inicio
    from c, dias, ps,
      jsonb_array_elements(c.expediente -> extract(dow from dias.dia)::int::text) iv,
      generate_series(dias.dia + (iv ->> 'inicio')::time, dias.dia + (iv ->> 'fim')::time - c.passo, c.passo) h
    where not (c.folgas ? to_char(dias.dia, 'YYYY-MM-DD'))
      and not (ps.folgas ? to_char(dias.dia, 'YYYY-MM-DD'))
  ),
  extras as (
    select a.pessoa_id, a.inicio
    from c, horarios_ajuste a join ps on ps.id = a.pessoa_id
    where a.tipo = 'extra'
      and (a.inicio at time zone c.fuso)::date between c.hoje and c.hoje + (c.dias_abertos - 1)
  ),
  ofertados as (
    select e.pessoa_id, e.inicio from do_expediente e
    union
    select x.pessoa_id, x.inicio from extras x
  )
  select o.pessoa_id, o.inicio
  from ofertados o join ps on ps.id = o.pessoa_id, c
  where c.link_ativo
    and o.inicio >= agora + make_interval(mins => c.antecedencia_min)
    and not exists (
      select 1 from horarios_ajuste f
      where f.tipo = 'fechado' and (f.pessoa_id is null or f.pessoa_id = o.pessoa_id)
        and f.inicio < o.inicio + c.passo and o.inicio < f.inicio + c.passo
    )
    and not exists (
      select 1 from agendamentos a
      where a.pessoa_id = o.pessoa_id and a.status in ('marcado', 'confirmado')
        and a.inicio < o.inicio + c.passo and o.inicio < a.fim
    )
  order by o.inicio, ps.ordem
$$;

-- Inícios para uma duração: todos os blocos que ela ocupa livres para a mesma pessoa.
create function inicios_para_duracao_em(agora timestamptz, duracao_min integer) returns table (pessoa_id uuid, inicio timestamptz)
language sql stable security definer set search_path = public
as $$
  with c as (
    select passo_min, greatest(1, ceil(duracao_min::numeric / passo_min)::int) as blocos
    from configuracoes where id = 1
  ),
  livres as (select l.pessoa_id, l.inicio from horarios_livres_em(agora) l)
  select l.pessoa_id, l.inicio
  from livres l join pessoas p on p.id = l.pessoa_id, c
  where not exists (
    select 1 from generate_series(1, c.blocos - 1) k
    where not exists (
      select 1 from livres l2
      where l2.pessoa_id = l.pessoa_id and l2.inicio = l.inicio + make_interval(mins => c.passo_min * k)
    )
  )
  order by l.inicio, p.ordem
$$;

revoke execute on function horarios_livres_em(timestamptz) from public, anon, authenticated;
revoke execute on function inicios_para_duracao_em(timestamptz, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Link público por pessoa. Pessoa sem nome nunca aparece (nem o id), mas entra na união dos horários
-- e pode receber o agendamento "Sem preferência".

-- Interna: a resposta do link num instante (a pública chama com now()).
create function horarios_publicos_em(agora timestamptz) returns jsonb
language sql stable security definer set search_path = public
as $$
  with fazem as (
    -- quem faz cada serviço ativo, entre as pessoas ativas
    select ps.servico_id, p.id as pessoa_id, p.nome, p.ordem
    from pessoa_servicos ps
      join pessoas p on p.id = ps.pessoa_id and p.ativo
      join servicos s on s.id = ps.servico_id and s.ativo
  ),
  srv as (
    select s.* from servicos s where s.ativo and exists (select 1 from fazem f where f.servico_id = s.id)
  ),
  ini as (
    -- inícios em que cabe o serviço inteiro, só de quem o faz
    select s.id as servico_id, d.pessoa_id, d.inicio
    from srv s cross join lateral inicios_para_duracao_em(agora, s.duracao_min) d
    where exists (select 1 from fazem f where f.servico_id = s.id and f.pessoa_id = d.pessoa_id)
  )
  select jsonb_build_object(
    'nome_negocio', c.nome_negocio,
    'telefone_negocio', c.telefone_negocio,
    'link_ativo', c.link_ativo,
    'horarios', coalesce(
      (select jsonb_agg(to_char(x.h at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by x.h)
       from (select distinct l.inicio as h from horarios_livres_em(agora) l) x),
      '[]'::jsonb),
    'pessoas', coalesce(
      (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.ordem)
       from pessoas p where p.ativo and p.nome is not null),
      '[]'::jsonb),
    'servicos', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'id', s.id, 'nome', s.nome, 'duracao_min', s.duracao_min,
         'horarios', coalesce(
           (select jsonb_agg(to_char(x.h at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by x.h)
            from (select distinct i.inicio as h from ini i where i.servico_id = s.id) x),
           '[]'::jsonb),
         'pessoas', coalesce(
           (select jsonb_agg(jsonb_build_object(
              'id', f.pessoa_id,
              'horarios', coalesce(
                (select jsonb_agg(to_char(i.inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by i.inicio)
                 from ini i where i.servico_id = s.id and i.pessoa_id = f.pessoa_id),
                '[]'::jsonb)
            ) order by f.ordem)
            from fazem f where f.servico_id = s.id and f.nome is not null),
           '[]'::jsonb),
         'com_escolha',
           exists (select 1 from fazem f where f.servico_id = s.id and f.nome is not null)
           and (select count(*) from fazem f where f.servico_id = s.id) > 1
       ) order by s.nome)
       from srv s),
      '[]'::jsonb)
  )
  from configuracoes c where c.id = 1
$$;

create or replace function horarios_publicos() returns jsonb
language sql stable security definer set search_path = public
as $$
  select horarios_publicos_em(now())
$$;

revoke execute on function horarios_publicos_em(timestamptz) from public, anon, authenticated;
grant execute on function horarios_publicos() to anon, authenticated;

-- Agendar pelo link com pessoa. As regras da 0005 continuam (link, dados, serviço, travas e limites).
-- Com p_pessoa: ela precisa estar ativa, ter nome e fazer o serviço (senão servico_invalido) e ter a
-- duração inteira livre (senão horario_indisponivel). Sem p_pessoa ("Sem preferência"): entre as que
-- fazem o serviço e têm a duração livre, a de menos agendamentos ativos no dia; empate, a menor ordem.
drop function agendar_publico(text, text, timestamptz, uuid);
drop function agendar_publico_em(text, text, timestamptz, timestamptz, text, uuid);

create function agendar_publico_em(p_nome text, p_telefone text, p_inicio timestamptz, p_agora timestamptz, p_ip text,
                                   p_servico uuid default null, p_pessoa uuid default null)
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
  com_servico boolean;
  candidata record;
begin
  select * into cfg from configuracoes where id = 1;

  if not cfg.link_ativo then
    return jsonb_build_object('ok', false, 'erro', 'link_fechado');
  end if;
  if char_length(nome_limpo) not between 1 and 80 or tel is null then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;
  com_servico := exists (select 1 from servicos where ativo);
  if com_servico then
    select * into srv from servicos where id = p_servico and ativo;
    if srv.id is null then
      return jsonb_build_object('ok', false, 'erro', 'servico_invalido');
    end if;
  end if;
  if p_pessoa is not null and not exists (
    select 1 from pessoas p
    where p.id = p_pessoa and p.ativo and p.nome is not null
      and (not com_servico or exists (select 1 from pessoa_servicos ps where ps.pessoa_id = p.id and ps.servico_id = srv.id))
  ) then
    return jsonb_build_object('ok', false, 'erro', 'servico_invalido');
  end if;
  duracao := coalesce(srv.duracao_min, cfg.passo_min);

  -- trava única: o teto geral e o limite por WhatsApp contam o mesmo conjunto; também serializa os
  -- pedidos "Sem preferência" do mesmo horário (o segundo já vê o primeiro e vai para outra pessoa)
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

  -- candidatas na ordem de preferência; se a trava recusar uma (o dono marcou no mesmo instante), tenta a próxima
  for candidata in
    select d.pessoa_id, p.nome
    from inicios_para_duracao_em(p_agora, duracao) d join pessoas p on p.id = d.pessoa_id
    where d.inicio = p_inicio
      and (p_pessoa is null or d.pessoa_id = p_pessoa)
      and (not com_servico or exists (select 1 from pessoa_servicos ps where ps.pessoa_id = d.pessoa_id and ps.servico_id = srv.id))
    order by (
      select count(*) from agendamentos a
      where a.pessoa_id = d.pessoa_id and a.status in ('marcado', 'confirmado')
        and (a.inicio at time zone cfg.fuso)::date = (p_inicio at time zone cfg.fuso)::date
    ), p.ordem
  loop
    begin
      -- dentro do bloco protegido: se a trava do banco recusar o horário, o cliente novo também é desfeito
      insert into clientes (nome, telefone) values (nome_limpo, tel) on conflict (telefone) do nothing;
      select c.id into id_cliente from clientes c where c.telefone = tel;
      insert into agendamentos (cliente_id, servico_id, inicio, fim, status, origem, nome_informado, pessoa_id)
      values (id_cliente, srv.id, p_inicio, p_inicio + make_interval(mins => duracao), 'marcado', 'link', nome_limpo,
              candidata.pessoa_id);
    exception when exclusion_violation then
      continue;
    end;

    delete from tentativas_publicas where criado_em < p_agora - interval '30 days';
    insert into tentativas_publicas (ip, criado_em) values (p_ip, p_agora);

    return jsonb_build_object('ok', true, 'inicio', to_char(p_inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                              'pessoa', candidata.nome);
  end loop;

  return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
end
$$;

-- Pública: o app instalado antes desta versão chama sem `pessoa` (Sem preferência).
create function agendar_publico(nome text, telefone text, inicio timestamptz, servico uuid default null, pessoa uuid default null)
returns jsonb
language sql volatile security definer set search_path = public
as $$
  select agendar_publico_em(nome, telefone, inicio, now(), ip_cliente(), servico, pessoa)
$$;

revoke execute on function agendar_publico_em(text, text, timestamptz, timestamptz, text, uuid, uuid) from public, anon, authenticated;
grant execute on function agendar_publico(text, text, timestamptz, uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backup v2: o mesmo formato do arquivo do app, agora com pessoas e quem faz o quê.
-- (Assinatura, segurança e permissões iguais às da 0003.)
-- ---------------------------------------------------------------------------
create or replace function exportar_backup(chave text) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(chave_backup_confere(chave), false) then
    raise exception 'chave de backup inválida' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'versao', 2,
    'gerado_em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'clientes', coalesce((select jsonb_agg(to_jsonb(c) order by c.nome) from clientes c), '[]'::jsonb),
    'servicos', coalesce((select jsonb_agg(to_jsonb(s) order by s.nome) from servicos s), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_agg(to_jsonb(p) order by p.ordem) from pessoas p), '[]'::jsonb),
    'pessoa_servicos', coalesce(
      (select jsonb_agg(to_jsonb(ps) order by ps.pessoa_id, ps.servico_id) from pessoa_servicos ps), '[]'::jsonb),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(a) order by a.inicio) from agendamentos a), '[]'::jsonb),
    'horarios_ajuste', coalesce((select jsonb_agg(to_jsonb(h) order by h.inicio) from horarios_ajuste h), '[]'::jsonb),
    'configuracoes', coalesce(
      (select jsonb_agg(to_jsonb(c) - 'backup_chave_hash' - 'backup_ativo') from configuracoes c), '[]'::jsonb)
  );
end
$$;
