/** Telefone só com dígitos, no formato 55 + DDD + número; `null` se não der para entender. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 || d.length === 11) {
    if (d.startsWith('0')) return null; // DDD não começa com 0
    return `55${d}`;
  }
  return null;
}

export function waLink(telefone: string | null, texto: string): string {
  return `https://wa.me/${telefone ?? ''}?text=${encodeURIComponent(texto)}`;
}

export function renderModelo(modelo: string, vars: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (marcador, chave: string) =>
    Object.prototype.hasOwnProperty.call(vars, chave) ? vars[chave] : marcador,
  );
}

