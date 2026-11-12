import type { Cliente } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

async function porTelefone(db: SupabaseClient, telefone: string): Promise<Cliente | null> {
  return executar(db.from('clientes').select('*').eq('telefone', telefone).maybeSingle<Cliente>());
}

/** Reaproveita o cliente pelo telefone; cria se não existir. */
export async function findOrCreateCliente(db: SupabaseClient, nome: string, telefone: string): Promise<Cliente> {
  const existente = await porTelefone(db, telefone);
  if (existente) return existente;
  try {
    return await executar(db.from('clientes').insert({ nome: nome.trim(), telefone }).select().single<Cliente>());
  } catch (e) {
    // outro cadastro com o mesmo telefone entrou no meio do caminho
    const outro = await porTelefone(db, telefone);
    if (outro) return outro;
    throw e;
  }
}

export async function listClientes(db: SupabaseClient, busca?: string): Promise<Cliente[]> {
  let q = db.from('clientes').select('*').order('nome').limit(200);
  const termo = busca?.replace(/[,()*%\\]/g, ' ').trim();
  if (termo) {
    const digitos = termo.replace(/\D/g, '');
    q = digitos.length >= 3 ? q.or(`nome.ilike.*${termo}*,telefone.like.*${digitos}*`) : q.ilike('nome', `*${termo}*`);
  }
  return executar(q.returns<Cliente[]>());
}
