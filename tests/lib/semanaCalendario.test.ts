import { describe, expect, it } from 'vitest';
import { diasDaSemana, segundaDe } from '../../src/lib/semanaCalendario';

describe('semana do calendário', () => {
  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(segundaDe('2026-11-15')).toBe('2026-11-09');
  });

  it('segunda é a própria segunda', () => {
    expect(segundaDe('2026-11-16')).toBe('2026-11-16');
  });

  it('sábado volta para a segunda da mesma semana', () => {
    expect(segundaDe('2026-11-21')).toBe('2026-11-16');
  });

  it('diasDaSemana devolve 7 dias, de segunda a domingo', () => {
    expect(diasDaSemana('2026-11-16')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('a semana atravessa a virada do mês', () => {
    expect(diasDaSemana('2026-11-30')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
  });
});
