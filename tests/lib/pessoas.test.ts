import { describe, expect, it } from 'vitest';
import { ativas, fazServico, livresPara, nomeDaPessoa, nomeNaMensagem, variasPessoas } from '../../src/lib/pessoas';
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

describe('livresPara e nomeNaMensagem', () => {
  const ana = pessoa('p1', 1, { nome: 'Ana', servicos: ['s1'] });
  const bia = pessoa('p2', 2, { nome: 'Bia', servicos: ['s1', 's2'] });
  const cida = pessoa('p3', 3, { servicos: ['s2'] });
  const ag = (id: string, pessoa_id: string, ini: string, fim: string, status: 'marcado' | 'cancelado' = 'marcado') => ({
    id, pessoa_id, inicio: ini, fim, status,
  });
  const base = {
    pessoas: [cida, bia, ana],
    servicosAtivos: 2,
    inicio: new Date('2026-11-17T13:00:00Z'),
    fim: new Date('2026-11-17T13:30:00Z'),
  };

  it('só quem faz o serviço, pela ordem', () => {
    expect(livresPara({ ...base, servicoId: 's2', agendamentos: [] }).map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(livresPara({ ...base, servicoId: null, agendamentos: [] }).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('tira quem tem cliente ativo cruzando o horário; cancelado e o próprio agendamento não contam', () => {
    const agendamentos = [
      ag('x', 'p1', '2026-11-17T12:45:00Z', '2026-11-17T13:15:00Z'),
      ag('y', 'p2', '2026-11-17T13:00:00Z', '2026-11-17T13:30:00Z', 'cancelado'),
      ag('z', 'p3', '2026-11-17T13:30:00Z', '2026-11-17T14:00:00Z'), // encosta, não cruza
    ];
    expect(livresPara({ ...base, servicoId: null, agendamentos }).map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(livresPara({ ...base, servicoId: null, agendamentos, ignorar: 'x' }).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('desativada não entra', () => {
    expect(livresPara({ ...base, pessoas: [{ ...ana, ativo: false }, bia], servicoId: 's1', agendamentos: [] }).map((p) => p.id)).toEqual(['p2']);
  });

  it('nomeNaMensagem: só com 2+ ativas e pessoa com nome', () => {
    expect(nomeNaMensagem('p1', [ana, bia])).toBe('Ana');
    expect(nomeNaMensagem('p3', [ana, cida])).toBeNull();
    expect(nomeNaMensagem('p1', [ana, { ...bia, ativo: false }])).toBeNull();
    expect(nomeNaMensagem(undefined, [ana, bia])).toBeNull();
  });
});
