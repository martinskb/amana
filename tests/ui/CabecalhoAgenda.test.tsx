import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linkAgendamento } from '../../src/lib/link';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ saveConfig: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/configuracoes', () => ({ saveConfig: m.saveConfig, getConfig: vi.fn() }));

import CabecalhoAgenda from '../../src/ui/CabecalhoAgenda';

const FECHADO = "Link fechado: quem abrir verá 'Agendamento online fechado no momento.'";

// sem encadear: no Vitest 5, mockReset().mockResolvedValue() seguido de mockRejectedValue no teste
// faz a rejeição ser reportada como erro solto
beforeEach(() => {
  m.saveConfig.mockReset();
  m.saveConfig.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('CabecalhoAgenda', () => {
  it('mostra o logo da Amana à esquerda; o nome do negócio fica no título da agenda', () => {
    renderComConfig(<CabecalhoAgenda />);
    const cab = screen.getByRole('banner');
    expect(cab.firstElementChild).toBe(screen.getByRole('img', { name: 'Amana' }));
    expect(screen.queryByText(CONFIG_TESTE.nome_negocio)).toBeNull();
  });

  it('com o link aberto, a chave mostra "Link aberto" e aria-pressed=true', () => {
    renderComConfig(<CabecalhoAgenda />);
    const chave = screen.getByRole('button', { name: 'Link de agendamento aberto' });
    expect(chave).toHaveAttribute('aria-pressed', 'true');
    expect(chave).toHaveTextContent('Link aberto');
  });

  it('fechar o link grava link_ativo=false, recarrega e avisa', async () => {
    const { recarregar } = renderComConfig(<CabecalhoAgenda />);
    await userEvent.click(screen.getByRole('button', { name: 'Link de agendamento aberto' }));
    expect(m.saveConfig).toHaveBeenCalledWith({}, { link_ativo: false });
    expect(recarregar).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(FECHADO);
    expect(screen.getByRole('button', { name: 'Link de agendamento fechado' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('abrir o link grava link_ativo=true e avisa', async () => {
    renderComConfig(<CabecalhoAgenda />, { ...CONFIG_TESTE, link_ativo: false });
    await userEvent.click(screen.getByRole('button', { name: 'Link de agendamento fechado' }));
    expect(m.saveConfig).toHaveBeenCalledWith({}, { link_ativo: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Link aberto: clientes já podem agendar.');
  });

  it('a chave fica desabilitada enquanto salva', async () => {
    let terminar: () => void = () => {};
    m.saveConfig.mockReturnValue(new Promise<void>((r) => (terminar = r)));
    renderComConfig(<CabecalhoAgenda />);
    await userEvent.click(screen.getByRole('button', { name: 'Link de agendamento aberto' }));
    expect(screen.getByRole('button', { name: /Link de agendamento/ })).toBeDisabled();
    await act(async () => terminar());
    expect(screen.getByRole('button', { name: /Link de agendamento/ })).toBeEnabled();
  });

  it('falha ao salvar volta ao estado anterior e avisa', async () => {
    m.saveConfig.mockRejectedValue(new Error('sem rede'));
    renderComConfig(<CabecalhoAgenda />);
    await userEvent.click(screen.getByRole('button', { name: 'Link de agendamento aberto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Confira a internet e tente de novo.');
    expect(screen.getByRole('button', { name: 'Link de agendamento aberto' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Copiar link copia o endereço, avisa e o botão mostra "Copiado ✓"', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderComConfig(<CabecalhoAgenda />);
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(writeText).toHaveBeenCalledWith(linkAgendamento());
    expect(await screen.findByRole('status')).toHaveTextContent('Link copiado!');
    expect(screen.getByRole('button', { name: 'Copiar link' })).toHaveTextContent('Copiado ✓');
  });

  it('falha ao copiar mostra o link para copiar à mão', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    renderComConfig(<CabecalhoAgenda />);
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(`Não deu para copiar. O link é: ${linkAgendamento()}`);
  });

  it('a engrenagem leva aos Ajustes', () => {
    renderComConfig(<CabecalhoAgenda />);
    expect(screen.getByRole('link', { name: 'Ajustes' }).getAttribute('href')).toMatch(/\/config$/);
  });
});
