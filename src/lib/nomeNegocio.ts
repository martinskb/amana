import { gravar, ler } from './cache';

/** Nome a mostrar antes de qualquer dado do servidor: o guardado, o do ambiente ou "Amana". */
export function nomeInicial(): string {
  return ler<string>('nome')?.valor || import.meta.env.VITE_NOME_NEGOCIO || 'Amana';
}

/** Guarda o nome no aparelho e o põe no título da aba. */
export function lembrarNome(nome: string): void {
  gravar('nome', nome);
  document.title = nome;
}
