import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthFalso } from '../helpers/auth';

const { auth } = vi.hoisted(() => ({ auth: {} as AuthFalso }));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(auth);
  return { supabase: { auth }, configurado: true };
});

import App from '../../src/ui/App';

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
