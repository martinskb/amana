/** Endereço da página pública de agendamento, no mesmo site do app. */
export function linkAgendamento(loc: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${loc.origin}${loc.pathname}#/agendar`;
}

/** Endereço da agenda de uma pessoa da equipe (link secreto, sem login). */
export function linkEquipe(codigo: string, loc: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${loc.origin}${loc.pathname}#/equipe/${codigo}`;
}
