import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import type { AgendamentoCompleto } from '../../src/types';

const m = vi.hoisted(() => ({ listNovosPeloLink: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listNovosPeloLink: m.listNovosPeloLink }));

import { useNovosPeloLink } from '../../src/ui/useNovosPeloLink';

const CORTE = '2026-11-16T10:00:00.000Z';

function ag(id: string, criado_em: string, inicio = '2026-11-18T13:00:00+00:00'): AgendamentoCompleto {
  return {
    id,
    cliente_id: 'c1',
    servico_id: 's1',
    inicio,
    fim: inicio,
    status: 'marcado',
    observacao: null,
    origem: 'link',
    criado_em,
    cliente: { nome: 'Ana', telefone: '5511911112222' },
    servico: { nome: 'Corte' },
  };
}

const ANA = ag('a1', '2026-11-16T22:00:00+00:00');
const BIA = ag('a2', '2026-11-17T10:30:00+00:00');
const CAIO = ag('a3', '2026-11-17T11:10:00+00:00');

const esvaziar = () => act(async () => {});
const ids = (l: AgendamentoCompleto[]) => l.map((a) => a.id);

let visivel: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z'));
  localStorage.clear();
  m.listNovosPeloLink.mockReset().mockResolvedValue([]);
  visivel = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visivel);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useNovosPeloLink', () => {
  it('no primeiro uso grava o corte = agora e nada antigo aparece como novo', async () => {
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    expect(ler('corte-novos')?.valor).toBe('2026-11-17T11:00:00.000Z');
    expect(m.listNovosPeloLink).toHaveBeenCalledWith({}, '2026-11-17T11:00:00.000Z');
    expect(result.current.novos).toEqual([]);
  });

  it('busca desde o corte guardado e mostra os novos', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA, BIA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    expect(m.listNovosPeloLink).toHaveBeenCalledWith({}, CORTE);
    expect(ids(result.current.novos)).toEqual(['a1', 'a2']);
  });

  it('ver tira o agendamento da lista e grava em vistos', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA, BIA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    act(() => result.current.ver(ANA));
    expect(ids(result.current.novos)).toEqual(['a2']);
    expect(ler('vistos')?.valor).toEqual(['a1']);
    expect(ler('corte-novos')?.valor).toBe(CORTE);
    // continua fora depois de buscar de novo
    await act(() => result.current.buscar());
    expect(ids(result.current.novos)).toEqual(['a2']);
  });

  it('ver o último novo avança o corte e esvazia vistos', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA, BIA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    act(() => result.current.ver(ANA));
    act(() => result.current.ver(BIA));
    expect(result.current.novos).toEqual([]);
    expect(ler('corte-novos')?.valor).toBe(BIA.criado_em);
    expect(ler('vistos')?.valor).toEqual([]);
  });

  it('ver um agendamento que não é novo não muda nada', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    act(() => result.current.ver({ ...ANA, id: 'outro', origem: 'dono' }));
    expect(ids(result.current.novos)).toEqual(['a1']);
    expect(ler('vistos')).toBeNull();
  });

  it('abrir um novo que a busca de novos ainda não trouxe vale: a busca seguinte não o lista', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    act(() => result.current.ver(CAIO));
    expect(ler('vistos')?.valor).toEqual(['a3']);
    m.listNovosPeloLink.mockResolvedValue([CAIO]);
    await act(() => result.current.buscar());
    expect(result.current.novos).toEqual([]);
  });

  it('"Entendi" antes da busca trazer um agendamento já aberto não o devolve como novo', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    act(() => result.current.ver(CAIO)); // a semana mostrou o CAIO antes da busca de novos
    act(() => result.current.verTodos()); // corte anda até a ANA; o CAIO é mais novo e fica em vistos
    expect(ler('corte-novos')?.valor).toBe(ANA.criado_em);
    expect(ler('vistos')?.valor).toEqual(['a3']);
    m.listNovosPeloLink.mockResolvedValue([CAIO]);
    await act(() => result.current.buscar());
    expect(result.current.novos).toEqual([]);
  });

  it('verTodos zera a lista', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA, BIA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    act(() => result.current.verTodos());
    expect(result.current.novos).toEqual([]);
    expect(ler('corte-novos')?.valor).toBe(BIA.criado_em);
    expect(ler('vistos')?.valor).toEqual([]);
  });

  it('a primeira busca não anima; o que chega numa busca seguinte entra em chegaramAgora uma vez só', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    expect(result.current.chegaramAgora.size).toBe(0);

    m.listNovosPeloLink.mockResolvedValue([ANA, CAIO]);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect([...result.current.chegaramAgora]).toEqual(['a3']);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.chegaramAgora.has('a3')).toBe(false);
  });

  it('busca sem nada chegando mantém o mesmo chegaramAgora (efeitos não rodam a cada 30 s)', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    const antes = result.current.chegaramAgora;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.chegaramAgora).toBe(antes);

    m.listNovosPeloLink.mockResolvedValue([ANA, CAIO]);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.chegaramAgora).not.toBe(antes);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    const vazio = result.current.chegaramAgora;
    expect(vazio.size).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.chegaramAgora).toBe(vazio);
  });

  it('um id que some e volta não anima de novo', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    m.listNovosPeloLink.mockResolvedValue([ANA, CAIO]);
    await act(() => result.current.buscar());
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    await act(() => result.current.buscar());
    m.listNovosPeloLink.mockResolvedValue([ANA, CAIO]);
    await act(() => result.current.buscar());
    expect(result.current.chegaramAgora.has('a3')).toBe(false);
  });

  it('trocar de semana (novo render e nova busca) não reanima', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result, rerender } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    m.listNovosPeloLink.mockResolvedValue([ANA, CAIO]);
    await act(() => result.current.buscar());
    expect(result.current.chegaramAgora.has('a3')).toBe(true);
    // a Agenda troca de semana: re-renderiza e a semana nova é buscada junto com os novos
    rerender();
    await act(() => result.current.buscar());
    expect(result.current.chegaramAgora.has('a3')).toBe(false);
    expect(ids(result.current.novos)).toEqual(['a1', 'a3']);
  });

  it('busca de novo a cada 30 s só com a aba visível e na hora em que ela volta', async () => {
    gravar('corte-novos', CORTE);
    renderHook(() => useNovosPeloLink());
    await esvaziar();
    expect(m.listNovosPeloLink).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(m.listNovosPeloLink).toHaveBeenCalledTimes(2);
    visivel = 'hidden';
    await act(() => vi.advanceTimersByTimeAsync(90_000));
    expect(m.listNovosPeloLink).toHaveBeenCalledTimes(2);
    visivel = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(m.listNovosPeloLink).toHaveBeenCalledTimes(3);
  });

  it('falha na busca mantém a lista que estava', async () => {
    gravar('corte-novos', CORTE);
    m.listNovosPeloLink.mockResolvedValue([ANA]);
    const { result } = renderHook(() => useNovosPeloLink());
    await esvaziar();
    m.listNovosPeloLink.mockRejectedValue(new Error('rede'));
    await act(() => result.current.buscar());
    expect(ids(result.current.novos)).toEqual(['a1']);
  });
});
