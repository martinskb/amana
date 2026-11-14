import { describe, expect, it } from 'vitest';
import { aposVer, ehNovo } from '../../src/lib/novos';
import type { AgendamentoCompleto } from '../../src/types';

const AGORA = new Date('2026-11-17T11:00:00Z');
const CORTE = '2026-11-16T10:00:00.000Z';

function ag(id: string, extra: Partial<AgendamentoCompleto> = {}): AgendamentoCompleto {
  return {
    id,
    cliente_id: 'c1',
    servico_id: 's1',
    inicio: '2026-11-18T13:00:00+00:00',
    fim: '2026-11-18T13:30:00+00:00',
    status: 'marcado',
    observacao: null,
    origem: 'link',
    criado_em: '2026-11-17T10:00:00+00:00',
    cliente: { nome: 'Ana', telefone: '5511911112222' },
    servico: { nome: 'Corte' },
    ...extra,
  };
}

const s = { corte: CORTE, vistos: [] as string[], agora: AGORA };

describe('ehNovo', () => {
  it('pelo link, depois do corte, marcado, futuro e não visto: é novo', () => {
    expect(ehNovo(ag('a1'), s)).toBe(true);
    expect(ehNovo(ag('a1', { status: 'confirmado' }), s)).toBe(true);
  });

  it('marcado pelo dono não é novo', () => {
    expect(ehNovo(ag('a1', { origem: 'dono' }), s)).toBe(false);
  });

  it('criado até o corte não é novo (compara o instante, não o texto)', () => {
    expect(ehNovo(ag('a1', { criado_em: '2026-11-16T10:00:00+00:00' }), s)).toBe(false);
    expect(ehNovo(ag('a1', { criado_em: '2026-11-16T09:00:00+00:00' }), s)).toBe(false);
  });

  it('cancelado, concluído ou faltou não é novo', () => {
    expect(ehNovo(ag('a1', { status: 'cancelado' }), s)).toBe(false);
    expect(ehNovo(ag('a1', { status: 'concluido' }), s)).toBe(false);
    expect(ehNovo(ag('a1', { status: 'faltou' }), s)).toBe(false);
  });

  it('horário que já passou não é novo', () => {
    expect(ehNovo(ag('a1', { inicio: '2026-11-17T11:00:00+00:00' }), s)).toBe(false);
    expect(ehNovo(ag('a1', { inicio: '2026-11-17T10:00:00+00:00' }), s)).toBe(false);
  });

  it('id em vistos não é novo', () => {
    expect(ehNovo(ag('a1'), { ...s, vistos: ['a1'] })).toBe(false);
  });
});

describe('aposVer', () => {
  it('quando não sobra nenhum novo, o corte vira o criado_em mais recente buscado e vistos esvazia', () => {
    const a1 = ag('a1', { criado_em: '2026-11-17T10:30:00+00:00' });
    const a2 = ag('a2', { criado_em: '2026-11-16T22:00:00+00:00' });
    expect(aposVer({ corte: CORTE, vistos: ['a2'] }, ['a1'], [], [a2, a1], AGORA)).toEqual({
      corte: '2026-11-17T10:30:00+00:00',
      vistos: [],
    });
  });

  it('sem nada buscado, o corte fica', () => {
    expect(aposVer({ corte: CORTE, vistos: [] }, [], [], [], AGORA)).toEqual({ corte: CORTE, vistos: [] });
  });

  it('enquanto há novos, guarda os vistos e poda os que já passaram', () => {
    const passado = ag('p', { inicio: '2026-11-17T10:00:00+00:00' });
    const futuro = ag('f');
    const visto = ag('v');
    const resta = ag('r');
    expect(aposVer({ corte: CORTE, vistos: ['p', 'f'] }, ['v'], [resta], [passado, futuro, visto, resta], AGORA)).toEqual({
      corte: CORTE,
      vistos: ['f', 'v'],
    });
  });
});
