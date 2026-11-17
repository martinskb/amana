import { useCallback, useState } from 'react';
import { apagar, gravar, ler } from '../lib/cache';
import { variasPessoas } from '../lib/pessoas';
import type { Pessoa } from '../types';

/**
 * Filtro da agenda por pessoa, guardado no aparelho (não sai no Sair). null = todos.
 * Volta para todos se a guardada não está entre as ativas ou se há uma pessoa ativa só.
 */
export function useFiltroPessoa(pessoas: Pessoa[]): [string | null, (id: string | null) => void] {
  const [guardado, setGuardado] = useState<string | null>(() => {
    const v = ler<unknown>('filtro-pessoa')?.valor;
    return typeof v === 'string' ? v : null;
  });

  const escolher = useCallback((id: string | null) => {
    setGuardado(id);
    if (id === null) apagar('filtro-pessoa');
    else gravar('filtro-pessoa', id);
  }, []);

  const valido = guardado !== null && variasPessoas(pessoas) && pessoas.some((p) => p.ativo && p.id === guardado);
  return [valido ? guardado : null, escolher];
}
