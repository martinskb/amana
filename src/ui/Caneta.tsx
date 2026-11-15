import type { CSSProperties, ReactNode } from 'react';
import { usePrefereMenosMovimento } from './animacao';

/** O traço à mão do circulado (o mesmo da proposta aprovada): abre e fecha passando um pouco do começo. */
const TRACO = 'M100 4C50 1 6 10 4 26c-2 18 50 24 100 22 52-2 84-10 82-24C184 10 150 3 90 6';

/**
 * Circulado de caneta em volta de um agendamento novo pelo link. Estica até a largura do item.
 * Já aparece desenhado; com `desenhar`, a caneta passa o traço (700 ms). Decoração: o rótulo
 * acessível do agendamento é que diz que ele é novo.
 */
export function Circulado({ desenhar }: { desenhar: boolean }) {
  const menos = usePrefereMenosMovimento();
  return (
    <svg
      className={`circulado${desenhar && !menos ? ' desenhando' : ''}`}
      viewBox="0 0 190 52"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRACO} pathLength={1} />
    </svg>
  );
}

/**
 * Anotação curta à mão (Caveat, `--marca`, girada). Com `atraso`, aparece escrita depois desse tempo
 * (por exemplo, depois do circulado); sem, já está lá. Decoração, escondida do leitor.
 */
export function NotaMao({ children, atraso }: { children: ReactNode; atraso?: number }) {
  const menos = usePrefereMenosMovimento();
  const anima = atraso !== undefined && !menos;
  return (
    <span
      className={`nota-mao${anima ? ' escrevendo' : ''}`}
      style={anima ? ({ animationDelay: `${atraso}ms` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
