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

-- ---------------------------------------------------------------------------
-- Agendamento pelo link (spec v2, seções 5 e 6).

-- Mesma regra de normalizePhone (src/lib/whatsapp.ts); casos em tests/lib/casosTelefone.ts.
create function normalizar_telefone(t text) returns text
language plpgsql immutable
as $$
declare
  texto text := btrim(coalesce(t, ''));
  d text := regexp_replace(btrim(coalesce(t, '')), '\D', '', 'g');
begin
  if left(texto, 1) = '+' and left(d, 2) <> '55' then
    return case when length(d) between 8 and 15 then d end;
  end if;
  if left(d, 2) = '55' and length(d) in (12, 13) then
    return d;
  end if;
  if left(texto, 1) = '+' then
    return null; -- +55 com tamanho errado
  end if;
  if left(d, 1) = '0' then
    d := substr(d, 2);
  end if;
  if length(d) in (10, 11) and left(d, 1) <> '0' then
    return '55' || d;
  end if;
  return null;
end
$$;

-- IP do cliente, do lado do servidor: só cf-connecting-ip, que a Cloudflare do Supabase preenche
-- e recusa quando o cliente tenta mandar (erro 1000). x-forwarded-for e x-real-ip podem ser forjados
-- por quem chama a API: verificado no projeto real em 2026-11-11 (docs/implantacao.md).
create function ip_cliente() returns text
language sql stable
as $$
  select coalesce(nullif(h ->> 'cf-connecting-ip', ''), 'desconhecido')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb as h) x
$$;

-- Interna: recebe `agora` e `ip` para poder ser testada.
create function agendar_publico_em(p_nome text, p_telefone text, p_inicio timestamptz, p_agora timestamptz, p_ip text)
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
  if (select count(*) from tentativas_publicas t
      where t.ip = p_ip and t.criado_em > p_agora - interval '1 hour') >= 3 then
    return jsonb_build_object('ok', false, 'erro', 'limite');
  end if;
  if not exists (select 1 from horarios_livres_em(p_agora) h where h = p_inicio) then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end if;

  insert into clientes (nome, telefone) values (nome_limpo, tel) on conflict (telefone) do nothing;
  select c.id into id_cliente from clientes c where c.telefone = tel;

  begin
    insert into agendamentos (cliente_id, inicio, fim, status, origem)
    values (id_cliente, p_inicio, p_inicio + make_interval(mins => cfg.passo_min), 'marcado', 'link');
  exception when exclusion_violation then
    -- duas pessoas no mesmo horário ao mesmo tempo: a trava do banco deixou só uma passar
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end;

  delete from tentativas_publicas where criado_em < p_agora - interval '30 days';
  insert into tentativas_publicas (ip, criado_em) values (p_ip, p_agora);

  return jsonb_build_object('ok', true, 'inicio', to_char(p_inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
end
$$;

-- Pública: chamada pela página /#/agendar (os nomes dos parâmetros são os do rpc).
create function agendar_publico(nome text, telefone text, inicio timestamptz) returns jsonb
language sql volatile security definer set search_path = public
as $$
  select agendar_publico_em(nome, telefone, inicio, now(), ip_cliente())
$$;

revoke execute on function normalizar_telefone(text) from public, anon, authenticated;
revoke execute on function ip_cliente() from public, anon, authenticated;
revoke execute on function agendar_publico_em(text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function agendar_publico(text, text, timestamptz) to anon, authenticated;
