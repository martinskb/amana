-- Amana — tira os dados de demonstração (scripts/demo/demo-popular.sql).
-- Rodar no SQL Editor do Supabase. Só apaga o que tem id 'de300000-...'; o resto fica como estava.

begin;

delete from agendamentos
where cliente_id::text like 'de300000-%' or pessoa_id::text like 'de300000-%';
delete from pessoas where id::text like 'de300000-%';   -- leva pessoa_servicos, extras e link junto
delete from clientes where id::text like 'de300000-%';

-- a primeira pessoa volta a ficar sem nome (como estava antes da demo)
update pessoas set nome = null
where nome = 'Zé' and ordem = (select min(ordem) from pessoas where ativo);

commit;
