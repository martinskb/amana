import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/ui/App';

describe('App', () => {
  it('mostra o nome do negócio vindo de VITE_NOME_NEGOCIO', () => {
    vi.stubEnv('VITE_NOME_NEGOCIO', 'Barbearia Teste');
    render(<App />);
    expect(screen.getByText('Barbearia Teste')).toBeInTheDocument();
  });
});
