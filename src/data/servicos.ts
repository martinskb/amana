import type { Servico } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

export async function listServicos(db: SupabaseClient, opcoes: { soAtivos?: boolean } = {}): Promise<Servico[]> {
  let q = db.from('servicos').select('*').order('nome');
  if (opcoes.soAtivos) q = q.eq('ativo', true);
  return executar(q.returns<Servico[]>());
}

export async function saveServico(db: SupabaseClient, s: Omit<Servico, 'id'> & { id?: string }): Promise<Servico> {
  return executar(db.from('servicos').upsert(s).select().single<Servico>());
}
