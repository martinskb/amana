import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Esqueleto from '../../src/ui/Esqueleto';

describe('Esqueleto', () => {
  it('avisa "Carregando" aos leitores de tela e esconde as gotas', () => {
    const { container } = render(<Esqueleto linhas={3} />);
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    expect(container.querySelectorAll('.esqueleto-linha')).toHaveLength(3);
    const gotas = container.querySelectorAll('.esqueleto-gota');
    expect(gotas.length).toBeGreaterThanOrEqual(4);
    expect(gotas.length).toBeLessThanOrEqual(6);
    gotas.forEach((g) => expect(g).toHaveAttribute('aria-hidden', 'true'));
  });
});
