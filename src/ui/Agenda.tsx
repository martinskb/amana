import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listAgendamentos, listNovosPeloLink } from '../data/agendamentos';
import { criarExtra, fecharHorario, listAjustes, removerAjuste } from '../data/ajustes';
import { listServicos } from '../data/servicos';
import { supabase } from '../data/supabase';
import { abreviaDia, dataLocal, freeSlots, gerarHorarios, horaLocal, instanteLocal, somarDias } from '../lib/slots';
import type { AgendamentoCompleto, HorarioAjuste, Servico } from '../types';
import { useConfig } from './contexto';
import DetalhesAgendamento from './DetalhesAgendamento';
import NovoAgendamento from './NovoAgendamento';
import { useAoVoltar } from './useAoVoltar';

type Painel =
  | { tipo: 'novo'; data: string; hora: string }
  | { tipo: 'detalhes'; agendamento: AgendamentoCompleto }
  | { tipo: 'editar'; agendamento: AgendamentoCompleto }
  | { tipo: 'livre'; data: string; hora: string }
  | { tipo: 'fechado'; data: string; hora: string; ajusteId: string }
  | { tipo: 'extra' }
  | null;

type Item =
  | { tipo: 'agendamento'; hora: string; agendamento: AgendamentoCompleto }
  | { tipo: 'livre'; hora: string }
  | { tipo: 'fechado'; hora: string; ajusteId: string };

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const CHAVE_VISITA = 'agenda:ultimaVisita';

export default function Agenda() {
  const { config } = useConfig();
  const hoje = dataLocal(new Date(), config.fuso);
  const [modo, setModo] = useState<'dia' | 'semana'>('dia');
  const [inicio, setInicio] = useState(hoje);
  const [agendamentos, setAgendamentos] = useState<AgendamentoCompleto[] | null>(null);
  const [ajustes, setAjustes] = useState<HorarioAjuste[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState(false);

  const [novos, setNovos] = useState<AgendamentoCompleto[]>([]);

  // agendamentos que chegaram pelo link desde a última vez que o dono olhou (neste aparelho)
  const buscarNovos = useCallback(() => {
    let ultima: string | null = null;
    try {
      ultima = localStorage.getItem(CHAVE_VISITA);
      if (!ultima) localStorage.setItem(CHAVE_VISITA, new Date().toISOString());
    } catch {
      return; // sem armazenamento (navegação privada): sem aviso
    }
    if (!ultima) return;
    listNovosPeloLink(supabase, ultima).then(setNovos, () => setNovos([]));
  }, []);

  useEffect(() => {
    buscarNovos();
  }, [buscarNovos]);

  function marcarVisto() {
    // o criado_em mais recente mostrado (relógio do servidor): o que chegar depois ainda aparece
    const maisRecente = novos.reduce(
      (max, a) => (new Date(a.criado_em).getTime() > new Date(max).getTime() ? a.criado_em : max),
      novos[0]?.criado_em ?? new Date().toISOString(),
    );
    try {
      localStorage.setItem(CHAVE_VISITA, maisRecente);
    } catch {
      /* sem armazenamento: só esconde */
    }
    setNovos([]);
  }

  const dias = modo === 'dia' ? 1 : 7;
  const ate = somarDias(inicio, dias - 1);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const [ags, ajs] = await Promise.all([listAgendamentos(supabase, inicio, ate), listAjustes(supabase, inicio, ate)]);
      setAjustes(ajs);
      setAgendamentos(ags);
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
    buscarNovos();
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
      ajustes,
      de: inicio,
      ate,
      agora: new Date(),
    });
    for (const s of livres) mapa.get(s.data)?.push({ tipo: 'livre', hora: s.hora });
    const passo = config.passo_min * 60_000;
    const fechados = ajustes.filter((a) => a.tipo === 'fechado');
    for (const h of gerarHorarios({ config, ajustes, de: inicio, ate })) {
      if (!h.fechado) continue;
      const ini = h.inicio.getTime();
      const ajuste = fechados.find((f) => {
        const fi = new Date(f.inicio).getTime();
        return ini < fi + passo && fi < ini + passo;
      });
      if (ajuste) mapa.get(h.data)?.push({ tipo: 'fechado', hora: h.hora, ajusteId: ajuste.id });
    }
    for (const itens of mapa.values()) itens.sort((x, y) => x.hora.localeCompare(y.hora));
    return mapa;
  }, [agendamentos, ajustes, config, inicio, ate]);

  const [erroAjuste, setErroAjuste] = useState<string | null>(null);
  const [extraData, setExtraData] = useState(hoje);
  const [extraHora, setExtraHora] = useState('');

  async function ajustar(acao: () => Promise<void>) {
    setErroAjuste(null);
    try {
      await acao();
      depoisDeSalvar();
    } catch {
      setErroAjuste('Não foi possível salvar. Confira a internet e tente de novo.');
    }
  }

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

  if (painel?.tipo === 'livre')
    return (
      <section role="dialog" aria-label="Horário livre" className="painel">
        <h3>
          {abreviaDia(painel.data)} {ddmm(painel.data)} às {painel.hora}
        </h3>
        <div className="linha">
          <button type="button" className="primario" onClick={() => setPainel({ tipo: 'novo', data: painel.data, hora: painel.hora })}>
            Marcar cliente
          </button>
          <button
            type="button"
            onClick={() => ajustar(() => fecharHorario(supabase, instanteLocal(painel.data, painel.hora, config.fuso).toISOString()))}
          >
            Fechar este horário
          </button>
          <button type="button" onClick={() => setPainel(null)}>
            Voltar
          </button>
        </div>
        {erroAjuste && <p role="alert">{erroAjuste}</p>}
      </section>
    );

  if (painel?.tipo === 'fechado')
    return (
      <section role="dialog" aria-label="Horário fechado" className="painel">
        <h3>
          {abreviaDia(painel.data)} {ddmm(painel.data)} às {painel.hora} — fechado
        </h3>
        <p className="sutil">Este horário não aparece no link de agendamento.</p>
        <div className="linha">
          <button type="button" className="primario" onClick={() => ajustar(() => removerAjuste(supabase, painel.ajusteId))}>
            Reabrir
          </button>
          <button type="button" onClick={() => setPainel(null)}>
            Voltar
          </button>
        </div>
        {erroAjuste && <p role="alert">{erroAjuste}</p>}
      </section>
    );

  if (painel?.tipo === 'extra')
    return (
      <section role="dialog" aria-label="Horário extra" className="painel">
        <h3>Abrir horário extra</h3>
        <p className="sutil">Um horário fora do expediente, que aparece no link.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!extraData || !extraHora) return setErroAjuste('Escolha a data e a hora.');
            void ajustar(() => criarExtra(supabase, instanteLocal(extraData, extraHora, config.fuso).toISOString()));
          }}
        >
          <div className="linha">
            <label>
              Data
              <input type="date" value={extraData} onChange={(e) => setExtraData(e.target.value)} />
            </label>
            <label>
              Hora
              <input type="time" step={300} value={extraHora} onChange={(e) => setExtraHora(e.target.value)} />
            </label>
          </div>
          <div className="linha">
            <button type="submit" className="primario">
              Abrir horário
            </button>
            <button type="button" onClick={() => setPainel(null)}>
              Voltar
            </button>
          </div>
        </form>
        {erroAjuste && <p role="alert">{erroAjuste}</p>}
      </section>
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
        <button type="button" onClick={() => setPainel({ tipo: 'extra' })}>
          + Horário extra
        </button>
      </div>

      {novos.length > 0 && (
        <aside className="aviso-novos" role="status">
          <strong>
            {novos.length === 1 ? '1 agendamento novo pelo link' : `${novos.length} agendamentos novos pelo link`}
          </strong>
          <ul>
            {novos.map((a) => {
              const ini = new Date(a.inicio);
              const d = dataLocal(ini, config.fuso);
              return (
                <li key={a.id}>
                  {abreviaDia(d)} {ddmm(d)} {horaLocal(ini, config.fuso)} · {a.cliente.nome}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={marcarVisto}>
            Entendi
          </button>
        </aside>
      )}

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
                      {item.agendamento.origem === 'link' && <span className="etiqueta"> pelo link</span>}
                    </button>
                  </li>
                ) : item.tipo === 'fechado' ? (
                  <li key={`fechado-${item.hora}`}>
                    <button
                      type="button"
                      className="fechado"
                      onClick={() => setPainel({ tipo: 'fechado', data, hora: item.hora, ajusteId: item.ajusteId })}
                    >
                      {item.hora} fechado
                    </button>
                  </li>
                ) : (
                  <li key={`livre-${item.hora}`}>
                    <button
                      type="button"
                      className="livre"
                      aria-label={`Marcar ${abreviaDia(data)} ${ddmm(data)} às ${item.hora}`}
                      onClick={() => setPainel({ tipo: 'livre', data, hora: item.hora })}
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
