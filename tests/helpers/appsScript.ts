import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const raiz = resolve(__dirname, '../..');

/** Carrega apps-script/logica.js como o Apps Script faz: funções globais, sem import/export. */
export function carregarLogica(extra: Record<string, unknown> = {}): Record<string, any> {
  const ctx = vm.createContext({ ...extra });
  vm.runInContext(readFileSync(resolve(raiz, 'apps-script/logica.js'), 'utf8'), ctx, { filename: 'logica.js' });
  return ctx as Record<string, any>;
}

/** Copia valores vindos do contexto do vm para o contexto do teste (comparação com toEqual). */
export const deVm = <T>(v: T): T => JSON.parse(JSON.stringify(v));
