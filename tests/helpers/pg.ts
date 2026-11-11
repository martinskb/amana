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
  `);
  await db.exec(readFileSync(resolve(raiz, 'supabase/migrations/0001_init.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(raiz, 'supabase/seed.sql'), 'utf8'));
  return db;
}
