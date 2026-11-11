import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemConexaoError } from '../../src/data/erros';
import { CONFIG_TESTE } from '../helpers/config';
import { SESSAO, type AuthFalso } from '../helpers/auth';

const { auth, getConfig } = vi.hoisted(() => ({
  auth: {} as AuthFalso,
  getConfig: vi.fn(),
}));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(auth);
  return { supabase: { auth }, configurado: true };
});
vi.mock('../../src/data/configuracoes', () => ({ getConfig, saveConfig: vi.fn() }));
vi.mock('../../src/ui/Agenda', () => ({ default: () => <h2>Agenda</h2> }));

import App from '../../src/ui/App';

beforeEach(() => {
  auth.sessao = null;
  getConfig.mockReset().mockResolvedValue(CONFIG_TESTE);
  window.location.hash = '';
});

describe('login e sessão', () => {
  it('sem sessão mostra o botão "Entrar com Google" e o campo de e-mail', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar com Google' }));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));

    await userEvent.type(screen.getByLabelText('E-mail'), 'dono@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Receber link por e-mail' }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'dono@exemplo.com' }));
    expect(await screen.findByText('Enviamos um link para o seu e-mail.')).toBeInTheDocument();
  });

  it('com sessão mostra a Agenda', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Livres' })).toBeInTheDocument();
  });

  it('evento SIGNED_OUT volta para o login', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    act(() => auth.emitir('SIGNED_OUT', null));
    expect(await screen.findByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });

  it('SemConexaoError ao carregar mostra o aviso e "Tentar de novo" repete a carga', async () => {
    auth.sessao = SESSAO;
    getConfig.mockRejectedValueOnce(new SemConexaoError());
    render(<App />);
    expect(await screen.findByText('Não foi possível conectar.')).toBeInTheDocument();
    expect(screen.getByText(/Restore project/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(getConfig).toHaveBeenCalledTimes(2);
  });
});
