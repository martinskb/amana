import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflitoDeHorarioError } from '../../src/data/erros';
import { gravar, ler } from '../../src/lib/cache';
import type { AgendamentoCompleto, Pessoa } from '../../src/types';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({
  listAgendamentos: vi.fn(),
  listNovosPeloLink: vi.fn(),
  listServicos: vi.fn(),
  listAjustes: vi.fn(),
  criarAgendamento: vi.fn(),
  editarAgendamento: vi.fn(),
  fecharHorario: vi.fn(),
  criarExtra: vi.fn(),
  removerAjuste: vi.fn(),
  findOrCreateCliente: vi.fn(),
}));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/agendamentos', () => ({
  listAgendamentos: m.listAgendamentos,
  listNovosPeloLink: m.listNovosPeloLink,
  criarAgendamento: m.criarAgendamento,
  editarAgendamento: m.editarAgendamento,
  mudarStatus: vi.fn(),
}));
vi.mock('../../src/data/clientes', () => ({ findOrCreateCliente: m.findOrCreateCliente, listClientes: vi.fn(async () => []) }));
vi.mock('../../src/data/servicos', () => ({ listServicos: m.listServicos }));
vi.mock('../../src/data/ajustes', () => ({
  listAjustes: m.listAjustes,
  fecharHorario: m.fecharHorario,
  criarExtra: m.criarExtra,
  removerAjuste: m.removerAjuste,
}));

import Agenda from '../../src/ui/Agenda';

const ANA: Pessoa = { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: [], servicos: ['s1'] };
const BIA: Pessoa = { id: 'p2', nome: 'Bia', ativo: true, ordem: 2, folgas: [], servicos: ['s1', 's2'] };

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
  m.listServicos.mockResolvedValue([
    { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true },
    { id: 's2', nome: 'Escova', duracao_min: 30, ativo: true },
  ]);
  m.criarAgendamento.mockResolvedValue({ id: 'novo' });
  m.editarAgendamento.mockResolvedValue(undefined);
  m.fecharHorario.mockResolvedValue(undefined);
  m.criarExtra.mockResolvedValue(undefined);
  m.removerAjuste.mockResolvedValue(undefined);
  m.findOrCreateCliente.mockResolvedValue({ id: 'c9', nome: 'Rui', telefone: '5511955554444', criado_em: '' });
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

const opcoes = (rotulo: string) =>
  within(screen.getByLabelText(rotulo) as HTMLSelectElement)
    .getAllByRole('option')
    .map((o) => o.textContent);
const valorDe = (rotulo: string) => {
  const sel = screen.getByLabelText(rotulo) as HTMLSelectElement;
  return sel.options[sel.selectedIndex]?.textContent;
};
async function abrirNovo(hora: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Marcar ter 17/11 às ${hora}` }));
  await userEvent.click(screen.getByRole('button', { name: 'Marcar cliente' }));
}

describe('painéis com duas pessoas', () => {
  it('Novo: "Com quem" só com quem está livre e faz o serviço; grava a pessoa e a confirmação diz com quem', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await abrirNovo('10:00');
    expect(opcoes('Com quem')).toEqual(['Bia']);
    await userEvent.type(screen.getByLabelText('Cliente'), 'Rui');
    await userEvent.type(screen.getByLabelText('Telefone'), '11955554444');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(m.criarAgendamento).toHaveBeenCalledWith({}, expect.objectContaining({ pessoa_id: 'p2' }));
    const link = await screen.findByRole('link', { name: 'Mandar confirmação no WhatsApp' });
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('às 10h com Bia. Até lá!');
  });

  it('Novo: vem a primeira livre; com o filtro, a do filtro; o serviço limita as opções', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await abrirNovo('09:00');
    expect(opcoes('Com quem')).toEqual(['Ana', 'Bia']);
    expect(valorDe('Com quem')).toBe('Ana');
    await userEvent.selectOptions(screen.getByLabelText('Serviço'), 's2');
    expect(opcoes('Com quem')).toEqual(['Bia']);
  });

  it('Novo com o filtro em Bia: vem a Bia', async () => {
    gravar('filtro-pessoa', 'p2');
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await abrirNovo('09:00');
    expect(valorDe('Com quem')).toBe('Bia');
  });

  it('Editar: mantém a pessoa enquanto pode; senão mostra a troca antes de salvar e grava a da tela', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await userEvent.click(await itemDe('João'));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(valorDe('Com quem')).toBe('Ana');
    await userEvent.selectOptions(screen.getByLabelText('Serviço'), 's2');
    expect(valorDe('Com quem')).toBe('Bia');
    expect(screen.getByText(/Ana não faz esse serviço ou não está livre nesse horário: vai com Bia/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(m.editarAgendamento).toHaveBeenCalledWith({}, 'a1', expect.objectContaining({ servico_id: 's2', pessoa_id: 'p2' }));
  });

  it('Detalhe: "com Ana" troca para outra pessoa livre que faz o serviço', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await userEvent.click(await itemDe('João'));
    await userEvent.click(screen.getByRole('button', { name: /^com Ana/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Trocar para' })).getByRole('button', { name: 'Bia' }));
    expect(m.editarAgendamento).toHaveBeenCalledWith({}, 'a1', { pessoa_id: 'p2' });
  });

  it('Detalhe: se o banco recusar, a mensagem de horário ocupado', async () => {
    m.editarAgendamento.mockRejectedValue(new ConflitoDeHorarioError());
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await userEvent.click(await itemDe('João'));
    await userEvent.click(screen.getByRole('button', { name: /^com Ana/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Trocar para' })).getByRole('button', { name: 'Bia' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário já está ocupado.');
  });

  it('Fechar: "Para" com o negócio todo e as pessoas; vem o negócio; grava para quem foi escolhido', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 09:00' }));
    expect(opcoes('Para')).toEqual(['o negócio todo', 'Ana', 'Bia']);
    expect(valorDe('Para')).toBe('o negócio todo');
    await userEvent.selectOptions(screen.getByLabelText('Para'), 'p1');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar este horário' }));
    expect(m.fecharHorario).toHaveBeenCalledWith({}, '2026-11-17T12:00:00.000Z', 'p1');
  });

  it('Fechar com o filtro em Bia: vem a Bia', async () => {
    gravar('filtro-pessoa', 'p2');
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 09:00' }));
    expect(valorDe('Para')).toBe('Bia');
  });

  it('o fechado de uma pessoa mostra para quem, e reabrir remove só ele', async () => {
    m.listAjustes.mockResolvedValue([{ id: 'f1', inicio: '2026-11-17T12:00:00.000Z', tipo: 'fechado', pessoa_id: 'p1' }]);
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    const fechado = await screen.findByText('fechado · Ana');
    expect(screen.getByRole('button', { name: 'Marcar ter 17/11 às 09:00' })).toHaveTextContent('livre · Bia');
    await userEvent.click(fechado.closest('button')!);
    expect(screen.getByRole('heading', { name: /fechado · Ana/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(m.removerAjuste).toHaveBeenCalledWith({}, 'f1');
  });

  it('Extra: "Com quem" sem o negócio todo; vem a do filtro', async () => {
    gravar('filtro-pessoa', 'p2');
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(min-width: 1280px)', media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    await userEvent.click(await screen.findByRole('button', { name: '+ Horário extra' }));
    expect(opcoes('Com quem')).toEqual(['Ana', 'Bia']);
    expect(valorDe('Com quem')).toBe('Bia');
    await userEvent.type(screen.getByLabelText('Hora'), '19:00');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir horário' }));
    expect(m.criarExtra).toHaveBeenCalledWith({}, '2026-11-17T22:00:00.000Z', 'p2');
  });

  it('Lembrar de amanhã diz com quem', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, BIA]);
    const amanha = await screen.findByRole('complementary', { name: 'Amanhã' });
    await userEvent.click(await within(amanha).findByRole('button', { name: 'Lembrar' }));
    const link = within(amanha).getByRole('link', { name: 'Lembrar Pedro' });
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('às 15h com Ana. Até lá!');
  });
});

describe('painéis com uma pessoa', () => {
  it('sem "Com quem" no novo nem "Para" no fechar', async () => {
    renderComConfig(<Agenda />, CONFIG_TESTE, [ANA, { ...BIA, ativo: false }]);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar ter 17/11 às 09:00' }));
    expect(screen.queryByLabelText('Para')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar cliente' }));
    expect(screen.queryByLabelText('Com quem')).toBeNull();
  });
});
