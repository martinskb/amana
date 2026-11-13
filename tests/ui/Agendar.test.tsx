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

  it('aviso de privacidade: o que é guardado, por quanto tempo e como pedir para apagar (LGPD)', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await userEvent.click(screen.getByText('Como usamos seus dados'));
    const aviso = screen.getByRole('group', { name: 'Como usamos seus dados' });
    expect(within(aviso).getByText(/não é vendido nem repassado/)).toBeInTheDocument();
    expect(within(aviso).getByText(/apagado 1 ano depois/)).toBeInTheDocument();
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
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Ana', '+5511987654321', '2026-11-18T12:00:00Z');
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

  it('número internacional vai com + e o código do país', async () => {
    render(<Agendar />);
    await escolher9hDeQuarta();
    await preencher('Rui', '+351 912 345 678');
    await confirmar();
    expect(m.agendarPublico).toHaveBeenCalledWith(expect.anything(), 'Rui', '+351912345678', '2026-11-18T12:00:00Z');
  });
});
