import { describe, expect, it } from 'vitest';
import { faltaPara, proximoCliente } from '../../src/lib/proximo';
import type { AgendamentoCompleto, Status } from '../../src/types';

const F = 'America/Sao_Paulo';
// terça 17/11, 08:00 em São Paulo
const AGORA = new Date('2026-11-17T11:00:00Z');
const ag = (id: string, inicio: string, status: Status = 'marcado'): AgendamentoCompleto => ({
  id, cliente_id: 'c', servico_id: null, inicio, fim: inicio, status, observacao: null, origem: 'dono',
  criado_em: '2026-11-01T00:00:00Z', cliente: { nome: id, telefone: '5511900000000' }, servico: null,
});

describe('proximoCliente', () => {
  it('escolhe o primeiro futuro de hoje', () => {
    const r = proximoCliente([ag('b', '2026-11-17T17:00:00Z'), ag('a', '2026-11-17T13:00:00Z')], AGORA, F);
    expect(r?.id).toBe('a');
  });

  it('ignora cancelado, concluído, faltou, já começado e de amanhã', () => {
    const lista = [
      ag('cancelado', '2026-11-17T12:00:00Z', 'cancelado'),
      ag('concluido', '2026-11-17T12:30:00Z', 'concluido'),
      ag('faltou', '2026-11-17T13:00:00Z', 'faltou'),
      ag('andamento', '2026-11-17T10:30:00Z'),
      ag('amanha', '2026-11-18T12:00:00Z'),
      ag('confirmado', '2026-11-17T19:00:00Z', 'confirmado'),
    ];
    expect(proximoCliente(lista, AGORA, F)?.id).toBe('confirmado');
  });

  it('sem nenhum, devolve null', () => {
    expect(proximoCliente([ag('amanha', '2026-11-18T12:00:00Z')], AGORA, F)).toBeNull();
    expect(proximoCliente([], AGORA, F)).toBeNull();
  });
});

describe('faltaPara', () => {
  it.each([
    [40, 'em 40 min'],
    [80, 'em 1 h 20 min'],
    [60, 'em 1 h'],
    [125, 'em 2 h 5 min'],
  ])('%i minutos → %s', (min, texto) => {
    expect(faltaPara(new Date(AGORA.getTime() + min * 60_000).toISOString(), AGORA)).toBe(texto);
  });
});
