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
}

function quando({ inicio, fuso }: DadosMensagem) {
  const d = new Date(inicio);
  const data = dataLocal(d, fuso);
  return { dia: diaPorExtenso(data), ddmm: `${data.slice(8, 10)}/${data.slice(5, 7)}`, hora: horaCurta(horaLocal(d, fuso)) };
}

export function mensagemConfirmar(d: DadosMensagem): string {
  const { dia, ddmm, hora } = quando(d);
  return `Olá, ${d.nome}! ✅ Seu horário está confirmado: ${dia} (${ddmm}) às ${hora}. Até lá!`;
}

export function mensagemLembrar(d: DadosMensagem): string {
  const { dia, ddmm, hora } = quando(d);
  return `Olá, ${d.nome}! 👋 Passando para lembrar do seu horário amanhã, ${dia} (${ddmm}), às ${hora}. Até lá!`;
}

export function mensagemCancelar(d: DadosMensagem, link: string): string {
  const { dia, ddmm, hora } = quando(d);
  return `Olá, ${d.nome}. Infelizmente não vou conseguir te atender ${dia} (${ddmm}) às ${hora}. Me desculpe! Para marcar outro horário: ${link}`;
}

export function mensagemDivulgar(link: string): string {
  return `📅 Agenda aberta! Escolha seu horário aqui: ${link}`;
}
