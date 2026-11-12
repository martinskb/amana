import { createContext, useContext } from 'react';
import type { Config } from '../types';

export interface ContextoApp {
  config: Config;
  /** Recarrega a configuração do banco (depois de salvar em Configurações, por exemplo). */
  recarregar: () => Promise<void>;
}

export const ConfigContext = createContext<ContextoApp | null>(null);

export function useConfig(): ContextoApp {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig fora do ConfigContext');
  return ctx;
}
