import type { AgendamentoCompleto } from '../types';

/** O que o aparelho guarda sobre os agendamentos pelo link que o dono já viu. */
export interface Vistos {
  /** Só conta como novo o que foi criado depois deste instante. */
  corte: string;
  /** Ids já vistos (abertos, com status mudado ou "Entendi") criados depois do corte. */
  vistos: string[];
}

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Novo pelo link: origem link, criado depois do corte, marcado ou confirmado,
 * com o horário ainda no futuro e ainda não visto.
 */
export function ehNovo(a: AgendamentoCompleto, s: Vistos & { agora: Date }): boolean {
  return (
    a.origem === 'link' &&
    ms(a.criado_em) > ms(s.corte) &&
    (a.status === 'marcado' || a.status === 'confirmado') &&
    ms(a.inicio) > s.agora.getTime() &&
    !s.vistos.includes(a.id)
  );
}

/** Teto de segurança para ids de `vistos` que nenhuma busca conhece (ex.: cancelados). */
const MAX_VISTOS = 200;

/**
 * O estado depois de ver os agendamentos `vistosAgora` (o próprio agendamento aberto, mesmo
 * que a busca de novos ainda não o tenha trazido). Sem nenhum novo restante, o corte anda até
 * o `criado_em` mais recente buscado. Em `vistos` fica cada id visto, menos os que se sabe
 * (pelos dados em mãos) que já passaram ou que ficaram até o corte; ids que nenhuma busca
 * conhece ficam, pois a busca pode só estar atrasada.
 */
export function aposVer(
  s: Vistos,
  vistosAgora: AgendamentoCompleto[],
  novosRestantes: AgendamentoCompleto[],
  todosBuscados: AgendamentoCompleto[],
  agora: Date = new Date(),
): Vistos {
  const corte =
    novosRestantes.length === 0
      ? todosBuscados.reduce((max, a) => (ms(a.criado_em) > ms(max) ? a.criado_em : max), s.corte)
      : s.corte;
  const conhecidos = new Map([...todosBuscados, ...vistosAgora].map((a) => [a.id, a] as const));
  const vistos = [...new Set([...s.vistos, ...vistosAgora.map((a) => a.id)])].filter((id) => {
    const a = conhecidos.get(id);
    return !a || (ms(a.inicio) > agora.getTime() && ms(a.criado_em) > ms(corte));
  });
  return { corte, vistos: vistos.slice(-MAX_VISTOS) };
}
