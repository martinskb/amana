import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendamentoCompleto, Status } from '../../src/types';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ listClientes: vi.fn(), listAgendamentosDoCliente: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/clientes', () => ({ listClientes: m.listClientes }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentosDoCliente: m.listAgendamentosDoCliente }));

import Clientes from '../../src/ui/Clientes';

const JOAO = { id: 'c1', nome: 'João', telefone: '5511987654321', criado_em: '2026-11-01T00:00:00Z' };
const ANA = { id: 'c2', nome: 'Ana', telefone: '5511911110000', criado_em: '2026-11-01T00:00:00Z' };

const ag = (id: string, inicio: string, servico: string, status: Status): AgendamentoCompleto => ({
  id, cliente_id: 'c1', servico_id: 's', inicio, fim: inicio, status, observacao: null, origem: 'dono', criado_em: '2026-11-01T00:00:00Z',
  cliente: { nome: 'João', telefone: JOAO.telefone }, servico: { nome: servico },
});

beforeEach(() => {
  m.listClientes.mockReset().mockImplementation(async (_db, busca?: string) =>
    [ANA, JOAO].filter((c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase())),
  );
  m.listAgendamentosDoCliente.mockReset().mockResolvedValue([
    ag('a2', '2026-11-10T13:00:00+00:00', 'Barba', 'concluido'),
    ag('a1', '2026-11-03T17:30:00+00:00', 'Corte', 'faltou'),
  ]);
});

describe('Clientes', () => {
  it('lista os clientes e filtra pela busca', async () => {
    renderComConfig(<Clientes />);
    expect(await screen.findByRole('button', { name: /Ana/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar'), 'Jo');
    await waitFor(() => expect(m.listClientes).toHaveBeenLastCalledWith({}, 'Jo'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Ana/ })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /João/ })).toBeInTheDocument();
  });

  it('abrir um cliente mostra o histórico na ordem recebida', async () => {
    renderComConfig(<Clientes />);
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    expect(m.listAgendamentosDoCliente).toHaveBeenCalledWith({}, 'c1');
    const itens = within(await screen.findByRole('list', { name: 'Histórico' })).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('10/11/2026 10:00 · Barba · Concluído');
    expect(itens[1]).toHaveTextContent('03/11/2026 14:30 · Corte · Faltou');
  });
});
