import type { CSSProperties, ReactNode } from 'react';
import { nomeDivergente } from '../lib/nomes';
import { abreviaDia, dataLocal, horaLocal, instanteLocal } from '../lib/slots';
import type { AgendamentoCompleto, Status } from '../types';
import { usePrefereMenosMovimento } from './animacao';
import { Circulado, NotaMao } from './Caneta';
import { useConfig } from './contexto';
import LinhaAgora, { noExpediente, posicaoDoAgora, useAgora } from './LinhaAgora';
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
  /** Ids que chegaram com a tela aberta: entram deslizando e a caneta desenha o circulado. */
  chegaram?: ReadonlySet<string>;
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

const horaDoItem = (item: ItemLinha) => (item.tipo === 'livres' ? item.de : item.hora);
const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const somarMin = (hora: string, min: number) => {
  const t = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Linha do tempo de um dia: hora à esquerda, trilho e um ponto por agendamento; livres tracejados. */
export default function LinhaDoTempo({ data, itens, modo, novos, chegaram, selecionado = null, onItem }: Props) {
  const { config } = useConfig();
  const menos = usePrefereMenosMovimento();
  const ehHoje = dataLocal(new Date(), config.fuso) === data;
  const instante = useAgora(ehHoje);
  const agora = Date.now();
  // a linha do agora: só hoje, dentro do expediente, antes do primeiro item que ainda não começou
  const horaAgora = horaLocal(instante, config.fuso);
  const posAgora = ehHoje && noExpediente(config, data, horaAgora) ? posicaoDoAgora(itens.map(horaDoItem), horaAgora) : -1;
  const dia = `${abreviaDia(data)} ${ddmm(data)}`;

  function linha(item: ItemLinha): { passado: boolean; no: ReactNode; chegou?: boolean } {
    if (item.tipo === 'agendamento') return agendamento(item.agendamento, item.hora);
    const hora = horaDoItem(item);
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

  function agendamento(a: AgendamentoCompleto, hora: string): { passado: boolean; no: ReactNode; chegou: boolean } {
    const atual = selecionado === `ag:${a.id}`;
    const digitou = nomeDivergente(a.cliente.nome, a.nome_informado);
    const nome = <span className="lt-nome">{a.cliente.nome}</span>;
    const novo = novos.has(a.id);
    const desenhar = chegaram?.has(a.id) ?? false;
    return {
      passado: new Date(a.fim).getTime() <= agora,
      chegou: desenhar && !menos,
      no: (
        <button
          type="button"
          className={`lt-item lt-ag ${a.status}${atual ? ' selecionado' : ''}`}
          aria-current={atual || undefined}
          onClick={() => onItem({ tipo: 'agendamento', hora, agendamento: a })}
        >
          <span className={`lt-ponto ${a.status}`} aria-hidden="true" />
          <span className="lt-hora">{hora}</span>{' '}
          <span className={`lt-corpo${novo ? ' com-caneta' : ''}`}>
            {/* o circulado e a nota acompanham o tamanho do nome e da linha de baixo */}
            <span className="lt-circulavel">
              {novo && <Circulado desenhar={desenhar} />}
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
              {novo && <NotaMao atraso={desenhar ? 700 : undefined}>marcou sozinho!</NotaMao>}
            </span>
            {novo && <span className="so-leitor">, novo, marcado pelo link</span>}
          </span>
        </button>
      ),
    };
  }

  const linhas = itens.map((item, i) => {
    const { passado, no, chegou } = linha(item);
    const chave = item.tipo === 'agendamento' ? item.agendamento.id : `${item.tipo}-${horaDoItem(item)}`;
    const classe = [passado && 'passado', chegou && 'chegou'].filter(Boolean).join(' ');
    // a cascata para no 8º item: os seguintes entram juntos
    return (
      <li key={chave} className={classe || undefined} style={{ '--i': Math.min(i, 8) } as CSSProperties}>
        {no}
      </li>
    );
  });
  if (posAgora >= 0) linhas.splice(posAgora, 0, <LinhaAgora key="agora" agora={instante} fuso={config.fuso} />);

  return <ol className={`linha-tempo ${modo}`}>{linhas}</ol>;
}
