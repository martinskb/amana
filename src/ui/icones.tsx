import type { ReactNode } from 'react';

interface Props {
  tamanho?: number;
}

/** Ícones de traço, decorativos (o texto ao lado ou o aria-label do botão dá o nome). */
function Icone({ tamanho = 20, espessura = 1.8, children }: Props & { espessura?: number; children: ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconeWhatsApp = (p: Props) => (
  <Icone {...p}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
  </Icone>
);

export const IconeX = (p: Props) => (
  <Icone espessura={2.6} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icone>
);

export const IconeEsquerda = (p: Props) => (
  <Icone espessura={2} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Icone>
);

export const IconeDireita = (p: Props) => (
  <Icone espessura={2} {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icone>
);

export const IconeMais = (p: Props) => (
  <Icone espessura={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icone>
);

export const IconeCopiar = (p: Props) => (
  <Icone {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Icone>
);

export const IconeEngrenagem = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icone>
);
