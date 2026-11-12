import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/** Contêiner das telas do dono: a cada troca de aba remonta com a animação de entrada (fade + 8px). */
export default function TransicaoRota({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="conteudo entra">
      {children}
    </div>
  );
}
