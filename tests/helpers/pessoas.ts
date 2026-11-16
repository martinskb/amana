import type { Pessoa } from '../../src/types';

/** A pessoa que a migração 0006 cria num negócio de uma pessoa só: sem nome, faz tudo. */
export const PESSOA_TESTE: Pessoa = { id: 'p1', nome: null, ativo: true, ordem: 1, folgas: [], servicos: [] };
