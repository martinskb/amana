import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendamentoCompleto } from '../../src/types';
import { renderComConfig } from '../helpers/render';
import LinhaAgora from '../../src/ui/LinhaAgora';
import LinhaDoTempo from '../../src/ui/LinhaDoTempo';
import type { Item } from '../../src/ui/semana';

const HOJE = '2026-11-17'; // terça; expediente 09–12 e 14–18 (CONFIG_TESTE)
const FUSO = 'America/Sao_Paulo';

function ag(id: string, hora: string, nome: string): AgendamentoCompleto {
  const [h, mi] = hora.split(':').map(Number);
  const ini = new Date(Date.UTC(2026, 10, 17, h + 3, mi));
  return {
    id,
    cliente_id: 'c1',
    servico_id: 's1',
    inicio: ini.toISOString(),
    fim: new Date(ini.getTime() + 30 * 60_000).toISOString(),
    status: 'marcado',
    observacao: null,
    origem: 'dono',
    criado_em: '2026-11-01T00:00:00Z',
    cliente: { nome, telefone: '5511911112222' },
    servico: { nome: 'Corte' },
  };
}

const ITENS: Item[] = [
  { tipo: 'agendamento', hora: '09:00', agendamento: ag('a1', '09:00', 'Ana') },
  { tipo: 'agendamento', hora: '10:00', agendamento: ag('a2', '10:00', 'Bia') },
  { tipo: 'livre', hora: '10:30' },
  { tipo: 'livre', hora: '11:00' },
];

const menosMovimento = (sim: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: sim && q === '(prefers-reduced-motion: reduce)',
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

/** Hora local de São Paulo (UTC−3) no dia de hoje. */
const as = (hora: string) => {
  const [h, mi] = hora.split(':').map(Number);
  return new Date(Date.UTC(2026, 10, 17, h + 3, mi));
};

const linha = (data = HOJE) =>
  renderComConfig(<LinhaDoTempo data={data} itens={ITENS} modo="dia" novos={new Set()} onItem={() => {}} />);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LinhaAgora', () => {
  it('tem o rótulo "Agora, HH:MM" e o "agora" à mão é decoração', () => {
    render(
      <ol>
        <LinhaAgora agora={as('14:12')} fuso={FUSO} />
      </ol>,
    );
    expect(screen.getByText('Agora, 14:12')).toBeInTheDocument();
    expect(screen.getByText('agora')).toHaveAttribute('aria-hidden', 'true');
  });

  it('entra animada; com menos movimento, já aparece no lugar', () => {
    const { container, unmount } = render(
      <ol>
        <LinhaAgora agora={as('14:12')} fuso={FUSO} />
      </ol>,
    );
    expect(container.querySelector('.lt-agora')).toHaveClass('anima');
    unmount();
    menosMovimento(true);
    const outro = render(
      <ol>
        <LinhaAgora agora={as('14:12')} fuso={FUSO} />
      </ol>,
    );
    expect(outro.container.querySelector('.lt-agora')).not.toHaveClass('anima');
  });
});

describe('linha do agora na LinhaDoTempo', () => {
  it('aparece hoje, dentro do expediente, logo depois do item que já começou', () => {
    vi.setSystemTime(as('10:12'));
    linha();
    const agora = screen.getByText('Agora, 10:12').closest('li')!;
    const bia = screen.getByRole('button', { name: /^10:00 Bia/ }).closest('li')!;
    const livre = screen.getByRole('button', { name: 'Marcar ter 17/11 às 10:30' }).closest('li')!;
    expect(bia.nextElementSibling).toBe(agora);
    expect(agora.nextElementSibling).toBe(livre);
  });

  it('não aparece fora do expediente', () => {
    vi.setSystemTime(as('12:40')); // intervalo de almoço
    linha();
    expect(screen.queryByText(/^Agora, /)).toBeNull();
    vi.setSystemTime(as('08:00'));
    linha();
    expect(screen.queryByText(/^Agora, /)).toBeNull();
  });

  it('não aparece em outro dia', () => {
    vi.setSystemTime(as('10:12'));
    linha('2026-11-18');
    expect(screen.queryByText(/^Agora, /)).toBeNull();
  });

  it('se move a cada minuto', () => {
    vi.setSystemTime(as('10:29'));
    linha();
    expect(screen.getByText('Agora, 10:29')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    const agora = screen.getByText('Agora, 10:30').closest('li')!;
    // às 10:30 o horário das 10:30 já começou: a linha passa para depois dele
    const livre = screen.getByRole('button', { name: 'Marcar ter 17/11 às 10:30' }).closest('li')!;
    expect(livre.nextElementSibling).toBe(agora);
  });
});
