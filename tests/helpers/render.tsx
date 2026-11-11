import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ConfigContext } from '../../src/ui/contexto';
import type { Config } from '../../src/types';
import { CONFIG_TESTE } from './config';

/** Renderiza uma tela com a configuração no contexto, como o App faz depois do login. */
export function renderComConfig(ui: ReactElement, config: Config = CONFIG_TESTE) {
  const recarregar = vi.fn(async () => {});
  const r = render(
    <ConfigContext.Provider value={{ config, recarregar }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ConfigContext.Provider>,
  );
  return { ...r, recarregar };
}
