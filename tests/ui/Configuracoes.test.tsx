import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../../src/types';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({
  saveConfig: vi.fn(),
  listServicos: vi.fn(),
  saveServico: vi.fn(),
  listClientes: vi.fn(),
  listAgendamentosDoCliente: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));
const { saveConfig, listServicos, saveServico, listClientes, listAgendamentosDoCliente, signOut } = m;
vi.mock('../../src/data/supabase', () => ({ supabase: { auth: { getSession: m.getSession, signOut: m.signOut } } }));
vi.mock('../../src/data/configuracoes', () => ({ saveConfig: m.saveConfig, getConfig: vi.fn(), definirChaveBackup: vi.fn() }));
vi.mock('../../src/data/servicos', () => ({ listServicos: m.listServicos, saveServico: m.saveServico }));
vi.mock('../../src/data/clientes', () => ({ listClientes: m.listClientes }));
vi.mock('../../src/data/agendamentos', () => ({ listAgendamentosDoCliente: m.listAgendamentosDoCliente }));

import { supabase } from '../../src/data/supabase';
import Configuracoes from '../../src/ui/Configuracoes';

const CORTE = { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true };
const ERRO_REDE = 'Não foi possível salvar. Confira a internet e tente de novo.';

beforeEach(() => {
  saveConfig.mockReset().mockResolvedValue(undefined);
  listServicos.mockReset().mockResolvedValue([CORTE]);
  saveServico.mockReset().mockImplementation(async (_db, s) => ({ id: 'novo', ...s }));
  listClientes.mockReset().mockResolvedValue([{ id: 'c1', nome: 'João', telefone: '5511987654321', criado_em: '2026-11-01T00:00:00Z' }]);
  listAgendamentosDoCliente.mockReset().mockResolvedValue([]);
  m.getSession.mockReset().mockResolvedValue({ data: { session: { user: { email: 'joao@dono.agenda' } } } });
  signOut.mockReset().mockResolvedValue({ error: null });
});

const abrir = (nome: RegExp | string) => userEvent.click(screen.getByRole('button', { name: nome }));
const dialogo = () => screen.getByRole('dialog');
const salvar = () => userEvent.click(within(dialogo()).getByRole('button', { name: 'Salvar' }));
const campo = (rotulo: string, valor: string) =>
  fireEvent.change(within(dialogo()).getByLabelText(rotulo), { target: { value: valor } });

describe('Ajustes: o índice de capítulos', () => {
  it('os capítulos aparecem na ordem Negócio, Agenda, Expediente, Folgas, Serviços, Clientes, Backup, Tela inicial, Conta', () => {
    renderComConfig(<Configuracoes />);
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Negócio', 'Agenda', 'Expediente', 'Folgas', 'Serviços', 'Clientes', 'Backup', 'Tela inicial', 'Conta']);
  });

  it('cada linha mostra o valor atual', async () => {
    renderComConfig(<Configuracoes />, { ...CONFIG_TESTE, folgas: [] });
    expect(screen.getByRole('button', { name: 'Nome, Barbearia do Teste' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WhatsApp, (11) 90000-1111' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duração de cada horário, 30 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quantos dias o link mostra, 14 dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'seg a sex, 9h–12h · 14h–18h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sáb e dom, fechado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Folgas, nenhuma' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Corte, 30 min' })).toBeInTheDocument();
  });

  it('a faixa do expediente vai de segunda a domingo e destaca os dias com expediente', () => {
    renderComConfig(<Configuracoes />);
    const faixa = screen.getByRole('group', { name: 'Dias da semana' });
    const dias = within(faixa).getAllByRole('button');
    expect(dias.map((d) => d.textContent)).toEqual(['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']);
    expect(dias[0]).toHaveAccessibleName('Segunda, 9h–12h · 14h–18h');
    expect(dias[0]).toHaveClass('aberto');
    expect(dias[6]).toHaveAccessibleName('Domingo, fechado');
    expect(dias[6]).not.toHaveClass('aberto');
  });

  it('o botão "Salvar configurações" não existe mais', () => {
    renderComConfig(<Configuracoes />);
    expect(screen.queryByRole('button', { name: 'Salvar configurações' })).not.toBeInTheDocument();
  });

  it('o link "‹ agenda" volta para a agenda', () => {
    renderComConfig(<Configuracoes />);
    expect(screen.getByRole('link', { name: '‹ agenda' }).getAttribute('href')).toBe('/');
  });

  it('não tem a seção Mensagens, os modelos nem a chave do link', () => {
    renderComConfig(<Configuracoes />);
    for (const rotulo of ['Mensagem de horários livres', 'Mensagem de lembrete', 'Mensagem de cancelamento', 'Link de agendamento ligado']) {
      expect(screen.queryByLabelText(rotulo)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Mensagens' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar link de agendamento' })).not.toBeInTheDocument();
  });
});

describe('Ajustes: cada painel salva só o que mostra', () => {
  it.each<[string, RegExp, string, string, Partial<Config>]>([
    ['nome', /^Nome,/, 'Nome do negócio', 'Barbearia Nova', { nome_negocio: 'Barbearia Nova' }],
    ['WhatsApp', /^WhatsApp,/, 'WhatsApp do negócio', '(11) 90000-2222', { telefone_negocio: '5511900002222' }],
    ['WhatsApp vazio', /^WhatsApp,/, 'WhatsApp do negócio', '', { telefone_negocio: null }],
    ['duração', /^Duração de cada horário,/, 'Duração de cada horário (min)', '40', { passo_min: 40 }],
    ['dias do link', /^Quantos dias o link mostra,/, 'Quantos dias o link mostra', '21', { dias_abertos: 21 }],
  ])('%s: grava exatamente esse campo, recarrega e fecha', async (_caso, linha, rotulo, valor, esperado) => {
    const { recarregar } = renderComConfig(<Configuracoes />);
    await abrir(linha);
    campo(rotulo, valor);
    await salvar();
    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(supabase, esperado);
    expect(recarregar).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('"salvo! ✓" aparece à mão perto da linha depois de salvar', async () => {
    renderComConfig(<Configuracoes />);
    await abrir(/^Nome,/);
    campo('Nome do negócio', 'Barbearia Nova');
    await salvar();
    const nota = await screen.findByText('salvo! ✓');
    expect(nota.closest('li')).toBe(screen.getByRole('button', { name: /^Nome,/ }).closest('li'));
    expect(screen.getByRole('status')).toHaveTextContent('Salvo');
  });

  it('sem internet: o erro aparece no painel, a linha mantém o valor e "salvo! ✓" não aparece', async () => {
    saveConfig.mockRejectedValue(new Error('rede'));
    const { recarregar } = renderComConfig(<Configuracoes />);
    await abrir(/^Nome,/);
    campo('Nome do negócio', 'Barbearia Nova');
    await salvar();
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(ERRO_REDE);
    expect(recarregar).not.toHaveBeenCalled();
    expect(screen.queryByText('salvo! ✓')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Nome, Barbearia do Teste' })).toBeInTheDocument();
    expect(screen.queryByText('salvo! ✓')).not.toBeInTheDocument();
  });

  it('WhatsApp inválido mostra a mensagem no painel e não salva', async () => {
    renderComConfig(<Configuracoes />);
    await abrir(/^WhatsApp,/);
    campo('WhatsApp do negócio', '9999');
    await salvar();
    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('WhatsApp inválido. Use DDD + número, ou + e o código do país.');
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it.each([['0'], ['61']])('dias do link = %s é recusado', async (dias) => {
    renderComConfig(<Configuracoes />);
    await abrir(/^Quantos dias o link mostra,/);
    campo('Quantos dias o link mostra', dias);
    await salvar();
    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Os dias do link precisam ficar entre 1 e 60.');
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it.each([['4'], ['241']])('duração = %s é recusada', async (dur) => {
    renderComConfig(<Configuracoes />);
    await abrir(/^Duração de cada horário,/);
    campo('Duração de cada horário (min)', dur);
    await salvar();
    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('A duração de cada horário precisa ficar entre 5 e 240 minutos.');
    expect(saveConfig).not.toHaveBeenCalled();
  });
});

describe('Ajustes: expediente', () => {
  it('salva o expediente de terça com dois intervalos, pelo painel do dia', async () => {
    const config = { ...CONFIG_TESTE, expediente: { ...CONFIG_TESTE.expediente, 2: [] } };
    renderComConfig(<Configuracoes />, config);
    await abrir('Terça, fechado');
    expect(within(dialogo()).getByRole('heading', { name: 'Terça' })).toBeInTheDocument();
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Adicionar intervalo' }));
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Adicionar intervalo' }));
    campo('Início 1', '14:00');
    campo('Fim 1', '18:00');
    campo('Início 2', '09:00');
    campo('Fim 2', '12:00');
    await salvar();
    expect(saveConfig).toHaveBeenCalledTimes(1);
    const [, parcial] = saveConfig.mock.calls[0];
    expect(Object.keys(parcial)).toEqual(['expediente']);
    expect(parcial.expediente[2]).toEqual([
      { inicio: '09:00', fim: '12:00' },
      { inicio: '14:00', fim: '18:00' },
    ]);
    expect(parcial.expediente[1]).toEqual(CONFIG_TESTE.expediente[1]);
    expect(await screen.findByText('salvo! ✓')).toBeInTheDocument();
  });

  it('o painel de um grupo grava o mesmo horário em todos os dias do grupo', async () => {
    renderComConfig(<Configuracoes />);
    await abrir('seg a sex, 9h–12h · 14h–18h');
    expect(within(dialogo()).getByRole('heading', { name: 'seg a sex' })).toBeInTheDocument();
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Remover intervalo 2' }));
    await salvar();
    const { expediente } = saveConfig.mock.calls[0][1];
    for (const dia of [1, 2, 3, 4, 5]) expect(expediente[dia]).toEqual([{ inicio: '09:00', fim: '12:00' }]);
    expect(expediente[6]).toEqual([]);
  });

  it('rejeita sobreposição e fim antes do início, com a mensagem no painel', async () => {
    renderComConfig(<Configuracoes />);
    await abrir('Terça, 9h–12h · 14h–18h');
    campo('Início 2', '11:00');
    await salvar();
    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Terça: Os intervalos não podem se sobrepor.');
    campo('Início 2', '14:00');
    campo('Fim 1', '08:00');
    await salvar();
    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Terça: O fim precisa ser depois do início.');
    expect(saveConfig).not.toHaveBeenCalled();
  });
});

describe('Ajustes: folgas', () => {
  it('o resumo conta as folgas e mostra a próxima', () => {
    renderComConfig(<Configuracoes />, { ...CONFIG_TESTE, folgas: ['2020-01-01', '2099-12-20', '2099-12-25'] });
    expect(screen.getByRole('button', { name: 'Folgas, 3 folgas · próxima 20/12' })).toBeInTheDocument();
  });

  it('adiciona e remove folga, e grava só as folgas', async () => {
    renderComConfig(<Configuracoes />, { ...CONFIG_TESTE, folgas: ['2099-01-01'] });
    await abrir(/^Folgas,/);
    campo('Nova folga', '2099-12-25');
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Adicionar folga' }));
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Remover folga 2099-01-01' }));
    await salvar();
    expect(saveConfig).toHaveBeenCalledWith(supabase, { folgas: ['2099-12-25'] });
  });
});

describe('Ajustes: serviços', () => {
  it('a chave ativo funciona na linha e é uma chave', async () => {
    renderComConfig(<Configuracoes />);
    const chave = await screen.findByRole('checkbox', { name: 'Corte ativo' });
    expect(chave).toHaveClass('chave');
    await userEvent.click(chave);
    expect(saveServico).toHaveBeenCalledWith(supabase, { ...CORTE, ativo: false });
  });

  it('"+ novo serviço" abre o painel vazio e adiciona "Barba" com 30 min', async () => {
    renderComConfig(<Configuracoes />);
    await screen.findByText('Corte');
    await abrir('+ novo serviço');
    expect(within(dialogo()).getByLabelText('Nome do serviço')).toHaveValue('');
    await userEvent.type(within(dialogo()).getByLabelText('Nome do serviço'), 'Barba');
    campo('Duração (min)', '30');
    await salvar();
    expect(saveServico).toHaveBeenCalledWith(supabase, { nome: 'Barba', duracao_min: 30, ativo: true });
    expect(await screen.findByRole('button', { name: 'Barba, 30 min' })).toBeInTheDocument();
    expect(await screen.findByText('salvo! ✓')).toBeInTheDocument();
  });

  it('tocar no serviço abre o painel de editar nome e duração', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte, 30 min' }));
    campo('Nome do serviço', 'Corte social');
    campo('Duração (min)', '45');
    await salvar();
    expect(saveServico).toHaveBeenCalledWith(supabase, { ...CORTE, nome: 'Corte social', duracao_min: 45 });
    expect(await screen.findByRole('button', { name: 'Corte social, 45 min' })).toBeInTheDocument();
  });

  it('sem nome não salva e avisa no painel', async () => {
    renderComConfig(<Configuracoes />);
    await screen.findByText('Corte');
    await abrir('+ novo serviço');
    await salvar();
    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Informe o nome e a duração do serviço.');
    expect(saveServico).not.toHaveBeenCalled();
  });
});

describe('Ajustes: Clientes, Backup, Tela inicial e Conta', () => {
  it('a seção Clientes busca e abre o histórico', async () => {
    renderComConfig(<Configuracoes />);
    await userEvent.type(screen.getByLabelText('Buscar'), 'Jo');
    await waitFor(() => expect(listClientes).toHaveBeenLastCalledWith(supabase, 'Jo'));
    await userEvent.click(await screen.findByRole('button', { name: /João/ }));
    expect(listAgendamentosDoCliente).toHaveBeenCalledWith(supabase, 'c1');
  });

  it('a linha do Backup mostra o estado e abre a seção com "Baixar backup"', async () => {
    renderComConfig(<Configuracoes />, { ...CONFIG_TESTE, ultimo_backup: null });
    await abrir('Último backup, nenhum ainda');
    expect(within(dialogo()).getByRole('button', { name: 'Baixar backup' })).toBeInTheDocument();
  });

  it('a linha da Tela inicial abre a seção de instalar', async () => {
    renderComConfig(<Configuracoes />);
    await abrir(/^Na tela inicial,/);
    expect(within(dialogo()).getByRole('heading', { name: 'Tela inicial' })).toBeInTheDocument();
  });

  it('Conta mostra o usuário sem o domínio interno, e "Sair" chama signOut', async () => {
    renderComConfig(<Configuracoes />);
    expect(await screen.findByText('joao')).toBeInTheDocument();
    expect(screen.queryByText(/dono\.agenda/)).not.toBeInTheDocument();
    await abrir('Sair');
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('Ajustes: reabrir outra linha logo depois de fechar (painel ainda saindo)', () => {
  it('Duração → fecha → "Quantos dias": o campo mostra os dias e salva dias_abertos', async () => {
    renderComConfig(<Configuracoes />);
    await abrir('Duração de cada horário, 30 min');
    await userEvent.keyboard('{Escape}');
    await abrir('Quantos dias o link mostra, 14 dias');
    expect(within(dialogo()).getByLabelText('Quantos dias o link mostra')).toHaveValue(14);
    await salvar();
    expect(saveConfig).toHaveBeenCalledWith(supabase, { dias_abertos: 14 });
  });

  it('Corte → fecha → Escova: o painel mostra os campos da Escova', async () => {
    listServicos.mockResolvedValue([CORTE, { id: 's2', nome: 'Escova', duracao_min: 60, ativo: true }]);
    renderComConfig(<Configuracoes />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte, 30 min' }));
    await userEvent.keyboard('{Escape}');
    await abrir('Escova, 60 min');
    expect(within(dialogo()).getByLabelText('Nome do serviço')).toHaveValue('Escova');
    expect(within(dialogo()).getByLabelText('Duração (min)')).toHaveValue(60);
  });

  it('Segunda → fecha → Domingo: o painel mostra o domingo fechado', async () => {
    renderComConfig(<Configuracoes />);
    await abrir('Segunda, 9h–12h · 14h–18h');
    const segunda = within(dialogo()).getAllByDisplayValue('09:00').length;
    expect(segunda).toBeGreaterThan(0);
    await userEvent.keyboard('{Escape}');
    await abrir('Domingo, fechado');
    expect(within(dialogo()).queryAllByDisplayValue('09:00')).toHaveLength(0);
  });
});
