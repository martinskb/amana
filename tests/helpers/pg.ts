import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(__dirname, '../..');

export async function novoBanco(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    -- imita os privilégios padrão do Supabase: quem bloqueia é o RLS
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    -- imita auth.uid() do Supabase: lê o "sub" do JWT da requisição
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  await db.exec(readFileSync(resolve(raiz, 'supabase/migrations/0001_init.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(raiz, 'supabase/seed.sql'), 'utf8'));
  return db;
}

export const DONO = '11111111-1111-1111-1111-111111111111';
export const ESTRANHO = '22222222-2222-2222-2222-222222222222';

/** Age como um usuário logado do Supabase (papel authenticated com o id dado). */
export async function comoUsuario(db: PGlite, id: string): Promise<void> {
  await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role authenticated`);
}
