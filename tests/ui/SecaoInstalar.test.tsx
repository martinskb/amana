import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _reiniciarParaTeste, iniciarCapturaInstalacao } from '../../src/lib/instalar';
import SecaoInstalar from '../../src/ui/SecaoInstalar';
import { eventoInstalacao, simularAparelho } from '../helpers/instalacao';

beforeEach(() => {
  _reiniciarParaTeste();
  simularAparelho();
  iniciarCapturaInstalacao();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('seção "Tela inicial" dos Ajustes', () => {
  it('aviso capturado antes de abrir os Ajustes: mostra o botão, que chama a instalação', async () => {
    const e = eventoInstalacao();
    window.dispatchEvent(e);
    render(<SecaoInstalar />);
    expect(screen.getByRole('heading', { name: 'Tela inicial' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Instalar na tela inicial' }));
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('o botão aparece se o aviso chegar com a seção aberta', () => {
    render(<SecaoInstalar />);
    expect(screen.queryByRole('button', { name: 'Instalar na tela inicial' })).toBeNull();
    act(() => {
      window.dispatchEvent(eventoInstalacao());
    });
    expect(screen.getByRole('button', { name: 'Instalar na tela inicial' })).toBeInTheDocument();
  });

  it('dispensou o aviso: o botão some e fica a instrução do menu', async () => {
    window.dispatchEvent(eventoInstalacao('dismissed'));
    render(<SecaoInstalar />);
    await userEvent.click(screen.getByRole('button', { name: 'Instalar na tela inicial' }));
    expect(screen.queryByRole('button', { name: 'Instalar na tela inicial' })).toBeNull();
    expect(screen.getByText('No menu do navegador, toque em "Instalar app" ou "Adicionar à tela inicial".')).toBeInTheDocument();
  });

  it('iPhone: instrução de Compartilhar, sem botão', () => {
    simularAparelho({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' });
    render(<SecaoInstalar />);
    expect(screen.getByText(/No Safari/)).toHaveTextContent('No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('já instalado', () => {
    simularAparelho({ standalone: true });
    render(<SecaoInstalar />);
    expect(screen.getByText('Já está na tela inicial.')).toBeInTheDocument();
  });

  it('sem aviso do navegador: instrução do menu', () => {
    render(<SecaoInstalar />);
    expect(screen.getByText('No menu do navegador, toque em "Instalar app" ou "Adicionar à tela inicial".')).toBeInTheDocument();
  });
});
