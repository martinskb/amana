/**
 * Restaura um backup no banco do cliente. Roda no computador do autor:
 *
 *   SUPABASE_DB_URL='postgresql://postgres:SENHA@db.XXXX.supabase.co:5432/postgres' \
 *   SUPABASE_CA_CERT=prod-ca-2021.crt \
 *     npx tsx scripts/restore.ts backup-agenda-2026-11-17.json [--confirmar-substituir]
 *
 * A URL do banco (com senha) fica só no ambiente; nunca no repositório.
 * SUPABASE_CA_CERT aponta para o certificado da CA baixado em Supabase >
 * Project Settings > Database > SSL Configuration; sem ele a conexão não sai,
 * para o certificado do servidor ser sempre verificado.
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
  const ca = process.env.SUPABASE_CA_CERT;
  if (!ca) {
    throw new Error(
      'Defina SUPABASE_CA_CERT com o caminho do certificado da CA (Supabase > Project Settings > Database > SSL Configuration).',
    );
  }

  const arquivo = JSON.parse(readFileSync(caminho, 'utf8'));
  const cliente = new pg.Client({ connectionString: url, ssl: { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true } });
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
