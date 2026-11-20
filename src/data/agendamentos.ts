import { FUSO, instanteLocal, somarDias } from '../lib/slots';
import type { Agendamento, AgendamentoCompleto, Status } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

const CAMPOS = 'id, cliente_id, servico_id, inicio, fim, status, observacao, origem, pessoa_id';
type LinhaCompleta = Omit<AgendamentoCompleto, 'cliente'> & { cliente: AgendamentoCompleto['cliente'] | null };

/** Sem cadastro (cliente apagado pela limpeza), vale o nome guardado no agendamento. */
function comCliente(l: LinhaCompleta): AgendamentoCompleto {
  return { ...l, cliente: l.cliente ?? { nome: l.cliente_nome ?? 'Cliente', telefone: null } };
}

const COMPLETO = `${CAMPOS}, cliente_nome, nome_informado, criado_em, cliente:clientes(nome,telefone), servico:servicos(nome)`;

/** Agendamentos com início entre 00:00 de `de` e 24:00 de `ate`, em hora local do negócio. */
export async function listAgendamentos(db: SupabaseClient, de: string, ate: string): Promise<AgendamentoCompleto[]> {
  return executar(
    db
      .from('agendamentos')
      .select(COMPLETO)
      .gte('inicio', instanteLocal(de, '00:00', FUSO).toISOString())
      .lt('inicio', instanteLocal(somarDias(ate, 1), '00:00', FUSO).toISOString())
      .order('inicio')
      .returns<LinhaCompleta[]>(),
  ).then((ls) => ls.map(comCliente));
}

export async function listAgendamentosDoCliente(db: SupabaseClient, clienteId: string): Promise<AgendamentoCompleto[]> {
  return executar(
    db
      .from('agendamentos')
      .select(COMPLETO)
      .eq('cliente_id', clienteId)
      .order('inicio', { ascending: false })
      .returns<LinhaCompleta[]>(),
  ).then((ls) => ls.map(comCliente));
}

/** Agendamentos feitos pelo link depois de `desde` (qualquer data de atendimento), sem os cancelados. */
export async function listNovosPeloLink(db: SupabaseClient, desde: string): Promise<AgendamentoCompleto[]> {
  return executar(
    db
      .from('agendamentos')
      .select(COMPLETO)
      .eq('origem', 'link')
      .gt('criado_em', desde)
      .neq('status', 'cancelado')
      .order('inicio')
      .returns<LinhaCompleta[]>(),
  ).then((ls) => ls.map(comCliente));
}

/** Clientes ativos (marcado/confirmado) da pessoa de agora em diante, pela hora. */
export async function listAgendamentosFuturosDaPessoa(db: SupabaseClient, pessoaId: string): Promise<AgendamentoCompleto[]> {
  return executar(
    db
      .from('agendamentos')
      .select(COMPLETO)
      .eq('pessoa_id', pessoaId)
      .in('status', ['marcado', 'confirmado'])
      .gte('inicio', new Date().toISOString())
      .order('inicio')
      .returns<LinhaCompleta[]>(),
  ).then((ls) => ls.map(comCliente));
}

/** Sem `pessoa_id`, o banco põe a primeira pessoa livre no horário. */
export async function criarAgendamento(
  db: SupabaseClient,
  a: Omit<Agendamento, 'id' | 'pessoa_id'> & { pessoa_id?: string },
): Promise<Agendamento> {
  return executar(db.from('agendamentos').insert(a).select(CAMPOS).single<Agendamento>());
}

export async function editarAgendamento(
  db: SupabaseClient,
  id: string,
  campos: Partial<Pick<Agendamento, 'servico_id' | 'inicio' | 'fim' | 'observacao' | 'pessoa_id'>>,
): Promise<void> {
  await executar(db.from('agendamentos').update(campos).eq('id', id));
}

export async function mudarStatus(db: SupabaseClient, id: string, status: Status): Promise<void> {
  await executar(db.from('agendamentos').update({ status }).eq('id', id));
}
