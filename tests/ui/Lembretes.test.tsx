import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderModelo, waLink } from '../../src/lib/whatsapp';
import type { AgendamentoCompleto, Status } from '../../src/types';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ listAgendamentos: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentos: m.listAgendamentos }));

import Lembretes from '../../src/ui/Lembretes';

function ag(id: string, inicio: string, nome: string, telefone: string, status: Status): AgendamentoCompleto {
  return {
    id, cliente_id: id, servico_id: 's1', inicio, fim: inicio, status, observacao: null,
    cliente: { nome, telefone }, servico: { nome: 'Corte' },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T02:30:00Z')); // terça 23:30 em São Paulo
  m.listAgendamentos.mockReset().mockResolvedValue([
    ag('a1', '2026-11-18T13:00:00+00:00', 'João', '5511987654321', 'marcado'),
    ag('a2', '2026-11-18T14:00:00+00:00', 'Ana', '5511911110000', 'cancelado'),
    ag('a3', '2026-11-18T18:30:00+00:00', 'Maria', '5511922223333', 'confirmado'),
  ]);
});

afterEach(() => vi.useRealTimers());

describe('Lembretes de amanhã', () => {
  it('busca os agendamentos de amanhã em hora local', async () => {
    renderComConfig(<Lembretes />);
    await screen.findByText(/João/);
    expect(m.listAgendamentos).toHaveBeenCalledWith({}, '2026-11-18', '2026-11-18');
  });

  it('lista só marcados e confirmados', async () => {
    renderComConfig(<Lembretes />);
    expect(await screen.findByText(/João/)).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument();
  });

  it('cada item tem o link do WhatsApp com a mensagem do modelo preenchida', async () => {
    renderComConfig(<Lembretes />);
    const link = await screen.findByRole('link', { name: 'Lembrar João' });
    const msg = renderModelo(CONFIG_TESTE.modelo_lembrete, {
      nome: 'João', dia: 'qua', hora: '10h', nome_negocio: CONFIG_TESTE.nome_negocio,
    });
    expect(msg).toBe('Oi João! Lembrete: amanhã (qua) às 10h na Barbearia do Teste.');
    expect(link).toHaveAttribute('href', waLink('5511987654321', msg));
    expect(screen.getByRole('link', { name: 'Lembrar Maria' }).getAttribute('href')).toContain(encodeURIComponent('15h30'));
  });

  it('sem agendamentos mostra "Nenhum atendimento amanhã"', async () => {
    m.listAgendamentos.mockResolvedValue([]);
    renderComConfig(<Lembretes />);
    expect(await screen.findByText('Nenhum atendimento amanhã.')).toBeInTheDocument();
  });

  it('ao voltar para o app no dia seguinte, usa o novo "amanhã"', async () => {
    renderComConfig(<Lembretes />);
    await screen.findByText(/João/);
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z')); // quarta 09:00
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-19', '2026-11-19'));
  });
});
