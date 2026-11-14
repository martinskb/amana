import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import { CONFIG_TESTE } from '../helpers/config';
import { SESSAO, type AuthFalso } from '../helpers/auth';

const { auth, getConfig } = vi.hoisted(() => ({ auth: {} as AuthFalso, getConfig: vi.fn() }));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(auth);
  return { supabase: { auth }, configurado: true };
});
vi.mock('../../src/data/configuracoes', () => ({ getConfig, saveConfig: vi.fn() }));
vi.mock('../../src/ui/Agenda', () => ({ default: () => <h2>Agenda</h2> }));
vi.mock('../../src/ui/Configuracoes', () => ({ default: () => <h2>Ajustes</h2> }));

import App from '../../src/ui/App';

beforeEach(() => {
  localStorage.clear();
  document.title = '';
  auth.sessao = null;
  auth.erroSessao = null;
  getConfig.mockReset().mockResolvedValue(CONFIG_TESTE);
  window.location.hash = '';
});

describe('App', () => {
  it('mostra o nome do negócio vindo de VITE_NOME_NEGOCIO', async () => {
    vi.stubEnv('VITE_NOME_NEGOCIO', 'Barbearia Teste');
    render(<App />);
    expect(await screen.findByText('Barbearia Teste')).toBeInTheDocument();
  });

  it('sem VITE_NOME_NEGOCIO o login mostra "Amana"', async () => {
    vi.stubEnv('VITE_NOME_NEGOCIO', '');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Amana', level: 1 })).toBeInTheDocument();
  });
});

describe('App: cache da config', () => {
  it('com config guardada e getConfig pendente, a agenda aparece sem esqueleto', async () => {
    auth.sessao = SESSAO;
    gravar('config', CONFIG_TESTE);
    getConfig.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando' })).toBeNull();
  });

  it('depois de getConfig, o título e amana:nome recebem o nome do negócio', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    expect(document.title).toBe(CONFIG_TESTE.nome_negocio);
    expect(ler<string>('nome')?.valor).toBe(CONFIG_TESTE.nome_negocio);
    expect(ler('config')).not.toBeNull();
  });

  it('SIGNED_OUT apaga amana:config e mantém amana:nome', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    expect(ler('config')).not.toBeNull();
    act(() => auth.emitir('SIGNED_OUT', null));
    expect(await screen.findByLabelText('Usuário')).toBeInTheDocument();
    expect(ler('config')).toBeNull();
    expect(ler('nome')).not.toBeNull();
  });

  it('erro de conexão com config em cache mantém a agenda, sem SemConexao', async () => {
    const { SemConexaoError } = await import('../../src/data/erros');
    auth.sessao = SESSAO;
    gravar('config', CONFIG_TESTE);
    getConfig.mockRejectedValue(new SemConexaoError());
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    await act(async () => {});
    expect(screen.queryByText('Não foi possível conectar.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
  });
});
