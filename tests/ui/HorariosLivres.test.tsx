import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waLink } from '../../src/lib/whatsapp';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ listAgendamentos: vi.fn(), listServicos: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentos: m.listAgendamentos }));
vi.mock('../../src/data/servicos', () => ({ listServicos: m.listServicos }));

import HorariosLivres from '../../src/ui/HorariosLivres';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z')); // terça 08:00 em São Paulo
  m.listAgendamentos.mockReset().mockResolvedValue([]);
  m.listServicos.mockReset().mockResolvedValue([
    { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true },
    { id: 's2', nome: 'Corte e barba', duracao_min: 60, ativo: true },
  ]);
});

afterEach(() => vi.useRealTimers());

const texto = () => screen.getByLabelText('Mensagem') as HTMLTextAreaElement;

describe('Horários livres', () => {
  it('escolher "Amanhã" e "Corte" mostra o texto gerado', async () => {
    const user = userEvent.setup();
    renderComConfig(<HorariosLivres />);
    await screen.findByRole('option', { name: /Corte \(30 min\)/ });
    await user.selectOptions(screen.getByLabelText('Período'), 'amanha');
    await user.selectOptions(screen.getByLabelText('Serviço'), 's1');
    await waitFor(() => expect(texto().value).toContain('qua 9h, 9h30'));
    expect(texto().value.startsWith('Horários livres: ')).toBe(true);
    expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-18', '2026-11-18');
  });

  it('a lista oferece só serviços ativos', async () => {
    renderComConfig(<HorariosLivres />);
    await screen.findByRole('option', { name: /Corte \(30 min\)/ });
    expect(m.listServicos).toHaveBeenCalledWith({}, { soAtivos: true });
  });

  it('texto é editável e Copiar usa o texto atual', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderComConfig(<HorariosLivres />);
    await waitFor(() => expect(texto().value).toContain('ter'));
    fireEvent.change(texto(), { target: { value: 'Texto meu' } });
    await user.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith('Texto meu');
    expect(await screen.findByText('Copiado!')).toBeInTheDocument();
  });

  it('"Abrir WhatsApp" usa o texto atual sem contato definido', async () => {
    renderComConfig(<HorariosLivres />);
    await waitFor(() => expect(texto().value).toContain('ter'));
    fireEvent.change(texto(), { target: { value: 'ter 14h' } });
    expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute('href', waLink(null, 'ter 14h'));
  });

  it('sem horários mostra a mensagem amigável', async () => {
    const vazio = { ...CONFIG_TESTE, expediente: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
    renderComConfig(<HorariosLivres />, vazio);
    await waitFor(() => expect(texto().value).toContain('Sem horários livres'));
  });

  it('ao voltar para o app no dia seguinte, recalcula a partir de agora', async () => {
    renderComConfig(<HorariosLivres />);
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-17', '2026-11-23'));
    vi.setSystemTime(new Date('2026-11-18T11:00:00Z'));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-18', '2026-11-24'));
  });
});
