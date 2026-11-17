-- Amana — dados de demonstração para gravar o vídeo.
-- Rodar no SQL Editor do Supabase. Pode rodar de novo: apaga a demo anterior e monta outra em volta
-- do dia de hoje (no fuso do negócio). Para tirar tudo: scripts/demo/demo-limpar.sql.
--
-- Não apaga nada que já existia. Tudo da demo tem id começando com 'de300000-' (pessoas e clientes),
-- e os clientes têm telefone 55919999900xx. A primeira pessoa do negócio, se estiver sem nome,
-- passa a se chamar "Zé" (o limpar volta para sem nome).
-- Agendamentos que bateriam com um horário já ocupado são pulados (on conflict do nothing).

begin;

-- 1. limpa a demo anterior
delete from agendamentos
where cliente_id::text like 'de300000-%' or pessoa_id::text like 'de300000-%';
delete from pessoas where id::text like 'de300000-%';
delete from clientes where id::text like 'de300000-%';

-- 2. pessoas: a primeira do negócio vira "Zé"; Rafa e Bia entram depois dela
update pessoas set nome = 'Zé'
where nome is null and ordem = (select min(ordem) from pessoas where ativo);

insert into pessoas (id, nome, ordem)
select v.id::uuid, v.nome, (select coalesce(max(ordem), 0) from pessoas) + v.n
from (values ('de300000-0000-4000-8000-000000000001', 'Rafa', 1),
             ('de300000-0000-4000-8000-000000000002', 'Bia', 2)) as v (id, nome, n);

-- Rafa faz tudo; Bia faz corte e pigmentação
insert into pessoa_servicos (pessoa_id, servico_id)
select 'de300000-0000-4000-8000-000000000001'::uuid, s.id from servicos s where s.ativo
union all
select 'de300000-0000-4000-8000-000000000002'::uuid, s.id from servicos s
where s.ativo and s.nome in ('Corte', 'Pigmentação')
on conflict do nothing;

-- 3. clientes (nomes de Belém; telefones fictícios)
insert into clientes (id, nome, telefone)
select ('de300000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, nome,
       '55919999900' || lpad(n::text, 2, '0')
from (values (1, 'Marcos Tavares'), (2, 'Pedro Henrique'), (3, 'Lucas Baía'),
             (4, 'Thiago Moraes'), (5, 'Rodrigo Pinheiro'), (6, 'Davi Andrade'),
             (7, 'Caio Monteiro'), (8, 'Gabriel Nazaré'), (9, 'Felipe Souza'),
             (10, 'André Lobato'), (11, 'Mateus Cunha'), (12, 'Vinícius Reis'),
             (13, 'Igor Brasil'), (14, 'Samuel Pantoja')) as v (n, nome)
on conflict do nothing;

-- 4. agendamentos em volta de hoje. Quem já passou vira "concluído" (um faltou); o resto fica
--    marcado ou confirmado. Os de origem 'link' aparecem como "novos pelo link" no app.
with cfg as (
  select fuso, (now() at time zone fuso)::date as hoje from configuracoes where id = 1
),
plano (dia, hora, quem, cli, servico, confirmado, origem, falta) as (
  values
    -- hoje
    (0, '09:00', 'ze',   1, 'Corte',         true,  'dono', false),
    (0, '10:00', 'ze',   2, 'Corte + barba', true,  'dono', true),
    (0, '11:30', 'ze',   3, 'Barba',         false, 'link', false),
    (0, '14:00', 'ze',   4, 'Corte',         true,  'dono', false),
    (0, '16:00', 'ze',   5, 'Corte + barba', false, 'dono', false),
    (0, '09:30', 'rafa', 6, 'Barba',         true,  'dono', false),
    (0, '11:00', 'rafa', 7, 'Corte',         false, 'link', false),
    (0, '15:00', 'rafa', 8, 'Corte + barba', true,  'dono', false),
    (0, '17:30', 'rafa', 9, 'Corte',         false, 'dono', false),
    (0, '10:00', 'bia', 10, 'Pigmentação',   true,  'dono', false),
    (0, '14:30', 'bia', 11, 'Corte',         false, 'link', false),
    -- amanhã
    (1, '09:00', 'ze',  12, 'Corte',         false, 'dono', false),
    (1, '11:00', 'ze',  13, 'Corte + barba', false, 'link', false),
    (1, '15:00', 'ze',  14, 'Barba',         false, 'dono', false),
    (1, '10:00', 'rafa', 1, 'Corte + barba', false, 'dono', false),
    (1, '16:00', 'rafa', 2, 'Corte',         false, 'dono', false),
    (1, '09:30', 'bia',  3, 'Pigmentação',   false, 'dono', false),
    (1, '14:00', 'bia',  4, 'Corte',         false, 'link', false),
    -- resto da semana
    (2, '10:00', 'ze',   5, 'Corte',         false, 'dono', false),
    (2, '15:00', 'rafa', 6, 'Corte + barba', false, 'dono', false),
    (2, '11:00', 'bia',  7, 'Corte',         false, 'dono', false),
    (3, '09:00', 'ze',   8, 'Corte + barba', false, 'dono', false),
    (3, '14:00', 'rafa', 9, 'Barba',         false, 'dono', false),
    (4, '10:30', 'ze',  10, 'Corte',         false, 'dono', false),
    (4, '16:00', 'bia', 11, 'Pigmentação',   false, 'dono', false),
    (5, '09:00', 'rafa',12, 'Corte',         false, 'dono', false)
),
linhas as (
  select
    ('de300000-0000-4000-8000-0000000001' || lpad(p.cli::text, 2, '0'))::uuid as cliente_id,
    s.id as servico_id,
    case p.quem
      when 'rafa' then 'de300000-0000-4000-8000-000000000001'::uuid
      when 'bia'  then 'de300000-0000-4000-8000-000000000002'::uuid
      else (select id from pessoas where ativo and id::text not like 'de300000-%' order by ordem limit 1)
    end as pessoa_id,
    ((c.hoje + p.dia) + p.hora::time) at time zone c.fuso as inicio,
    s.duracao_min,
    p.confirmado, p.origem, p.falta
  from plano p
  cross join cfg c
  join lateral (select id, duracao_min from servicos where nome = p.servico order by ativo desc limit 1) s on true
)
insert into agendamentos (cliente_id, servico_id, pessoa_id, inicio, fim, status, origem)
select cliente_id, servico_id, pessoa_id, inicio, inicio + make_interval(mins => duracao_min),
       case
         when inicio + make_interval(mins => duracao_min) <= now() and falta then 'faltou'
         when inicio + make_interval(mins => duracao_min) <= now() then 'concluido'
         when confirmado then 'confirmado'
         else 'marcado'
       end,
       origem
from linhas
order by inicio
on conflict do nothing;

commit;

-- confere: quantos entraram por pessoa
select coalesce(p.nome, 'Pessoa') as pessoa, count(*) as agendamentos
from agendamentos a join pessoas p on p.id = a.pessoa_id
where a.cliente_id::text like 'de300000-%'
group by p.nome, p.ordem order by p.ordem;
