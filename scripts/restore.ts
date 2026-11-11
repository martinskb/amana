/**
 * Restaura um backup no banco do cliente. Roda no computador do autor:
 *
 *   SUPABASE_DB_URL='postgresql://postgres:SENHA@db.XXXX.supabase.co:5432/postgres' \
 *     npx tsx scripts/restore.ts backup-agenda-2026-11-17.json [--confirmar-substituir]
 *
 * A URL do banco (com senha) fica só no ambiente; nunca no repositório.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { BancoNaoVazioError, restaurar } from './restaurar';

async function main() {
  const args = process.argv.slice(2);
  const caminho = args.find((a) => !a.startsWith('--'));
  const confirmarSubstituir = args.includes('--confirmar-substituir');
  const url = process.env.SUPABASE_DB_URL;

  if (!caminho) throw new Error('Uso: npx tsx scripts/restore.ts <arquivo.json> [--confirmar-substituir]');
  if (!url) throw new Error('Defina SUPABASE_DB_URL no ambiente (Supabase > Project Settings > Database).');

  const arquivo = JSON.parse(readFileSync(caminho, 'utf8'));
  const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    await restaurar((sql, params) => cliente.query(sql, params as unknown[]), arquivo, { confirmarSubstituir });
    console.log(
      `Restaurado: ${arquivo.clientes.length} clientes, ${arquivo.servicos.length} serviços, ${arquivo.agendamentos.length} agendamentos.`,
    );
  } finally {
    await cliente.end();
  }
}

main().catch((e) => {
  console.error(e instanceof BancoNaoVazioError ? e.message : `Erro: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
