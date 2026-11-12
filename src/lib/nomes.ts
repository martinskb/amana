const normalizar = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Nome digitado no link quando ele não bate com o cadastro do WhatsApp (SEC-001): o número identifica
 * o cliente que volta, mas quem agenda pelo link não prova que é o dono do número. Ignora maiúsculas,
 * espaços e acentos para não alarmar à toa ("joao" e "João" são o mesmo nome).
 */
export function nomeDivergente(cadastro: string, informado: string | null | undefined): string | null {
  if (!informado?.trim()) return null;
  return normalizar(cadastro) === normalizar(informado) ? null : informado.trim();
}
