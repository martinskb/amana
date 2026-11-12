/** Chave do backup automático: 32 bytes aleatórios em base64url (43 caracteres, sem "="). */
export function gerarChaveBackup(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
