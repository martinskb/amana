import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemAcessoError, SemConexaoError } from '../../src/data/erros';
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
  auth.erroSessao = null;
  getConfig.mockReset().mockResolvedValue(CONFIG_TESTE);
  window.location.hash = '';
});

describe('login e sessão', () => {
  it('sem sessão mostra o botão "Entrar com Google"', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar com Google' }));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
  });

  it('entra com código de 6 dígitos digitado no próprio app', async () => {
    render(<App />);
    await userEvent.type(await screen.findByLabelText('E-mail'), 'dono@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Receber código por e-mail' }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'dono@exemplo.com', options: { shouldCreateUser: false } });
    expect(await screen.findByText('Enviamos um código de 6 dígitos para o seu e-mail.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Código'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'dono@exemplo.com', token: '123456', type: 'email' });
  });

  it('código errado mostra mensagem clara', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ data: {}, error: { message: 'Token has expired or is invalid', status: 403 } });
    render(<App />);
    await userEvent.type(await screen.findByLabelText('E-mail'), 'dono@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Receber código por e-mail' }));
    await userEvent.type(await screen.findByLabelText('Código'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou vencido.');
  });

  it('falha de rede ao pedir o código culpa a conexão, não o e-mail', async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { message: 'Failed to fetch', status: 0 } } as never);
    render(<App />);
    await userEvent.type(await screen.findByLabelText('E-mail'), 'dono@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Receber código por e-mail' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor');
  });

  it('erro ao ler a sessão (sem internet ou projeto pausado) mostra o aviso de conexão, não o login', async () => {
    auth.erroSessao = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 };
    render(<App />);
    expect(await screen.findByText('Não foi possível conectar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar com Google' })).not.toBeInTheDocument();
    auth.erroSessao = null;
    auth.sessao = SESSAO;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
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

  it('conta sem acesso mostra o aviso e o botão Sair', async () => {
    auth.sessao = SESSAO;
    getConfig.mockRejectedValueOnce(new SemAcessoError());
    render(<App />);
    expect(await screen.findByText(/não tem acesso a esta agenda/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(auth.signOut).toHaveBeenCalled();
  });
});
