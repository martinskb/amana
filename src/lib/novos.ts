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

/**
 * O estado depois de ver `idsVistos`. Sem nenhum novo restante, o corte anda até o
 * `criado_em` mais recente buscado e `vistos` esvazia; senão, `vistos` guarda só ids
 * de agendamentos buscados que ainda são futuros.
 */
export function aposVer(
  s: Vistos,
  idsVistos: string[],
  novosRestantes: AgendamentoCompleto[],
  todosBuscados: AgendamentoCompleto[],
  agora: Date = new Date(),
): Vistos {
  if (novosRestantes.length === 0) {
    const corte = todosBuscados.reduce((max, a) => (ms(a.criado_em) > ms(max) ? a.criado_em : max), s.corte);
    return { corte, vistos: [] };
  }
  const futuros = new Set(todosBuscados.filter((a) => ms(a.inicio) > agora.getTime()).map((a) => a.id));
  const vistos = [...new Set([...s.vistos, ...idsVistos])].filter((id) => futuros.has(id));
  return { corte: s.corte, vistos };
}
