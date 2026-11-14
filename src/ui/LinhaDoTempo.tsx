import type { CSSProperties } from 'react';
import { nomeDivergente } from '../lib/nomes';
import { abreviaDia, instanteLocal } from '../lib/slots';
import type { AgendamentoCompleto, Status } from '../types';
import { useConfig } from './contexto';
import { IconeMais } from './icones';
import type { Item, ItemSemana } from './semana';

export type ItemLinha = Item | ItemSemana;

interface Props {
  /** O dia desta linha do tempo, "YYYY-MM-DD". */
  data: string;
  itens: readonly ItemLinha[];
  /** Dia: um horário livre por linha. Semana: livres seguidos agrupados ("livre até"). */
  modo: 'dia' | 'semana';
  /** Ids dos agendamentos novos pelo link. */
  novos: Set<string>;
  /** Item aberto no painel lateral ("ag:<id>" ou "h:<data>:<hora>"). */
  selecionado?: string | null;
  onItem: (item: ItemLinha) => void;
}

const ESTADO: Record<Status, string> = {
  marcado: 'marcado',
  confirmado: 'confirmado',
  concluido: 'concluído',
  faltou: 'faltou',
  cancelado: 'cancelado',
};
const COM_CHECK = new Set<Status>(['confirmado', 'concluido']);
const RISCADO = new Set<Status>(['faltou', 'cancelado']);

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const somarMin = (hora: string, min: number) => {
  const t = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Linha do tempo de um dia: hora à esquerda, trilho e um ponto por agendamento; livres tracejados. */
export default function LinhaDoTempo({ data, itens, modo, novos, selecionado = null, onItem }: Props) {
  const { config } = useConfig();
  const agora = Date.now();
  const dia = `${abreviaDia(data)} ${ddmm(data)}`;

  function linha(item: ItemLinha) {
    if (item.tipo === 'agendamento') return agendamento(item.agendamento, item.hora);
    const hora = item.tipo === 'livres' ? item.de : item.hora;
    const chave = `h:${data}:${hora}`;
    const atual = selecionado === chave;
    const comum = { type: 'button' as const, 'aria-current': atual || undefined, onClick: () => onItem(item) };

    if (item.tipo === 'fechado')
      return {
        passado: instanteLocal(data, hora, config.fuso).getTime() < agora,
        no: (
          <button {...comum} className={`lt-item lt-fechado${atual ? ' selecionado' : ''}`}>
            <s className="lt-hora">{hora}</s> <s className="lt-texto">fechado</s>
          </button>
        ),
      };

    const grupo = item.tipo === 'livres' && item.de !== item.ate;
    const rotulo = grupo ? `Marcar ${dia} entre ${item.de} e ${item.ate}` : `Marcar ${dia} às ${hora}`;
    return {
      passado: false,
      no: (
        <button {...comum} className={`lt-item lt-livre${atual ? ' selecionado' : ''}`} aria-label={rotulo}>
          <span className="lt-hora">{hora}</span>{' '}
          <span className="lt-texto">
            {grupo ? `livre até ${somarMin(item.ate, config.passo_min)}` : 'livre'} <IconeMais tamanho={14} />
          </span>
        </button>
      ),
    };
  }

  function agendamento(a: AgendamentoCompleto, hora: string) {
    const atual = selecionado === `ag:${a.id}`;
    const digitou = nomeDivergente(a.cliente.nome, a.nome_informado);
    const nome = <span className="lt-nome">{a.cliente.nome}</span>;
    return {
      passado: new Date(a.fim).getTime() <= agora,
      no: (
        <button
          type="button"
          className={`lt-item lt-ag ${a.status}${atual ? ' selecionado' : ''}`}
          aria-current={atual || undefined}
          onClick={() => onItem({ tipo: 'agendamento', hora, agendamento: a })}
        >
          <span className={`lt-ponto ${a.status}`} aria-hidden="true" />
          <span className="lt-hora">{hora}</span>{' '}
          <span className="lt-corpo">
            <span className="lt-cima">
              {RISCADO.has(a.status) ? <s>{nome}</s> : nome}{' '}
              <span className="lt-estado">
                {COM_CHECK.has(a.status) && <span aria-hidden="true">✓ </span>}
                {ESTADO[a.status]}
              </span>
            </span>{' '}
            <span className="lt-sub">
              {a.servico?.nome ?? 'sem serviço'}
              {a.origem === 'link' && ' · pelo link'}
              {digitou && <span className="alerta"> · digitou {digitou}</span>}
            </span>
            {novos.has(a.id) && <span className="so-leitor">, novo, marcado pelo link</span>}
          </span>
        </button>
      ),
    };
  }

  return (
    <ol className={`linha-tempo ${modo}`}>
      {itens.map((item, i) => {
        const { passado, no } = linha(item);
        const chave =
          item.tipo === 'agendamento' ? item.agendamento.id : `${item.tipo}-${item.tipo === 'livres' ? item.de : item.hora}`;
        return (
          <li key={chave} className={passado ? 'passado' : undefined} style={{ '--i': Math.min(i, 8) } as CSSProperties}>
            {no}
          </li>
        );
      })}
    </ol>
  );
}
