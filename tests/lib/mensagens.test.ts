import { describe, expect, it } from 'vitest';
import {
  diaPorExtenso,
  mensagemCancelar,
  mensagemConfirmar,
  mensagemDivulgar,
  mensagemLembrar,
} from '../../src/lib/mensagens';
import { waLink } from '../../src/lib/whatsapp';

const F = 'America/Sao_Paulo';
const L = 'https://b.pages.dev/#/agendar';

describe('mensagens prontas', () => {
  it('diaPorExtenso de domingo a sábado', () => {
    const dias = ['15', '16', '17', '18', '19', '20', '21'].map((d) => diaPorExtenso(`2026-11-${d}`));
    expect(dias).toEqual(['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']);
  });

  it('Confirmar', () => {
    expect(mensagemConfirmar({ nome: 'João', inicio: '2026-11-18T12:00:00Z', fuso: F })).toBe(
      'Olá, João! ✅ Seu horário está confirmado: quarta-feira (18/11) às 9h. Até lá!',
    );
  });

  it('Lembrar', () => {
    expect(mensagemLembrar({ nome: 'João', inicio: '2026-11-18T12:00:00Z', fuso: F })).toBe(
      'Olá, João! 👋 Passando para lembrar do seu horário amanhã, quarta-feira (18/11), às 9h. Até lá!',
    );
  });

  it('Cancelar num domingo com hora quebrada', () => {
    expect(mensagemCancelar({ nome: 'João', inicio: '2026-11-22T17:30:00Z', fuso: F }, L)).toBe(
      'Olá, João. Infelizmente não vou conseguir te atender domingo (22/11) às 14h30. Me desculpe! Para marcar outro horário: https://b.pages.dev/#/agendar',
    );
  });

  it('sábado de outro mês com dd/mm de dois dígitos', () => {
    expect(mensagemConfirmar({ nome: 'Zé', inicio: '2026-12-05T12:00:00Z', fuso: F })).toContain('sábado (05/12) às 9h');
  });

  it('Divulgar', () => {
    expect(mensagemDivulgar(L)).toBe('📅 Agenda aberta! Escolha seu horário aqui: https://b.pages.dev/#/agendar');
  });

  it('nome com acento e emoji é preservado e o link codifica o emoji', () => {
    const msg = mensagemConfirmar({ nome: 'José 💈', inicio: '2026-11-18T12:00:00Z', fuso: F });
    const link = waLink('5511987654321', msg);
    expect(link).toContain(encodeURIComponent('José 💈'));
    expect(link).toContain('%E2%9C%85');
  });
});
