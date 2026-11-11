import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { linkAgendamento } from '../../src/lib/link';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const { saveConfig, listServicos, saveServico } = vi.hoisted(() => ({
  saveConfig: vi.fn(),
  listServicos: vi.fn(),
  saveServico: vi.fn(),
}));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/configuracoes', () => ({ saveConfig, getConfig: vi.fn() }));
vi.mock('../../src/data/servicos', () => ({ listServicos, saveServico }));

import Configuracoes from '../../src/ui/Configuracoes';

const CORTE = { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true };

beforeEach(() => {
  saveConfig.mockReset().mockResolvedValue(undefined);
  listServicos.mockReset().mockResolvedValue([CORTE]);
  saveServico.mockReset().mockImplementation(async (_db, s) => ({ id: 'novo', ...s }));
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

  it('desativar serviço grava ativo=false', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Corte ativo' }));
    expect(saveServico).toHaveBeenCalledWith({}, { ...CORTE, ativo: false });
  });

  it('edita modelos de mensagem e nome do negócio', async () => {
    renderComConfig(<Configuracoes />);
    for (const [rotulo, valor] of [
      ['Nome do negócio', 'Barbearia Nova'],
      ['Mensagem de horários livres', 'Livres: {horarios}'],
      ['Mensagem de lembrete', 'Oi {nome}, até amanhã!'],
    ]) {
      await userEvent.clear(screen.getByLabelText(rotulo));
      fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
    }
    await salvar();
    await waitFor(() => expect(saveConfig).toHaveBeenCalled());
    expect(saveConfig.mock.calls[0][1]).toMatchObject({
      nome_negocio: 'Barbearia Nova',
      modelo_livres: 'Livres: {horarios}',
      modelo_lembrete: 'Oi {nome}, até amanhã!',
    });
  });

  it('tem o botão "Baixar backup"', () => {
    renderComConfig(<Configuracoes />);
    expect(screen.getByRole('button', { name: 'Baixar backup' })).toBeInTheDocument();
  });
});

describe('Configurações do link', () => {
  const campo = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

  it('salva duração, dias do link, liga/desliga, WhatsApp do negócio e mensagem de cancelamento', async () => {
    renderComConfig(<Configuracoes />);
    campo('Duração de cada horário (min)', '40');
    campo('Quantos dias o link mostra', '21');
    await userEvent.click(screen.getByLabelText('Link de agendamento ligado'));
    campo('WhatsApp do negócio', '(11) 90000-2222');
    campo('Mensagem de cancelamento', 'Não vai dar, {nome}. {link}');
    await salvar();
    expect(saveConfig.mock.calls[0][1]).toMatchObject({
      passo_min: 40,
      dias_abertos: 21,
      link_ativo: false,
      telefone_negocio: '5511900002222',
      modelo_cancelamento: 'Não vai dar, {nome}. {link}',
    });
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

  it('"Copiar link de agendamento" copia o link', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderComConfig(<Configuracoes />);
    await user.click(screen.getByRole('button', { name: 'Copiar link de agendamento' }));
    expect(writeText).toHaveBeenCalledWith(linkAgendamento());
    expect(await screen.findByText('Link copiado!')).toBeInTheDocument();
  });
});
