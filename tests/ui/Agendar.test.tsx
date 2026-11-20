import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SemConexaoError } from '../../src/data/erros';
import { waLink } from '../../src/lib/whatsapp';
import type { HorariosPublicos } from '../../src/types';
import type { AuthFalso } from '../helpers/auth';

const m = vi.hoisted(() => ({ auth: {} as AuthFalso, getHorariosPublicos: vi.fn(), agendarPublico: vi.fn() }));
vi.mock('../../src/data/supabase', async () => {
  const { criarAuthFalso } = await import('../helpers/auth');
  criarAuthFalso(m.auth);
  return { supabase: { auth: m.auth }, configurado: true };
});
vi.mock('../../src/data/publico', () => ({ getHorariosPublicos: m.getHorariosPublicos, agendarPublico: m.agendarPublico }));

import App from '../../src/ui/App';
import Agendar from '../../src/ui/publico/Agendar';

const DADOS: HorariosPublicos = {
  nome_negocio: 'Barbearia do João',
  telefone_negocio: '5511900001111',
  link_ativo: true,
  // qua 18/11 9h e 9h30, qui 19/11 10h (hora de São Paulo)
  horarios: ['2026-11-18T12:00:00Z', '2026-11-18T12:30:00Z', '2026-11-19T13:00:00Z'],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T11:00:00Z'));
  m.getHorariosPublicos.mockReset().mockResolvedValue(DADOS);
  m.agendarPublico.mockReset().mockResolvedValue({ ok: true, inicio: '2026-11-18T12:00:00Z' });
  window.location.hash = '';
});
afterEach(() => vi.useRealTimers());

async function escolher9hDeQuarta() {
  await userEvent.click(await screen.findByRole('button', { name: 'qua 18' }));
  await userEvent.click(screen.getByRole('button', { name: '9h' }));
}

async function preencher(nome: string, whats: string) {
  await userEvent.type(screen.getByLabelText('Nome'), nome);
  await userEvent.type(screen.getByLabelText('WhatsApp com DDD'), whats);
}

const confirmar = () => userEvent.click(screen.getByRole('button', { name: 'Confirmar horário' }));
const falar = () => screen.queryByRole('link', { name: 'Falar com a barbearia' });

describe('página pública de agendamento', () => {
  it('App com #/agendar e sem sessão mostra a página pública, não o login', async () => {
    window.location.hash = '#/agendar';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Barbearia do João' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Usuário')).not.toBeInTheDocument();
  });

  it('mostra os dias com horário e, ao tocar no dia, os horários', async () => {
    render(<Agendar />);
    expect(await screen.findByRole('button', { name: 'qua 18' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'qui 19' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'qua 18' }));
    expect(screen.getByRole('button', { name: '9h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9h30' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10h' })).not.toBeInTheDocument();
  });

  it('Como usamos seus dados fala do cadastro apagado em uma semana e do histórico em 3 meses', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await userEvent.click(screen.getByText('Como usamos seus dados'));
    const aviso = screen.getByRole('group', { name: 'Como usamos seus dados' });
    expect(aviso).toHaveTextContent(
      'Os dados ficam em serviços de nuvem usados pela agenda (banco de dados e cópia de segurança no Google Drive). Seu cadastro (nome e WhatsApp) é apagado uma semana depois do último atendimento, e o histórico de cada horário, 3 meses depois.',
    );
    expect(aviso).not.toHaveTextContent('1 ano');
  });

  it('aviso de privacidade: o que é guardado, por quanto tempo e como pedir para apagar (LGPD)', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await userEvent.click(screen.getByText('Como usamos seus dados'));
    const aviso = screen.getByRole('group', { name: 'Como usamos seus dados' });
    expect(within(aviso).getByText(/não é vendido nem repassado/)).toBeInTheDocument();
    expect(within(aviso).getByText(/apagado uma semana depois do último atendimento/)).toBeInTheDocument();
    expect(within(aviso).getByRole('link', { name: 'pedir pelo WhatsApp' })).toHaveAttribute(
      'href',
      waLink('5511900001111', 'Oi! Quero ver, corrigir ou apagar meus dados da agenda.'),
    );
  });

  it('aviso de privacidade sem WhatsApp do negócio: orienta a falar com o negócio, sem link quebrado', async () => {
    m.getHorariosPublicos.mockResolvedValue({ ...DADOS, telefone_negocio: null });
    render(<Agendar />);
    await escolher9hDeQuarta();
    await userEvent.click(screen.getByText('Como usamos seus dados'));
    const aviso = screen.getByRole('group', { name: 'Como usamos seus dados' });
    expect(within(aviso).queryByRole('link')).not.toBeInTheDocument();
    expect(within(aviso).getByText(/falar com Barbearia do João/)).toBeInTheDocument();
  });

  it('marca com nome e WhatsApp e mostra a confirmação', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    expect(screen.getByText('Seu nome e WhatsApp ficam só com Barbearia do João, para marcar e lembrar seus horários.')).toBeInTheDocument();
    await preencher('Ana', '(11) 98765-4321');
    await confirmar();
    // com "+": o servidor aplica a mesma regra e não confunde com número brasileiro
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Ana', '+5511987654321', '2026-11-18T12:00:00Z', null);
    const status = await screen.findByRole('status');
    expect(within(status).getByRole('heading', { name: 'Pronto, Ana!' })).toBeInTheDocument();
    expect(within(status).getByText('Seu horário: qua 18/11 às 9h.')).toBeInTheDocument();
    expect(falar()).toHaveAttribute('href', waLink('5511900001111', 'Oi! Marquei qua 18/11 às 9h pelo link.'));
  });

  it('fichas de dia mostram o dia da semana e o número, com o mesmo nome acessível', async () => {
    render(<Agendar />);
    const ficha = await screen.findByRole('button', { name: 'qua 18' });
    expect(ficha.querySelector('.ficha-dia')).toHaveTextContent('qua');
    expect(ficha.querySelector('.ficha-num')).toHaveTextContent('18');
  });

  it('resumo do horário escolhido aparece acima do formulário', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    expect(screen.getByText('Quarta, 18/11 às 9h')).toBeInTheDocument();
  });

  it('as setas rolam as fichas de dia', async () => {
    const rolar = vi.fn();
    HTMLElement.prototype.scrollBy = rolar;
    render(<Agendar />);
    await screen.findByRole('button', { name: 'qua 18' });
    await userEvent.click(screen.getByRole('button', { name: 'Mais dias' }));
    expect(rolar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Dias anteriores' }));
    expect(rolar).toHaveBeenCalledTimes(2);
  });

  it('WhatsApp inválido mostra a mensagem e não envia', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Ana', '98765-4321');
    await confirmar();
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp inválido. Use DDD + número, ou + e o código do país.');
    expect(m.agendarPublico).not.toHaveBeenCalled();
  });

  it('dois toques em Confirmar fazem um agendamento só', async () => {
    let terminar: (v: unknown) => void = () => {};
    m.agendarPublico.mockReturnValue(new Promise((r) => (terminar = r)));
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Ana', '11987654321');
    await confirmar();
    expect(screen.getByRole('button', { name: 'Confirmar horário' })).toBeDisabled();
    await confirmar();
    terminar({ ok: true, inicio: '2026-11-18T12:00:00Z' });
    expect(await screen.findByText(/Pronto, Ana!/)).toBeInTheDocument();
    expect(m.agendarPublico).toHaveBeenCalledTimes(1);
  });

  it('horário tomado no meio do caminho: avisa e recarrega a lista', async () => {
    m.agendarPublico.mockResolvedValue({ ok: false, erro: 'horario_indisponivel' });
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Ana', '11987654321');
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse horário acabou de ser ocupado. Escolha outro.');
    expect(m.getHorariosPublicos).toHaveBeenCalledTimes(2);
  });

  it('limite mostra a mensagem e o botão do WhatsApp', async () => {
    m.agendarPublico.mockResolvedValue({ ok: false, erro: 'limite' });
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Ana', '11987654321');
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível marcar pelo link agora. Chame no WhatsApp para marcar seu horário.',
    );
    expect(falar()).toBeInTheDocument();
  });

  it('link fechado ao confirmar mostra a mensagem', async () => {
    m.agendarPublico.mockResolvedValue({ ok: false, erro: 'link_fechado' });
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Ana', '11987654321');
    await confirmar();
    expect(await screen.findByText('Agendamento online fechado no momento.')).toBeInTheDocument();
    expect(falar()).toBeInTheDocument();
  });

  it('link desligado na carga mostra a mensagem e o WhatsApp', async () => {
    m.getHorariosPublicos.mockResolvedValue({ ...DADOS, link_ativo: false, horarios: [] });
    render(<Agendar />);
    expect(await screen.findByText('Agendamento online fechado no momento.')).toBeInTheDocument();
    expect(falar()).toBeInTheDocument();
  });

  it('sem horários mostra a mensagem e o WhatsApp', async () => {
    m.getHorariosPublicos.mockResolvedValue({ ...DADOS, horarios: [] });
    render(<Agendar />);
    expect(await screen.findByText('Sem horários livres nos próximos dias.')).toBeInTheDocument();
    expect(falar()).toBeInTheDocument();
  });

  it('sem telefone do negócio, o botão do WhatsApp não aparece', async () => {
    m.getHorariosPublicos.mockResolvedValue({ ...DADOS, telefone_negocio: null, horarios: [] });
    render(<Agendar />);
    await screen.findByText('Sem horários livres nos próximos dias.');
    expect(falar()).not.toBeInTheDocument();
  });

  it('sem conexão mostra o aviso e "Tentar de novo" recarrega', async () => {
    m.getHorariosPublicos.mockRejectedValueOnce(new SemConexaoError());
    render(<Agendar />);
    expect(await screen.findByText('Não foi possível carregar. Tente de novo em instantes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: 'qua 18' })).toBeInTheDocument();
    await waitFor(() => expect(m.getHorariosPublicos).toHaveBeenCalledTimes(2));
  });

  it('sem serviço ativo: capítulos "1 · dia", "2 · horário", "3 · seus dados" e o fluxo completo', async () => {
    render(<Agendar />);
    expect(await screen.findByText('1 · dia')).toBeInTheDocument();
    expect(screen.queryByText('1 · serviço')).not.toBeInTheDocument();
    expect(screen.getByText('Escolha e pronto: o horário é seu.')).toBeInTheDocument();
    expect(screen.queryByText('Escolha o dia e o horário do seu atendimento.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'qua 18' }));
    expect(screen.getByText('2 · horário')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '9h' }));
    expect(screen.getByText('3 · seus dados')).toBeInTheDocument();
    await preencher('Rui', '11987654321');
    await confirmar();
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Rui', '+5511987654321', '2026-11-18T12:00:00Z', null);
    expect(await screen.findByRole('heading', { name: 'Pronto, Rui!' })).toBeInTheDocument();
  });

  it('a chuva do topo é decoração escondida dos leitores de tela', async () => {
    const { container } = render(<Agendar />);
    await screen.findByText('1 · dia');
    expect(container.querySelector('.chuva')).toHaveAttribute('aria-hidden', 'true');
  });

  it('número internacional vai com + e o código do país', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Rui', '+351 912 345 678');
    await confirmar();
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Rui', '+351912345678', '2026-11-18T12:00:00Z', null);
  });
});

// Corte cabe às 9h, 9h30 (qua) e 10h (qui); Corte + barba (60 min) só às 9h de quarta.
const COM_SERVICOS: HorariosPublicos = {
  ...DADOS,
  servicos: [
    { id: 's1', nome: 'Corte', duracao_min: 30, horarios: DADOS.horarios },
    { id: 's2', nome: 'Corte + barba', duracao_min: 60, horarios: ['2026-11-18T12:00:00Z'] },
    { id: 's3', nome: 'Luzes', duracao_min: 120, horarios: [] },
  ],
};

describe('página pública com serviços', () => {
  beforeEach(() => m.getHorariosPublicos.mockResolvedValue(COM_SERVICOS));

  it('pede o serviço antes do dia, com a duração de cada um', async () => {
    render(<Agendar />);
    const grupo = await screen.findByRole('group', { name: 'Serviços' });
    expect(within(grupo).getByRole('button', { name: 'Corte 30 min' })).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Corte + barba 60 min' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'qua 18' })).not.toBeInTheDocument();
  });

  it('capítulos numerados com serviço: 1 · serviço, 2 · dia, 3 · horário, 4 · seus dados', async () => {
    render(<Agendar />);
    expect(await screen.findByText('1 · serviço')).toBeInTheDocument();
    expect(screen.getByText('Escolha e pronto: o horário é seu.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corte 30 min' }));
    expect(screen.getByText('2 · dia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'qua 18' }));
    expect(screen.getByText('3 · horário')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '9h' }));
    expect(screen.getByText('4 · seus dados')).toBeInTheDocument();
  });

  it('o serviço escolhido ganha ✓ sem mudar o nome acessível', async () => {
    render(<Agendar />);
    const b = await screen.findByRole('button', { name: 'Corte 30 min' });
    expect(b).not.toHaveTextContent('✓');
    await userEvent.click(b);
    expect(b).toHaveTextContent('✓');
    expect(screen.getByRole('button', { name: 'Corte 30 min' })).toBeInTheDocument();
  });

  it('serviço sem horário que caiba aparece desligado', async () => {
    render(<Agendar />);
    expect(await screen.findByRole('button', { name: 'Luzes sem horário' })).toBeDisabled();
  });

  it('os dias e horários são os do serviço escolhido', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte + barba 60 min' }));
    expect(screen.queryByRole('button', { name: 'qui 19' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'qua 18' }));
    expect(screen.getByRole('button', { name: '9h' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '9h30' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Corte 30 min' }));
    expect(screen.getByRole('button', { name: 'qui 19' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9h30' })).toBeInTheDocument();
  });

  it('trocar de serviço desfaz o horário escolhido', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    await escolher9hDeQuarta();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corte + barba 60 min' }));
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  it('marca com o serviço e mostra o serviço no resumo e na confirmação', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte + barba 60 min' }));
    await escolher9hDeQuarta();
    expect(screen.getByText(/Corte \+ barba · 60 min/)).toBeInTheDocument();
    await preencher('Ana', '11987654321');
    await confirmar();
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Ana', '+5511987654321', '2026-11-18T12:00:00Z', 's2');
    const status = await screen.findByRole('status');
    expect(within(status).getByText('Corte + barba: qua 18/11 às 9h.')).toBeInTheDocument();
    expect(falar()).toHaveAttribute('href', waLink('5511900001111', 'Oi! Marquei Corte + barba qua 18/11 às 9h pelo link.'));
  });

  it('serviço desativado no meio do caminho: avisa, volta à escolha do serviço e recarrega', async () => {
    m.agendarPublico.mockResolvedValue({ ok: false, erro: 'servico_invalido' });
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte + barba 60 min' }));
    await escolher9hDeQuarta();
    await preencher('Ana', '11987654321');
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse serviço não está mais disponível. Escolha outro.');
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'qua 18' })).not.toBeInTheDocument();
    expect(m.getHorariosPublicos).toHaveBeenCalledTimes(2);
  });

  it('nenhum serviço com horário: mostra "sem horários"', async () => {
    m.getHorariosPublicos.mockResolvedValue({
      ...COM_SERVICOS,
      servicos: COM_SERVICOS.servicos!.map((s) => ({ ...s, horarios: [] })),
    });
    render(<Agendar />);
    expect(await screen.findByText('Sem horários livres nos próximos dias.')).toBeInTheDocument();
  });
});

describe('assinatura da Amana', () => {
  function conferirAssinatura() {
    const rodape = screen.getByRole('contentinfo');
    expect(within(rodape).getByText(/agendado com/)).toBeInTheDocument();
    expect(within(rodape).getByRole('img', { name: 'Amana' })).toBeInTheDocument();
  }

  it('aparece no rodapé da escolha de horário e a aba mostra o nome do negócio', async () => {
    render(<Agendar />);
    await screen.findByRole('button', { name: 'qua 18' });
    conferirAssinatura();
    expect(document.title).toBe('Barbearia do João');
  });

  it('aparece na confirmação', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Ana', '(11) 98765-4321');
    await confirmar();
    await screen.findByRole('status');
    conferirAssinatura();
  });

  it('aparece com o link fechado', async () => {
    m.getHorariosPublicos.mockResolvedValue({ ...DADOS, link_ativo: false, horarios: [] });
    render(<Agendar />);
    await screen.findByText('Agendamento online fechado no momento.');
    conferirAssinatura();
  });
});

// Ana faz Corte (qua 9h e qui 10h); Bia faz Corte (qua 9h30) e Escova; uma pessoa sem nome faz Corte + barba.
const COM_PESSOAS: HorariosPublicos = {
  ...DADOS,
  pessoas: [
    { id: 'p1', nome: 'Ana' },
    { id: 'p2', nome: 'Bia' },
  ],
  servicos: [
    {
      id: 's1',
      nome: 'Corte',
      duracao_min: 30,
      horarios: DADOS.horarios,
      com_escolha: true,
      pessoas: [
        { id: 'p1', horarios: ['2026-11-18T12:00:00Z', '2026-11-19T13:00:00Z'] },
        { id: 'p2', horarios: ['2026-11-18T12:30:00Z'] },
      ],
    },
    { id: 's2', nome: 'Escova', duracao_min: 30, horarios: ['2026-11-18T12:30:00Z'], com_escolha: false, pessoas: [{ id: 'p2', horarios: ['2026-11-18T12:30:00Z'] }] },
    { id: 's3', nome: 'Corte + barba', duracao_min: 60, horarios: ['2026-11-18T12:00:00Z'], com_escolha: false, pessoas: [] },
  ],
};

describe('página pública com pessoas', () => {
  beforeEach(() => m.getHorariosPublicos.mockResolvedValue(COM_PESSOAS));
  const comQuem = () => screen.queryByRole('group', { name: 'Com quem' });

  it('o passo "2 · com quem" aparece só no serviço com escolha, com "Sem preferência" já escolhido', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    expect(screen.getByText('2 · com quem')).toBeInTheDocument();
    const botoes = within(comQuem()!).getAllByRole('button');
    expect(botoes.map((b) => b.textContent?.replace('✓', '').trim())).toEqual(['Sem preferência', 'Ana', 'Bia']);
    expect(botoes[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3 · dia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'qua 18' }));
    expect(screen.getByText('4 · horário')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '9h' }));
    expect(screen.getByText('5 · seus dados')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Escova 30 min' }));
    expect(comQuem()).toBeNull();
    expect(screen.getByText('2 · dia')).toBeInTheDocument();
  });

  it('os dias e horários seguem a pessoa; Sem preferência mostra todos', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    await userEvent.click(within(comQuem()!).getByRole('button', { name: 'Bia' }));
    expect(screen.queryByRole('button', { name: 'qui 19' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'qua 18' }));
    expect(screen.queryByRole('button', { name: '9h' })).toBeNull();
    expect(screen.getByRole('button', { name: '9h30' })).toBeInTheDocument();
    await userEvent.click(within(comQuem()!).getByRole('button', { name: 'Sem preferência' }));
    expect(screen.getByRole('button', { name: '9h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'qui 19' })).toBeInTheDocument();
  });

  it('a escolha do "com quem" ganha ✓ como o serviço, sem mudar o nome acessível', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    expect(within(comQuem()!).getByRole('button', { name: 'Sem preferência' })).toHaveTextContent('✓');
    await userEvent.click(within(comQuem()!).getByRole('button', { name: 'Ana' }));
    expect(within(comQuem()!).getByRole('button', { name: 'Ana' })).toHaveTextContent('✓');
    expect(within(comQuem()!).getByRole('button', { name: 'Sem preferência' })).not.toHaveTextContent('✓');
  });

  it('trocar para um serviço que a pessoa não faz volta para Sem preferência', async () => {
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    await userEvent.click(within(comQuem()!).getByRole('button', { name: 'Ana' }));
    await userEvent.click(screen.getByRole('button', { name: 'Escova 30 min' }));
    await userEvent.click(screen.getByRole('button', { name: 'Corte 30 min' }));
    expect(within(comQuem()!).getByRole('button', { name: 'Sem preferência' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('com a pessoa escolhida: envia a pessoa e o "Pronto" diz com quem', async () => {
    m.agendarPublico.mockResolvedValue({ ok: true, inicio: '2026-11-18T12:00:00Z', pessoa: 'Ana' });
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    await userEvent.click(within(comQuem()!).getByRole('button', { name: 'Ana' }));
    await escolher9hDeQuarta();
    expect(screen.getByText(/Corte · 30 min · com Ana/)).toBeInTheDocument();
    await preencher('Carlos', '11987654321');
    await confirmar();
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Carlos', '+5511987654321', '2026-11-18T12:00:00Z', 's1', 'p1');
    const status = await screen.findByRole('status');
    expect(within(status).getByText('Corte: qua 18/11 às 9h, com Ana.')).toBeInTheDocument();
  });

  it('Sem preferência: não envia pessoa; se o banco escolheu alguém com nome, o "Pronto" diz', async () => {
    m.agendarPublico.mockResolvedValue({ ok: true, inicio: '2026-11-18T12:00:00Z', pessoa: 'Ana' });
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte 30 min' }));
    await escolher9hDeQuarta();
    await preencher('Carlos', '11987654321');
    await confirmar();
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Carlos', '+5511987654321', '2026-11-18T12:00:00Z', 's1');
    expect(within(await screen.findByRole('status')).getByText('Corte: qua 18/11 às 9h, com Ana.')).toBeInTheDocument();
  });

  it('pessoa sem nome na resposta: o "Pronto" de sempre', async () => {
    m.agendarPublico.mockResolvedValue({ ok: true, inicio: '2026-11-18T12:00:00Z', pessoa: null });
    render(<Agendar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corte + barba 60 min' }));
    await escolher9hDeQuarta();
    await preencher('Carlos', '11987654321');
    await confirmar();
    expect(within(await screen.findByRole('status')).getByText('Corte + barba: qua 18/11 às 9h.')).toBeInTheDocument();
  });
});
