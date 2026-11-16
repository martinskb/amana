import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gravar, ler } from '../../src/lib/cache';
import type { AgendamentoCompleto, Pessoa } from '../../src/types';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({
  listAgendamentos: vi.fn(),
  listNovosPeloLink: vi.fn(),
  listServicos: vi.fn(),
  listAjustes: vi.fn(),
}));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({
  listAgendamentos: m.listAgendamentos,
  listNovosPeloLink: m.listNovosPeloLink,
  criarAgendamento: vi.fn(),
  editarAgendamento: vi.fn(),
  mudarStatus: vi.fn(),
}));
vi.mock('../../src/data/clientes', () => ({ findOrCreateCliente: vi.fn(), listClientes: vi.fn(async () => []) }));
vi.mock('../../src/data/servicos', () => ({ listServicos: m.listServicos }));
vi.mock('../../src/data/ajustes', () => ({ listAjustes: m.listAjustes, fecharHorario: vi.fn(), criarExtra: vi.fn(), removerAjuste: vi.fn() }));

import Agenda from '../../src/ui/Agenda';

const ANA: Pessoa = { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: [], servicos: ['s1'] };
const BIA: Pessoa = { id: 'p2', nome: 'Bia', ativo: true, ordem: 2, folgas: [], servicos: ['s1'] };

function ag(id: string, inicio: string, nome: string, pessoa_id: string, origem: 'dono' | 'link' = 'dono'): AgendamentoCompleto {
  const fim = new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString();
  return {
    id,
    cliente_id: `c-${id}`,
    servico_id: 's1',
    inicio,
    fim,
    status: 'marcado',
    observacao: null,
    origem,
    criado_em: '2026-11-17T10:00:00Z',
    cliente: { nome, telefone: '5511900000000' },
    pessoa_id,
    servico: { nome: 'Corte' },
  };
}

// terça 17/11: João 10:00 com Ana, Maria 11:00 com Bia; quarta 18/11: Pedro 15:00 com Ana, Lia 15:00 com Bia
const DIA = [
  ag('a1', '2026-11-17T13:00:00.000Z', 'João', 'p1'),
  ag('a2', '2026-11-17T14:00:00.000Z', 'Maria', 'p2'),
  ag('a3', '2026-11-18T18:00:00.000Z', 'Pedro', 'p1'),
  ag('a4', '2026-11-18T18:00:00.000Z', 'Lia', 'p2'),
];
// pelo link, na semana seguinte, com a Bia
const NOVO_BIA = ag('n1', '2026-11-25T13:00:00.000Z', 'Rita', 'p2', 'link');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z')); // terça 08:00 em São Paulo
  for (const f of Object.values(m)) f.mockReset();
  m.listAgendamentos.mockImplementation(async (_db, de: string, ate: string) =>
    DIA.filter((a) => {
      const dia = a.inicio.slice(0, 10);
      return dia >= de && dia <= ate;
    }),
  );
  m.listServicos.mockResolvedValue([{ id: 's1', nome: 'Corte', duracao_min: 30, ativo: true }]);
  m.listAjustes.mockResolvedValue([]);
  m.listNovosPeloLink.mockResolvedValue([NOVO_BIA]);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const filtro = () => screen.getByRole('group', { name: 'Pessoa' });
const itemDe = async (nome: string) => (await screen.findByText(nome)).closest('button')!;

describe('Agenda com duas pessoas', () => {
  it('mostra o filtro com "todos" escolhido e o nome da pessoa em cada cliente', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    expect(within(await itemDe('João')).getByText('Ana')).toHaveClass('lt-pessoa');
    expect(within(await itemDe('Maria')).getByText('Bia')).toBeInTheDocument();
    expect(within(filtro()).getByRole('button', { name: 'todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('escolher Ana esconde os clientes da Bia, tira a etiqueta e fica guardado no aparelho', async () => {
    const { unmount } = renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await itemDe('Maria');
    await userEvent.click(within(filtro()).getByRole('button', { name: 'Ana' }));
    expect(screen.queryByText('Maria')).toBeNull();
    expect(within(await itemDe('João')).queryByText('Ana')).toBeNull();
    expect(ler('filtro-pessoa')?.valor).toBe('p1');
    unmount();
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await itemDe('João');
    expect(within(filtro()).getByRole('button', { name: 'Ana' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Maria')).toBeNull();
  });

  it('filtro guardado de uma pessoa desativada volta para todos', async () => {
    gravar('filtro-pessoa', 'p3');
    const velha: Pessoa = { id: 'p3', nome: 'Cida', ativo: false, ordem: 3, folgas: [], servicos: [] };
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA, velha]);
    await itemDe('Maria');
    expect(within(filtro()).getByRole('button', { name: 'todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(filtro()).queryByRole('button', { name: 'Cida' })).toBeNull();
  });

  it('livre no modo dia diz quem está livre; com o filtro, igual a hoje', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    expect(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 09:00' })).toHaveTextContent('livre · Ana · Bia');
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 10:00' })).toHaveTextContent('livre · Bia');
    await userEvent.click(within(filtro()).getByRole('button', { name: 'Ana' }));
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 09:00' })).toHaveTextContent(/^09:00 livre$/);
    expect(screen.queryByRole('button', { name: 'Marcar ter 17/11 às 10:00' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 11:00' })).toBeInTheDocument();
  });

  it('a contagem da semana segue o filtro', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await itemDe('Maria');
    const dias = screen.getByRole('group', { name: 'Dias da semana' });
    expect(within(dias).getAllByRole('button', { name: /2 clientes/ })).toHaveLength(2);
    await userEvent.click(within(filtro()).getByRole('button', { name: 'Bia' }));
    expect(within(dias).queryAllByRole('button', { name: /2 clientes/ })).toHaveLength(0);
    expect(within(dias).getAllByRole('button', { name: /1 cliente\b/ })).toHaveLength(2);
  });

  it('Amanhã segue o filtro', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    const amanha = await screen.findByRole('complementary', { name: 'Amanhã' });
    await within(amanha).findByText('2 clientes pra lembrar');
    await userEvent.click(within(filtro()).getByRole('button', { name: 'Ana' }));
    expect(within(amanha).getByText('1 cliente pra lembrar')).toBeInTheDocument();
  });

  it('"N novos pelo link" segue o filtro', async () => {
    gravar('corte-novos', '2026-11-01T00:00:00.000Z');
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    expect(await screen.findByRole('button', { name: /1 novo pelo link/ })).toBeInTheDocument();
    await userEvent.click(within(filtro()).getByRole('button', { name: 'Ana' }));
    expect(screen.queryByRole('button', { name: /novo pelo link/ })).toBeNull();
  });

  it('na tela larga, o próximo cliente segue o filtro', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(min-width: 1280px)', media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    const resumo = await screen.findByRole('complementary', { name: 'Resumo' });
    await within(resumo).findByText('João');
    await userEvent.click(within(filtro()).getByRole('button', { name: 'Bia' }));
    await waitFor(() => expect(within(resumo).getByText('Maria')).toBeInTheDocument());
    expect(within(resumo).queryByText('João')).toBeNull();
  });
});

describe('Agenda com uma pessoa', () => {
  it('não tem filtro nem etiqueta de pessoa', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, { ...BIA, ativo: false }]);
    await itemDe('João');
    expect(screen.queryByRole('group', { name: 'Pessoa' })).toBeNull();
    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 09:00' })).toHaveTextContent(/^09:00 livre$/);
  });
});
