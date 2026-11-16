import type { AgendamentoCompleto } from '../types';

/** Uma linha da grade de um dia. */
export type Item =
  | { tipo: 'agendamento'; hora: string; agendamento: AgendamentoCompleto }
  /** `pessoas`: ids de quem está livre nesse bloco (pela ordem). */
  | { tipo: 'livre'; hora: string; pessoas?: string[] }
  | { tipo: 'fechado'; hora: string; ajusteId: string };

/** Na semana, livres seguidos viram um grupo "de–até". */
export type ItemSemana = Exclude<Item, { tipo: 'livre' }> | { tipo: 'livres'; de: string; ate: string };

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Une livres seguidos da lista (já ordenada por hora): só emenda quando o horário é exatamente o próximo
 * passo, então almoço e outros buracos quebram o grupo. Agendamentos e fechados também interrompem.
 */
export function agruparLivres(itens: Item[], passoMin: number): ItemSemana[] {
  const saida: ItemSemana[] = [];
  for (const item of itens) {
    const ultimo = saida[saida.length - 1];
    if (item.tipo !== 'livre') saida.push(item);
    else if (ultimo?.tipo === 'livres' && minutos(item.hora) === minutos(ultimo.ate) + passoMin) ultimo.ate = item.hora;
    else saida.push({ tipo: 'livres', de: item.hora, ate: item.hora });
  }
  return saida;
}
