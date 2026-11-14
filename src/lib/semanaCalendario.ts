import { diaDaSemana, somarDias } from './slots';

/** A segunda-feira da semana do calendário (seg–dom) que contém a data "YYYY-MM-DD". */
export function segundaDe(data: string): string {
  const dia = diaDaSemana(data); // 0 = domingo
  return somarDias(data, dia === 0 ? -6 : 1 - dia);
}

/** Os 7 dias da semana que começa na segunda dada, de segunda a domingo. */
export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}
