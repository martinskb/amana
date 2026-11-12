import { describe, expect, it } from 'vitest';
import { agruparLivres, type Item } from '../../src/ui/semana';
import type { AgendamentoCompleto } from '../../src/types';

const L = (hora: string): Item => ({ tipo: 'livre', hora });
const F = (hora: string): Item => ({ tipo: 'fechado', hora, ajusteId: 'f' + hora });
const A = (hora: string): Item => ({ tipo: 'agendamento', hora, agendamento: { id: 'a' + hora } as AgendamentoCompleto });

describe('agruparLivres', () => {
  it('une livres seguidos e mantém o resto na ordem', () => {
    expect(agruparLivres([L('10:00'), L('10:30'), A('11:00'), L('14:00')], 30)).toEqual([
      { tipo: 'livres', de: '10:00', ate: '10:30' },
      A('11:00'),
      { tipo: 'livres', de: '14:00', ate: '14:00' },
    ]);
  });

  it('dia todo livre vira um grupo só', () => {
    const horas = Array.from({ length: 20 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
    expect(agruparLivres(horas.map(L), 30)).toEqual([{ tipo: 'livres', de: '09:00', ate: '18:30' }]);
  });

  it('sem livres não cria grupo', () => {
    expect(agruparLivres([A('09:00'), F('09:30')], 30)).toEqual([A('09:00'), F('09:30')]);
  });

  it('lista vazia devolve vazia', () => {
    expect(agruparLivres([], 30)).toEqual([]);
  });

  it('fechado interrompe o grupo', () => {
    expect(agruparLivres([L('10:00'), F('10:30'), L('11:00')], 30)).toEqual([
      { tipo: 'livres', de: '10:00', ate: '10:00' },
      F('10:30'),
      { tipo: 'livres', de: '11:00', ate: '11:00' },
    ]);
  });

  it('um buraco no horário (almoço) quebra o grupo', () => {
    expect(agruparLivres([L('11:00'), L('11:30'), L('14:00'), L('14:30')], 30)).toEqual([
      { tipo: 'livres', de: '11:00', ate: '11:30' },
      { tipo: 'livres', de: '14:00', ate: '14:30' },
    ]);
  });
});
