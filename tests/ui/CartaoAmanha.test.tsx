import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mensagemLembrar } from '../../src/lib/mensagens';
import { waLink } from '../../src/lib/whatsapp';
import type { AgendamentoCompleto, Status } from '../../src/types';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ listAgendamentos: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentos: m.listAgendamentos }));

import CartaoAmanha from '../../src/ui/CartaoAmanha';

const F = 'America/Sao_Paulo';
function ag(id: string, inicio: string, nome: string, telefone: string, status: Status): AgendamentoCompleto {
  return {
    id, cliente_id: id, servico_id: null, inicio, fim: inicio, status, observacao: null, origem: 'dono',
    criado_em: '2026-11-01T00:00:00Z', cliente: { nome, telefone }, servico: null,
  };
}
const JOAO = ag('a1', '2026-11-18T13:00:00+00:00', 'João', '5511987654321', 'marcado');
const ANA = ag('a2', '2026-11-18T14:00:00+00:00', 'Ana', '5511911110000', 'cancelado');
const MARIA = ag('a3', '2026-11-18T18:30:00+00:00', 'Maria', '5511922223333', 'confirmado');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T02:30:00Z')); // terça 23:30 em São Paulo
  m.listAgendamentos.mockReset().mockResolvedValue([JOAO, ANA, MARIA]);
});
afterEach(() => vi.useRealTimers());

describe('cartão Amanhã', () => {
  it('busca amanhã em hora local', async () => {
    renderComConfig(<CartaoAmanha />);
    await screen.findByText(/Amanhã:/);
    expect(m.listAgendamentos).toHaveBeenCalledWith({}, '2026-11-18', '2026-11-18');
  });

  it('conta só marcados e confirmados', async () => {
    renderComConfig(<CartaoAmanha />);
    expect(await screen.findByText('Amanhã: 2 clientes')).toBeInTheDocument();
  });

  it('um só usa o singular', async () => {
    m.listAgendamentos.mockResolvedValue([JOAO]);
    renderComConfig(<CartaoAmanha />);
    expect(await screen.findByText('Amanhã: 1 cliente')).toBeInTheDocument();
  });

  it.each([[[]], [[ANA]]])('sem ninguém (%#) mostra "nenhum cliente" e nenhum botão', async (lista) => {
    m.listAgendamentos.mockResolvedValue(lista);
    renderComConfig(<CartaoAmanha />);
    expect(await screen.findByText('Amanhã: nenhum cliente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lembrar' })).not.toBeInTheDocument();
  });

  it('Lembrar abre a lista com um link por cliente e Voltar fecha', async () => {
    renderComConfig(<CartaoAmanha />);
    await userEvent.click(await screen.findByRole('button', { name: 'Lembrar' }));
    expect(screen.getByRole('link', { name: 'Lembrar João' })).toHaveAttribute(
      'href',
      waLink('5511987654321', mensagemLembrar({ nome: 'João', inicio: JOAO.inicio, fuso: F })),
    );
    expect(screen.getByRole('link', { name: 'Lembrar Maria' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lembrar Ana' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByRole('link', { name: 'Lembrar João' })).not.toBeInTheDocument();
  });

  it('ao voltar para o app no dia seguinte, usa o novo "amanhã"', async () => {
    renderComConfig(<CartaoAmanha />);
    await screen.findByText(/Amanhã:/);
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z')); // quarta 09:00
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-19', '2026-11-19'));
  });
});

describe('cartão Amanhã — estabilidade da tela', () => {
  it('enquanto carrega, já ocupa o lugar do cartão (a grade não pula quando a resposta chega)', async () => {
    let responder: (v: AgendamentoCompleto[]) => void = () => {};
    m.listAgendamentos.mockReturnValue(new Promise((r) => (responder = r)));
    const { container } = renderComConfig(<CartaoAmanha />);
    expect(container.querySelector('.cartao-amanha')).not.toBeNull();
    expect(screen.getByText('Amanhã: …')).toBeInTheDocument();
    responder([JOAO]);
    expect(await screen.findByText('Amanhã: 1 cliente')).toBeInTheDocument();
  });
});
