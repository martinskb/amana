import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { listServicos } from '../data/servicos';
import { supabase } from '../data/supabase';
import { abreviaDia, dataLocal, freeSlots, horaLocal, somarDias } from '../lib/slots';
import type { AgendamentoCompleto, Servico } from '../types';
import { useConfig } from './contexto';
import DetalhesAgendamento from './DetalhesAgendamento';
import NovoAgendamento from './NovoAgendamento';
import { useAoVoltar } from './useAoVoltar';

type Painel =
  | { tipo: 'novo'; data: string; hora: string }
  | { tipo: 'detalhes'; agendamento: AgendamentoCompleto }
  | { tipo: 'editar'; agendamento: AgendamentoCompleto }
  | null;

type Item =
  | { tipo: 'agendamento'; hora: string; agendamento: AgendamentoCompleto }
  | { tipo: 'livre'; hora: string };

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

export default function Agenda() {
  const { config } = useConfig();
  const hoje = dataLocal(new Date(), config.fuso);
  const [modo, setModo] = useState<'dia' | 'semana'>('dia');
  const [inicio, setInicio] = useState(hoje);
  const [agendamentos, setAgendamentos] = useState<AgendamentoCompleto[] | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState(false);

  const dias = modo === 'dia' ? 1 : 7;
  const ate = somarDias(inicio, dias - 1);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      setAgendamentos(await listAgendamentos(supabase, inicio, ate));
    } catch {
      setErro(true);
    }
  }, [inicio, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    listServicos(supabase).then(setServicos, () => setErro(true));
  }, []);

  // ao reabrir o app: se virou o dia e a tela estava em "hoje", vai para o novo hoje; e recarrega
  const voltas = useAoVoltar();
  const hojeAnterior = useRef(hoje);
  useEffect(() => {
    if (voltas === 0) return;
    const novoHoje = dataLocal(new Date(), config.fuso);
    if (novoHoje !== hojeAnterior.current) {
      const antigo = hojeAnterior.current;
      hojeAnterior.current = novoHoje;
      setInicio((atual) => (atual === antigo ? novoHoje : atual));
    }
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voltas]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (let d = inicio; d <= ate; d = somarDias(d, 1)) mapa.set(d, []);
    if (!agendamentos) return mapa;
    const visiveis = agendamentos.filter((a) => a.status !== 'cancelado');
    for (const a of visiveis) {
      const ini = new Date(a.inicio);
      mapa.get(dataLocal(ini, config.fuso))?.push({ tipo: 'agendamento', hora: horaLocal(ini, config.fuso), agendamento: a });
    }
    const livres = freeSlots({
      config: { ...config, antecedencia_min: 0 },
      agendamentos: visiveis,
      ajustes: [],
      de: inicio,
      ate,
      agora: new Date(),
    });
    for (const s of livres) mapa.get(s.data)?.push({ tipo: 'livre', hora: s.hora });
    for (const itens of mapa.values()) itens.sort((x, y) => x.hora.localeCompare(y.hora));
    return mapa;
  }, [agendamentos, config, inicio, ate]);

  function depoisDeSalvar() {
    setPainel(null);
    void carregar();
  }

  if (painel?.tipo === 'novo' || painel?.tipo === 'editar')
    return (
      <NovoAgendamento
        inicial={painel.tipo === 'novo' ? { data: painel.data, hora: painel.hora } : undefined}
        agendamento={painel.tipo === 'editar' ? painel.agendamento : undefined}
        servicos={servicos}
        onSalvo={depoisDeSalvar}
        onFechar={() => setPainel(null)}
      />
    );

  if (painel?.tipo === 'detalhes')
    return (
      <DetalhesAgendamento
        agendamento={painel.agendamento}
        onEditar={() => setPainel({ tipo: 'editar', agendamento: painel.agendamento })}
        onMudou={depoisDeSalvar}
        onFechar={() => setPainel(null)}
      />
    );

  return (
    <main className="agenda">
      <h2>Agenda</h2>
      <div className="linha controles">
        <div role="group" aria-label="Visão" className="segmentado">
          <button type="button" aria-pressed={modo === 'dia'} onClick={() => setModo('dia')}>
            Dia
          </button>
          <button type="button" aria-pressed={modo === 'semana'} onClick={() => setModo('semana')}>
            Semana
          </button>
        </div>
        <button type="button" aria-label="Anterior" onClick={() => setInicio(somarDias(inicio, -dias))}>
          ‹
        </button>
        <button type="button" onClick={() => setInicio(hoje)}>
          Hoje
        </button>
        <button type="button" aria-label="Próximo" onClick={() => setInicio(somarDias(inicio, dias))}>
          ›
        </button>
        <button
          type="button"
          className="primario"
          onClick={() => setPainel({ tipo: 'novo', data: inicio, hora: '' })}
        >
          + Novo
        </button>
      </div>

      {erro && (
        <p role="alert">
          Não foi possível carregar a agenda.{' '}
          <button type="button" onClick={carregar}>
            Tentar de novo
          </button>
        </p>
      )}
      {!agendamentos && !erro && <p className="carregando">Carregando…</p>}

      {agendamentos &&
        [...porDia].map(([data, itens]) => (
          <section key={data} className="dia">
            <h3>
              {abreviaDia(data)} {ddmm(data)}
            </h3>
            {itens.length === 0 && <p className="sutil">Sem horários.</p>}
            <ul className="grade">
              {itens.map((item) =>
                item.tipo === 'agendamento' ? (
                  <li key={item.agendamento.id}>
                    <button
                      type="button"
                      className={`ag ${item.agendamento.status}`}
                      onClick={() => setPainel({ tipo: 'detalhes', agendamento: item.agendamento })}
                    >
                      {item.hora} {item.agendamento.cliente.nome} · {item.agendamento.servico?.nome ?? '—'}
                    </button>
                  </li>
                ) : (
                  <li key={`livre-${item.hora}`}>
                    <button
                      type="button"
                      className="livre"
                      aria-label={`Marcar ${abreviaDia(data)} ${ddmm(data)} às ${item.hora}`}
                      onClick={() => setPainel({ tipo: 'novo', data, hora: item.hora })}
                    >
                      {item.hora} livre
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
    </main>
  );
}
