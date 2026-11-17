import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import { CONFIG_TESTE } from '../helpers/config';
import { SESSAO, type AuthFalso } from '../helpers/auth';
import { PESSOA_TESTE } from '../helpers/pessoas';
import type { Pessoa } from '../../src/types';

const { auth, getConfig, listPessoas } = vi.hoisted(() => ({ auth: {} as AuthFalso, getConfig: vi.fn(), listPessoas: vi.fn() }));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(auth);
  return { supabase: { auth }, configurado: true };
});
vi.mock('../../src/data/configuracoes', () => ({ getConfig, saveConfig: vi.fn() }));
vi.mock('../../src/data/pessoas', () => ({ listPessoas }));
vi.mock('../../src/ui/Agenda', async () => {
  const { useConfig } = await import('../../src/ui/contexto');
  function AgendaFalsa() {
    const { pessoas } = useConfig();
    return (
      <>
        <h2>Agenda</h2>
        <p data-testid="pessoas">{pessoas.map((p) => p.nome ?? '-').join(',')}</p>
      </>
    );
  }
  return { default: AgendaFalsa };
});
vi.mock('../../src/ui/Configuracoes', () => ({ default: () => <h2>Ajustes</h2> }));

import App from '../../src/ui/App';

beforeEach(() => {
  localStorage.clear();
  document.title = '';
  auth.sessao = null;
  auth.erroSessao = null;
  getConfig.mockReset().mockResolvedValue(CONFIG_TESTE);
  listPessoas.mockReset().mockResolvedValue([PESSOA_TESTE]);
  window.location.hash = '';
  adicionados = [];
  const original = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((...args: Parameters<typeof window.addEventListener>) => {
    adicionados.push(args);
    return original(...args);
  });
});

afterEach(() => vi.restoreAllMocks());

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

/**
 * Espera o App registrar o ouvinte de "online". A agenda aparece no commit, mas o efeito que registra o
 * ouvinte roda depois (a sessão chegou fora de act); disparar o evento antes disso não teria ouvinte.
 */
async function ouvindoOnline() {
  await waitFor(() =>
    expect(adicionados.some(([tipo]) => tipo === 'online')).toBe(true),
  );
}
let adicionados: unknown[][] = [];

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

  it('config guardada com outro formato é ignorada (esqueleto, não tela branca)', async () => {
    auth.sessao = SESSAO;
    gravar('config', { nome_negocio: 'X', expediente: null });
    getConfig.mockReturnValue(new Promise(() => {}));
    render(<App />);
    await act(async () => {});
    expect(screen.queryByRole('heading', { name: 'Agenda' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
  });

  it('config guardada com outro formato e sem conexão mostra SemConexao', async () => {
    const { SemConexaoError } = await import('../../src/data/erros');
    auth.sessao = SESSAO;
    gravar('config', { ...CONFIG_TESTE, passo_min: '30' });
    getConfig.mockRejectedValue(new SemConexaoError());
    render(<App />);
    expect(await screen.findByText('Não foi possível conectar.')).toBeInTheDocument();
  });

  it('com config guardada, o título da aba já é o nome do negócio antes da busca', async () => {
    auth.sessao = SESSAO;
    gravar('config', { ...CONFIG_TESTE, nome_negocio: 'Guardado' });
    getConfig.mockReturnValue(new Promise(() => {}));
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    expect(document.title).toBe('Guardado');
  });

  it('sessão que não renova sem internet, com config guardada: mostra a agenda guardada, não SemConexao', async () => {
    const { SemConexaoError } = await import('../../src/data/erros');
    auth.erroSessao = { name: 'AuthRetryableFetchError', status: 0 };
    gravar('config', CONFIG_TESTE);
    getConfig.mockRejectedValue(new SemConexaoError());
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível conectar.')).toBeNull();
  });

  it('sessão que não renova sem internet, sem config guardada: mostra SemConexao', async () => {
    auth.erroSessao = { name: 'AuthRetryableFetchError', status: 0 };
    render(<App />);
    expect(await screen.findByText('Não foi possível conectar.')).toBeInTheDocument();
  });

  it('quando a conexão volta, a sessão é lida de novo: se não vale mais, vai para o login', async () => {
    const { SemConexaoError } = await import('../../src/data/erros');
    auth.erroSessao = { name: 'AuthRetryableFetchError', status: 0 };
    gravar('config', CONFIG_TESTE);
    getConfig.mockRejectedValue(new SemConexaoError());
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    await ouvindoOnline();
    auth.erroSessao = null;
    auth.sessao = null;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByLabelText('Usuário')).toBeInTheDocument();
  });

  it('quando a conexão volta e a sessão renova, a agenda continua', async () => {
    const { SemConexaoError } = await import('../../src/data/erros');
    auth.erroSessao = { name: 'AuthRetryableFetchError', status: 0 };
    gravar('config', CONFIG_TESTE);
    getConfig.mockRejectedValue(new SemConexaoError());
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    await ouvindoOnline();
    auth.erroSessao = null;
    auth.sessao = SESSAO;
    getConfig.mockResolvedValue(CONFIG_TESTE);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando' })).toBeNull();
    expect(getConfig).toHaveBeenCalledTimes(2);
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

describe('App: pessoas', () => {
  const ana: Pessoa = { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: [], servicos: [] };
  const bia: Pessoa = { id: 'p2', nome: 'Bia', ativo: true, ordem: 2, folgas: [], servicos: [] };

  it('as pessoas guardadas aparecem antes da busca', async () => {
    auth.sessao = SESSAO;
    gravar('config', CONFIG_TESTE);
    gravar('pessoas', [ana, bia]);
    getConfig.mockReturnValue(new Promise(() => {}));
    listPessoas.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(await screen.findByTestId('pessoas')).toHaveTextContent('Ana,Bia');
  });

  it('pessoas guardadas com outro formato são ignoradas', async () => {
    auth.sessao = SESSAO;
    gravar('config', CONFIG_TESTE);
    gravar('pessoas', [{ id: 'p1' }]);
    getConfig.mockReturnValue(new Promise(() => {}));
    listPessoas.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(await screen.findByTestId('pessoas')).toHaveTextContent(/^$/);
  });

  it('depois da busca, as pessoas vão para o contexto e para o aparelho', async () => {
    auth.sessao = SESSAO;
    listPessoas.mockResolvedValue([ana, bia]);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('pessoas')).toHaveTextContent('Ana,Bia'));
    expect(ler('pessoas')?.valor).toEqual([ana, bia]);
  });

  it('falha ao buscar as pessoas não derruba a agenda: fica o que estava guardado', async () => {
    auth.sessao = SESSAO;
    gravar('pessoas', [ana]);
    listPessoas.mockRejectedValue(new Error('qualquer'));
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    await act(async () => {});
    expect(screen.getByTestId('pessoas')).toHaveTextContent('Ana');
  });

  it('SIGNED_OUT apaga amana:pessoas e mantém amana:filtro-pessoa', async () => {
    auth.sessao = SESSAO;
    gravar('filtro-pessoa', 'p2');
    render(<App />);
    await waitFor(() => expect(ler('pessoas')).not.toBeNull());
    act(() => auth.emitir('SIGNED_OUT', null));
    expect(await screen.findByLabelText('Usuário')).toBeInTheDocument();
    expect(ler('pessoas')).toBeNull();
    expect(ler('filtro-pessoa')?.valor).toBe('p2');
  });
});
