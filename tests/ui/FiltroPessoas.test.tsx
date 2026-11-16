import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Pessoa } from '../../src/types';
import FiltroPessoas from '../../src/ui/FiltroPessoas';

const pessoa = (i: number, nome: string | null = `P${i}`): Pessoa => ({ id: `p${i}`, nome, ativo: true, ordem: i, folgas: [], servicos: [] });

describe('FiltroPessoas', () => {
  it('"todos" primeiro, depois as ativas pela ordem com o nome de exibição; marca a escolhida', async () => {
    const onEscolher = vi.fn();
    render(
      <FiltroPessoas
        pessoas={[pessoa(2, null), pessoa(1, 'Ana'), { ...pessoa(3, 'Velha'), ativo: false }]}
        escolhida="p2"
        onEscolher={onEscolher}
      />,
    );
    const grupo = screen.getByRole('group', { name: 'Pessoa' });
    const botoes = within(grupo).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['todos', 'Ana', 'Pessoa 2']);
    expect(botoes[2]).toHaveAttribute('aria-pressed', 'true');
    expect(botoes[0]).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(botoes[1]);
    expect(onEscolher).toHaveBeenCalledWith('p1');
    await userEvent.click(botoes[0]);
    expect(onEscolher).toHaveBeenCalledWith(null);
  });

  it('20 pessoas cabem numa faixa que rola na horizontal', () => {
    const vinte = Array.from({ length: 20 }, (_, i) => pessoa(i + 1));
    render(<FiltroPessoas pessoas={vinte} escolhida={null} onEscolher={() => {}} />);
    const grupo = screen.getByRole('group', { name: 'Pessoa' });
    expect(grupo).toHaveClass('filtro-pessoas');
    expect(within(grupo).getAllByRole('button')).toHaveLength(21);
  });
});
