import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const { saveConfig, listServicos, saveServico, listClientes, listAgendamentosDoCliente } = vi.hoisted(() => ({
  saveConfig: vi.fn(),
  listServicos: vi.fn(),
  saveServico: vi.fn(),
  listClientes: vi.fn(),
  listAgendamentosDoCliente: vi.fn(),
}));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/configuracoes', () => ({ saveConfig, getConfig: vi.fn() }));
vi.mock('../../src/data/servicos', () => ({ listServicos, saveServico }));
vi.mock('../../src/data/clientes', () => ({ listClientes }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentosDoCliente }));

import Configuracoes from '../../src/ui/Configuracoes';

const CORTE = { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true };

beforeEach(() => {
  saveConfig.mockReset().mockResolvedValue(undefined);
  listServicos.mockReset().mockResolvedValue([CORTE]);
  saveServico.mockReset().mockImplementation(async (_db, s) => ({ id: 'novo', ...s }));
  listClientes.mockReset().mockResolvedValue([{ id: 'c1', nome: 'João', telefone: '5511987654321', criado_em: '2026-11-01T00:00:00Z' }]);
  listAgendamentosDoCliente.mockReset().mockResolvedValue([]);
});

const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
const hora = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe('Configurações', () => {
  it('edita expediente de terça com dois intervalos e salva', async () => {
    const config = { ...CONFIG_TESTE, expediente: { ...CONFIG_TESTE.expediente, 2: [] } };
    const { recarregar } = renderComConfig(<Configuracoes />, config);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar intervalo na terça' }));
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar intervalo na terça' }));
    hora('Terça, início 1', '09:00');
    hora('Terça, fim 1', '12:00');
    hora('Terça, início 2', '14:00');
    hora('Terça, fim 2', '18:00');
    await salvar();
    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig.mock.calls[0][1].expediente[2]).toEqual([
      { inicio: '09:00', fim: '12:00' },
      { inicio: '14:00', fim: '18:00' },
    ]);
    expect(recarregar).toHaveBeenCalled();
    expect(await screen.findByText('Salvo!')).toBeInTheDocument();
  });

  it('remove um intervalo', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover intervalo 2 da terça' }));
    await salvar();
    expect(saveConfig.mock.calls[0][1].expediente[2]).toEqual([{ inicio: '09:00', fim: '12:00' }]);
  });

  it('rejeita intervalo com fim antes do início', async () => {
    renderComConfig(<Configuracoes />);
    hora('Terça, fim 1', '08:00');
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('O fim precisa ser depois do início');
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('adiciona folga', async () => {
    renderComConfig(<Configuracoes />);
    hora('Nova folga', '2026-12-25');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar folga' }));
    await salvar();
    expect(saveConfig.mock.calls[0][1].folgas).toEqual(['2026-12-25']);
  });

  it('adiciona serviço "Barba" com 30 min', async () => {
    renderComConfig(<Configuracoes />);
    await screen.findByText('Corte');
    await userEvent.type(screen.getByLabelText('Nome do serviço'), 'Barba');
    await userEvent.clear(screen.getByLabelText('Duração (min)'));
    await userEvent.type(screen.getByLabelText('Duração (min)'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar serviço' }));
    expect(saveServico).toHaveBeenCalledWith({}, { nome: 'Barba', duracao_min: 30, ativo: true });
    expect(await screen.findByText('Barba')).toBeInTheDocument();
  });

  it.each(['Negócio', 'Horários', 'Serviços', 'Clientes', 'Backup'])('a seção %s é um cartão', async (titulo) => {
    renderComConfig(<Configuracoes />);
    const h = await screen.findByRole('heading', { name: titulo });
    expect(h.closest('section')).toHaveClass('cartao');
  });

  it('o ativo do serviço é uma chave (checkbox estilizado)', async () => {
    renderComConfig(<Configuracoes />);
    expect(await screen.findByRole('checkbox', { name: 'Corte ativo' })).toHaveClass('chave');
  });

  it('o link "‹ Agenda" volta para a agenda', async () => {
    renderComConfig(<Configuracoes />);
    expect((await screen.findByRole('link', { name: '‹ Agenda' })).getAttribute('href')).toBe('/');
  });

  it('desativar serviço grava ativo=false', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Corte ativo' }));
    expect(saveServico).toHaveBeenCalledWith({}, { ...CORTE, ativo: false });
  });

  it('edita o nome do negócio', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.clear(screen.getByLabelText('Nome do negócio'));
    fireEvent.change(screen.getByLabelText('Nome do negócio'), { target: { value: 'Barbearia Nova' } });
    await salvar();
    await waitFor(() => expect(saveConfig).toHaveBeenCalled());
    expect(saveConfig.mock.calls[0][1]).toMatchObject({ nome_negocio: 'Barbearia Nova' });
  });

  it('tem o botão "Baixar backup"', () => {
    renderComConfig(<Configuracoes />);
    expect(screen.getByRole('button', { name: 'Baixar backup' })).toBeInTheDocument();
  });
});

describe('Configurações do link', () => {
  const campo = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

  it('salva duração, dias do link e WhatsApp do negócio', async () => {
    renderComConfig(<Configuracoes />);
    campo('Duração de cada horário (min)', '40');
    campo('Quantos dias o link mostra', '21');
    campo('WhatsApp do negócio', '(11) 90000-2222');
    await salvar();
    expect(saveConfig.mock.calls[0][1]).toMatchObject({
      passo_min: 40,
      dias_abertos: 21,
      telefone_negocio: '5511900002222',
    });
  });

  it('não tem a seção Mensagens nem os campos de modelo', () => {
    renderComConfig(<Configuracoes />);
    for (const rotulo of ['Mensagem de horários livres', 'Mensagem de lembrete', 'Mensagem de cancelamento']) {
      expect(screen.queryByLabelText(rotulo)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Mensagens' })).not.toBeInTheDocument();
  });

  it('não tem a chave do link nem "Copiar link de agendamento" (foram para a aba Link)', () => {
    renderComConfig(<Configuracoes />);
    expect(screen.queryByLabelText('Link de agendamento ligado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar link de agendamento' })).not.toBeInTheDocument();
  });

  it('salvar não manda link_ativo nem os modelos', async () => {
    renderComConfig(<Configuracoes />);
    await salvar();
    expect(Object.keys(saveConfig.mock.calls[0][1]).sort()).toEqual(
      ['dias_abertos', 'expediente', 'folgas', 'nome_negocio', 'passo_min', 'telefone_negocio'],
    );
  });

  it('as seções aparecem na ordem Negócio, Horários, Serviços, Clientes, Backup', () => {
    renderComConfig(<Configuracoes />);
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Negócio', 'Horários', 'Serviços', 'Clientes', 'Backup']);
  });

  it('a seção Clientes busca e abre o histórico', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.type(screen.getByLabelText('Buscar'), 'Jo');
    await waitFor(() => expect(listClientes).toHaveBeenLastCalledWith({}, 'Jo'));
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    expect(listAgendamentosDoCliente).toHaveBeenCalledWith({}, 'c1');
  });

  it('WhatsApp do negócio vazio grava nulo', async () => {
    renderComConfig(<Configuracoes />);
    campo('WhatsApp do negócio', '');
    await salvar();
    expect(saveConfig.mock.calls[0][1].telefone_negocio).toBeNull();
  });

  it('WhatsApp do negócio inválido mostra a mensagem e não salva', async () => {
    renderComConfig(<Configuracoes />);
    campo('WhatsApp do negócio', '9999');
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp inválido. Use DDD + número, ou + e o código do país.');
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it.each([['0'], ['61']])('dias do link = %s é recusado', async (dias) => {
    renderComConfig(<Configuracoes />);
    campo('Quantos dias o link mostra', dias);
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('Os dias do link precisam ficar entre 1 e 60.');
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it.each([['4'], ['241']])('duração = %s é recusada', async (dur) => {
    renderComConfig(<Configuracoes />);
    campo('Duração de cada horário (min)', dur);
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('A duração de cada horário precisa ficar entre 5 e 240 minutos.');
    expect(saveConfig).not.toHaveBeenCalled();
  });
});
