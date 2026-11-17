import type { AgendaEquipe } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

/** O que a página do link da equipe vê: os clientes de hoje e amanhã da pessoa dona do código. */
export async function getAgendaEquipe(db: SupabaseClient, codigo: string): Promise<AgendaEquipe> {
  return executar(db.rpc('agenda_da_equipe', { codigo: codigo.trim() }));
}

/** Gera (ou troca) o link da pessoa; o antigo para de valer. Devolve o código novo. */
export async function gerarLinkPessoa(db: SupabaseClient, id: string): Promise<string> {
  return executar(db.rpc('gerar_link_pessoa', { p: id }));
}

export async function salvarWhatsappPessoa(db: SupabaseClient, id: string, ligado: boolean): Promise<void> {
  await executar(db.from('pessoas').update({ link_whatsapp: ligado }).eq('id', id));
}
