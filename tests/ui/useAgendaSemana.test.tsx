import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import type { AgendamentoCompleto } from '../../src/types';

const m = vi.hoisted(() => ({ listAgendamentos: vi.fn(), listAjustes: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentos: m.listAgendamentos }));
vi.mock('../../src/data/ajustes', () => ({ listAjustes: m.listAjustes }));

import { useAgendaSemana } from '../../src/ui/useAgendaSemana';

const SEGUNDA = '2026-11-16';
const AG = { id: 'a1', inicio: '2026-11-17T13:00:00+00:00' } as AgendamentoCompleto;
const NOVO = { id: 'a2', inicio: '2026-11-18T13:00:00+00:00' } as AgendamentoCompleto;

/** Grava o cache da semana como se tivesse sido salvo `segundosAtras` antes de agora. */
function cacheDe(segundosAtras: number) {
  const agora = Date.now();
  vi.setSystemTime(agora - segundosAtras * 1000);
  gravar(`agenda:${SEGUNDA}`, { agendamentos: [AG], ajustes: [] });
  vi.setSystemTime(agora);
}

const pendente = () => new Promise<never>(() => {});
const esvaziar = () => act(async () => {});

let visivel: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z'));
  localStorage.clear();
  m.listAgendamentos.mockReset().mockResolvedValue([NOVO]);
  m.listAjustes.mockReset().mockResolvedValue([]);
  visivel = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visivel);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAgendaSemana', () => {
  it('busca de segunda a domingo, grava no cache da semana e devolve os dados', async () => {
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(m.listAgendamentos).toHaveBeenCalledWith({}, '2026-11-16', '2026-11-22');
    expect(m.listAjustes).toHaveBeenCalledWith({}, '2026-11-16', '2026-11-22');
    expect(result.current.agendamentos).toEqual([NOVO]);
    expect(result.current.salvoEm).not.toBeNull();
    expect(ler<{ agendamentos: AgendamentoCompleto[] }>(`agenda:${SEGUNDA}`)?.valor.agendamentos).toEqual([NOVO]);
  });

  it('mostra o cache antes da busca terminar', () => {
    cacheDe(10);
    m.listAgendamentos.mockReturnValue(pendente());
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    expect(result.current.agendamentos).toEqual([AG]);
    expect(result.current.salvoEm).toBe(ler(`agenda:${SEGUNDA}`)!.em);
  });

  it('sem cache, começa sem dados (esqueleto)', () => {
    m.listAgendamentos.mockReturnValue(pendente());
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    expect(result.current.agendamentos).toBeNull();
    expect(result.current.salvoEm).toBeNull();
  });

  it('"atualizando" só aparece com cache de mais de 60 s e a busca pendente', async () => {
    cacheDe(30);
    m.listAgendamentos.mockReturnValue(pendente());
    const recente = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(recente.result.current.atualizando).toBe(false);
    recente.unmount();

    cacheDe(90);
    const velho = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(velho.result.current.atualizando).toBe(true);
  });

  it('"atualizando" some quando a busca volta', async () => {
    cacheDe(90);
    let terminar: (v: AgendamentoCompleto[]) => void = () => {};
    m.listAgendamentos.mockReturnValue(new Promise((r) => (terminar = r)));
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(result.current.atualizando).toBe(true);
    await act(async () => terminar([NOVO]));
    expect(result.current.atualizando).toBe(false);
    expect(result.current.agendamentos).toEqual([NOVO]);
  });

  it('falha com cache: semConexao e o cache continua na tela', async () => {
    cacheDe(10);
    m.listAgendamentos.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(result.current.semConexao).toBe(true);
    expect(result.current.erro).toBe(false);
    expect(result.current.agendamentos).toEqual([AG]);
  });

  it('falha sem cache: erro, sem semConexao', async () => {
    m.listAgendamentos.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(result.current.semConexao).toBe(false);
    expect(result.current.erro).toBe(true);
  });

  it('busca passando de 10 s com cache: semConexao', async () => {
    cacheDe(10);
    m.listAgendamentos.mockReturnValue(pendente());
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    await act(() => vi.advanceTimersByTimeAsync(9_000));
    expect(result.current.semConexao).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current.semConexao).toBe(true);
  });

  it('depois de semConexao, uma busca que dá certo tira o aviso', async () => {
    cacheDe(10);
    m.listAgendamentos.mockRejectedValueOnce(new Error('rede'));
    const { result } = renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(result.current.semConexao).toBe(true);
    await act(() => result.current.recarregar());
    expect(result.current.semConexao).toBe(false);
    expect(result.current.agendamentos).toEqual([NOVO]);
  });

  it('a cada 30 s, com a aba visível, busca de novo', async () => {
    renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    expect(m.listAgendamentos).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(m.listAgendamentos).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(m.listAgendamentos).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(m.listAgendamentos).toHaveBeenCalledTimes(3);
  });

  it('com a aba escondida, não busca', async () => {
    renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    visivel = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(m.listAgendamentos).toHaveBeenCalledTimes(1);
  });

  it('ao voltar para a aba, busca na hora', async () => {
    renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    visivel = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(() => vi.advanceTimersByTimeAsync(45_000));
    visivel = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await esvaziar();
    expect(m.listAgendamentos).toHaveBeenCalledTimes(2);
  });

  it('trocar de semana mostra o cache da outra semana e busca a outra semana', async () => {
    gravar('agenda:2026-11-23', { agendamentos: [NOVO], ajustes: [] });
    m.listAgendamentos.mockReturnValue(pendente());
    const { result, rerender } = renderHook(({ s }) => useAgendaSemana(s), { initialProps: { s: SEGUNDA } });
    expect(result.current.agendamentos).toBeNull();
    rerender({ s: '2026-11-23' });
    expect(result.current.agendamentos).toEqual([NOVO]);
    await esvaziar();
    expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-23', '2026-11-29');
  });

  it('a resposta de uma semana antiga não sobrescreve a semana atual', async () => {
    let terminarAntiga: (v: AgendamentoCompleto[]) => void = () => {};
    m.listAgendamentos.mockReturnValueOnce(new Promise((r) => (terminarAntiga = r)));
    const { result, rerender } = renderHook(({ s }) => useAgendaSemana(s), { initialProps: { s: SEGUNDA } });
    rerender({ s: '2026-11-23' });
    await esvaziar();
    expect(result.current.agendamentos).toEqual([NOVO]);
    await act(async () => terminarAntiga([AG]));
    expect(result.current.agendamentos).toEqual([NOVO]);
    expect(ler<{ agendamentos: AgendamentoCompleto[] }>('agenda:2026-11-23')?.valor.agendamentos).toEqual([NOVO]);
  });

  it('guarda só as 8 semanas mais recentes', async () => {
    for (let i = 0; i < 9; i++) {
      vi.setSystemTime(new Date(`2026-10-0${i + 1}T12:00:00Z`));
      gravar(`agenda:2026-01-0${i + 1}`, { agendamentos: [], ajustes: [] });
    }
    vi.setSystemTime(new Date('2026-11-17T11:00:00Z'));
    renderHook(() => useAgendaSemana(SEGUNDA));
    await esvaziar();
    const chaves = Object.keys(localStorage).filter((k) => k.startsWith('amana:agenda:'));
    expect(chaves).toHaveLength(8);
    expect(chaves).toContain(`amana:agenda:${SEGUNDA}`);
  });
});
