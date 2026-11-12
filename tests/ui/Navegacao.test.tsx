import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Navegacao from '../../src/ui/Navegacao';

function renderizar(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Navegacao nomeNegocio="Barbearia do Zé" />
    </MemoryRouter>,
  );
}

describe('Navegacao', () => {
  it.each(['Agenda', 'Link', 'Ajustes'])('o link %s tem nome acessível e ícone decorativo', (nome) => {
    renderizar();
    const link = screen.getByRole('link', { name: nome });
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('marca a aba da rota atual', () => {
    renderizar('/link');
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current');
  });

  it('mostra o nome do negócio para a barra lateral', () => {
    renderizar();
    expect(screen.getByText('Barbearia do Zé')).toHaveClass('marca');
  });
});
