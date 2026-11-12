import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContador, usePrefereMenosMovimento, useSaida, useTelaLarga } from '../../src/ui/animacao';

type Ouvinte = (e: { matches: boolean }) => void;

/** Stub controlável de matchMedia('(prefers-reduced-motion: reduce)'). */
function stubMenosMovimento(inicial: boolean) {
  let matches = inicial;
  const ouvintes = new Set<Ouvinte>();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() {
      return q.includes('prefers-reduced-motion') && matches;
    },
    media: q,
    addEventListener: (_: string, f: Ouvinte) => ouvintes.add(f),
    removeEventListener: (_: string, f: Ouvinte) => ouvintes.delete(f),
  }));
  return {
    mudar(v: boolean) {
      matches = v;
      ouvintes.forEach((f) => f({ matches: v }));
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useSaida', () => {
  it('fica montado enquanto aberto', () => {
    const { result } = renderHook(() => useSaida(true, 200));
    expect(result.current).toEqual({ montado: true, saindo: false });
  });

  it('ao fechar, marca saindo e desmonta depois do tempo', () => {
    const { result, rerender } = renderHook(({ a }) => useSaida(a, 200), { initialProps: { a: true } });
    rerender({ a: false });
    expect(result.current).toEqual({ montado: true, saindo: true });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.montado).toBe(false);
  });

  it('reabrir antes do fim cancela a saída', () => {
    const { result, rerender } = renderHook(({ a }) => useSaida(a, 200), { initialProps: { a: true } });
    rerender({ a: false });
    act(() => vi.advanceTimersByTime(100));
    rerender({ a: true });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toEqual({ montado: true, saindo: false });
  });

  it('começa desmontado quando fechado', () => {
    const { result } = renderHook(() => useSaida(false, 200));
    expect(result.current.montado).toBe(false);
  });
});

describe('useContador', () => {
  it('conta de 0 até o alvo no tempo pedido', () => {
    stubMenosMovimento(false);
    const { result } = renderHook(() => useContador(3, 600));
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe(3);
  });

  it('com menos movimento, já começa no alvo', () => {
    stubMenosMovimento(true);
    const { result } = renderHook(() => useContador(3, 600));
    expect(result.current).toBe(3);
  });

  it('quando o alvo muda, termina no novo alvo', () => {
    stubMenosMovimento(false);
    const { result, rerender } = renderHook(({ n }) => useContador(n, 600), { initialProps: { n: 3 } });
    act(() => vi.advanceTimersByTime(700));
    rerender({ n: 5 });
    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe(5);
  });
});

describe('usePrefereMenosMovimento', () => {
  it('é false sem matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => usePrefereMenosMovimento());
    expect(result.current).toBe(false);
  });

  it('reflete a preferência e acompanha mudanças', () => {
    const mm = stubMenosMovimento(false);
    const { result } = renderHook(() => usePrefereMenosMovimento());
    expect(result.current).toBe(false);
    act(() => mm.mudar(true));
    expect(result.current).toBe(true);
  });
});

describe('useTelaLarga', () => {
  function stubLargura(inicial: boolean) {
    let matches = inicial;
    const ouvintes = new Set<(e: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() {
        return q === '(min-width: 1280px)' && matches;
      },
      media: q,
      addEventListener: (_: string, f: (e: { matches: boolean }) => void) => ouvintes.add(f),
      removeEventListener: (_: string, f: (e: { matches: boolean }) => void) => ouvintes.delete(f),
    }));
    return { mudar: (v: boolean) => { matches = v; ouvintes.forEach((f) => f({ matches: v })); } };
  }

  it('é false sem matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useTelaLarga()).result.current).toBe(false);
  });

  it('reflete (min-width: 1280px) e acompanha mudanças', () => {
    const mm = stubLargura(true);
    const { result } = renderHook(() => useTelaLarga());
    expect(result.current).toBe(true);
    act(() => mm.mudar(false));
    expect(result.current).toBe(false);
  });
});
