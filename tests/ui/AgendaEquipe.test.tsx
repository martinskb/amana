import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SemConexaoError } from '../../src/data/erros';
import { waLink } from '../../src/lib/whatsapp';
import type { AgendaEquipe as Agenda } from '../../src/types';
import type { AuthFalso } from '../helpers/auth';

const m = vi.hoisted(() => ({ auth: {} as AuthFalso, getAgendaEquipe: vi.fn() }));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(m.auth);
  return { supabase: { auth: m.auth }, configurado: true };
});
vi.mock('../../src/data/equipe', () => ({ getAgendaEquipe: m.getAgendaEquipe }));

import App from '../../src/ui/App';
import AgendaEquipe from '../../src/ui/publico/AgendaEquipe';

// terça 17/11 às 08:00 em São Paulo
const AGENDA: Agenda = {
  ok: true,
  negocio: 'Barbearia do João',
  pessoa: 'Ana',
  whatsapp: true,
  hoje: '2026-11-17',
  amanha: '2026-11-18',
  dias: [
    {
      data: '2026-11-17',
      clientes: [
        { inicio: '2026-11-17T10:00:00+00:00', fim: '2026-11-17T10:30:00+00:00', cliente: 'Marcos', servico: 'Corte', status: 'concluido', telefone: '5511900000001' },
        { inicio: '2026-11-17T13:00:00+00:00', fim: '2026-11-17T14:00:00+00:00', cliente: 'Pedro', servico: 'Corte + barba', status: 'marcado', telefone: '5511900000002' },
      ],
    },
    { data: '2026-11-18', clientes: [] },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z'));
  m.getAgendaEquipe.mockReset().mockResolvedValue(AGENDA);
  document.title = '';
  window.location.hash = '';
});
afterEach(() => vi.useRealTimers());

describe('página do link da equipe', () => {
  it('mostra pessoa e negócio, hoje com hora, cliente e serviço, e amanhã vazio', async () => {
    render(<AgendaEquipe codigo="abc" />);
    expect(await screen.findByRole('heading', { name: 'Ana · Barbearia do João', level: 1 })).toBeInTheDocument();
    const hoje = screen.getByRole('region', { name: /^hoje/ });
    expect(within(hoje).getByText('Pedro')).toBeInTheDocument();
    expect(hoje).toHaveTextContent('10:00');
    expect(hoje).toHaveTextContent('Corte + barba');
    expect(within(hoje).getByText('Marcos').closest('li')).toHaveClass('passado');
    expect(within(screen.getByRole('region', { name: /^amanhã/ })).getByText('nenhum cliente')).toBeInTheDocument();
    expect(document.title).toBe('Barbearia do João');
  });

  it('botão de WhatsApp só nos clientes com telefone', async () => {
    m.getAgendaEquipe.mockResolvedValue({
      ...AGENDA,
      dias: [{ ...AGENDA.dias[0], clientes: [AGENDA.dias[0].clientes[1], { ...AGENDA.dias[0].clientes[0], telefone: undefined }] }, AGENDA.dias[1]],
    });
    render(<AgendaEquipe codigo="abc" />);
    const link = await screen.findByRole('link', { name: 'WhatsApp de Pedro' });
    expect(link).toHaveAttribute('href', waLink('5511900000002', ''));
    expect(screen.queryByRole('link', { name: 'WhatsApp de Marcos' })).toBeNull();
  });

  it('link inválido: avisa e não mostra cliente', async () => {
    m.getAgendaEquipe.mockResolvedValue({ ok: false });
    render(<AgendaEquipe codigo="abc" />);
    expect(await screen.findByText('Este link não vale mais. Peça um novo para quem cuida da agenda.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^hoje/ })).toBeNull();
  });

  it('sem conexão: avisa e "Tentar de novo" busca de novo', async () => {
    m.getAgendaEquipe.mockRejectedValueOnce(new SemConexaoError());
    render(<AgendaEquipe codigo="abc" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Pedro')).toBeInTheDocument();
    expect(m.getAgendaEquipe).toHaveBeenCalledTimes(2);
  });

  it('busca de novo a cada 30 s', async () => {
    render(<AgendaEquipe codigo="abc" />);
    await screen.findByText('Pedro');
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(m.getAgendaEquipe).toHaveBeenCalledTimes(2);
  });

  it('App com #/equipe/<código> abre sem login, com o código decodificado e aparado', async () => {
    window.location.hash = '#/equipe/abc%20';
    render(<App />);
    expect(await screen.findByText('Pedro')).toBeInTheDocument();
    expect(m.getAgendaEquipe).toHaveBeenCalledWith(expect.anything(), 'abc');
    expect(screen.queryByLabelText('Usuário')).toBeNull();
  });
});
