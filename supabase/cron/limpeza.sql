-- Amana — agendamento da limpeza diária (06:15 UTC).
-- Rodar uma vez no SQL Editor do Supabase, depois da migração 0009. Pode rodar de novo: agendar com
-- o mesmo nome substitui o job anterior.

create extension if not exists pg_cron;

select cron.schedule('amana-limpeza', '15 6 * * *', $$select limpar_dados_antigos()$$);
