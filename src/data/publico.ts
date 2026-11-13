import type { HorariosPublicos, ResultadoPublico } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

/** O que a página /#/agendar vê: só horários livres e os dados públicos do negócio. */
export async function getHorariosPublicos(db: SupabaseClient): Promise<HorariosPublicos> {
  return executar(db.rpc('horarios_publicos'));
}

/** Pede o horário; o servidor valida tudo de novo e responde ok ou o motivo da recusa. */
export async function agendarPublico(
  db: SupabaseClient,
  nome: string,
  telefone: string,
  inicio: string,
  servico: string | null = null,
): Promise<ResultadoPublico> {
  // sem serviço, não manda o campo: o banco sem a migração 0005 não conhece esse parâmetro
  const params = servico ? { nome, telefone, inicio, servico } : { nome, telefone, inicio };
  return executar(db.rpc('agendar_publico', params));
}
