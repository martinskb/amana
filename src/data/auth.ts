/** Erro do Supabase Auth que vem da rede ou do servidor fora do ar (inclui projeto pausado). */
export function ehErroDeConexao(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const { status, name } = erro as { status?: number; name?: string };
  return name === 'AuthRetryableFetchError' || status === 0 || (typeof status === 'number' && status >= 500);
}
