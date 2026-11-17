import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import { lembrarNome, nomeInicial } from '../../src/lib/nomeNegocio';

beforeEach(() => {
  localStorage.clear();
  document.title = '';
});

describe('nomeInicial', () => {
  it('prefere o nome guardado', () => {
    vi.stubEnv('VITE_NOME_NEGOCIO', 'Do Ambiente');
    gravar('nome', 'Guardado');
    expect(nomeInicial()).toBe('Guardado');
  });
  it('sem guardado, usa VITE_NOME_NEGOCIO', () => {
    vi.stubEnv('VITE_NOME_NEGOCIO', 'Do Ambiente');
    expect(nomeInicial()).toBe('Do Ambiente');
  });
  it('sem nada, "Amana"', () => {
    vi.stubEnv('VITE_NOME_NEGOCIO', '');
    expect(nomeInicial()).toBe('Amana');
  });
});

describe('lembrarNome', () => {
  it('grava o nome e muda document.title', () => {
    lembrarNome('Barbearia X');
    expect(document.title).toBe('Barbearia X');
    expect(ler<string>('nome')?.valor).toBe('Barbearia X');
  });
});
