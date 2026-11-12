import type { Config } from '../types';
import { executar, SemAcessoError } from './erros';
import type { SupabaseClient } from './supabase';

/** Colunas de configuracoes que o app e o backup manual leem. Nunca inclui backup_chave_hash. */
export const COLUNAS_CONFIG = [
  'id', 'nome_negocio', 'fuso', 'expediente', 'folgas', 'passo_min', 'antecedencia_min',
  'modelo_livres', 'modelo_lembrete', 'ultimo_backup', 'dias_abertos', 'link_ativo',
  'telefone_negocio', 'modelo_cancelamento',
].join(', ');

export async function getConfig(db: SupabaseClient): Promise<Config> {
  const config = await executar(
    db.from('configuracoes').select(`${COLUNAS_CONFIG}, backup_ativo`).eq('id', 1).maybeSingle<Config>(),
  );
  if (!config) throw new SemAcessoError();
  return config;
}

export async function saveConfig(db: SupabaseClient, parcial: Partial<Config>): Promise<void> {
  await executar(db.from('configuracoes').update(parcial).eq('id', 1));
}

/** Grava uma chave nova de backup (só o dono logado); a anterior para de funcionar. */
export async function definirChaveBackup(db: SupabaseClient, chave: string): Promise<void> {
  await executar(db.rpc('definir_chave_backup', { chave }));
}
