import type { Config } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

export async function getConfig(db: SupabaseClient): Promise<Config> {
  return executar(db.from('configuracoes').select('*').eq('id', 1).single<Config>());
}

export async function saveConfig(db: SupabaseClient, parcial: Partial<Config>): Promise<void> {
  await executar(db.from('configuracoes').update(parcial).eq('id', 1));
}
