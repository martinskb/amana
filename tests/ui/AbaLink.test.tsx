import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linkAgendamento } from '../../src/lib/link';
import { mensagemDivulgar } from '../../src/lib/mensagens';
import { waLink } from '../../src/lib/whatsapp';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ listAgendamentos: vi.fn(), listAjustes: vi.fn(), saveConfig: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentos: m.listAgendamentos }));
vi.mock('../../src/data/ajustes', () => ({ listAjustes: m.listAjustes }));
vi.mock('../../src/data/configuracoes', () => ({ saveConfig: m.saveConfig, getConfig: vi.fn() }));

import AbaLink from '../../src/ui/AbaLink';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z')); // terça 08:00 em São Paulo
  m.listAgendamentos.mockReset().mockResolvedValue([]);
  m.listAjustes.mockReset().mockResolvedValue([]);
  m.saveConfig.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

const resumo = () => screen.getByTestId('resumo-livres');

describe('aba Link', () => {
  it('mostra o título e o endereço por inteiro', () => {
    renderComConfig(<AbaLink />);
    expect(screen.getByRole('heading', { name: 'Seu link de agendamento' })).toBeInTheDocument();
    expect(screen.getByText(linkAgendamento())).toBeInTheDocument();
  });

  it('Copiar link copia o endereço e avisa', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderComConfig(<AbaLink />);
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(writeText).toHaveBeenCalledWith(linkAgendamento());
    expect(await screen.findByText('Link copiado!')).toBeInTheDocument();
  });

  it('Mandar no WhatsApp usa a mensagem de divulgação sem contato', () => {
    renderComConfig(<AbaLink />);
    expect(screen.getByRole('link', { name: 'Mandar no WhatsApp' })).toHaveAttribute(
      'href',
      waLink(null, mensagemDivulgar(linkAgendamento())),
    );
  });

  it('desligar a chave grava link_ativo false e recarrega', async () => {
    const { recarregar } = renderComConfig(<AbaLink />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Link ligado' }));
    expect(m.saveConfig).toHaveBeenCalledWith({}, { link_ativo: false });
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
  });

  it('com o link desligado mostra o aviso e esconde o resumo', () => {
    renderComConfig(<AbaLink />, { ...CONFIG_TESTE, link_ativo: false });
    expect(
      screen.getByText("O link está fechado: quem abrir verá 'Agendamento online fechado no momento.'"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('resumo-livres')).not.toBeInTheDocument();
  });

  it('o resumo mostra até 8 próximos horários', async () => {
    renderComConfig(<AbaLink />);
    await waitFor(() => expect(resumo()).toHaveTextContent('ter 9h, 9h30, 10h, 10h30, 11h, 11h30, 14h, 14h30'));
    expect(resumo()).not.toHaveTextContent('15h');
    expect(m.listAgendamentos).toHaveBeenCalledWith({}, '2026-11-17', '2026-11-30');
    expect(m.listAjustes).toHaveBeenCalledWith({}, '2026-11-17', '2026-11-30');
  });

  it('o resumo respeita os horários fechados', async () => {
    m.listAjustes.mockResolvedValue([{ id: 'f1', tipo: 'fechado', inicio: '2026-11-17T12:00:00.000Z' }]);
    renderComConfig(<AbaLink />);
    await waitFor(() => expect(resumo()).toHaveTextContent(/^Próximos horários livres: ter 9h30/));
  });

  it('ao voltar para o app, recarrega o resumo', async () => {
    renderComConfig(<AbaLink />);
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenCalledTimes(1));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenCalledTimes(2));
  });

  it('falha ao gravar a chave volta ao estado anterior e avisa', async () => {
    m.saveConfig.mockRejectedValue(new Error('rede'));
    renderComConfig(<AbaLink />);
    const chave = screen.getByRole('checkbox', { name: 'Link ligado' });
    await userEvent.click(chave);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Confira a internet e tente de novo.');
    expect(chave).toBeChecked();
  });
});
