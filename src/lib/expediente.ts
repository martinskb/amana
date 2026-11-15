import type { DiaSemana, Expediente, Intervalo } from '../types';
import { horaCurta } from './slots';

/** Os dias na ordem do calendário do app: segunda a domingo (domingo por último). */
export const DIAS_SEMANA: { dia: DiaSemana; nome: string; extenso: string; curto: string }[] = [
  { dia: 1, nome: 'Segunda', extenso: 'segunda', curto: 'seg' },
  { dia: 2, nome: 'Terça', extenso: 'terça', curto: 'ter' },
  { dia: 3, nome: 'Quarta', extenso: 'quarta', curto: 'qua' },
  { dia: 4, nome: 'Quinta', extenso: 'quinta', curto: 'qui' },
  { dia: 5, nome: 'Sexta', extenso: 'sexta', curto: 'sex' },
  { dia: 6, nome: 'Sábado', extenso: 'sábado', curto: 'sáb' },
  { dia: 0, nome: 'Domingo', extenso: 'domingo', curto: 'dom' },
];

const INFO = new Map(DIAS_SEMANA.map((d) => [d.dia, d]));
export const infoDia = (dia: DiaSemana) => INFO.get(dia)!;

/** Os intervalos em ordem de início (é como o expediente é gravado). */
export function ordenarIntervalos(lista: Intervalo[]): Intervalo[] {
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** "9h–12h · 14h–18h", ou "fechado" sem nenhum intervalo. */
export function horarioDoDia(lista: Intervalo[]): string {
  if (lista.length === 0) return 'fechado';
  return ordenarIntervalos(lista)
    .map((iv) => `${horaCurta(iv.inicio)}–${horaCurta(iv.fim)}`)
    .join(' · ');
}

/** "terça" para um dia; "sáb e dom" para dois; "seg a sex" para três ou mais (dias vizinhos). */
export function rotuloDosDias(dias: DiaSemana[]): string {
  const primeiro = infoDia(dias[0]);
  if (dias.length === 1) return primeiro.extenso;
  const ultimo = infoDia(dias[dias.length - 1]);
  return `${primeiro.curto} ${dias.length === 2 ? 'e' : 'a'} ${ultimo.curto}`;
}

/**
 * O expediente em linhas, de segunda a domingo. Dias vizinhos com os mesmos intervalos viram uma linha
 * só ("seg a sex"); dias iguais que não são vizinhos ficam separados.
 */
export function resumoExpediente(e: Expediente): { dias: DiaSemana[]; rotulo: string; horario: string }[] {
  const grupos: { dias: DiaSemana[]; horario: string }[] = [];
  for (const { dia } of DIAS_SEMANA) {
    const horario = horarioDoDia(e[dia]);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.horario === horario) ultimo.dias.push(dia);
    else grupos.push({ dias: [dia], horario });
  }
  return grupos.map((g) => ({ dias: g.dias, rotulo: rotuloDosDias(g.dias), horario: g.horario }));
}

/** Cada dia: início e fim preenchidos, fim depois do início e sem sobreposição. Devolve a 1ª mensagem de erro. */
export function validarExpediente(e: Expediente): string | null {
  for (const { dia, nome } of DIAS_SEMANA) {
    const lista = ordenarIntervalos(e[dia]);
    for (const [i, iv] of lista.entries()) {
      if (!iv.inicio || !iv.fim) return `${nome}: Preencha início e fim.`;
      if (iv.fim <= iv.inicio) return `${nome}: O fim precisa ser depois do início.`;
      if (i > 0 && iv.inicio < lista[i - 1].fim) return `${nome}: Os intervalos não podem se sobrepor.`;
    }
  }
  return null;
}
