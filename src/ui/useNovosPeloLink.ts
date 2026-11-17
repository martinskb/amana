import { useCallback, useEffect, useRef, useState } from 'react';
import { listNovosPeloLink } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { gravar, ler, tirarChaveAntiga } from '../lib/cache';
import { aposVer, ehNovo, type Vistos } from '../lib/novos';
import type { AgendamentoCompleto } from '../types';

/** O mesmo ritmo da semana visível (useAgendaSemana): a cada 30 s com a aba visível. */
const INTERVALO_MS = 30_000;
/** Sempre o mesmo Set quando nada chegou: quem depende de `chegaramAgora` não roda a cada busca. */
const NADA: ReadonlySet<string> = new Set();

export interface NovosPeloLink {
  novos: AgendamentoCompleto[];
  /** Ids que chegaram na última busca e não estavam em nenhuma busca anterior desta tela. */
  chegaramAgora: ReadonlySet<string>;
  /** O dono abriu (ou mudou o status de) este agendamento; vale mesmo antes da busca de novos o trazer. */
  ver: (a: AgendamentoCompleto) => void;
  /** "Entendi": todos os novos ficam vistos. */
  verTodos: () => void;
  /** Marca só estes como vistos (o "Entendi" com o filtro de uma pessoa). */
  verEstes: (lista: AgendamentoCompleto[]) => void;
  buscar: () => Promise<void>;
}

interface Estado extends Vistos {
  /** O que a última busca trouxe (desde o corte, sem filtrar). */
  buscados: AgendamentoCompleto[];
  chegaramAgora: ReadonlySet<string>;
}

const ehData = (s: unknown): s is string => typeof s === 'string' && !isNaN(Date.parse(s));

/**
 * Lê corte e vistos do aparelho. No primeiro uso o corte é a última visita da versão anterior
 * (chave antiga "agenda:ultimaVisita"), se houver; senão é agora (nada antigo aparece como novo).
 */
function lerVistos(): Vistos {
  let corte = ler<string>('corte-novos')?.valor;
  if (!ehData(corte)) {
    const antiga = tirarChaveAntiga('agenda:ultimaVisita');
    corte = ehData(antiga) ? antiga : new Date().toISOString();
    gravar('corte-novos', corte);
  }
  const vistos = ler<string[]>('vistos')?.valor;
  return { corte, vistos: Array.isArray(vistos) ? vistos.filter((v) => typeof v === 'string') : [] };
}

const filtrar = (e: Estado, agora: Date) => e.buscados.filter((a) => ehNovo(a, { ...e, agora }));

/**
 * Agendamentos novos pelo link, vistos por agendamento. Busca ao montar, a cada 30 s com a
 * aba visível e na hora em que a aba volta; a Agenda também chama `buscar` depois de gravar.
 */
export function useNovosPeloLink(): NovosPeloLink {
  const [estado, setEstado] = useState<Estado>(() => ({ ...lerVistos(), buscados: [], chegaramAgora: NADA }));
  // espelho do estado para as funções estáveis (buscar roda num intervalo)
  const ref = useRef(estado);
  const mudar = useCallback((f: (e: Estado) => Estado) => {
    ref.current = f(ref.current);
    setEstado(ref.current);
  }, []);
  // ids já trazidos por alguma busca desta tela; null até a primeira (que não anima)
  const jaBuscados = useRef<Set<string> | null>(null);
  const pedido = useRef(0);

  const buscar = useCallback(async () => {
    const id = ++pedido.current;
    let lista: AgendamentoCompleto[];
    try {
      lista = await listNovosPeloLink(supabase, ref.current.corte);
    } catch {
      return; // sem conexão: fica o que estava
    }
    if (pedido.current !== id) return;
    const anteriores = jaBuscados.current;
    jaBuscados.current = new Set([...(anteriores ?? []), ...lista.map((a) => a.id)]);
    mudar((e) => {
      const novoEstado = { ...e, buscados: lista };
      const chegaram = anteriores
        ? filtrar(novoEstado, new Date()).filter((a) => !anteriores.has(a.id)).map((a) => a.id)
        : [];
      return { ...novoEstado, chegaramAgora: chegaram.length ? new Set(chegaram) : NADA };
    });
  }, [mudar]);

  const marcar = useCallback(
    (escolher: (novos: AgendamentoCompleto[]) => AgendamentoCompleto[]) => {
      const agora = new Date();
      const novos = filtrar(ref.current, agora);
      // vale se está entre os novos, ou se o próprio agendamento é novo (a busca de novos pode estar atrasada)
      const vistosAgora = escolher(novos)
        .map((a) => novos.find((n) => n.id === a.id) ?? a)
        .filter((a) => ehNovo(a, { ...ref.current, agora }));
      if (vistosAgora.length === 0) return;
      const ids = new Set(vistosAgora.map((a) => a.id));
      mudar((e) => {
        const s = aposVer(e, vistosAgora, novos.filter((a) => !ids.has(a.id)), e.buscados, agora);
        gravar('corte-novos', s.corte);
        gravar('vistos', s.vistos);
        return { ...e, ...s };
      });
    },
    [mudar],
  );
  const ver = useCallback((a: AgendamentoCompleto) => marcar(() => [a]), [marcar]);
  const verTodos = useCallback(() => marcar((novos) => novos), [marcar]);
  const verEstes = useCallback((lista: AgendamentoCompleto[]) => marcar(() => lista), [marcar]);

  useEffect(() => {
    void buscar();
    const seVisivel = () => {
      if (document.visibilityState === 'visible') void buscar();
    };
    const intervalo = setInterval(seVisivel, INTERVALO_MS);
    document.addEventListener('visibilitychange', seVisivel);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', seVisivel);
      pedido.current++; // resposta pendente é descartada
    };
  }, [buscar]);

  return { novos: filtrar(estado, new Date()), chegaramAgora: estado.chegaramAgora, ver, verTodos, verEstes, buscar };
}
