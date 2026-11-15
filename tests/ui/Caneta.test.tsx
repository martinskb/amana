import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Circulado, NotaMao } from '../../src/ui/Caneta';

/** Stub de matchMedia: só "menos movimento" responde. */
const menosMovimento = (sim: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: sim && q === '(prefers-reduced-motion: reduce)',
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

afterEach(() => vi.unstubAllGlobals());

describe('Circulado', () => {
  it('é decoração: um path de caneta escondido do leitor', () => {
    const { container } = render(<Circulado desenhar={false} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('circulado');
    expect(svg.querySelector('path')).not.toBeNull();
  });

  it('já aparece desenhado; com desenhar, ganha a classe que anima o traço', () => {
    const { container, rerender } = render(<Circulado desenhar={false} />);
    expect(container.querySelector('svg')).not.toHaveClass('desenhando');
    rerender(<Circulado desenhar />);
    expect(container.querySelector('svg')).toHaveClass('desenhando');
  });

  it('com menos movimento, nunca anima', () => {
    menosMovimento(true);
    const { container } = render(<Circulado desenhar />);
    expect(container.querySelector('svg')).not.toHaveClass('desenhando');
  });
});

describe('NotaMao', () => {
  it('é decoração escrita à mão, escondida do leitor', () => {
    const { getByText } = render(<NotaMao>marcou sozinho!</NotaMao>);
    const nota = getByText('marcou sozinho!');
    expect(nota).toHaveAttribute('aria-hidden', 'true');
    expect(nota).toHaveClass('nota-mao');
    expect(nota).not.toHaveClass('escrevendo');
  });

  it('com atraso, aparece escrita depois desse tempo', () => {
    const { getByText } = render(<NotaMao atraso={700}>marcou sozinho!</NotaMao>);
    const nota = getByText('marcou sozinho!');
    expect(nota).toHaveClass('escrevendo');
    expect(nota.style.animationDelay).toBe('700ms');
  });

  it('com menos movimento, já aparece pronta', () => {
    menosMovimento(true);
    const { getByText } = render(<NotaMao atraso={700}>marcou sozinho!</NotaMao>);
    expect(getByText('marcou sozinho!')).not.toHaveClass('escrevendo');
  });
});
