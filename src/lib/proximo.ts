import type { AgendamentoCompleto } from '../types';
import { dataLocal } from './slots';

/** Próximo atendimento de hoje (data local): marcado ou confirmado, com início depois de agora. */
export function proximoCliente(ags: AgendamentoCompleto[], agora: Date, fuso: string): AgendamentoCompleto | null {
  const hoje = dataLocal(agora, fuso);
  return (
    ags
      .filter(
        (a) =>
          (a.status === 'marcado' || a.status === 'confirmado') &&
          new Date(a.inicio).getTime() > agora.getTime() &&
          dataLocal(new Date(a.inicio), fuso) === hoje,
      )
      .sort((x, y) => new Date(x.inicio).getTime() - new Date(y.inicio).getTime())[0] ?? null
  );
}

/** "em 40 min", "em 1 h", "em 1 h 20 min". */
export function faltaPara(inicio: string, agora: Date): string {
  const min = Math.max(0, Math.round((new Date(inicio).getTime() - agora.getTime()) / 60_000));
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h === 0) return `em ${resto} min`;
  return resto === 0 ? `em ${h} h` : `em ${h} h ${resto} min`;
}
