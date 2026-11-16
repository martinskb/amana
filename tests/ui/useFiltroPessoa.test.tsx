import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import type { Pessoa } from '../../src/types';
import { useFiltroPessoa } from '../../src/ui/useFiltroPessoa';

const ana: Pessoa = { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: [], servicos: [] };
const bia: Pessoa = { id: 'p2', nome: 'Bia', ativo: true, ordem: 2, folgas: [], servicos: [] };

beforeEach(() => localStorage.clear());

describe('useFiltroPessoa', () => {
  it('começa em todos (null), guarda a escolha no aparelho e lê de volta', () => {
    const { result, unmount } = renderHook(() => useFiltroPessoa([ana, bia]));
    expect(result.current[0]).toBeNull();
    act(() => result.current[1]('p2'));
    expect(result.current[0]).toBe('p2');
    expect(ler('filtro-pessoa')?.valor).toBe('p2');
    unmount();
    const outra = renderHook(() => useFiltroPessoa([ana, bia]));
    expect(outra.result.current[0]).toBe('p2');
    act(() => outra.result.current[1](null));
    expect(outra.result.current[0]).toBeNull();
    expect(ler('filtro-pessoa')?.valor ?? null).toBeNull();
  });

  it('pessoa guardada que foi desativada volta para todos', () => {
    gravar('filtro-pessoa', 'p2');
    const { result } = renderHook(() =>
      useFiltroPessoa([ana, bia, { ...bia, id: 'p3', ativo: true, ordem: 3 }].map((p) => (p.id === 'p2' ? { ...p, ativo: false } : p))),
    );
    expect(result.current[0]).toBeNull();
  });

  it('pessoa guardada que foi apagada volta para todos', () => {
    gravar('filtro-pessoa', 'p9');
    const { result } = renderHook(() => useFiltroPessoa([ana, bia]));
    expect(result.current[0]).toBeNull();
  });

  it('com uma pessoa ativa só, o filtro é sempre todos', () => {
    gravar('filtro-pessoa', 'p1');
    const { result } = renderHook(() => useFiltroPessoa([ana, { ...bia, ativo: false }]));
    expect(result.current[0]).toBeNull();
  });

  it('quando as pessoas mudam e a escolhida sai, volta para todos', () => {
    gravar('filtro-pessoa', 'p2');
    const { result, rerender } = renderHook(({ ps }) => useFiltroPessoa(ps), { initialProps: { ps: [ana, bia] } });
    expect(result.current[0]).toBe('p2');
    rerender({ ps: [ana, { ...bia, ativo: false }, { ...bia, id: 'p3', ordem: 3 }] });
    expect(result.current[0]).toBeNull();
  });
});
