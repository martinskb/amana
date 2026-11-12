import { useEffect, useState } from 'react';

/**
 * Conta quantas vezes o app voltou a ficar visível. No iPhone, o app da Tela de Início fica
 * suspenso na memória; ao reabrir no dia seguinte, as telas precisam recarregar e recalcular "hoje".
 */
export function useAoVoltar(): number {
  const [voltas, setVoltas] = useState(0);
  useEffect(() => {
    const aoMudar = () => {
      if (document.visibilityState === 'visible') setVoltas((v) => v + 1);
    };
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, []);
  return voltas;
}
