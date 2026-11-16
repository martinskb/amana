import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ConfigContext } from '../../src/ui/contexto';
import type { Config, Pessoa } from '../../src/types';
import { CONFIG_TESTE } from './config';
import { PESSOA_TESTE } from './pessoas';

/** Renderiza uma tela com a configuração no contexto, como o App faz depois do login. */
export function renderComConfig(ui: ReactElement, config: Config = CONFIG_TESTE, pessoas: Pessoa[] = [PESSOA_TESTE]) {
  const recarregar = vi.fn(async () => {});
  const recarregarPessoas = vi.fn(async () => {});
  const r = render(
    <ConfigContext.Provider value={{ config, recarregar, semConexao: false, pessoas, recarregarPessoas }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ConfigContext.Provider>,
  );
  return { ...r, recarregar, recarregarPessoas };
}
