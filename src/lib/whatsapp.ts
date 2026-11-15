/**
 * WhatsApp só com dígitos (código do país + número); `null` se não der para entender.
 * Com `+`: internacional, de 8 a 15 dígitos (`+55` segue a regra brasileira).
 * Sem `+`: número brasileiro, com DDD obrigatório.
 * A mesma regra existe em SQL: `normalizar_telefone` (supabase/migrations/0002).
 */
export function normalizePhone(raw: string): string | null {
  const texto = raw.trim();
  let d = texto.replace(/\D/g, '');
  if (texto.startsWith('+') && !d.startsWith('55')) return d.length >= 8 && d.length <= 15 ? d : null;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (texto.startsWith('+')) return null; // +55 com tamanho errado
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 || d.length === 11) {
    if (d.startsWith('0')) return null; // DDD não começa com 0
    return `55${d}`;
  }
  return null;
}

/** O WhatsApp gravado (só dígitos) para ler: "(11) 98765-4321" no Brasil, "+351…" fora. */
export function telefoneLegivel(digitos: string): string {
  if (!digitos.startsWith('55') || (digitos.length !== 12 && digitos.length !== 13)) return `+${digitos}`;
  const numero = digitos.slice(4);
  return `(${digitos.slice(2, 4)}) ${numero.slice(0, -4)}-${numero.slice(-4)}`;
}

export const MSG_WHATSAPP_INVALIDO ='WhatsApp inválido. Use DDD + número, ou + e o código do país.';

export function waLink(telefone: string | null, texto: string): string {
  return `https://wa.me/${telefone ?? ''}?text=${encodeURIComponent(texto)}`;
}

export function renderModelo(modelo: string, vars: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (marcador, chave: string) =>
    Object.prototype.hasOwnProperty.call(vars, chave) ? vars[chave] : marcador,
  );
}

