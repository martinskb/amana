import { describe, expect, it } from 'vitest';
import { resumoExpediente, validarExpediente } from '../../src/lib/expediente';
import type { Expediente } from '../../src/types';

const util = [{ inicio: '09:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];
const vazio: Expediente = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

describe('resumoExpediente', () => {
  it('seg a sex iguais, sábado diferente e domingo fechado viram 3 linhas, de segunda a domingo', () => {
    const e: Expediente = { ...vazio, 1: util, 2: util, 3: util, 4: util, 5: util, 6: [{ inicio: '09:00', fim: '13:00' }] };
    expect(resumoExpediente(e)).toEqual([
      { dias: [1, 2, 3, 4, 5], rotulo: 'seg a sex', horario: '9h–12h · 14h–18h' },
      { dias: [6], rotulo: 'sábado', horario: '9h–13h' },
      { dias: [0], rotulo: 'domingo', horario: 'fechado' },
    ]);
  });

  it('dias iguais que não são vizinhos ficam em linhas separadas', () => {
    const outro = [{ inicio: '10:00', fim: '16:30' }];
    const e: Expediente = { ...vazio, 1: util, 2: outro, 3: util };
    const linhas = resumoExpediente(e);
    expect(linhas.slice(0, 3)).toEqual([
      { dias: [1], rotulo: 'segunda', horario: '9h–12h · 14h–18h' },
      { dias: [2], rotulo: 'terça', horario: '10h–16h30' },
      { dias: [3], rotulo: 'quarta', horario: '9h–12h · 14h–18h' },
    ]);
    // quinta a domingo, todos fechados, viram uma linha só
    expect(linhas[3]).toEqual({ dias: [4, 5, 6, 0], rotulo: 'qui a dom', horario: 'fechado' });
  });

  it('dois dias vizinhos iguais: "sáb e dom"; a ordem dos intervalos não importa', () => {
    const e: Expediente = { ...vazio, 1: util, 2: util, 3: util, 4: util, 5: util, 6: [...util].reverse(), 0: util };
    expect(resumoExpediente(e)).toEqual([{ dias: [1, 2, 3, 4, 5, 6, 0], rotulo: 'seg a dom', horario: '9h–12h · 14h–18h' }]);
    const f: Expediente = { ...vazio, 1: util, 2: util, 3: util, 4: util, 5: util };
    expect(resumoExpediente(f)[1]).toEqual({ dias: [6, 0], rotulo: 'sáb e dom', horario: 'fechado' });
  });
});

describe('validarExpediente', () => {
  it('aceita o expediente certo e dia fechado', () => {
    expect(validarExpediente({ ...vazio, 2: util })).toBeNull();
  });

  it('as mensagens são as de antes, com o nome do dia', () => {
    expect(validarExpediente({ ...vazio, 2: [{ inicio: '09:00', fim: '' }] })).toBe('Terça: Preencha início e fim.');
    expect(validarExpediente({ ...vazio, 2: [{ inicio: '09:00', fim: '08:00' }] })).toBe('Terça: O fim precisa ser depois do início.');
    expect(validarExpediente({ ...vazio, 0: [{ inicio: '09:00', fim: '12:00' }, { inicio: '11:00', fim: '13:00' }] })).toBe(
      'Domingo: Os intervalos não podem se sobrepor.',
    );
  });
});
