import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { linkEquipe } from '../../src/lib/link';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendamentoCompleto, Pessoa, Servico } from '../../src/types';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({
  criarPessoa: vi.fn(),
  salvarPessoa: vi.fn(),
  desativarPessoa: vi.fn(),
  apagarPessoa: vi.fn(),
  pessoaTemAgendamentos: vi.fn(),
  listAgendamentosFuturosDaPessoa: vi.fn(),
  gerarLinkPessoa: vi.fn(),
  salvarWhatsappPessoa: vi.fn(),
}));
vi.mock('../../src/data/equipe', () => ({ gerarLinkPessoa: m.gerarLinkPessoa, salvarWhatsappPessoa: m.salvarWhatsappPessoa }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/pessoas', () => ({
  criarPessoa: m.criarPessoa,
  salvarPessoa: m.salvarPessoa,
  desativarPessoa: m.desativarPessoa,
  apagarPessoa: m.apagarPessoa,
  pessoaTemAgendamentos: m.pessoaTemAgendamentos,
}));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentosFuturosDaPessoa: m.listAgendamentosFuturosDaPessoa }));

import PainelPessoa from '../../src/ui/ajustes/PainelPessoa';

const CORTE: Servico = { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true };
const ESCOVA: Servico = { id: 's2', nome: 'Escova', duracao_min: 60, ativo: true };
const VELHO: Servico = { id: 's3', nome: 'Luzes', duracao_min: 90, ativo: false };
const ana: Pessoa = { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: [], servicos: ['s1'] };
const semNome: Pessoa = { id: 'p2', nome: null, ativo: true, ordem: 2, folgas: [], servicos: ['s1', 's2'] };

const futuro = (over: Partial<AgendamentoCompleto>): AgendamentoCompleto => ({
  id: 'a1',
  cliente_id: 'c1',
  servico_id: 's1',
  inicio: '2099-11-17T13:00:00.000Z', // ter 17/11 10:00 em São Paulo
  fim: '2099-11-17T13:30:00.000Z',
  status: 'marcado',
  observacao: null,
  origem: 'dono',
  pessoa_id: 'p2',
  criado_em: '2099-11-01T00:00:00Z',
  cliente: { nome: 'João', telefone: '5511987654321' },
  servico: { nome: 'Corte' },
  ...over,
});

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.criarPessoa.mockImplementation(async (_db, p) => ({ id: 'p9', ativo: true, ordem: 3, folgas: [], ...p }));
  m.salvarPessoa.mockResolvedValue(undefined);
  m.desativarPessoa.mockResolvedValue({ ok: true });
  m.apagarPessoa.mockResolvedValue(undefined);
  m.pessoaTemAgendamentos.mockResolvedValue(true);
  m.listAgendamentosFuturosDaPessoa.mockResolvedValue([]);
  m.gerarLinkPessoa.mockResolvedValue('c'.repeat(64));
  m.salvarWhatsappPessoa.mockResolvedValue(undefined);
});

function abrir(pessoa: Pessoa | undefined, pessoas: Pessoa[] = [ana, semNome]) {
  const onSalvo = vi.fn();
  const r = renderComConfig(<PainelPessoa pessoa={pessoa} servicos={[CORTE, ESCOVA, VELHO]} onSalvo={onSalvo} />, CONFIG_TESTE, pessoas);
  return { ...r, onSalvo };
}
const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

describe('PainelPessoa: nova', () => {
  it('vem com todos os serviços ativos marcados; nome vazio salva null', async () => {
    const { onSalvo, recarregarPessoas } = abrir(undefined);
    expect(screen.getByRole('heading', { name: 'Nova pessoa' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Corte' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Escova' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Luzes' })).toBeNull();
    expect(screen.getByLabelText('Nome (opcional)')).toHaveAttribute('placeholder', 'Pessoa 3');
    await salvar();
    expect(m.criarPessoa).toHaveBeenCalledWith({}, { nome: null, servicos: ['s1', 's2'] });
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith('pessoa:p9'));
    expect(recarregarPessoas).toHaveBeenCalled();
  });

  it('nome com 41 caracteres é recusado', async () => {
    abrir(undefined);
    fireEvent.change(screen.getByLabelText('Nome (opcional)'), { target: { value: 'a'.repeat(41) } });
    await salvar();
    expect(screen.getByRole('alert')).toHaveTextContent('O nome pode ter até 40 letras.');
    expect(m.criarPessoa).not.toHaveBeenCalled();
  });

  it('pessoa nova não tem Desativar nem Apagar', () => {
    abrir(undefined);
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apagar' })).toBeNull();
  });
});

describe('PainelPessoa: editar', () => {
  it('o campo mostra o nome de exibição como placeholder e salva nome e serviços', async () => {
    const { onSalvo } = abrir(semNome);
    expect(screen.getByRole('heading', { name: 'Pessoa 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome (opcional)')).toHaveAttribute('placeholder', 'Pessoa 2');
    fireEvent.change(screen.getByLabelText('Nome (opcional)'), { target: { value: 'Bia' } });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Escova' }));
    await salvar();
    expect(m.salvarPessoa).toHaveBeenCalledWith({}, 'p2', { nome: 'Bia', servicos: ['s1'] });
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith('pessoa:p2'));
  });

  it('desmarcar serviço com clientes futuros desse serviço avisa com a lista e salva mesmo assim', async () => {
    m.listAgendamentosFuturosDaPessoa.mockResolvedValue([
      futuro({}),
      futuro({ id: 'a2', servico_id: 's2', cliente: { nome: 'Maria', telefone: '5511900000000' } }),
    ]);
    abrir(semNome);
    await waitFor(() => expect(m.listAgendamentosFuturosDaPessoa).toHaveBeenCalledWith({}, 'p2'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Corte' }));
    const aviso = await screen.findByText(/continuam marcados com ela/);
    expect(aviso.closest('.aviso-pessoa')).toHaveTextContent('ter 17/11 10:00 · João');
    expect(aviso.closest('.aviso-pessoa')).not.toHaveTextContent('Maria');
    await salvar();
    expect(m.salvarPessoa).toHaveBeenCalledWith({}, 'p2', { nome: null, servicos: ['s2'] });
  });

  it('Desativar sendo a última ativa explica e não fecha', async () => {
    m.desativarPessoa.mockResolvedValue({ ok: false, erro: 'ultima' });
    const { onSalvo } = abrir(ana, [ana]);
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('única pessoa ativa');
    expect(onSalvo).not.toHaveBeenCalled();
  });

  it('Desativar com clientes futuros lista dia, hora e nome', async () => {
    m.desativarPessoa.mockResolvedValue({ ok: false, erro: 'clientes_futuros' });
    m.listAgendamentosFuturosDaPessoa.mockResolvedValue([futuro({})]);
    abrir(semNome);
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('passe cada um para outra pessoa no detalhe do agendamento');
    expect(alerta).toHaveTextContent('ter 17/11 10:00 · João');
  });

  it('Desativar deu certo: recarrega as pessoas e fecha com salvo', async () => {
    const { onSalvo, recarregarPessoas } = abrir(semNome);
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(m.desativarPessoa).toHaveBeenCalledWith({}, 'p2');
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith('desativadas'));
    expect(recarregarPessoas).toHaveBeenCalled();
  });

  it('sem nenhum agendamento: Apagar no lugar de Desativar, com confirmação', async () => {
    m.pessoaTemAgendamentos.mockResolvedValue(false);
    const { onSalvo } = abrir(semNome);
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
    expect(m.apagarPessoa).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Apagar de vez' }));
    expect(m.apagarPessoa).toHaveBeenCalledWith({}, 'p2');
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith('pessoas'));
  });

  it('a última ativa não pode ser apagada', async () => {
    m.pessoaTemAgendamentos.mockResolvedValue(false);
    abrir(ana, [ana]);
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apagar de vez' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('única pessoa ativa');
    expect(m.apagarPessoa).not.toHaveBeenCalled();
  });
});

describe('PainelPessoa: link da agenda', () => {
  const comLink: Pessoa = { ...ana, link_codigo: 'a'.repeat(64), link_whatsapp: false };
  const secao = () => screen.getByRole('group', { name: 'Link da agenda' });

  it('pessoa nova e pessoa desativada não têm a seção', () => {
    abrir(undefined);
    expect(screen.queryByRole('group', { name: 'Link da agenda' })).toBeNull();
  });

  it('desativada não tem a seção', () => {
    abrir({ ...ana, ativo: false }, [{ ...ana, ativo: false }, semNome]);
    expect(screen.queryByRole('group', { name: 'Link da agenda' })).toBeNull();
  });

  it('sem link: "Criar link" gera e passa a mostrar Copiar e Trocar', async () => {
    const { recarregarPessoas } = abrir(ana);
    await userEvent.click(within(secao()).getByRole('button', { name: 'Criar link' }));
    expect(m.gerarLinkPessoa).toHaveBeenCalledWith({}, 'p1');
    expect(await within(secao()).findByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
    expect(within(secao()).getByRole('button', { name: 'Trocar link' })).toBeInTheDocument();
    expect(recarregarPessoas).toHaveBeenCalled();
  });

  it('"Copiar link" copia o endereço da agenda dela', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    abrir(comLink);
    fireEvent.click(within(secao()).getByRole('button', { name: 'Copiar link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(linkEquipe('a'.repeat(64))));
    expect(await within(secao()).findByText('Link copiado!')).toBeInTheDocument();
  });

  it('"Trocar link" pede confirmação e só troca depois dela', async () => {
    abrir(comLink);
    await userEvent.click(within(secao()).getByRole('button', { name: 'Trocar link' }));
    expect(within(secao()).getByText('O link antigo para de funcionar.')).toBeInTheDocument();
    expect(m.gerarLinkPessoa).not.toHaveBeenCalled();
    await userEvent.click(within(secao()).getByRole('button', { name: 'Trocar mesmo' }));
    expect(m.gerarLinkPessoa).toHaveBeenCalledWith({}, 'p1');
  });

  it('a chave do WhatsApp começa como está e grava; erro de rede avisa e volta', async () => {
    const { recarregarPessoas } = abrir(comLink);
    const chave = within(secao()).getByRole('checkbox', { name: 'Pode chamar os clientes no WhatsApp' });
    expect(chave).not.toBeChecked();
    await userEvent.click(chave);
    expect(m.salvarWhatsappPessoa).toHaveBeenCalledWith({}, 'p1', true);
    await waitFor(() => expect(recarregarPessoas).toHaveBeenCalled());
    expect(chave).toBeChecked();
    m.salvarWhatsappPessoa.mockRejectedValueOnce(new Error('rede'));
    await userEvent.click(chave);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(chave).toBeChecked();
  });
});
