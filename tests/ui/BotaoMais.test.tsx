import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BotaoMais from '../../src/ui/BotaoMais';

function montar() {
  const onNovo = vi.fn();
  const onExtra = vi.fn();
  render(
    <div>
      <p>fora</p>
      <BotaoMais onNovo={onNovo} onExtra={onExtra} />
    </div>,
  );
  return { onNovo, onExtra };
}

describe('BotaoMais', () => {
  it('começa fechado; tocar em "Adicionar" abre o menu com os dois itens e foca o primeiro', async () => {
    montar();
    const mais = screen.getByRole('button', { name: 'Adicionar' });
    expect(mais).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).toBeNull();
    await userEvent.click(mais);
    expect(mais).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Novo agendamento' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Horário extra' })).toBeInTheDocument();
  });

  it('"Novo agendamento" chama onNovo e fecha o menu', async () => {
    const { onNovo, onExtra } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }));
    expect(onNovo).toHaveBeenCalledTimes(1);
    expect(onExtra).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).toBeNull();
  });

  it('"Horário extra" chama onExtra', async () => {
    const { onNovo, onExtra } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Horário extra' }));
    expect(onExtra).toHaveBeenCalledTimes(1);
    expect(onNovo).not.toHaveBeenCalled();
  });

  it('Esc fecha e devolve o foco ao "+"', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toHaveFocus();
  });

  it('tocar fora fecha', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await userEvent.click(screen.getByText('fora'));
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).toBeNull();
  });

  it('com o menu aberto, Tab fica preso entre o "+" e os itens', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Horário extra' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Novo agendamento' })).toHaveFocus();
  });
});
