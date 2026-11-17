import type { Pessoa } from '../types';
import { executar } from './erros';
import type { SupabaseClient } from './supabase';

type Linha = Omit<Pessoa, 'servicos'> & { pessoa_servicos?: { servico_id: string }[] };

const CAMPOS = 'id, nome, ativo, ordem, folgas, link_codigo, link_whatsapp';

function daLinha({ pessoa_servicos, ...p }: Linha): Pessoa {
  return { ...p, servicos: (pessoa_servicos ?? []).map((s) => s.servico_id) };
}

/** Aparado; vazio vira null (o app mostra "Pessoa N"). O banco recusa mais de 40 caracteres. */
function limparNome(nome: string | null): string | null {
  const n = nome?.trim() ?? '';
  return n === '' ? null : n;
}

async function ligarServicos(db: SupabaseClient, pessoaId: string, servicos: string[]): Promise<void> {
  if (servicos.length === 0) return;
  await executar(db.from('pessoa_servicos').insert(servicos.map((servico_id) => ({ pessoa_id: pessoaId, servico_id }))));
}

/** Todas as pessoas (ativas e desativadas), pela ordem, com os serviços que cada uma faz. */
export async function listPessoas(db: SupabaseClient): Promise<Pessoa[]> {
  const linhas = await executar(
    db.from('pessoas').select(`${CAMPOS}, pessoa_servicos(servico_id)`).order('ordem').returns<Linha[]>(),
  );
  return linhas.map(daLinha);
}

/** Entra no fim da lista (`ordem` = maior + 1). */
export async function criarPessoa(db: SupabaseClient, p: { nome: string | null; servicos: string[] }): Promise<Pessoa> {
  const ultima = await executar(
    db.from('pessoas').select('ordem').order('ordem', { ascending: false }).limit(1).returns<{ ordem: number }[]>(),
  );
  const ordem = (ultima[0]?.ordem ?? 0) + 1;
  const criada = await executar(
    db.from('pessoas').insert({ nome: limparNome(p.nome), ordem }).select(CAMPOS).single<Linha>(),
  );
  await ligarServicos(db, criada.id, p.servicos);
  return { ...daLinha(criada), servicos: [...p.servicos] };
}

/** Grava o nome e troca a lista de serviços que ela faz. */
export async function salvarPessoa(db: SupabaseClient, id: string, p: { nome: string | null; servicos: string[] }): Promise<void> {
  await executar(db.from('pessoas').update({ nome: limparNome(p.nome) }).eq('id', id));
  await executar(db.from('pessoa_servicos').delete().eq('pessoa_id', id));
  await ligarServicos(db, id, p.servicos);
}

export async function salvarFolgasPessoa(db: SupabaseClient, id: string, folgas: string[]): Promise<void> {
  await executar(db.from('pessoas').update({ folgas }).eq('id', id));
}

/** Recusa a última ativa e quem tem cliente marcado daqui para frente. */
export async function desativarPessoa(
  db: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; erro: 'ultima' | 'clientes_futuros' }> {
  return executar(db.rpc('desativar_pessoa', { p: id }));
}

export async function reativarPessoa(db: SupabaseClient, id: string): Promise<void> {
  await executar(db.from('pessoas').update({ ativo: true }).eq('id', id));
}

export async function apagarPessoa(db: SupabaseClient, id: string): Promise<void> {
  await executar(db.from('pessoas').delete().eq('id', id));
}

/** Se ela tem algum agendamento (qualquer data ou status): com histórico, só dá para desativar. */
export async function pessoaTemAgendamentos(db: SupabaseClient, id: string): Promise<boolean> {
  const linhas = await executar(
    db.from('agendamentos').select('id').eq('pessoa_id', id).limit(1).returns<{ id: string }[]>(),
  );
  return linhas.length > 0;
}
