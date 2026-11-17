import { dataLocal, horaCurta, horaLocal, nomeDiaExtenso } from '../lib/slots';
import type { AgendamentoCompleto } from '../types';
import { NotaMao } from './Caneta';

/** "Ana, sábado às 10h": o dia da semana por extenso e a hora curta, no fuso do negócio. */
function quando(a: AgendamentoCompleto, fuso: string): string {
  const inicio = new Date(a.inicio);
  const dia = nomeDiaExtenso(dataLocal(inicio, fuso)).split(',')[0];
  return `${a.cliente.nome}, ${dia} às ${horaCurta(horaLocal(inicio, fuso))}`;
}

/**
 * Anúncio para o leitor de tela quando um novo pelo link chega com a tela aberta. A região fica
 * sempre montada (vazia) para o leitor perceber a mudança.
 */
export function AnuncioNovos({
  novos,
  chegaram,
  fuso,
}: {
  novos: AgendamentoCompleto[];
  chegaram: ReadonlySet<string>;
  fuso: string;
}) {
  const texto = novos
    .filter((a) => chegaram.has(a.id))
    .map((a) => `Novo agendamento pelo link: ${quando(a, fuso)}`)
    .join('. ');
  return (
    <p className="so-leitor" aria-live="polite">
      {texto}
    </p>
  );
}

interface NotaProps {
  novos: AgendamentoCompleto[];
  chegaram: ReadonlySet<string>;
  /** A semana visível, "YYYY-MM-DD". */
  de: string;
  ate: string;
  fuso: string;
  /** Vai para o dia do primeiro novo fora da semana. */
  onIr: (data: string) => void;
}

/** "3 novos pelo link →" à mão, no topo do celular, quando há novos fora da semana visível. */
export function NotaNovosFora({ novos, chegaram, de, ate, fuso, onIr }: NotaProps) {
  const fora = novos
    .map((a) => ({ a, data: dataLocal(new Date(a.inicio), fuso) }))
    .filter(({ data }) => data < de || data > ate)
    .sort((x, y) => new Date(x.a.inicio).getTime() - new Date(y.a.inicio).getTime());
  if (fora.length === 0) return null;
  const n = fora.length;
  const texto = `${n} ${n === 1 ? 'novo' : 'novos'} pelo link`;
  // chegou agora: a nota também aparece escrita
  const acabouDeChegar = fora.some(({ a }) => chegaram.has(a.id));
  return (
    <button
      type="button"
      className="nota-novos"
      aria-label={`${texto} em outra semana: ver o primeiro`}
      onClick={() => onIr(fora[0].data)}
    >
      <NotaMao atraso={acabouDeChegar ? 0 : undefined}>{texto} →</NotaMao>
    </button>
  );
}
