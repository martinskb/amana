import { useCallback, useEffect, useRef, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { listAjustes } from '../data/ajustes';
import { supabase } from '../data/supabase';
import { gravar, ler, podarAgenda } from '../lib/cache';
import { segundaDe } from '../lib/semanaCalendario';
import { dataLocal, somarDias } from '../lib/slots';
import type { AgendamentoCompleto, HorarioAjuste } from '../types';

/** De quanto em quanto tempo a semana visível é buscada de novo (só com a aba visível). */
const INTERVALO_MS = 30_000;
/** Cache mais velho que isso mostra "atualizando…" enquanto a busca roda. */
const CACHE_VELHO_MS = 60_000;
/** Busca pendente por mais que isso, com dados guardados na tela, conta como sem conexão. */
const LIMITE_BUSCA_MS = 10_000;

interface Semana {
  agendamentos: AgendamentoCompleto[];
  ajustes: HorarioAjuste[];
}

interface Estado {
  segunda: string;
  agendamentos: AgendamentoCompleto[] | null;
  ajustes: HorarioAjuste[];
  /** Quando os dados na tela foram obtidos (do cache ou da última busca). */
  salvoEm: string | null;
  atualizando: boolean;
  semConexao: boolean;
  /** A busca falhou e não há nada guardado para mostrar. */
  erro: boolean;
}

export interface AgendaSemana {
  agendamentos: AgendamentoCompleto[] | null;
  ajustes: HorarioAjuste[];
  atualizando: boolean;
  salvoEm: string | null;
  semConexao: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

const chave = (segunda: string) => `agenda:${segunda}`;

function doCache(segunda: string): Estado {
  const lido = ler<Semana>(chave(segunda));
  const ok = lido !== null && Array.isArray(lido.valor?.agendamentos) && Array.isArray(lido.valor?.ajustes);
  return {
    segunda,
    agendamentos: ok ? lido.valor.agendamentos : null,
    ajustes: ok ? lido.valor.ajustes : [],
    salvoEm: ok ? lido.em : null,
    atualizando: false,
    semConexao: false,
    erro: false,
  };
}

/**
 * Agendamentos de um dia (YYYY-MM-DD) tirados da semana guardada no aparelho, para quando a busca
 * falha sem conexão; null se a semana desse dia não está guardada.
 */
export function agendamentosGuardadosDoDia(dia: string, fuso: string): AgendamentoCompleto[] | null {
  const guardados = doCache(segundaDe(dia)).agendamentos;
  return guardados && guardados.filter((a) => dataLocal(new Date(a.inicio), fuso) === dia);
}

/**
 * Agendamentos e ajustes da semana do calendário (seg–dom) que começa em `segunda`.
 * Mostra o guardado no aparelho na hora e busca por baixo; repete a busca a cada 30 s
 * com a aba visível e na hora em que a aba volta.
 */
export function useAgendaSemana(segunda: string): AgendaSemana {
  const [estado, setEstado] = useState(() => doCache(segunda));
  // trocou de semana: mostra o cache da semana nova já neste render
  let atual = estado;
  if (estado.segunda !== segunda) {
    atual = doCache(segunda);
    setEstado(atual);
  }

  // só a resposta da busca mais recente vale (troca de semana ou buscas sobrepostas)
  const pedido = useRef(0);

  const recarregar = useCallback(async () => {
    const id = ++pedido.current;
    const daSemana = (f: (e: Estado) => Estado) => setEstado((e) => (e.segunda === segunda ? f(e) : e));
    daSemana((e) => ({
      ...e,
      erro: false,
      atualizando: e.salvoEm !== null && Date.now() - new Date(e.salvoEm).getTime() > CACHE_VELHO_MS,
    }));
    const demorou = setTimeout(() => {
      if (pedido.current === id) daSemana((e) => (e.agendamentos ? { ...e, semConexao: true } : e));
    }, LIMITE_BUSCA_MS);
    try {
      const ate = somarDias(segunda, 6);
      const [agendamentos, ajustes] = await Promise.all([
        listAgendamentos(supabase, segunda, ate),
        listAjustes(supabase, segunda, ate),
      ]);
      if (pedido.current !== id) return;
      gravar<Semana>(chave(segunda), { agendamentos, ajustes });
      podarAgenda();
      daSemana(() => ({
        segunda,
        agendamentos,
        ajustes,
        salvoEm: new Date().toISOString(),
        atualizando: false,
        semConexao: false,
        erro: false,
      }));
    } catch {
      if (pedido.current !== id) return;
      // qualquer falha: com dados na tela, avisa e mantém; sem dados, é erro
      daSemana((e) => ({ ...e, atualizando: false, semConexao: e.agendamentos !== null, erro: e.agendamentos === null }));
    } finally {
      clearTimeout(demorou);
    }
  }, [segunda]);

  useEffect(() => {
    void recarregar();
    const seVisivel = () => {
      if (document.visibilityState === 'visible') void recarregar();
    };
    const intervalo = setInterval(seVisivel, INTERVALO_MS);
    document.addEventListener('visibilitychange', seVisivel);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', seVisivel);
      pedido.current++; // respostas pendentes desta semana são descartadas
    };
  }, [recarregar]);

  return {
    agendamentos: atual.agendamentos,
    ajustes: atual.ajustes,
    atualizando: atual.atualizando,
    salvoEm: atual.salvoEm,
    semConexao: atual.semConexao,
    erro: atual.erro,
    recarregar,
  };
}
