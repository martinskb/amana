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

export const IconeAgenda = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icone>
);

export const IconeLink = (p: Props) => (
  <Icone {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icone>
);

export const IconeAjustes = (p: Props) => (
  <Icone {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icone>
);

export const IconeWhatsApp = (p: Props) => (
  <Icone {...p}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
  </Icone>
);

export const IconeCheck = (p: Props) => (
  <Icone espessura={2.6} {...p}>
    <path d="M5 12l5 5 9-10" />
  </Icone>
);

export const IconeX = (p: Props) => (
  <Icone espessura={2.6} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icone>
);

export const IconeRelogio = (p: Props) => (
  <Icone espessura={2.2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icone>
);

export const IconeSino = (p: Props) => (
  <Icone {...p}>
    <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <path d="M10 21h4" />
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
