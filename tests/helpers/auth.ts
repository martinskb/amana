import { vi } from 'vitest';

type Callback = (evento: string, sessao: unknown) => void;

function metodos(alvo: { sessao: unknown; erroSessao: unknown }) {
  let callback: Callback | undefined;
  return {
    sessao: null as unknown,
    /** Erro devolvido por getSession (por exemplo, falha de rede ao renovar o token). */
    erroSessao: null as unknown,
    getSession: vi.fn(async () =>
      alvo.erroSessao ? { data: { session: null }, error: alvo.erroSessao } : { data: { session: alvo.sessao }, error: null },
    ),
    onAuthStateChange: vi.fn((cb: Callback) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signOut: vi.fn(async () => ({ error: null })),
    emitir: (evento: string, sessao: unknown) => callback?.(evento, sessao),
  };
}

export type AuthFalso = ReturnType<typeof metodos>;

/** Preenche `alvo` (criado com vi.hoisted) com um supabase.auth falso e o devolve. */
export function criarAuthFalso(alvo: Partial<AuthFalso> = {}): AuthFalso {
  return Object.assign(alvo, metodos(alvo as AuthFalso));
}

export const SESSAO = { access_token: 't', user: { id: 'u1', email: 'dono@exemplo.com' } };
