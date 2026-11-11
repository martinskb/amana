import { FUSO, instanteLocal, somarDias } from '../lib/slots';
import type { Agendamento, Status } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

const CAMPOS = 'id, cliente_id, servico_id, inicio, fim, status, observacao';

/** Agendamentos com início entre 00:00 de `de` e 24:00 de `ate`, em hora local do negócio. */
export async function listAgendamentos(db: SupabaseClient, de: string, ate: string): Promise<Agendamento[]> {
  return executar(
    db
      .from('agendamentos')
      .select(CAMPOS)
      .gte('inicio', instanteLocal(de, '00:00', FUSO).toISOString())
      .lt('inicio', instanteLocal(somarDias(ate, 1), '00:00', FUSO).toISOString())
      .order('inicio')
      .returns<Agendamento[]>(),
  );
}

export async function listAgendamentosDoCliente(db: SupabaseClient, clienteId: string): Promise<Agendamento[]> {
  return executar(
    db.from('agendamentos').select(CAMPOS).eq('cliente_id', clienteId).order('inicio', { ascending: false }).returns<Agendamento[]>(),
  );
}

export async function criarAgendamento(db: SupabaseClient, a: Omit<Agendamento, 'id'>): Promise<Agendamento> {
  return executar(db.from('agendamentos').insert(a).select(CAMPOS).single<Agendamento>());
}

export async function editarAgendamento(
  db: SupabaseClient,
  id: string,
  campos: Partial<Pick<Agendamento, 'servico_id' | 'inicio' | 'fim' | 'observacao'>>,
): Promise<void> {
  await executar(db.from('agendamentos').update(campos).eq('id', id));
}

export async function mudarStatus(db: SupabaseClient, id: string, status: Status): Promise<void> {
  await executar(db.from('agendamentos').update({ status }).eq('id', id));
}
