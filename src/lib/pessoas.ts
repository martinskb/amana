import type { Pessoa } from '../types';

/** As pessoas ativas, pela ordem. */
export function ativas(pessoas: Pessoa[]): Pessoa[] {
  return pessoas.filter((p) => p.ativo).sort((a, b) => a.ordem - b.ordem);
}

/** Com uma pessoa ativa só, nada de pessoa aparece fora do capítulo Pessoas. */
export function variasPessoas(pessoas: Pessoa[]): boolean {
  return pessoas.filter((p) => p.ativo).length >= 2;
}

/** O nome; sem nome, "Pessoa N" pela posição entre as ativas; desativada sem nome, "Pessoa (desativada)". */
export function nomeDaPessoa(p: Pessoa, pessoas: Pessoa[]): string {
  if (p.nome) return p.nome;
  if (!p.ativo) return 'Pessoa (desativada)';
  return `Pessoa ${ativas(pessoas).findIndex((x) => x.id === p.id) + 1}`;
}

/** Sem serviço escolhido, ou sem serviço ativo no negócio, todo mundo "faz o serviço". */
export function fazServico(p: Pessoa, servicoId: string | null, servicosAtivos: number): boolean {
  if (servicoId === null || servicosAtivos === 0) return true;
  return p.servicos.includes(servicoId);
}
