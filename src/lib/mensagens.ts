import { dataLocal, diaDaSemana, horaCurta, horaLocal } from './slots';

/** Mensagens de WhatsApp prontas (spec v3, seção 3). O dono não edita esses textos. */

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function diaPorExtenso(data: string): string {
  return DIAS[diaDaSemana(data)];
}

export interface DadosMensagem {
  nome: string;
  inicio: string; // ISO
  fuso: string;
  /** Nome de quem atende ("com Ana"); só vem com 2+ pessoas ativas e pessoa com nome. */
  pessoa?: string | null;
}

const com = (d: DadosMensagem) => (d.pessoa ? ` com ${d.pessoa}` : '');

function quando({ inicio, fuso }: DadosMensagem) {
  const d = new Date(inicio);
  const data = dataLocal(d, fuso);
  return { dia: diaPorExtenso(data), ddmm: `${data.slice(8, 10)}/${data.slice(5, 7)}`, hora: horaCurta(horaLocal(d, fuso)) };
}

export function mensagemConfirmar(d: DadosMensagem): string {
  const { dia, ddmm, hora } = quando(d);
  return `Olá, ${d.nome}! ✅ Seu horário está confirmado: ${dia} (${ddmm}) às ${hora}${com(d)}. Até lá!`;
}

export function mensagemLembrar(d: DadosMensagem): string {
  const { dia, ddmm, hora } = quando(d);
  return `Olá, ${d.nome}! 👋 Passando para lembrar do seu horário amanhã, ${dia} (${ddmm}), às ${hora}${com(d)}. Até lá!`;
}

export function mensagemCancelar(d: DadosMensagem, link: string): string {
  const { dia, ddmm, hora } = quando(d);
  return `Olá, ${d.nome}. Infelizmente não vou conseguir te atender ${dia} (${ddmm}) às ${hora}. Me desculpe! Para marcar outro horário: ${link}`;
}

