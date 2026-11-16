import { ativas, nomeDaPessoa } from '../lib/pessoas';
import type { Pessoa } from '../types';

interface Props {
  pessoas: Pessoa[];
  /** null = todos. */
  escolhida: string | null;
  onEscolher: (id: string | null) => void;
}

/** "[ todos ] Ana João Pessoa 3" no topo da agenda. Com muitas pessoas, a faixa rola para o lado. */
export default function FiltroPessoas({ pessoas, escolhida, onEscolher }: Props) {
  return (
    <div role="group" aria-label="Pessoa" className="filtro-pessoas">
      <button type="button" aria-pressed={escolhida === null} onClick={() => onEscolher(null)}>
        todos
      </button>
      {ativas(pessoas).map((p) => (
        <button key={p.id} type="button" aria-pressed={escolhida === p.id} onClick={() => onEscolher(p.id)}>
          {nomeDaPessoa(p, pessoas)}
        </button>
      ))}
    </div>
  );
}
