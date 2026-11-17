import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(__dirname, '../..');

const MIGRACOES = [
  '0001_init.sql',
  '0002_link_publico.sql',
  '0003_backup_drive.sql',
  '0004_link_seguranca.sql',
  '0005_servico_no_link.sql',
  '0006_pessoas.sql',
  '0007_link_equipe.sql',
];

/** Aplica uma migração pelo número (1 = 0001). */
export async function aplicarMigracao(db: PGlite, n: number): Promise<void> {
  await db.exec(readFileSync(resolve(raiz, 'supabase/migrations', MIGRACOES[n - 1]), 'utf8'));
}

/** Banco com as migrações até `ate` (padrão: todas) e o seed. */
export async function novoBanco(ate = MIGRACOES.length): Promise<PGlite> {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    -- imita os privilégios padrão do Supabase: quem bloqueia é o RLS
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    -- imita auth.uid() do Supabase: lê o "sub" do JWT da requisição
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  for (let n = 1; n <= ate; n++) await aplicarMigracao(db, n);
  await db.exec(readFileSync(resolve(raiz, 'supabase/seed.sql'), 'utf8'));
  return db;
}

export const DONO = '11111111-1111-1111-1111-111111111111';
export const ESTRANHO = '22222222-2222-2222-2222-222222222222';

/** Age como um usuário logado do Supabase (papel authenticated com o id dado). */
export async function comoUsuario(db: PGlite, id: string): Promise<void> {
  await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role authenticated`);
}
