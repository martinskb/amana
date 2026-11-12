-- Agenda Fácil — backup automático no Google Drive (spec backup-drive, seções 3 e 4).
-- Aplicar por cima da 0002.

-- Só o hash da chave fica guardado; a chave aparece uma vez no app e vai para o script do Google.
alter table configuracoes add column backup_chave_hash text;
-- o app lê só isto (nunca o hash)
alter table configuracoes add column backup_ativo boolean generated always as (backup_chave_hash is not null) stored;

-- Interna: confere a chave contra o hash.
create function chave_backup_confere(chave text) returns boolean
language sql stable security definer set search_path = public
as $$
  select c.backup_chave_hash is not null
     and c.backup_chave_hash = encode(sha256(convert_to(coalesce(chave, ''), 'UTF8')), 'hex')
  from configuracoes c where c.id = 1
$$;

-- O dono logado grava uma chave nova (a anterior para de funcionar).
create function definir_chave_backup(chave text) returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not eh_dono() then
    raise exception 'só o dono define a chave de backup' using errcode = '42501';
  end if;
  if char_length(coalesce(chave, '')) < 32 then
    raise exception 'chave de backup curta demais' using errcode = '22023';
  end if;
  update configuracoes set backup_chave_hash = encode(sha256(convert_to(chave, 'UTF8')), 'hex') where id = 1;
end
$$;

-- Lido pelo script do Google com a chave. Mesmo formato do backup em arquivo (v1/v2), sem o hash.
create function exportar_backup(chave text) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(chave_backup_confere(chave), false) then
    raise exception 'chave de backup inválida' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'versao', 1,
    'gerado_em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'clientes', coalesce((select jsonb_agg(to_jsonb(c) order by c.nome) from clientes c), '[]'::jsonb),
    'servicos', coalesce((select jsonb_agg(to_jsonb(s) order by s.nome) from servicos s), '[]'::jsonb),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(a) order by a.inicio) from agendamentos a), '[]'::jsonb),
    'horarios_ajuste', coalesce((select jsonb_agg(to_jsonb(h) order by h.inicio) from horarios_ajuste h), '[]'::jsonb),
    'configuracoes', coalesce(
      (select jsonb_agg(to_jsonb(c) - 'backup_chave_hash' - 'backup_ativo') from configuracoes c), '[]'::jsonb)
  );
end
$$;

-- Chamado pelo script só DEPOIS de a planilha e o JSON estarem salvos no Drive.
create function concluir_backup(chave text) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  n integer;
begin
  if not coalesce(chave_backup_confere(chave), false) then
    raise exception 'chave de backup inválida' using errcode = '42501';
  end if;
  update configuracoes set ultimo_backup = now() where id = 1;
  -- só agendamentos que terminaram há mais de 1 ano; clientes, serviços e ajustes nunca
  delete from agendamentos where fim < now() - interval '1 year';
  get diagnostics n = row_count;
  return jsonb_build_object('apagados', n);
end
$$;

revoke execute on function chave_backup_confere(text) from public, anon, authenticated;
revoke execute on function definir_chave_backup(text) from public, anon, authenticated;
grant execute on function definir_chave_backup(text) to authenticated;
revoke execute on function exportar_backup(text) from public, anon, authenticated;
grant execute on function exportar_backup(text) to anon, authenticated;
revoke execute on function concluir_backup(text) from public, anon, authenticated;
grant execute on function concluir_backup(text) to anon, authenticated;
