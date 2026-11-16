import type { HorariosPublicos, ResultadoPublico } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

/** O que a página /#/agendar vê: só horários livres e os dados públicos do negócio. */
export async function getHorariosPublicos(db: SupabaseClient): Promise<HorariosPublicos> {
  return executar(db.rpc('horarios_publicos'));
}

/**
 * Pede o horário; o servidor valida tudo de novo e responde ok ou o motivo da recusa.
 * `pessoa` null: Sem preferência (o banco escolhe).
 */
export async function agendarPublico(
  db: SupabaseClient,
  nome: string,
  telefone: string,
  inicio: string,
  servico: string | null = null,
  pessoa: string | null = null,
): Promise<ResultadoPublico> {
  // só manda o que tem valor: o banco sem a migração 0005/0006 não conhece esses parâmetros
  const params: Record<string, string> = { nome, telefone, inicio };
  if (servico) params.servico = servico;
  if (pessoa) params.pessoa = pessoa;
  return executar(db.rpc('agendar_publico', params));
}
