import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflitoDeHorarioError } from '../../src/data/erros';
import { linkAgendamento } from '../../src/lib/link';
import { mensagemCancelar, mensagemConfirmar } from '../../src/lib/mensagens';
import { waLink } from '../../src/lib/whatsapp';
import { CONFIG_TESTE } from '../helpers/config';
import type { AgendamentoCompleto, Status } from '../../src/types';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({
  listAgendamentos: vi.fn(),
  criarAgendamento: vi.fn(),
  editarAgendamento: vi.fn(),
  mudarStatus: vi.fn(),
  listNovosPeloLink: vi.fn(),
  findOrCreateCliente: vi.fn(),
  listClientes: vi.fn(),
  listServicos: vi.fn(),
  listAjustes: vi.fn(),
  fecharHorario: vi.fn(),
  criarExtra: vi.fn(),
  removerAjuste: vi.fn(),
}));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({
  listAgendamentos: m.listAgendamentos,
  criarAgendamento: m.criarAgendamento,
  editarAgendamento: m.editarAgendamento,
  mudarStatus: m.mudarStatus,
  listNovosPeloLink: m.listNovosPeloLink,
}));
vi.mock('../../src/data/clientes', () => ({ findOrCreateCliente: m.findOrCreateCliente, listClientes: m.listClientes }));
vi.mock('../../src/data/servicos', () => ({ listServicos: m.listServicos }));
vi.mock('../../src/data/ajustes', () => ({
  listAjustes: m.listAjustes,
  fecharHorario: m.fecharHorario,
  criarExtra: m.criarExtra,
  removerAjuste: m.removerAjuste,
}));

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
  m.listAjustes.mockResolvedValue([]);
  m.listNovosPeloLink.mockResolvedValue([]);
  localStorage.clear();
  m.fecharHorario.mockResolvedValue(undefined);
  m.criarExtra.mockResolvedValue(undefined);
  m.removerAjuste.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

const abrirNovo = async (rotulo = 'Marcar ter 17/11 às 09:00') => {
  await userEvent.click(await screen.findByRole('button', { name: rotulo }));
  await userEvent.click(screen.getByRole('button', { name: 'Marcar cliente' }));
};
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
      servico_id: null,
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

  it('salvar com telefone inválido mostra "WhatsApp inválido" e não grava', async () => {
    m.listClientes.mockResolvedValue([]);
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Pedro');
    await userEvent.type(screen.getByLabelText('Telefone'), '1234');
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp inválido. Use DDD + número, ou + e o código do país.');
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
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar' }));
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

  it('tocar num horário livre oferece "Marcar cliente" e "Fechar este horário"', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 09:00' }));
    expect(screen.getByRole('button', { name: 'Marcar cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar este horário' })).toBeInTheDocument();
  });

  it('Fechar este horário grava o fechado e recarrega', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 09:00' }));
    const antes = m.listAjustes.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Fechar este horário' }));
    expect(m.fecharHorario).toHaveBeenCalledWith({}, '2026-11-17T12:00:00.000Z');
    await waitFor(() => expect(m.listAjustes.mock.calls.length).toBeGreaterThan(antes));
  });

  it('horário fechado aparece como "fechado" e pode ser reaberto', async () => {
    m.listAjustes.mockResolvedValue([{ id: 'f1', tipo: 'fechado', inicio: '2026-11-17T12:00:00.000Z' }]);
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /09:00 fechado/ }));
    expect(screen.queryByRole('button', { name: 'Marcar ter 17/11 às 09:00' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(m.removerAjuste).toHaveBeenCalledWith({}, 'f1');
  });

  it('+ Horário extra abre um horário fora do expediente', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Horário extra' }));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-17' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '19:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Abrir horário' }));
    expect(m.criarExtra).toHaveBeenCalledWith({}, '2026-11-17T22:00:00.000Z');
  });

  it('o horário extra aparece livre na grade', async () => {
    m.listAjustes.mockResolvedValue([{ id: 'e1', tipo: 'extra', inicio: '2026-11-17T22:00:00.000Z' }]);
    renderComConfig(<Agenda />);
    expect(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 19:00' })).toBeInTheDocument();
    expect(m.listAjustes).toHaveBeenCalledWith({}, '2026-11-17', '2026-11-17');
  });

  it('o formulário começa em "Sem serviço" e ocupa um horário (30 min)', async () => {
    renderComConfig(<Agenda />);
    await abrirNovo();
    expect(screen.getByLabelText('Serviço')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Sem serviço' })).toBeInTheDocument();
  });

  it('com o serviço "Corte e barba" (60 min) ocupa 60 min', async () => {
    m.listServicos.mockResolvedValue([CORTE, { id: 's2', nome: 'Corte e barba', duracao_min: 60, ativo: true }]);
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Jo');
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    await userEvent.selectOptions(screen.getByLabelText('Serviço'), 's2');
    await salvar();
    expect(m.criarAgendamento).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ servico_id: 's2', inicio: '2026-11-17T12:00:00.000Z', fim: '2026-11-17T13:00:00.000Z' }),
    );
  });

  it('agendamento feito pelo link mostra a etiqueta "pelo link"', async () => {
    m.listAgendamentos.mockResolvedValue([{ ...JOAO_TERCA, origem: 'link' }]);
    renderComConfig(<Agenda />);
    const botao = await screen.findByRole('button', { name: /10:00 João/ });
    expect(botao).toHaveTextContent('pelo link');
  });

  it('na primeira abertura grava a visita e não mostra aviso', async () => {
    renderComConfig(<Agenda />);
    await screen.findByRole('button', { name: /10:00 João/ });
    expect(localStorage.getItem('agenda:ultimaVisita')).toBe('2026-11-17T11:00:00.000Z');
    expect(m.listNovosPeloLink).not.toHaveBeenCalled();
  });

  it('mostra quantos agendamentos chegaram pelo link desde a última visita e some ao tocar', async () => {
    localStorage.setItem('agenda:ultimaVisita', '2026-11-16T10:00:00.000Z');
    m.listNovosPeloLink.mockResolvedValue([
      { ...MARIA_QUARTA, origem: 'link', criado_em: '2026-11-17T10:30:00+00:00' },
      { ...JOAO_TERCA, origem: 'link', criado_em: '2026-11-16T22:00:00+00:00' },
    ]);
    renderComConfig(<Agenda />);
    expect(await screen.findByText('2 agendamentos novos pelo link')).toBeInTheDocument();
    expect(m.listNovosPeloLink).toHaveBeenCalledWith({}, '2026-11-16T10:00:00.000Z');
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByText(/novos? pelo link/)).not.toBeInTheDocument();
    // guarda o criado_em mais recente mostrado (relógio do servidor), não a hora do celular
    expect(localStorage.getItem('agenda:ultimaVisita')).toBe('2026-11-17T10:30:00+00:00');
  });

  it('um só usa o singular', async () => {
    localStorage.setItem('agenda:ultimaVisita', '2026-11-16T10:00:00.000Z');
    m.listNovosPeloLink.mockResolvedValue([{ ...MARIA_QUARTA, origem: 'link' }]);
    renderComConfig(<Agenda />);
    expect(await screen.findByText('1 agendamento novo pelo link')).toBeInTheDocument();
  });

  it('localStorage indisponível não quebra a Agenda', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    renderComConfig(<Agenda />);
    expect(await screen.findByRole('button', { name: /10:00 João/ })).toBeInTheDocument();
    getItem.mockRestore();
  });

  it('depois de cancelar, "Avisar no WhatsApp" usa a mensagem pronta de cancelamento', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar agendamento' }));
    const aviso = await screen.findByRole('link', { name: 'Avisar no WhatsApp' });
    const msg = mensagemCancelar({ nome: 'João', inicio: JOAO_TERCA.inicio, fuso: CONFIG_TESTE.fuso }, linkAgendamento());
    expect(msg).toContain('não vou conseguir te atender terça-feira (17/11) às 10h');
    expect(aviso).toHaveAttribute('href', waLink('5511987654321', msg));
    expect(screen.getByText(/Cancelado/)).toBeInTheDocument();
  });

  it('num marcado, "Confirmar no WhatsApp" grava e só depois mostra "Abrir WhatsApp"', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar no WhatsApp' }));
    expect(m.mudarStatus).toHaveBeenCalledWith({}, 'a1', 'confirmado');
    expect(await screen.findByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute(
      'href',
      waLink('5511987654321', mensagemConfirmar({ nome: 'João', inicio: JOAO_TERCA.inicio, fuso: CONFIG_TESTE.fuso })),
    );
  });

  it('se a confirmação falhar, mostra o erro e não oferece o WhatsApp', async () => {
    m.mudarStatus.mockRejectedValue(new Error('rede'));
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar no WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar');
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument();
  });

  it('dois toques em "Confirmar no WhatsApp" gravam uma vez só', async () => {
    let terminar: () => void = () => {};
    m.mudarStatus.mockReturnValue(new Promise<void>((r) => (terminar = r)));
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    const botao = screen.getByRole('button', { name: 'Confirmar no WhatsApp' });
    await userEvent.click(botao);
    expect(botao).toBeDisabled();
    await userEvent.click(botao);
    terminar();
    await screen.findByRole('link', { name: 'Abrir WhatsApp' });
    expect(m.mudarStatus).toHaveBeenCalledTimes(1);
  });

  it('num confirmado, não há "Confirmar no WhatsApp"', async () => {
    m.listAgendamentos.mockResolvedValue([{ ...JOAO_TERCA, status: 'confirmado' }]);
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    expect(screen.queryByRole('button', { name: 'Confirmar no WhatsApp' })).not.toBeInTheDocument();
  });

  it('depois de marcar um cliente existente, aparece "Mandar confirmação no WhatsApp"', async () => {
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Jo');
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    await salvar();
    expect(await screen.findByRole('heading', { name: 'Agendamento marcado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mandar confirmação no WhatsApp' })).toHaveAttribute(
      'href',
      waLink('5511987654321', mensagemConfirmar({ nome: 'João', inicio: '2026-11-17T12:00:00.000Z', fuso: CONFIG_TESTE.fuso })),
    );
    const antes = m.listAgendamentos.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(m.listAgendamentos.mock.calls.length).toBeGreaterThan(antes));
    expect(screen.queryByRole('heading', { name: 'Agendamento marcado' })).not.toBeInTheDocument();
  });

  it('depois de marcar um cliente novo, a confirmação vai para o telefone dele', async () => {
    m.listClientes.mockResolvedValue([]);
    m.findOrCreateCliente.mockResolvedValue({ id: 'c9', nome: 'Pedro', telefone: '5511977776666', criado_em: '2026-11-01T00:00:00Z' });
    renderComConfig(<Agenda />);
    await abrirNovo();
    await userEvent.type(screen.getByLabelText('Cliente'), 'Pedro');
    await userEvent.type(screen.getByLabelText('Telefone'), '(11) 97777-6666');
    await salvar();
    expect(await screen.findByRole('link', { name: 'Mandar confirmação no WhatsApp' })).toHaveAttribute(
      'href',
      waLink('5511977776666', mensagemConfirmar({ nome: 'Pedro', inicio: '2026-11-17T12:00:00.000Z', fuso: CONFIG_TESTE.fuso })),
    );
  });

  it('editar um agendamento não mostra o painel "Agendamento marcado"', async () => {
    renderComConfig(<Agenda />);
    await userEvent.click(await screen.findByRole('button', { name: /10:00 João/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await salvar();
    await waitFor(() => expect(m.editarAgendamento).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Agendamento marcado' })).not.toBeInTheDocument();
  });

  it('ao voltar para o app, busca de novo os agendamentos novos pelo link', async () => {
    localStorage.setItem('agenda:ultimaVisita', '2026-11-16T10:00:00.000Z');
    renderComConfig(<Agenda />);
    await screen.findByRole('button', { name: /10:00 João/ });
    expect(screen.queryByText(/novos? pelo link/)).not.toBeInTheDocument();
    m.listNovosPeloLink.mockResolvedValue([{ ...MARIA_QUARTA, origem: 'link', criado_em: '2026-11-17T10:50:00+00:00' }]);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(await screen.findByText('1 agendamento novo pelo link')).toBeInTheDocument();
  });

  it('a Agenda mostra o cartão Amanhã', async () => {
    renderComConfig(<Agenda />);
    expect(await screen.findByText(/^Amanhã:/)).toBeInTheDocument();
  });
});
