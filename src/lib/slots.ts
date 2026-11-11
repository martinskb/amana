import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Agendamento, Config, DiaSemana, Slot } from '../types';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const ATIVOS = new Set(['marcado', 'confirmado']);
const MINUTO = 60_000;

/** Soma `n` dias a uma data "YYYY-MM-DD" (aritmética de calendário, sem fuso). */
export function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diaDaSemana(data: string): DiaSemana {
  return new Date(`${data}T12:00:00Z`).getUTCDay() as DiaSemana;
}

/** Instante correspondente a uma data e hora locais do negócio. */
export function instanteLocal(data: string, hora: string, fuso: string): Date {
  return fromZonedTime(`${data}T${hora}:00`, fuso);
}

export function dataLocal(instante: Date, fuso: string): string {
  return formatInTimeZone(instante, fuso, 'yyyy-MM-dd');
}

export function horaLocal(instante: Date, fuso: string): string {
  return formatInTimeZone(instante, fuso, 'HH:mm');
}

function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function paraHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function freeSlots(args: {
  config: Config;
  agendamentos: Agendamento[];
  duracaoMin: number;
  de: string;
  ate: string;
  agora: Date;
}): Slot[] {
  const { config, agendamentos, duracaoMin, de, ate, agora } = args;
  const ocupados = agendamentos
    .filter((a) => ATIVOS.has(a.status))
    .map((a) => [new Date(a.inicio).getTime(), new Date(a.fim).getTime()] as const);
  const limite = agora.getTime() + config.antecedencia_min * MINUTO;
  const folgas = new Set(config.folgas);
  const slots: Slot[] = [];

  for (let data = de; data <= ate; data = somarDias(data, 1)) {
    if (folgas.has(data)) continue;
    for (const intervalo of config.expediente[diaDaSemana(data)] ?? []) {
      const fimIntervalo = paraMinutos(intervalo.fim);
      for (let m = paraMinutos(intervalo.inicio); m + duracaoMin <= fimIntervalo; m += config.passo_min) {
        const hora = paraHora(m);
        const inicio = instanteLocal(data, hora, config.fuso);
        const ini = inicio.getTime();
        const fim = ini + duracaoMin * MINUTO;
        if (ini < limite) continue;
        // intervalos meio-abertos: encostar no fim de outro não é conflito
        if (ocupados.some(([oi, of]) => ini < of && oi < fim)) continue;
        slots.push({ data, hora, inicio });
      }
    }
  }
  return slots;
}

function horaCurta(hora: string): string {
  const [h, m] = hora.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function formatSlotsMessage(slots: Slot[], modelo: string): string {
  let horarios: string;
  if (slots.length === 0) {
    horarios = 'Sem horários livres nesse período.';
  } else {
    const porDia = new Map<string, string[]>();
    for (const s of slots) {
      const lista = porDia.get(s.data) ?? [];
      lista.push(horaCurta(s.hora));
      porDia.set(s.data, lista);
    }
    horarios = [...porDia]
      .map(([data, hs]) => `${DIAS[diaDaSemana(data)]} ${hs.join(', ')}`)
      .join('; ');
  }
  const texto = modelo.includes('{horarios}') ? modelo.replaceAll('{horarios}', horarios) : `${modelo} ${horarios}`.trim();
  return texto;
}

export function diasDoPeriodo(
  periodo: 'hoje' | 'amanha' | 'semana',
  agora: Date,
  fuso: string,
): { de: string; ate: string } {
  const hoje = dataLocal(agora, fuso);
  if (periodo === 'hoje') return { de: hoje, ate: hoje };
  if (periodo === 'amanha') {
    const amanha = somarDias(hoje, 1);
    return { de: amanha, ate: amanha };
  }
  return { de: hoje, ate: somarDias(hoje, 6) };
}

export function abreviaDia(data: string): string {
  return DIAS[diaDaSemana(data)];
}

export { horaCurta };
