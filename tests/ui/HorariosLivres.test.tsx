import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linkAgendamento } from '../../src/lib/link';
import { waLink } from '../../src/lib/whatsapp';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ listAgendamentos: vi.fn(), listAjustes: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentos: m.listAgendamentos }));
vi.mock('../../src/data/ajustes', () => ({ listAjustes: m.listAjustes }));

import HorariosLivres from '../../src/ui/HorariosLivres';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z')); // terça 08:00 em São Paulo
  m.listAgendamentos.mockReset().mockResolvedValue([]);
  m.listAjustes.mockReset().mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

const texto = () => screen.getByLabelText('Mensagem') as HTMLTextAreaElement;

describe('Horários livres', () => {
  it('escolher "Amanhã" mostra o texto gerado com os horários ofertados', async () => {
    const user = userEvent.setup();
    renderComConfig(<HorariosLivres />);
    await user.selectOptions(await screen.findByLabelText('Período'), 'amanha');
    await waitFor(() => expect(texto().value).toContain('qua 9h, 9h30'));
    expect(texto().value.startsWith('Horários livres: ')).toBe(true);
    expect(m.listAgendamentos).toHaveBeenLastCalledWith({}, '2026-11-18', '2026-11-18');
    expect(m.listAjustes).toHaveBeenLastCalledWith({}, '2026-11-18', '2026-11-18');
  });

  it('não há mais seletor de serviço', async () => {
    renderComConfig(<HorariosLivres />);
    await screen.findByLabelText('Período');
    expect(screen.queryByLabelText('Serviço')).not.toBeInTheDocument();
  });

  it('o texto respeita os horários fechados', async () => {
    const user = userEvent.setup();
    m.listAjustes.mockResolvedValue([{ id: 'f1', tipo: 'fechado', inicio: '2026-11-18T12:00:00.000Z' }]);
    renderComConfig(<HorariosLivres />);
    await user.selectOptions(await screen.findByLabelText('Período'), 'amanha');
    await waitFor(() => expect(texto().value).toContain('qua 9h30'));
    expect(texto().value).not.toContain('qua 9h,');
  });

  it('{link} no modelo vira o link de agendamento', async () => {
    renderComConfig(<HorariosLivres />, { ...CONFIG_TESTE, modelo_livres: 'Livres: {horarios}\nMarque aqui: {link}' });
    await waitFor(() => expect(texto().value).toContain(`Marque aqui: ${linkAgendamento()}`));
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
