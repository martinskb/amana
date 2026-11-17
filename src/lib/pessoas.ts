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

/**
 * Quem pode atender de `inicio` a `fim`: ativa, faz o serviço e não tem cliente ativo (marcado ou
 * confirmado) cruzando esse intervalo. `ignorar`: o agendamento que está sendo editado. Pela ordem.
 * É a mesma conta da trava do banco; expediente e folga não entram (o dono marca onde quiser).
 */
export function livresPara(args: {
  pessoas: Pessoa[];
  servicoId: string | null;
  servicosAtivos: number;
  inicio: Date;
  fim: Date;
  agendamentos: readonly { id: string; pessoa_id: string; inicio: string; fim: string; status: string }[];
  ignorar?: string;
}): Pessoa[] {
  const ini = args.inicio.getTime();
  const fim = args.fim.getTime();
  const ocupadas = new Set(
    args.agendamentos
      .filter(
        (a) =>
          a.id !== args.ignorar &&
          (a.status === 'marcado' || a.status === 'confirmado') &&
          new Date(a.inicio).getTime() < fim &&
          ini < new Date(a.fim).getTime(),
      )
      .map((a) => a.pessoa_id),
  );
  return ativas(args.pessoas).filter((p) => fazServico(p, args.servicoId, args.servicosAtivos) && !ocupadas.has(p.id));
}

/** O nome que entra nas mensagens ("às 10h com Ana"): só com 2+ ativas e se ela tem nome. */
export function nomeNaMensagem(pessoaId: string | null | undefined, pessoas: Pessoa[]): string | null {
  if (!pessoaId || !variasPessoas(pessoas)) return null;
  return pessoas.find((p) => p.id === pessoaId)?.nome ?? null;
}

/** "Ana · João · Bia +17": até `max` nomes; o resto vira "+N" (o livre não estoura a linha com muita gente). */
export function resumoNomes(nomes: string[], max = 3): string {
  if (nomes.length <= max) return nomes.join(' · ');
  return `${nomes.slice(0, max).join(' · ')} +${nomes.length - max}`;
}
