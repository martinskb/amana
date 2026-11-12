import type { Status } from '../types';
import { IconeCheck, IconeRelogio, IconeX } from './icones';

const SELOS: Record<Status, { texto: string; Icone: typeof IconeCheck }> = {
  marcado: { texto: 'marcado', Icone: IconeRelogio },
  confirmado: { texto: 'confirmado', Icone: IconeCheck },
  concluido: { texto: 'concluído', Icone: IconeCheck },
  faltou: { texto: 'faltou', Icone: IconeX },
  cancelado: { texto: 'cancelado', Icone: IconeX },
};

/** Situação do agendamento com ícone e texto (a cor nunca é o único indicador). */
export default function SeloStatus({ status }: { status: Status }) {
  const { texto, Icone } = SELOS[status];
  return (
    <span className={`selo ${status}`}>
      <Icone tamanho={12} /> {texto}
    </span>
  );
}
