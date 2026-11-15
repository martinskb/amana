import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendamentoCompleto, Status } from '../../src/types';
import { renderComConfig } from '../helpers/render';
import LinhaDoTempo from '../../src/ui/LinhaDoTempo';
import { agruparLivres, type Item } from '../../src/ui/semana';

const DIA = '2026-11-17'; // terça

function ag(id: string, hora: string, nome: string, status: Status = 'marcado', extra: Partial<AgendamentoCompleto> = {}): AgendamentoCompleto {
  // hora de São Paulo (UTC−3), 30 min
  const [h, mi] = hora.split(':').map(Number);
  const ini = new Date(Date.UTC(2026, 10, 17, h + 3, mi));
  return {
    id,
    cliente_id: 'c1',
    servico_id: 's1',
    inicio: ini.toISOString(),
    fim: new Date(ini.getTime() + 30 * 60_000).toISOString(),
    status,
    observacao: null,
    origem: 'dono',
    criado_em: '2026-11-01T00:00:00Z',
    pessoa_id: 'p1',
    cliente: { nome, telefone: '5511911112222' },
    servico: { nome: 'Corte' },
    ...extra,
  };
}

const item = (a: AgendamentoCompleto, hora: string): Item => ({ tipo: 'agendamento', hora, agendamento: a });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z')); // terça 09:00 em São Paulo
});
afterEach(() => vi.useRealTimers());

describe('LinhaDoTempo', () => {
  it('no modo dia, cada horário livre é uma linha própria que dá para tocar', async () => {
    const onItem = vi.fn();
    const itens: Item[] = [
      { tipo: 'livre', hora: '10:00' },
      { tipo: 'livre', hora: '10:30' },
      item(ag('a1', '11:00', 'Ana'), '11:00'),
    ];
    renderComConfig(<LinhaDoTempo data={DIA} itens={itens} modo="dia" novos={new Set()} onItem={onItem} />);
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 10:00' })).toHaveTextContent('livre');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar ter 17/11 às 10:30' }));
    expect(onItem).toHaveBeenCalledWith({ tipo: 'livre', hora: '10:30' });
    expect(screen.queryByText(/livre até/)).toBeNull();
  });

  it('no modo semana, livres seguidos viram "livre até" e abrem o primeiro horário', async () => {
    const onItem = vi.fn();
    const itens = agruparLivres(
      [{ tipo: 'livre', hora: '10:00' }, { tipo: 'livre', hora: '10:30' }, { tipo: 'livre', hora: '11:00' }],
      30,
    );
    renderComConfig(<LinhaDoTempo data={DIA} itens={itens} modo="semana" novos={new Set()} onItem={onItem} />);
    const grupo = screen.getByRole('button', { name: 'Marcar ter 17/11 entre 10:00 e 11:00' });
    expect(grupo).toHaveTextContent('10:00');
    expect(grupo).toHaveTextContent('livre até 11:30');
    await userEvent.click(grupo);
    expect(onItem).toHaveBeenCalledWith({ tipo: 'livres', de: '10:00', ate: '11:00' });
  });

  it('horário fechado aparece riscado e dá para tocar', async () => {
    const onItem = vi.fn();
    renderComConfig(
      <LinhaDoTempo data={DIA} itens={[{ tipo: 'fechado', hora: '10:00', ajusteId: 'f1' }]} modo="dia" novos={new Set()} onItem={onItem} />,
    );
    const fechado = screen.getByRole('button', { name: /10:00 fechado/ });
    expect(fechado.querySelector('s')).not.toBeNull();
    await userEvent.click(fechado);
    expect(onItem).toHaveBeenCalledWith({ tipo: 'fechado', hora: '10:00', ajusteId: 'f1' });
  });

  it('o status aparece como texto pequeno ao lado do nome, sem pílula', () => {
    const itens = [
      item(ag('a1', '10:00', 'Ana', 'marcado'), '10:00'),
      item(ag('a2', '11:00', 'Bia', 'confirmado'), '11:00'),
      item(ag('a3', '12:00', 'Caio', 'concluido'), '12:00'),
      item(ag('a4', '13:00', 'Duda', 'faltou'), '13:00'),
    ];
    const { container } = renderComConfig(<LinhaDoTempo data={DIA} itens={itens} modo="dia" novos={new Set()} onItem={() => {}} />);
    expect(screen.getByRole('button', { name: /^10:00 Ana/ })).toHaveTextContent('marcado');
    expect(screen.getByRole('button', { name: /^11:00 Bia/ })).toHaveTextContent('✓ confirmado');
    expect(screen.getByRole('button', { name: /^12:00 Caio/ })).toHaveTextContent('✓ concluído');
    const duda = screen.getByRole('button', { name: /^13:00 Duda/ });
    expect(duda).toHaveTextContent('faltou');
    // faltou: nome riscado
    expect(within(duda).getByText('Duda').closest('s')).not.toBeNull();
    expect(container.querySelector('.selo')).toBeNull();
    // um ponto por agendamento, com o status na classe (cheio, contorno da marca ou sutil)
    expect(container.querySelectorAll('.lt-ponto')).toHaveLength(4);
  });

  it('mostra o serviço, "pelo link" e o nome digitado diferente na linha de baixo', () => {
    const a = ag('a1', '10:00', 'João', 'marcado', { origem: 'link', nome_informado: 'Fulano' });
    renderComConfig(<LinhaDoTempo data={DIA} itens={[item(a, '10:00')]} modo="dia" novos={new Set()} onItem={() => {}} />);
    const botao = screen.getByRole('button', { name: /^10:00 João/ });
    expect(botao).toHaveTextContent('Corte · pelo link · digitou Fulano');
  });

  it('um agendamento novo pelo link ganha ", novo, marcado pelo link" no nome acessível', () => {
    const a = ag('a1', '10:00', 'Ana', 'marcado', { origem: 'link' });
    const b = ag('a2', '11:00', 'Bia', 'marcado', { origem: 'link' });
    renderComConfig(
      <LinhaDoTempo data={DIA} itens={[item(a, '10:00'), item(b, '11:00')]} modo="dia" novos={new Set(['a1'])} onItem={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /^10:00 Ana.*, novo, marcado pelo link$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^11:00 Bia/ }).textContent).not.toContain('novo');
  });

  it('agendamentos já passados ficam esmaecidos', () => {
    const itens = [item(ag('a1', '08:00', 'Ana'), '08:00'), item(ag('a2', '10:00', 'Bia'), '10:00')];
    renderComConfig(<LinhaDoTempo data={DIA} itens={itens} modo="dia" novos={new Set()} onItem={() => {}} />);
    expect(screen.getByRole('button', { name: /^08:00 Ana/ }).closest('li')).toHaveClass('passado');
    expect(screen.getByRole('button', { name: /^10:00 Bia/ }).closest('li')).not.toHaveClass('passado');
  });

  it('o item aberto no painel fica marcado com aria-current', () => {
    renderComConfig(
      <LinhaDoTempo data={DIA} itens={[item(ag('a1', '10:00', 'Ana'), '10:00')]} modo="dia" novos={new Set()} selecionado="ag:a1" onItem={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /^10:00 Ana/ })).toHaveAttribute('aria-current', 'true');
  });
});

describe('LinhaDoTempo: meia-noite com a tela aberta', () => {
  it('o dia de amanhã ganha a linha do agora quando o relógio passa da meia-noite (sem voltar ao app)', async () => {
    const { act } = await import('@testing-library/react');
    const { CONFIG_TESTE } = await import('../helpers/config');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T02:59:30Z')); // terça 23:59:30 em São Paulo
    const diaTodo = [{ inicio: '00:00', fim: '23:59' }];
    const config = { ...CONFIG_TESTE, expediente: { 0: diaTodo, 1: diaTodo, 2: diaTodo, 3: diaTodo, 4: diaTodo, 5: diaTodo, 6: diaTodo } };
    const itens: Item[] = [{ tipo: 'livre', hora: '10:00' }];
    renderComConfig(<LinhaDoTempo data="2026-11-18" itens={itens} modo="dia" novos={new Set()} onItem={() => {}} />, config);
    expect(screen.queryByText(/^Agora,/)).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByText('Agora, 00:00')).toBeInTheDocument();
  });
});
