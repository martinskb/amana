import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FaixaSemana from '../../src/ui/FaixaSemana';
import { diasDaSemana } from '../../src/lib/semanaCalendario';

const DIAS = diasDaSemana('2026-11-09'); // seg 09 a dom 15/11

function montar(extra: Partial<Parameters<typeof FaixaSemana>[0]> = {}) {
  const onEscolher = vi.fn();
  const onSemana = vi.fn();
  render(
    <FaixaSemana
      dias={DIAS}
      selecionado="2026-11-14"
      contagem={{ '2026-11-10': 2, '2026-11-14': 3, '2026-11-15': 1 }}
      comNovo={new Set(['2026-11-15'])}
      onEscolher={onEscolher}
      onSemana={onSemana}
      {...extra}
    />,
  );
  return { onEscolher, onSemana };
}

describe('FaixaSemana', () => {
  it('é um grupo de 7 dias, de segunda a domingo, com o escolhido pressionado', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Dias da semana' });
    const dias = within(grupo).getAllByRole('button');
    expect(dias).toHaveLength(7);
    expect(dias.map((d) => d.textContent)).toEqual(['seg9', 'ter10', 'qua11', 'qui12', 'sex13', 'sáb14', 'dom15']);
    expect(dias.filter((d) => d.getAttribute('aria-pressed') === 'true')).toEqual([dias[5]]);
  });

  it('cada dia tem o nome completo com a quantidade de clientes', () => {
    montar();
    expect(screen.getByRole('button', { name: 'sábado, 14 de novembro, 3 clientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'segunda, 9 de novembro, nenhum cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'domingo, 15 de novembro, 1 cliente, com novo pelo link' })).toBeInTheDocument();
  });

  it('dia com cliente ganha a bolinha; com novo pelo link, o risco de caneta', () => {
    montar();
    const marca = (nome: RegExp) => screen.getByRole('button', { name: nome }).querySelector('.fd-marca');
    expect(marca(/^segunda/)).toBeNull();
    expect(marca(/^terça/)).toHaveClass('bolinha');
    expect(marca(/^domingo/)).toHaveClass('risco');
  });

  it('tocar num dia escolhe esse dia; as setas mudam a semana', async () => {
    const { onEscolher, onSemana } = montar();
    await userEvent.click(screen.getByRole('button', { name: /^quarta, 11/ }));
    expect(onEscolher).toHaveBeenCalledWith('2026-11-11');
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(onSemana).toHaveBeenLastCalledWith(-1);
    await userEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(onSemana).toHaveBeenLastCalledWith(1);
  });
});
