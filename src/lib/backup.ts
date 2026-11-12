import { COLUNAS_CONFIG, saveConfig } from '../data/configuracoes';
import { executar } from '../data/erros';
import type { SupabaseClient } from '../data/supabase';
import type { Agendamento, Cliente, Config, HorarioAjuste, Servico } from '../types';
import { dataLocal, FUSO } from './slots';

export interface BackupFile {
  versao: 1;
  gerado_em: string;
  clientes: Cliente[];
  servicos: Servico[];
  agendamentos: Agendamento[];
  /** sem backup_ativo (coluna gerada) e sem o hash da chave */
  configuracoes: Omit<Config, 'backup_ativo'>[];
  /** v2: horários fechados e extras. Ausente nos backups da v1. */
  horarios_ajuste?: HorarioAjuste[];
}

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
/** O Supabase devolve no máximo 1000 linhas por requisição; o backup busca em páginas. */
const PAGINA = 1000;

export function backupIsStale(ultimo: string | null, agora: Date): boolean {
  if (!ultimo) return true;
  return agora.getTime() - new Date(ultimo).getTime() > SETE_DIAS;
}

export async function exportBackup(db: SupabaseClient): Promise<BackupFile> {
  async function tudo<T>(tabela: string, colunas = '*'): Promise<T[]> {
    const linhas: T[] = [];
    for (let de = 0; ; de += PAGINA) {
      const pagina = await executar(
        db.from(tabela).select(colunas).order('id').range(de, de + PAGINA - 1).returns<T[]>(),
      );
      linhas.push(...pagina);
      if (pagina.length < PAGINA) return linhas;
    }
  }
  const [clientes, servicos, agendamentos, configuracoes, horarios_ajuste] = await Promise.all([
    tudo<Cliente>('clientes'),
    tudo<Servico>('servicos'),
    tudo<Agendamento>('agendamentos'),
    tudo<Omit<Config, 'backup_ativo'>>('configuracoes', COLUNAS_CONFIG), // sem o hash da chave de backup
    tudo<HorarioAjuste>('horarios_ajuste'),
  ]);
  return { versao: 1, gerado_em: new Date().toISOString(), clientes, servicos, agendamentos, configuracoes, horarios_ajuste };
}

/**
 * Entrega o arquivo ao usuário: menu de compartilhar do iPhone (salvar no iCloud/Drive)
 * ou download. Só registra `ultimo_backup` se o arquivo saiu. Devolve se salvou.
 */
export async function salvarBackup(arquivo: BackupFile, db: SupabaseClient): Promise<boolean> {
  const agora = new Date();
  const nome = `backup-agenda-${dataLocal(agora, FUSO)}.json`;
  const json = JSON.stringify(arquivo, null, 2);
  const file = new File([json], nome, { type: 'application/json' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false; // o usuário cancelou
      throw e; // outro erro (ex.: o Safari exige um toque recente): a tela avisa
    }
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  await saveConfig(db, { ultimo_backup: agora.toISOString() });
  return true;
}
