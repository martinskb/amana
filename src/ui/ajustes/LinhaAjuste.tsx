import type { ReactNode } from 'react';
import { NotaMao } from '../Caneta';
import { IconeDireita } from '../icones';

/** "salvo! ✓" escrito à mão por ~1,5 s ao lado da linha que acabou de ser salva. Decoração. */
export function NotaSalvo() {
  return (
    <span className="salvo-mao">
      <NotaMao>salvo! ✓</NotaMao>
    </span>
  );
}

interface Props {
  rotulo: string;
  valor: string;
  /** Sem `onAbrir`, a linha só mostra (não abre painel). */
  onAbrir?: () => void;
  salvo?: boolean;
  /** Algo que fica na própria linha, depois do valor (ex.: a chave "ativo" do serviço). */
  fim?: ReactNode;
}

/** Uma linha do resumo dos Ajustes: o nome à esquerda, o valor atual à direita e "›" quando abre um painel. */
export default function LinhaAjuste({ rotulo, valor, onAbrir, salvo = false, fim }: Props) {
  const conteudo = (
    <>
      <span className="la-rotulo">
        {rotulo}
        {salvo && <NotaSalvo />}
      </span>
      <span className="la-valor">{valor}</span>
      {onAbrir && <IconeDireita tamanho={16} />}
    </>
  );
  return (
    <li className="linha-ajuste">
      {onAbrir ? (
        <button type="button" className="la-corpo" aria-label={`${rotulo}, ${valor}`} onClick={onAbrir}>
          {conteudo}
        </button>
      ) : (
        <div className="la-corpo">{conteudo}</div>
      )}
      {fim}
    </li>
  );
}
