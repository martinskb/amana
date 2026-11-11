import { fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { diasDoPeriodo, formatSlotsMessage, freeSlots } from '../../src/lib/slots';
import type { Agendamento, Config, Slot, Status } from '../../src/types';

const FUSO = 'America/Sao_Paulo';
const sp = (s: string) => fromZonedTime(s, FUSO);
const util = [{ inicio: '09:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];

const config: Config = {
  nome_negocio: 'Barbearia',
  fuso: FUSO,
  expediente: { 0: [], 1: util, 2: util, 3: util, 4: util, 5: util, 6: [] },
  folgas: [],
  passo_min: 30,
  antecedencia_min: 60,
  modelo_livres: '{horarios}',
  modelo_lembrete: '',
  ultimo_backup: null,
  dias_abertos: 14,
  link_ativo: true,
  telefone_negocio: null,
  modelo_cancelamento: '',
};

const ag = (inicio: string, fim: string, status: Status = 'marcado'): Agendamento => ({
  id: inicio + status,
  cliente_id: 'c',
  servico_id: 's',
  inicio: sp(inicio).toISOString(),
  fim: sp(fim).toISOString(),
  status,
  observacao: null,
  origem: 'dono',
});

const TERCA = '2026-11-17';
const horas = (slots: Slot[]) => slots.map((s) => s.hora);
const terca = (over: Partial<Parameters<typeof freeSlots>[0]> = {}) =>
  freeSlots({ config, agendamentos: [], duracaoMin: 60, de: TERCA, ate: TERCA, agora: sp('2026-11-16 20:00'), ...over });

const TERCA_LIVRE = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

describe('freeSlots', () => {
  it('dia sem agendamentos, duração 60', () => {
    const r = terca();
    expect(horas(r)).toEqual(TERCA_LIVRE);
    expect(r.every((s) => s.data === TERCA)).toBe(true);
  });

  it('agendamento marcado 10:00–11:00 remove 09:30, 10:00 e 10:30', () => {
    const r = horas(terca({ agendamentos: [ag(`${TERCA} 10:00`, `${TERCA} 11:00`)] }));
    expect(r).toContain('09:00');
    expect(r).toContain('11:00');
    expect(r).not.toContain('09:30');
    expect(r).not.toContain('10:00');
    expect(r).not.toContain('10:30');
  });

  it('cancelado e faltou não bloqueiam', () => {
    const r = terca({
      agendamentos: [
        ag(`${TERCA} 10:00`, `${TERCA} 11:00`, 'cancelado'),
        ag(`${TERCA} 14:00`, `${TERCA} 15:00`, 'faltou'),
      ],
    });
    expect(horas(r)).toEqual(TERCA_LIVRE);
  });

  it('confirmado bloqueia', () => {
    const r = horas(terca({ agendamentos: [ag(`${TERCA} 14:00`, `${TERCA} 15:00`, 'confirmado')] }));
    expect(r).not.toContain('14:00');
  });

  it('folga remove o dia inteiro', () => {
    expect(terca({ config: { ...config, folgas: [TERCA] } })).toEqual([]);
  });

  it('antecedência: agora 08:30 e antecedência 60 → primeiro slot 09:30', () => {
    expect(horas(terca({ agora: sp(`${TERCA} 08:30`) }))[0]).toBe('09:30');
  });

  it('almoço: duração 90 não atravessa 12:00–14:00', () => {
    const manha = horas(terca({ duracaoMin: 90 })).filter((h) => h < '13:00');
    expect(manha).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('sábado sem intervalos não gera slots', () => {
    expect(terca({ de: '2026-11-21', ate: '2026-11-21' })).toEqual([]);
  });

  it('slot.inicio é o instante correto', () => {
    expect(terca()[0].inicio).toEqual(new Date('2026-11-17T12:00:00Z'));
  });

  it('período de vários dias em ordem', () => {
    const r = freeSlots({ config, agendamentos: [], duracaoMin: 60, de: TERCA, ate: '2026-11-18', agora: sp('2026-11-16 20:00') });
    expect(r).toHaveLength(24);
    expect(r[12].data).toBe('2026-11-18');
  });
});

describe('formatSlotsMessage', () => {
  const slot = (data: string, hora: string): Slot => ({ data, hora, inicio: sp(`${data} ${hora}`) });

  it('agrupa por dia', () => {
    const slots = [slot(TERCA, '14:00'), slot(TERCA, '15:00'), slot('2026-11-18', '10:00'), slot('2026-11-18', '11:30')];
    expect(formatSlotsMessage(slots, 'Esta semana tenho: {horarios}')).toBe(
      'Esta semana tenho: ter 14h, 15h; qua 10h, 11h30',
    );
  });

  it('lista vazia gera texto amigável', () => {
    const r = formatSlotsMessage([], 'Horários: {horarios}');
    expect(r).toContain('Sem horários livres');
  });
});

describe('diasDoPeriodo', () => {
  it('semana vai de hoje até hoje + 6', () => {
    expect(diasDoPeriodo('semana', sp(`${TERCA} 20:00`), FUSO)).toEqual({ de: TERCA, ate: '2026-11-23' });
  });

  it('hoje', () => {
    expect(diasDoPeriodo('hoje', sp(`${TERCA} 20:00`), FUSO)).toEqual({ de: TERCA, ate: TERCA });
  });

  it('amanhã às 23:30 de São Paulo usa a data local', () => {
    expect(diasDoPeriodo('amanha', sp(`${TERCA} 23:30`), FUSO)).toEqual({ de: '2026-11-18', ate: '2026-11-18' });
  });
});
