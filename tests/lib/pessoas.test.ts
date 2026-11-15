import { describe, expect, it } from 'vitest';
import { ativas, fazServico, nomeDaPessoa, variasPessoas } from '../../src/lib/pessoas';
import type { Pessoa } from '../../src/types';

const pessoa = (id: string, ordem: number, over: Partial<Pessoa> = {}): Pessoa => ({
  id,
  nome: null,
  ativo: true,
  ordem,
  folgas: [],
  servicos: [],
  ...over,
});

describe('ativas', () => {
  it('só as ativas, em ordem', () => {
    const lista = [pessoa('c', 3), pessoa('a', 1), pessoa('b', 2, { ativo: false })];
    expect(ativas(lista).map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('nomeDaPessoa', () => {
  const ana = pessoa('a', 1, { nome: 'Ana' });
  const sumida = pessoa('s', 2, { ativo: false });
  const semNome = pessoa('b', 3);
  const todas = [ana, sumida, semNome];

  it('com nome: o nome', () => {
    expect(nomeDaPessoa(ana, todas)).toBe('Ana');
  });

  it('sem nome: "Pessoa N" pela posição entre as ativas', () => {
    expect(nomeDaPessoa(semNome, todas)).toBe('Pessoa 2');
  });

  it('desativada sem nome: "Pessoa (desativada)"', () => {
    expect(nomeDaPessoa(sumida, todas)).toBe('Pessoa (desativada)');
  });

  it('desativada com nome: o nome', () => {
    expect(nomeDaPessoa({ ...sumida, nome: 'Bia' }, todas)).toBe('Bia');
  });
});

describe('variasPessoas', () => {
  it('uma ativa (e uma desativada): false', () => {
    expect(variasPessoas([pessoa('a', 1), pessoa('b', 2, { ativo: false })])).toBe(false);
  });

  it('duas ativas: true', () => {
    expect(variasPessoas([pessoa('a', 1), pessoa('b', 2)])).toBe(true);
  });
});

describe('fazServico', () => {
  const ana = pessoa('a', 1, { servicos: ['corte'] });

  it('faz o serviço ligado a ela', () => {
    expect(fazServico(ana, 'corte', 2)).toBe(true);
    expect(fazServico(ana, 'barba', 2)).toBe(false);
  });

  it('sem serviço escolhido: true', () => {
    expect(fazServico(ana, null, 2)).toBe(true);
  });

  it('negócio sem serviço ativo: true', () => {
    expect(fazServico(ana, 'barba', 0)).toBe(true);
  });
});
