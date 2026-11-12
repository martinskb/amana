import type { BackupFile } from '../src/lib/backup';

/** Executa SQL com parâmetros ($1, $2…). No script real é o `pg`; nos testes, o PGlite. */
export type Consulta = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

export class BancoNaoVazioError extends Error {
  constructor(public linhas: number) {
    super(`O banco já tem ${linhas} registro(s). Rode de novo com --confirmar-substituir para apagar tudo e restaurar.`);
    this.name = 'BancoNaoVazioError';
  }
}

// Colunas aceitas por tabela (o nome das colunas nunca vem do arquivo direto para o SQL).
const COLUNAS = {
  servicos: ['id', 'nome', 'duracao_min', 'ativo'],
  clientes: ['id', 'nome', 'telefone', 'criado_em'],
  agendamentos: ['id', 'cliente_id', 'servico_id', 'inicio', 'fim', 'status', 'observacao', 'origem', 'criado_em', 'nome_informado'],
  configuracoes: [
    'nome_negocio', 'fuso', 'expediente', 'folgas', 'passo_min', 'antecedencia_min',
    'modelo_livres', 'modelo_lembrete', 'ultimo_backup',
    'dias_abertos', 'link_ativo', 'telefone_negocio', 'modelo_cancelamento',
  ],
  horarios_ajuste: ['id', 'inicio', 'tipo', 'criado_em'],
} as const;
const JSON_COLS = new Set(['expediente', 'folgas']);
type Tabela = keyof typeof COLUNAS;

async function inserir(q: Consulta, tabela: Tabela, linhas: object[]) {
  for (const linha of linhas) {
    const r = linha as Record<string, unknown>;
    const cols = COLUNAS[tabela].filter((c) => r[c] !== undefined);
    const valores = cols.map((c) => (JSON_COLS.has(c) ? JSON.stringify(r[c]) : r[c]));
    const marcadores = cols.map((_, i) => `$${i + 1}`).join(', ');
    await q(`insert into ${tabela} (${cols.join(', ')}) values (${marcadores})`, valores);
  }
}

/** Restaura um backup numa transação. Banco com dados só é substituído com confirmação. */
export async function restaurar(q: Consulta, arquivo: BackupFile, opcoes: { confirmarSubstituir: boolean }): Promise<void> {
  if (arquivo?.versao !== 1) throw new Error(`Arquivo de backup com versão desconhecida: ${String(arquivo?.versao)}`);
  if (arquivo.configuracoes?.length !== 1) {
    throw new Error('O backup precisa ter exatamente uma linha de configurações; arquivo incompleto, nada foi alterado.');
  }

  await q('begin');
  try {
    const { rows } = await q(
      'select (select count(*) from clientes) + (select count(*) from servicos) + (select count(*) from agendamentos) as n',
    );
    const existentes = Number((rows[0] as { n: number | string }).n);
    if (existentes > 0 && !opcoes.confirmarSubstituir) throw new BancoNaoVazioError(existentes);

    await q('delete from horarios_ajuste');
    await q('delete from agendamentos');
    await q('delete from clientes');
    await q('delete from servicos');
    await q('delete from configuracoes');

    await inserir(q, 'servicos', arquivo.servicos);
    await inserir(q, 'clientes', arquivo.clientes);
    await inserir(q, 'agendamentos', arquivo.agendamentos);
    await inserir(q, 'configuracoes', arquivo.configuracoes);
    await inserir(q, 'horarios_ajuste', arquivo.horarios_ajuste ?? []);
    await q('commit');
  } catch (e) {
    await q('rollback');
    throw e;
  }
}
