import { FUSO, instanteLocal, somarDias } from '../lib/slots';
import type { HorarioAjuste } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

/** Horários fechados e extras com início entre 00:00 de `de` e 24:00 de `ate`, em hora local. */
export async function listAjustes(db: SupabaseClient, de: string, ate: string): Promise<HorarioAjuste[]> {
  return executar(
    db
      .from('horarios_ajuste')
      .select('id, inicio, tipo')
      .gte('inicio', instanteLocal(de, '00:00', FUSO).toISOString())
      .lt('inicio', instanteLocal(somarDias(ate, 1), '00:00', FUSO).toISOString())
      .order('inicio')
      .returns<HorarioAjuste[]>(),
  );
}

export async function fecharHorario(db: SupabaseClient, inicio: string): Promise<void> {
  await executar(db.from('horarios_ajuste').insert({ inicio, tipo: 'fechado' }));
}

export async function criarExtra(db: SupabaseClient, inicio: string): Promise<void> {
  await executar(db.from('horarios_ajuste').insert({ inicio, tipo: 'extra' }));
}

export async function removerAjuste(db: SupabaseClient, id: string): Promise<void> {
  await executar(db.from('horarios_ajuste').delete().eq('id', id));
}
