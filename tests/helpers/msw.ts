import { createClient } from '@supabase/supabase-js';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

export const URL_TESTE = 'http://teste.local';
export const REST = `${URL_TESTE}/rest/v1`;
export const servidor = setupServer();
export const dbTeste = createClient(URL_TESTE, 'chave-teste', {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { retry: false }, // o app real tenta de novo 3 vezes; nos testes, falha na hora
});

/** Liga o MSW no arquivo de teste que chamar. Requisição sem handler é erro. */
export function usarServidor() {
  beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => servidor.resetHandlers());
  afterAll(() => servidor.close());
}
