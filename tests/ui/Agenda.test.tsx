import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflitoDeHorarioError } from '../../src/data/erros';
import type { AgendamentoCompleto, Status } from '../../src/types';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({
  listAgendamentos: vi.fn(),
  criarAgendamento: vi.fn(),
  editarAgendamento: vi.fn(),
  mudarStatus: vi.fn(),
  findOrCreateCliente: vi.fn(),
  listClientes: vi.fn(),
  listServicos: vi.fn(),
}));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({
  listAgendamentos: m.listAgendamentos,
  criarAgendamento: m.criarAgendamento,
  editarAgendamento: m.editarAgendamento,
  mudarStatus: m.mudarStatus,
}));
vi.mock('../../src/data/clientes', () => ({ findOrCreateCliente: m.findOrCreateCliente, listClientes: m.listClientes }));
vi.mock('../../src/data/servicos', () => ({ listServicos: m.listServicos }));

import Agenda from '../../src/ui/Agenda';

const JOAO = { id: 'c1', nome: 'João', telefone: '5511987654321', criado_em: '2026-11-01T00:00:00Z' };
const CORTE = { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true };

function ag(id: string, inicio: string, fim: string, nome: string, status: Status = 'marcado'): AgendamentoCompleto {
  return {
    id,
    cliente_id: nome === 'João' ? 'c1' : 'c2',
    servico_id: 's1',
    inicio,
    fim,
    status,
    observacao: null,
    origem: 'dono',
    criado_em: '2026-11-01T00:00:00Z',
    cliente: { nome, telefone: nome === 'João' ? JOAO.telefone : '5511911112222' },
    servico: { nome: 'Corte' },
  };
}

// terça 17/11 10:00–10:30 (13:00Z) e quarta 18/11 15:00–15:30 (18:00Z), hora de São Paulo
const JOAO_TERCA = ag('a1', '2026-11-17T13:00:00+00:00', '2026-11-17T13:30:00+00:00', 'João');
const MARIA_QUARTA = ag('a2', '2026-11-18T18:00:00+00:00', '2026-11-18T18:30:00+00:00', 'Maria');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z')); // terça 08:00 em São Paulo
  for (const f of Object.values(m)) f.mockReset();
  m.listAgendamentos.mockImplementation(async (_db, de: string, ate: string) =>
    [JOAO_TERCA, MARIA_QUARTA].filter((a) => {
      const dia = a.id === 'a1' ? '2026-11-17' : '2026-11-18';
      return dia >= de && dia <= ate;
    }),
  );
  m.listServicos.mockResolvedValue([CORTE]);
  m.listClientes.mockResolvedValue([JOAO]);
  m.criarAgendamento.mockResolvedValue({ id: 'novo' });
  m.editarAgendamento.mockResolvedValue(undefined);
  m.mudarStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

const abrirNovo = async (rotulo = 'Marcar ter 17/11 às 09:00') => userEvent.click(await screen.findByRole('button', { name: rotulo }));
const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

describe('Agenda', () => {
  it('visão de dia mostra só hoje', async () => {
    renderComConfig(<Agenda />);
    expect(await screen.findByRole('button', { name: /10:00 João/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /15:00 Maria/ })).not.toBeInTheDocument();
    expect(m.listAgendamentos).toHaveBeenCalledWith({}, '2026-11-17', '2026-11-17');
  });

  it('visão de semana mostra os agendamentos da semana na grade', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: 'Semana' }));
    expect(await screen.findByRole('button', { name: /15:00 Maria/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /10:00 João/ })).toBeInTheDocument();
    expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-17', '2026-11-23');
    await userEvent.click(screen.getByRole('button', { name: 'Dia' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /15:00 Maria/ })).not.toBeInTheDocument());
  });

  it('horário ocupado não aparece como livre', async () => {
    renderComConfig(<Agenda />);
    await screen.findByRole('button', { name: /10:00 João/ });
    expect(screen.queryByRole('button', { name: 'Marcar ter 17/11 às 10:00' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 10:30' })).toBeInTheDocument();
  });

  it('tocar num horário livre abre o formulário com data e hora preenchidas', async () => {
    renderComConfig(<Agenda />);
    await abrirNovo();
    expect(screen.getByLabelText('Data')).toHaveValue('2026-11-17');
    expect(screen.getByLabelText('Hora')).toHaveValue('09:00');
  });

  it('buscar "Jo" lista o João e selecionar não cria cliente novo', async () => {
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Jo');
    await waitFor(() => expect(m.listClientes).toHaveBeenLastCalledWith({}, 'Jo'));
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    await salvar();
    expect(m.findOrCreateCliente).not.toHaveBeenCalled();
    expect(m.criarAgendamento).toHaveBeenCalledWith({}, {
      cliente_id: 'c1',
      servico_id: 's1',
      inicio: '2026-11-17T12:00:00.000Z',
      fim: '2026-11-17T12:30:00.000Z',
      status: 'marcado',
      observacao: null,
      origem: 'dono',
    });
  });

  it('cliente novo é cadastrado com o telefone normalizado', async () => {
    m.listClientes.mockResolvedValue([]);
    m.findOrCreateCliente.mockResolvedValue({ ...JOAO, id: 'c9', nome: 'Pedro' });
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Pedro');
    await userEvent.type(screen.getByLabelText('Telefone'), '(11) 97777-6666');
    await salvar();
    expect(m.findOrCreateCliente).toHaveBeenCalledWith({}, 'Pedro', '5511977776666');
    expect(m.criarAgendamento).toHaveBeenCalledWith({}, expect.objectContaining({ cliente_id: 'c9' }));
  });

  it('salvar com telefone inválido mostra "Telefone inválido" e não grava', async () => {
    m.listClientes.mockResolvedValue([]);
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Pedro');
    await userEvent.type(screen.getByLabelText('Telefone'), '1234');
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('Telefone inválido');
    expect(m.criarAgendamento).not.toHaveBeenCalled();
  });

  it('conflito mostra "Esse horário já está ocupado."', async () => {
    m.criarAgendamento.mockRejectedValue(new ConflitoDeHorarioError());
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Jo');
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    await salvar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário já está ocupado.');
  });

  it('editar o horário chama editarAgendamento com inicio e fim novos', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '11:00' } });
    await salvar();
    expect(m.editarAgendamento).toHaveBeenCalledWith({}, 'a1', {
      servico_id: 's1',
      inicio: '2026-11-17T14:00:00.000Z',
      fim: '2026-11-17T14:30:00.000Z',
      observacao: null,
    });
  });

  it('conflito na edição mostra a mesma mensagem', async () => {
    m.editarAgendamento.mockRejectedValue(new ConflitoDeHorarioError());
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await salvar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário já está ocupado.');
  });

  it.each([
    ['Confirmar', 'confirmado'],
    ['Concluir', 'concluido'],
    ['Faltou', 'faltou'],
    ['Cancelar agendamento', 'cancelado'],
  ])('botão %s chama mudarStatus com %s', async (botao, status) => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    await userEvent.click(screen.getByRole('button', { name: botao }));
    expect(m.mudarStatus).toHaveBeenCalledWith({}, 'a1', status);
  });

  it('depois de cancelar, o horário volta a aparecer livre', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    m.listAgendamentos.mockResolvedValue([{ ...JOAO_TERCA, status: 'cancelado' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar agendamento' }));
    expect(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 10:00' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /10:00 João/ })).not.toBeInTheDocument();
  });

  it('botão WhatsApp do agendamento abre a conversa com o cliente', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    const detalhes = screen.getByRole('dialog');
    expect(within(detalhes).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/5511987654321?text=',
    );
  });

  it('ao voltar para o app no dia seguinte, mostra o novo dia', async () => {
    renderComConfig(<Agenda />);
    await screen.findByRole('button', { name: /10:00 João/ });
    vi.setSystemTime(new Date('2026-11-18T11:00:00Z')); // quarta 08:00
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-18', '2026-11-18'));
    expect(await screen.findByRole('button', { name: /15:00 Maria/ })).toBeInTheDocument();
  });

  it('ao voltar para o app, recarrega mesmo no mesmo dia', async () => {
    renderComConfig(<Agenda />);
    await screen.findByRole('button', { name: /10:00 João/ });
    const antes = m.listAgendamentos.mock.calls.length;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(m.listAgendamentos.mock.calls.length).toBeGreaterThan(antes));
  });
});
