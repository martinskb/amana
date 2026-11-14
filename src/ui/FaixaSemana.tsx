import { abreviaDia, nomeDiaExtenso } from '../lib/slots';
import { IconeDireita, IconeEsquerda } from './icones';

interface Props {
  /** Os 7 dias (seg–dom), "YYYY-MM-DD". */
  dias: string[];
  selecionado: string;
  /** Quantos clientes cada dia tem (dia ausente = nenhum). */
  contagem: Record<string, number>;
  /** Dias com agendamento novo pelo link: a bolinha vira risco de caneta. */
  comNovo: Set<string>;
  onEscolher: (dia: string) => void;
  onSemana: (passo: -1 | 1) => void;
}

const clientes = (n: number) => (n === 0 ? 'nenhum cliente' : n === 1 ? '1 cliente' : `${n} clientes`);

/** Faixa da semana: tocar num dia mostra esse dia; as setas das pontas mudam a semana. */
export default function FaixaSemana({ dias, selecionado, contagem, comNovo, onEscolher, onSemana }: Props) {
  return (
    <div className="faixa-semana">
      <button type="button" className="faixa-seta" aria-label="Semana anterior" onClick={() => onSemana(-1)}>
        <IconeEsquerda tamanho={18} />
      </button>
      <div role="group" aria-label="Dias da semana" className="faixa-dias">
        {dias.map((d) => {
          const n = contagem[d] ?? 0;
          const novo = comNovo.has(d);
          const nome = `${nomeDiaExtenso(d, true)}, ${clientes(n)}${novo ? ', com novo pelo link' : ''}`;
          return (
            <button key={d} type="button" className="faixa-dia" aria-pressed={d === selecionado} aria-label={nome} onClick={() => onEscolher(d)}>
              <span className="fd-nome">{abreviaDia(d)}</span>
              <span className="fd-num">{Number(d.slice(8, 10))}</span>
              {(novo || n > 0) && <span className={`fd-marca ${novo ? 'risco' : 'bolinha'}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <button type="button" className="faixa-seta" aria-label="Próxima semana" onClick={() => onSemana(1)}>
        <IconeDireita tamanho={18} />
      </button>
    </div>
  );
}
