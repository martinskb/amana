import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemAcessoError, SemConexaoError } from '../../src/data/erros';
import { CONFIG_TESTE } from '../helpers/config';
import { gravar, ler } from '../../src/lib/cache';
import { SESSAO, type AuthFalso } from '../helpers/auth';

const { auth, getConfig, getHorariosPublicos } = vi.hoisted(() => ({
  auth: {} as AuthFalso,
  getConfig: vi.fn(),
  getHorariosPublicos: vi.fn(),
}));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(auth);
  return { supabase: { auth }, configurado: true };
});
vi.mock('../../src/data/configuracoes', () => ({ getConfig, saveConfig: vi.fn() }));
vi.mock('../../src/data/publico', () => ({ getHorariosPublicos }));
vi.mock('../../src/ui/Agenda', () => ({ default: () => <h2>Agenda</h2> }));
vi.mock('../../src/ui/Configuracoes', () => ({ default: () => <h2>Ajustes</h2> }));

import App from '../../src/ui/App';
import { emailDoUsuario } from '../../src/ui/Login';

beforeEach(() => {
  localStorage.clear();
  getHorariosPublicos.mockReset().mockRejectedValue(new Error('sem rede'));
  auth.sessao = null;
  auth.erroSessao = null;
  getConfig.mockReset().mockResolvedValue(CONFIG_TESTE);
  window.location.hash = '';
});

describe('login e sessão', () => {
  it('o login mostra a marca Amana, o nome do negócio e a frase', async () => {
    render(<App />);
    expect(await screen.findByRole('img', { name: 'Amana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('chega de "tem horário?"')).toBeInTheDocument();
  });

  // um cliente que troque o endereço da página pública não chega a nenhuma tela do dono
  it.each(['#/config', '#/', '#/link', '#/qualquer'])('%s sem sessão mostra o login', async (hash) => {
    window.location.hash = hash;
    render(<App />);
    expect(await screen.findByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ajustes' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Agenda' })).toBeNull();
  });

  it('com sessão, não há abas de navegação', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('#/link com sessão leva à agenda', async () => {
    auth.sessao = SESSAO;
    window.location.hash = '#/link';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
  });

  const entrar = async (usuario: string, senha: string) => {
    await userEvent.type(await screen.findByLabelText('Usuário'), usuario);
    await userEvent.type(screen.getByLabelText('Senha'), senha);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  };

  it('emailDoUsuario acrescenta @dono.agenda e respeita e-mail completo', () => {
    expect(emailDoUsuario(' Joao ')).toBe('joao@dono.agenda');
    expect(emailDoUsuario('a@b.com')).toBe('a@b.com');
  });

  it('o login mostra o subtítulo', async () => {
    render(<App />);
    expect(await screen.findByText('Entre para ver sua agenda')).toBeInTheDocument();
  });

  it('enquanto lê a sessão, mostra o esqueleto de carregamento', () => {
    render(<App />);
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
  });

  it('entrar chama signInWithPassword com o e-mail do usuário', async () => {
    render(<App />);
    await entrar('joao', 'segredo123');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'joao@dono.agenda', password: 'segredo123' });
  });

  it('usuário ou senha errados mostram mensagem clara', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 },
    } as never);
    render(<App />);
    await entrar('joao', 'errada123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.');
  });

  it('falha de rede ao entrar culpa a conexão', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Failed to fetch', status: 0 } } as never);
    render(<App />);
    await entrar('joao', 'segredo123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor');
  });

  it('não há login com Google nem por código', async () => {
    render(<App />);
    await screen.findByLabelText('Usuário');
    expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
  });

  it('erro ao ler a sessão (sem internet ou projeto pausado) mostra o aviso de conexão, não o login', async () => {
    auth.erroSessao = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 };
    render(<App />);
    expect(await screen.findByText('Não foi possível conectar.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Usuário')).not.toBeInTheDocument();
    auth.erroSessao = null;
    auth.sessao = SESSAO;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
  });

  it('com sessão mostra a Agenda', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument();
  });

  it('evento SIGNED_OUT volta para o login', async () => {
    auth.sessao = SESSAO;
    render(<App />);
    await screen.findByRole('heading', { name: 'Agenda' });
    act(() => auth.emitir('SIGNED_OUT', null));
    expect(await screen.findByLabelText('Usuário')).toBeInTheDocument();
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

  it.each([
    ['#/link', 'Agenda'],
    ['#/config', 'Ajustes'],
    ['#/livres', 'Agenda'],
    ['#/lembretes', 'Agenda'],
    ['#/clientes', 'Ajustes'],
    ['#/qualquer-coisa', 'Agenda'],
  ])('%s abre "%s"', async (hash, titulo) => {
    auth.sessao = SESSAO;
    window.location.hash = hash;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: titulo })).toBeInTheDocument();
  });
});

describe('nome do negócio no login', () => {
  it('mostra o nome guardado em amana:nome', async () => {
    gravar('nome', 'Barbearia X');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Barbearia X' })).toBeInTheDocument();
  });

  it('a chamada pública troca o nome e atualiza título e cache', async () => {
    gravar('nome', 'Barbearia X');
    getHorariosPublicos.mockResolvedValue({ nome_negocio: 'Novo Nome', horarios: [] });
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Novo Nome' })).toBeInTheDocument();
    expect(document.title).toBe('Novo Nome');
    expect(ler<string>('nome')?.valor).toBe('Novo Nome');
  });

  it('se a chamada rejeita, nada muda e não aparece alerta', async () => {
    gravar('nome', 'Barbearia X');
    render(<App />);
    await screen.findByLabelText('Usuário');
    await waitFor(() => expect(getHorariosPublicos).toHaveBeenCalled());
    expect(screen.getByRole('heading', { level: 1, name: 'Barbearia X' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
