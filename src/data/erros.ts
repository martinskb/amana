export class ConflitoDeHorarioError extends Error {
  constructor() {
    super('Esse horário já está ocupado.');
    this.name = 'ConflitoDeHorarioError';
  }
}

export class SemConexaoError extends Error {
  constructor(detalhe?: string) {
    super(`Não foi possível conectar.${detalhe ? ` (${detalhe})` : ''}`);
    this.name = 'SemConexaoError';
  }
}

interface Resposta<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
  status: number;
}

/** Traduz a resposta do supabase-js nos erros da aplicação e devolve os dados. */
export async function executar<T>(consulta: PromiseLike<Resposta<T>>): Promise<T> {
  let r: Resposta<T>;
  try {
    r = await consulta;
  } catch (e) {
    throw new SemConexaoError(e instanceof Error ? e.message : String(e));
  }
  if (r.status === 0 || r.status >= 500) throw new SemConexaoError(r.error?.message);
  if (r.error) {
    if (r.error.code === '23P01') throw new ConflitoDeHorarioError();
    throw new Error(r.error.message);
  }
  return r.data as T;
}
