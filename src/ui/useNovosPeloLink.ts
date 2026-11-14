import { useCallback, useEffect, useRef, useState } from 'react';
import { listNovosPeloLink } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { gravar, ler } from '../lib/cache';
import { aposVer, ehNovo, type Vistos } from '../lib/novos';
import type { AgendamentoCompleto } from '../types';

/** O mesmo ritmo da semana visível (useAgendaSemana): a cada 30 s com a aba visível. */
const INTERVALO_MS = 30_000;

export interface NovosPeloLink {
  novos: AgendamentoCompleto[];
  /** Ids que chegaram na última busca e não estavam em nenhuma busca anterior desta tela. */
  chegaramAgora: Set<string>;
  /** O dono abriu (ou mudou o status de) este agendamento. */
  ver: (id: string) => void;
  /** "Entendi": todos os novos ficam vistos. */
  verTodos: () => void;
  buscar: () => Promise<void>;
}

interface Estado extends Vistos {
  /** O que a última busca trouxe (desde o corte, sem filtrar). */
  buscados: AgendamentoCompleto[];
  chegaramAgora: Set<string>;
}

/** Lê corte e vistos do aparelho; no primeiro uso o corte é agora (nada antigo aparece como novo). */
function lerVistos(): Vistos {
  let corte = ler<string>('corte-novos')?.valor;
  if (typeof corte !== 'string') {
    corte = new Date().toISOString();
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
  const [estado, setEstado] = useState<Estado>(() => ({ ...lerVistos(), buscados: [], chegaramAgora: new Set() }));
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
      return { ...novoEstado, chegaramAgora: new Set(chegaram) };
    });
  }, [mudar]);

  const marcar = useCallback(
    (escolher: (novos: AgendamentoCompleto[]) => string[]) => {
      const agora = new Date();
      const novos = filtrar(ref.current, agora);
      const ids = escolher(novos).filter((id) => novos.some((a) => a.id === id));
      if (ids.length === 0) return;
      mudar((e) => {
        const s = aposVer(e, ids, novos.filter((a) => !ids.includes(a.id)), e.buscados, agora);
        gravar('corte-novos', s.corte);
        gravar('vistos', s.vistos);
        return { ...e, ...s };
      });
    },
    [mudar],
  );
  const ver = useCallback((id: string) => marcar(() => [id]), [marcar]);
  const verTodos = useCallback(() => marcar((novos) => novos.map((a) => a.id)), [marcar]);

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

  return { novos: filtrar(estado, new Date()), chegaramAgora: estado.chegaramAgora, ver, verTodos, buscar };
}
