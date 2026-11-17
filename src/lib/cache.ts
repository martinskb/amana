/**
 * Cache no aparelho (localStorage). Todas as funções recebem a chave sem o prefixo "amana:"
 * e nunca lançam: se o armazenamento estiver cheio, bloqueado ou corrompido, o app segue sem cache.
 */
const PREFIXO = 'amana:';

export function ler<T>(chave: string): { valor: T; em: string } | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (bruto === null) return null;
    const lido = JSON.parse(bruto) as { valor: T; em: string } | null;
    if (!lido || typeof lido !== 'object' || typeof lido.em !== 'string' || !('valor' in lido)) return null;
    return { valor: lido.valor, em: lido.em };
  } catch {
    return null;
  }
}

export function gravar<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ valor, em: new Date().toISOString() }));
  } catch {
    // sem espaço ou bloqueado: segue sem cache
  }
}

export function apagar(chave: string): void {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch {
    // ignorado
  }
}

function chavesComPrefixo(inicio: string): string[] {
  const chaves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIXO + inicio)) chaves.push(k);
  }
  return chaves;
}

/** Apaga o que é da sessão (config, agenda:*, servicos, pessoas). Mantém nome, vistos, corte-novos e filtro-pessoa. */
export function apagarAgendaESessao(): void {
  try {
    for (const k of chavesComPrefixo('agenda:')) localStorage.removeItem(k);
    localStorage.removeItem(PREFIXO + 'config');
    localStorage.removeItem(PREFIXO + 'servicos');
    localStorage.removeItem(PREFIXO + 'pessoas');
  } catch {
    // ignorado
  }
}

/** Mantém só as `max` chaves agenda:* mais recentes (pelo `em` gravado). */
export function podarAgenda(max = 8): void {
  try {
    const itens = chavesComPrefixo('agenda:').map((k) => {
      const lido = ler<unknown>(k.slice(PREFIXO.length));
      return { k, em: lido?.em ?? '' };
    });
    itens.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0));
    for (const { k } of itens.slice(max)) localStorage.removeItem(k);
  } catch {
    // ignorado
  }
}

/**
 * Lê e apaga uma chave antiga, sem o prefixo "amana:" (de antes desta versão do app).
 * Devolve null se não existir ou se o armazenamento falhar.
 */
export function tirarChaveAntiga(chaveCompleta: string): string | null {
  try {
    const valor = localStorage.getItem(chaveCompleta);
    if (valor !== null) localStorage.removeItem(chaveCompleta);
    return valor;
  } catch {
    return null;
  }
}
