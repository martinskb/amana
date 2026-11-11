import type { Config } from '../types';
import { executar, SemAcessoError } from './erros';
import type { SupabaseClient } from './supabase';

export async function getConfig(db: SupabaseClient): Promise<Config> {
  const config = await executar(db.from('configuracoes').select('*').eq('id', 1).maybeSingle<Config>());
  if (!config) throw new SemAcessoError();
  return config;
}

export async function saveConfig(db: SupabaseClient, parcial: Partial<Config>): Promise<void> {
  await executar(db.from('configuracoes').update(parcial).eq('id', 1));
}
