import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
