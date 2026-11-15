import { fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { diasDoLink, diasDoPeriodo, formatSlotsMessage, freeSlots, gerarHorarios, nomeDiaExtenso } from '../../src/lib/slots';
import type { Agendamento, Config, HorarioAjuste, Pessoa, Slot, Status } from '../../src/types';

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
  backup_ativo: false,
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
  pessoa_id: 'p1',
});

const pessoa = (id: string, ordem: number, over: Partial<Pessoa> = {}): Pessoa => ({
  id,
  nome: null,
  ativo: true,
  ordem,
  folgas: [],
  servicos: [],
  ...over,
});
const P1 = pessoa('p1', 1);
const P2 = pessoa('p2', 2);

const TERCA = '2026-11-17';
const horas = (slots: Slot[]) => slots.map((s) => s.hora);
const SEGUNDA_20H = sp('2026-11-16 20:00');
const terca = (over: Partial<Parameters<typeof freeSlots>[0]> = {}) =>
  freeSlots({ config, agendamentos: [], ajustes: [], pessoas: [P1], de: TERCA, ate: TERCA, agora: SEGUNDA_20H, ...over });
const ajuste = (tipo: 'fechado' | 'extra', local: string, pessoa_id: string | null = tipo === 'extra' ? 'p1' : null): HorarioAjuste => ({
  id: tipo + local,
  tipo,
  inicio: sp(local).toISOString(),
  pessoa_id,
});

const MANHA = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
const TARDE = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
const TERCA_LIVRE = [...MANHA, ...TARDE];

describe('freeSlots', () => {
  it('dia sem agendamentos: blocos de passo_min (30) dentro do expediente', () => {
    const r = terca();
    expect(horas(r)).toEqual(TERCA_LIVRE);
    expect(r.every((s) => s.data === TERCA)).toBe(true);
  });

  it('agendamento marcado 10:00–11:00 remove 10:00 e 10:30; 09:30 e 11:00 encostam e ficam', () => {
    const r = horas(terca({ agendamentos: [ag(`${TERCA} 10:00`, `${TERCA} 11:00`)] }));
    expect(r).toEqual(TERCA_LIVRE.filter((h) => h !== '10:00' && h !== '10:30'));
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
    expect(r).not.toContain('14:30');
  });

  it('folga remove o dia inteiro', () => {
    expect(terca({ config: { ...config, folgas: [TERCA] } })).toEqual([]);
  });

  it('antecedência: agora 08:30 e antecedência 60 → primeiro horário 09:30', () => {
    expect(horas(terca({ agora: sp(`${TERCA} 08:30`) }))[0]).toBe('09:30');
  });

  it('passo 90: manhã só 09:00 e 10:30; tarde 14:00 e 15:30', () => {
    expect(horas(terca({ config: { ...config, passo_min: 90 } }))).toEqual(['09:00', '10:30', '14:00', '15:30']);
  });

  it('passo 40 com agendamento antigo 10:00–10:30: 09:40 e 10:20 saem; 09:00 e 11:00 ficam', () => {
    const r = horas(terca({ config: { ...config, passo_min: 40 }, agendamentos: [ag(`${TERCA} 10:00`, `${TERCA} 10:30`)] }));
    expect(r.filter((h) => h < '12:00')).toEqual(['09:00', '11:00']);
  });

  it('sábado sem intervalos não gera horários', () => {
    expect(terca({ de: '2026-11-21', ate: '2026-11-21' })).toEqual([]);
  });

  it('slot.inicio é o instante correto', () => {
    expect(terca()[0].inicio).toEqual(new Date('2026-11-17T12:00:00Z'));
  });

  it('período de vários dias em ordem', () => {
    const r = freeSlots({ config, agendamentos: [], ajustes: [], pessoas: [P1], de: TERCA, ate: '2026-11-18', agora: SEGUNDA_20H });
    expect(r).toHaveLength(28);
    expect(r[14].data).toBe('2026-11-18');
  });

  it('extra às 19:00 de terça entra na lista', () => {
    expect(horas(terca({ ajustes: [ajuste('extra', `${TERCA} 19:00`)] })).at(-1)).toBe('19:00');
  });

  it('extra num dia de folga entra', () => {
    const r = terca({ config: { ...config, folgas: [TERCA] }, ajustes: [ajuste('extra', `${TERCA} 19:00`)] });
    expect(horas(r)).toEqual(['19:00']);
  });

  it('extra no mesmo início de um horário do expediente aparece uma vez só', () => {
    expect(horas(terca({ ajustes: [ajuste('extra', `${TERCA} 10:00`)] }))).toEqual(TERCA_LIVRE);
  });

  it('fechado às 10:00 tira 10:00', () => {
    expect(horas(terca({ ajustes: [ajuste('fechado', `${TERCA} 10:00`)] }))).toEqual(
      TERCA_LIVRE.filter((h) => h !== '10:00'),
    );
  });

  it('extra ocupado por agendamento não é livre', () => {
    const r = terca({
      ajustes: [ajuste('extra', `${TERCA} 19:00`)],
      agendamentos: [ag(`${TERCA} 19:00`, `${TERCA} 19:30`)],
    });
    expect(horas(r)).not.toContain('19:00');
  });
});

describe('freeSlots por pessoa', () => {
  const dela = (r: ReturnType<typeof freeSlots>, id: string) => horas(r.filter((s) => s.pessoa_id === id));
  const duas = (over: Partial<Parameters<typeof freeSlots>[0]> = {}) => terca({ pessoas: [P1, P2], ...over });

  it('cada slot diz de quem é; ordem por início e depois pela ordem da pessoa', () => {
    const r = duas();
    expect(r).toHaveLength(TERCA_LIVRE.length * 2);
    expect(r.slice(0, 2).map((s) => [s.hora, s.pessoa_id])).toEqual([['09:00', 'p1'], ['09:00', 'p2']]);
  });

  it('livre para uma pessoa e ocupada para a outra', () => {
    const r = duas({ agendamentos: [ag(`${TERCA} 10:00`, `${TERCA} 10:30`)] });
    expect(dela(r, 'p1')).not.toContain('10:00');
    expect(dela(r, 'p2')).toContain('10:00');
  });

  it('folga de uma pessoa só tira os horários dela', () => {
    const r = terca({ pessoas: [P1, { ...P2, folgas: [TERCA] }] });
    expect(dela(r, 'p1')).toEqual(TERCA_LIVRE);
    expect(dela(r, 'p2')).toEqual([]);
  });

  it('fechado do negócio tira de todas, fechado de uma tira só dela', () => {
    const r = duas({ ajustes: [ajuste('fechado', `${TERCA} 10:00`, null), ajuste('fechado', `${TERCA} 14:00`, 'p2')] });
    expect(dela(r, 'p1')).toEqual(TERCA_LIVRE.filter((h) => h !== '10:00'));
    expect(dela(r, 'p2')).toEqual(TERCA_LIVRE.filter((h) => h !== '10:00' && h !== '14:00'));
  });

  it('extra de uma pessoa só abre para ela', () => {
    const r = duas({ ajustes: [ajuste('extra', `${TERCA} 19:00`, 'p2')] });
    expect(dela(r, 'p1')).not.toContain('19:00');
    expect(dela(r, 'p2').at(-1)).toBe('19:00');
  });

  it('pessoa desativada não tem horário', () => {
    const r = terca({ pessoas: [P1, { ...P2, ativo: false }] });
    expect(dela(r, 'p2')).toEqual([]);
    expect(dela(r, 'p1')).toEqual(TERCA_LIVRE);
  });
});

describe('gerarHorarios', () => {
  it('marca fechado: true no horário fechado e mantém os outros', () => {
    const r = gerarHorarios({ config, ajustes: [ajuste('fechado', `${TERCA} 10:00`)], de: TERCA, ate: TERCA });
    expect(r.map((h) => h.hora)).toEqual(TERCA_LIVRE);
    expect(r.filter((h) => h.fechado).map((h) => h.hora)).toEqual(['10:00']);
  });

  it('inclui o extra fora do expediente, ordenado', () => {
    const r = gerarHorarios({ config, ajustes: [ajuste('extra', `${TERCA} 12:30`)], de: TERCA, ate: TERCA });
    expect(r.map((h) => h.hora)).toEqual([...MANHA, '12:30', ...TARDE]);
  });

  it('com pessoa: folga dela, extra dela e fechado do negócio ou dela', () => {
    const ajustes = [
      ajuste('extra', `${TERCA} 12:30`, 'p2'),
      ajuste('extra', `${TERCA} 19:00`, 'p1'),
      ajuste('fechado', `${TERCA} 10:00`, 'p1'),
      ajuste('fechado', `${TERCA} 11:00`, null),
    ];
    const r = gerarHorarios({ config, ajustes, de: TERCA, ate: TERCA, pessoa: P2 });
    expect(r.map((h) => h.hora)).toEqual([...MANHA, '12:30', ...TARDE]);
    expect(r.filter((h) => h.fechado).map((h) => h.hora)).toEqual(['11:00']);
    expect(gerarHorarios({ config, ajustes, de: TERCA, ate: TERCA, pessoa: { ...P2, folgas: [TERCA] } }).map((h) => h.hora)).toEqual(['12:30']);
  });
});

describe('diasDoLink', () => {
  it('de hoje até hoje + dias_abertos − 1', () => {
    expect(diasDoLink(sp(`${TERCA} 20:00`), config)).toEqual({ de: TERCA, ate: '2026-11-30' });
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

describe('nomeDiaExtenso', () => {
  it('escreve o dia por extenso, sem zero à esquerda, e com o mês quando pedido', () => {
    expect(nomeDiaExtenso('2026-11-14')).toBe('sábado, 14');
    expect(nomeDiaExtenso('2026-11-09')).toBe('segunda, 9');
    expect(nomeDiaExtenso('2026-03-01', true)).toBe('domingo, 1 de março');
  });
});
