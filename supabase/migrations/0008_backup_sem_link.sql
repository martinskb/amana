-- Amana — 0008: o backup não leva o código do link da equipe.
-- Aplicar por cima da 0007, sem apagar dados.
--
-- Quem pegasse o arquivo do backup conseguiria abrir a agenda das pessoas com o código. Agora o
-- backup do Drive sai sem `link_codigo` (o resto igual à 0006); depois de restaurar, o dono cria
-- os links de novo em Ajustes.

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
    'pessoas', coalesce((select jsonb_agg(to_jsonb(p) - 'link_codigo' order by p.ordem) from pessoas p), '[]'::jsonb),
    'pessoa_servicos', coalesce(
      (select jsonb_agg(to_jsonb(ps) order by ps.pessoa_id, ps.servico_id) from pessoa_servicos ps), '[]'::jsonb),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(a) order by a.inicio) from agendamentos a), '[]'::jsonb),
    'horarios_ajuste', coalesce((select jsonb_agg(to_jsonb(h) order by h.inicio) from horarios_ajuste h), '[]'::jsonb),
    'configuracoes', coalesce(
      (select jsonb_agg(to_jsonb(c) - 'backup_chave_hash' - 'backup_ativo') from configuracoes c), '[]'::jsonb)
  );
end
$$;
