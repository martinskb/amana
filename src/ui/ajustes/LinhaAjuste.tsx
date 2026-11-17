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
  /** Um aviso curto em `--sutil` depois do valor (ex.: "ninguém faz"). Fica fora do nome do botão. */
  nota?: string;
}

/** Uma linha do resumo dos Ajustes: o nome à esquerda, o valor atual à direita e "›" quando abre um painel. */
export default function LinhaAjuste({ rotulo, valor, onAbrir, salvo = false, fim, nota }: Props) {
  const conteudo = (
    <>
      <span className="la-rotulo">
        {rotulo}
        {salvo && <NotaSalvo />}
      </span>
      <span className="la-valor">{valor}</span>
      {nota && <span className="la-nota">{nota}</span>}
      {onAbrir && <IconeDireita tamanho={16} />}
    </>
  );
  return (
    <li className="linha-ajuste">
      {onAbrir ? (
        <button type="button" className="la-corpo" aria-label={valor ? `${rotulo}, ${valor}` : rotulo} onClick={onAbrir}>
          {conteudo}
        </button>
      ) : (
        <div className="la-corpo">{conteudo}</div>
      )}
      {fim}
    </li>
  );
}
