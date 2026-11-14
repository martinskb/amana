import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { criarExtra, fecharHorario, removerAjuste } from '../data/ajustes';
import { listServicos } from '../data/servicos';
import { supabase } from '../data/supabase';
import { abreviaDia, dataLocal, freeSlots, gerarHorarios, horaLocal, instanteLocal, somarDias } from '../lib/slots';
import type { AgendamentoCompleto, Servico } from '../types';
import { useConfig } from './contexto';
import BackupBanner from './BackupBanner';
import CabecalhoAgenda from './CabecalhoAgenda';
import CartaoAmanha from './CartaoAmanha';
import DetalhesAgendamento from './DetalhesAgendamento';
import NovoAgendamento from './NovoAgendamento';
import Painel from './Painel';
import ResumoLateral from './ResumoLateral';
import { useTelaLarga } from './animacao';
import Esqueleto from './Esqueleto';
import { agruparLivres, type Item } from './semana';
import { nomeDivergente } from '../lib/nomes';
import SeloStatus from './SeloStatus';
import { IconeDireita, IconeEsquerda, IconeMais } from './icones';
import { useAoVoltar } from './useAoVoltar';
import { useAgendaSemana } from './useAgendaSemana';
import { useNovosPeloLink } from './useNovosPeloLink';
import FaixaSemConexao from './FaixaSemConexao';
import { diasDaSemana, segundaDe } from '../lib/semanaCalendario';

type EstadoPainel =
  | { tipo: 'novo'; data: string; hora: string }
  | { tipo: 'detalhes'; agendamento: AgendamentoCompleto }
  | { tipo: 'editar'; agendamento: AgendamentoCompleto }
  // extraId: o horário só existe por causa de um extra (fora do expediente) e pode ser removido
  | { tipo: 'livre'; data: string; hora: string; extraId?: string }
  | { tipo: 'fechado'; data: string; hora: string; ajusteId: string }
  | { tipo: 'extra' }
  | null;


/** Identifica o item da grade aberto no painel (para destacar na tela larga). */
function chaveDoPainel(p: Exclude<EstadoPainel, null>): string | null {
  if (p.tipo === 'detalhes' || p.tipo === 'editar') return `ag:${p.agendamento.id}`;
  if (p.tipo === 'livre' || p.tipo === 'fechado') return `h:${p.data}:${p.hora}`;
  return null;
}

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

export default function Agenda() {
  const { config, recarregar: recarregarConfig, semConexao: configSemConexao } = useConfig();
  const hoje = dataLocal(new Date(), config.fuso);
  const [modo, setModo] = useState<'dia' | 'semana'>('dia');
  const [diaSelecionado, setDiaSelecionado] = useState(hoje);
  // a semana do calendário (seg–dom) do dia escolhido; o hook sempre busca a semana inteira
  const segunda = segundaDe(diaSelecionado);
  const {
    agendamentos,
    ajustes,
    atualizando,
    salvoEm,
    semConexao,
    erro: erroAgenda,
    recarregar: carregar,
  } = useAgendaSemana(segunda);
  // para onde a grade desliza ao trocar de dia/semana (null: sem deslize)
  const [direcao, setDirecao] = useState<'esq' | 'dir' | null>(null);
  // a cascata dos horários só acontece na primeira vez que a grade aparece
  const primeiraCarga = useRef(true);
  useEffect(() => {
    if (agendamentos) primeiraCarga.current = false;
  }, [agendamentos]);
  // semana: anda uma semana do calendário, de segunda a segunda; dia: anda um dia (trocando de semana se precisar)
  function andar(passo: -1 | 1) {
    setDirecao(passo < 0 ? 'esq' : 'dir');
    setDiaSelecionado((d) => (modo === 'semana' ? somarDias(segundaDe(d), passo * 7) : somarDias(d, passo)));
  }
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [painel, setPainel] = useState<EstadoPainel>(null);
  const [erroServicos, setErroServicos] = useState(false);
  const erro = erroAgenda || erroServicos;

  const larga = useTelaLarga();
  // muda quando a agenda grava algo: o resumo lateral recarrega o próximo cliente
  const [versao, setVersao] = useState(0);
  // o resto da tela fica inerte só quando o painel é uma janela por cima (celular e telas médias)
  const modal = painel !== null && !larga;
  // na tela larga, o item aberto no painel lateral fica destacado na grade
  const atual = (chave: string) => larga && painel !== null && chaveDoPainel(painel) === chave;
  const sel = (chave: string) => (atual(chave) ? ' selecionado' : '');

  // agendamentos novos pelo link, vistos por agendamento (busca a cada 30 s e ao voltar, como a semana)
  const { novos, ver, verTodos, buscar: buscarNovos } = useNovosPeloLink();

  const ate = somarDias(segunda, 6);

  const carregarServicos = useCallback(() => {
    setErroServicos(false);
    listServicos(supabase).then(setServicos, () => setErroServicos(true));
  }, []);

  useEffect(() => {
    carregarServicos();
  }, [carregarServicos]);

  // ao reabrir o app: se virou o dia e a tela estava em "hoje", vai para o novo hoje (talvez numa semana nova).
  // A agenda em si e os novos pelo link são buscados de novo pelos seus hooks.
  const voltas = useAoVoltar();
  const hojeAnterior = useRef(hoje);
  useEffect(() => {
    if (voltas === 0) return;
    const novoHoje = dataLocal(new Date(), config.fuso);
    if (novoHoje !== hojeAnterior.current) {
      const antigo = hojeAnterior.current;
      hojeAnterior.current = novoHoje;
      setDiaSelecionado((atual) => (atual === antigo ? novoHoje : atual));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voltas]);

  // a semana inteira (seg–dom); o modo dia mostra só o dia escolhido
  const porDia = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (const d of diasDaSemana(segunda)) mapa.set(d, []);
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
      de: segunda,
      ate,
      agora: new Date(),
    });
    for (const s of livres) mapa.get(s.data)?.push({ tipo: 'livre', hora: s.hora });
    const passo = config.passo_min * 60_000;
    const fechados = ajustes.filter((a) => a.tipo === 'fechado');
    for (const h of gerarHorarios({ config, ajustes, de: segunda, ate })) {
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
  }, [agendamentos, ajustes, config, segunda, ate]);
  const diasVisiveis = modo === 'dia' ? [[diaSelecionado, porDia.get(diaSelecionado) ?? []] as const] : [...porDia];

  /** O extra que sozinho cria este horário (fora do expediente); undefined se o horário é do expediente. */
  function extraQueCria(data: string, hora: string): string | undefined {
    const ini = instanteLocal(data, hora, config.fuso).getTime();
    const extra = ajustes.find((a) => a.tipo === 'extra' && new Date(a.inicio).getTime() === ini);
    if (!extra) return undefined;
    const doExpediente = gerarHorarios({ config, ajustes: [], de: data, ate: data }).some((h) => h.inicio.getTime() === ini);
    return doExpediente ? undefined : extra.id;
  }

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
    setVersao((v) => v + 1);
    setPainel(null);
    void carregar();
    void buscarNovos();
  }

  // durante a animação de saída o painel já é null: continua mostrando o último conteúdo
  const ultimoPainel = useRef<Exclude<EstadoPainel, null> | null>(null);
  if (painel) ultimoPainel.current = painel;
  const ROTULOS: Record<Exclude<EstadoPainel, null>['tipo'], string> = {
    novo: 'Novo agendamento',
    editar: 'Editar agendamento',
    detalhes: 'Agendamento',
    livre: 'Horário livre',
    fechado: 'Horário fechado',
    extra: 'Horário extra',
  };

  /** Conteúdo do painel aberto (o Painel em volta é o diálogo). */
  function conteudoPainel(p: Exclude<EstadoPainel, null>) {
    if (p.tipo === 'novo' || p.tipo === 'editar')
      return (
        <NovoAgendamento
          inicial={p.tipo === 'novo' ? { data: p.data, hora: p.hora } : undefined}
          agendamento={p.tipo === 'editar' ? p.agendamento : undefined}
          servicos={servicos}
          onSalvo={depoisDeSalvar}
          onFechar={() => setPainel(null)}
        />
      );

    if (p.tipo === 'livre')
      return (
        <>
          <h3>
            {abreviaDia(p.data)} {ddmm(p.data)} às {p.hora}
          </h3>
          <div className="linha">
            <button type="button" className="primario" onClick={() => setPainel({ tipo: 'novo', data: p.data, hora: p.hora })}>
              Marcar cliente
            </button>
            {p.extraId ? (
              <button type="button" onClick={() => ajustar(() => removerAjuste(supabase, p.extraId!))}>
                Remover horário extra
              </button>
            ) : (
              <button
                type="button"
                onClick={() => ajustar(() => fecharHorario(supabase, instanteLocal(p.data, p.hora, config.fuso).toISOString()))}
              >
                Fechar este horário
              </button>
            )}
            <button type="button" onClick={() => setPainel(null)}>
              Voltar
            </button>
          </div>
          {erroAjuste && <p role="alert">{erroAjuste}</p>}
        </>
      );

    if (p.tipo === 'fechado')
      return (
        <>
          <h3>
            {abreviaDia(p.data)} {ddmm(p.data)} às {p.hora} — fechado
          </h3>
          <p className="sutil">Este horário não aparece no link de agendamento.</p>
          <div className="linha">
            <button type="button" className="primario" onClick={() => ajustar(() => removerAjuste(supabase, p.ajusteId))}>
              Reabrir
            </button>
            <button type="button" onClick={() => setPainel(null)}>
              Voltar
            </button>
          </div>
          {erroAjuste && <p role="alert">{erroAjuste}</p>}
        </>
      );

    if (p.tipo === 'extra')
      return (
        <>
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
        </>
      );

    if (p.tipo === 'detalhes')
      return (
        <DetalhesAgendamento
          agendamento={p.agendamento}
          onEditar={() => setPainel({ tipo: 'editar', agendamento: p.agendamento })}
          onMudou={() => {
            ver(p.agendamento.id);
            depoisDeSalvar();
          }}
          onFechar={() => setPainel(null)}
        />
      );

    return null;
  }

  const avisoNovos =
    novos.length > 0 ? (
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
          <button type="button" onClick={verTodos}>
            Entendi
          </button>
        </aside>
    ) : null;

  return (
    <main className="agenda">
      <div className="agenda-fundo" inert={modal} aria-hidden={modal || undefined}>
        <CabecalhoAgenda />
        <BackupBanner />
        <div className="linha controles">
          <div role="group" aria-label="Visão" className="segmentado">
            <button type="button" aria-pressed={modo === 'dia'} onClick={() => { setDirecao(null); setModo('dia'); }}>
              Dia
            </button>
            <button type="button" aria-pressed={modo === 'semana'} onClick={() => { setDirecao(null); setModo('semana'); }}>
              Semana
            </button>
          </div>
          <button type="button" className="red" aria-label="Anterior" onClick={() => andar(-1)}>
            <IconeEsquerda />
          </button>
          <button
            type="button"
            onClick={() => {
              setDirecao(hoje < diaSelecionado ? 'esq' : hoje > diaSelecionado ? 'dir' : null);
              setDiaSelecionado(hoje);
            }}
          >
            Hoje
          </button>
          <button type="button" className="red" aria-label="Próximo" onClick={() => andar(1)}>
            <IconeDireita />
          </button>
          <button
            type="button"
            className="primario"
            onClick={() => setPainel({ tipo: 'novo', data: diaSelecionado, hora: '' })}
          >
            + Novo
          </button>
          <button type="button" onClick={() => setPainel({ tipo: 'extra' })}>
            + Horário extra
          </button>
          {atualizando && <span className="sutil atualizando">atualizando…</span>}
        </div>

        {(semConexao || configSemConexao) && salvoEm && (
          <FaixaSemConexao
            salvoEm={salvoEm}
            onTentar={() => {
              void carregar();
              if (configSemConexao) void recarregarConfig();
            }}
          />
        )}

        {!larga && avisoNovos}

        {!larga && <CartaoAmanha />}
      </div>

      <div className="agenda-layout">
        <div className="agenda-grade" inert={modal} aria-hidden={modal || undefined}>
        {erro && (
          <p role="alert">
            Não foi possível carregar a agenda.{' '}
            <button
              type="button"
              onClick={() => {
                if (erroAgenda) void carregar();
                if (erroServicos) carregarServicos();
              }}
            >
              Tentar de novo
            </button>
          </p>
        )}
        {!agendamentos && !erro && <Esqueleto linhas={6} />}

        {agendamentos && (
          <div
            key={`${modo}-${modo === 'dia' ? diaSelecionado : segunda}`}
            className={`dias-grade${modo === 'semana' ? ' semana' : ''}${direcao ? ` entra-${direcao}` : ''}${primeiraCarga.current ? ' cascata' : ''}`}
          >
            {diasVisiveis.map(([data, itens]) => (
              <section key={data} className="dia">
                <h3>
                  {abreviaDia(data)} {ddmm(data)}
                </h3>
                {itens.length === 0 && <p className="sutil">{modo === 'semana' ? 'Fechado' : 'Sem horários.'}</p>}
                <ul className="grade">
                  {(modo === 'semana' ? agruparLivres(itens, config.passo_min) : itens).map((item, i) => (
                    <li key={item.tipo === 'agendamento' ? item.agendamento.id : `${item.tipo}-${item.tipo === 'livres' ? item.de : item.hora}`} style={{ '--i': Math.min(i, 10) } as CSSProperties}>
                      {item.tipo === 'agendamento' ? (
                        <button
                          type="button"
                          className={`ag ${item.agendamento.status}${sel(`ag:${item.agendamento.id}`)}`}
                          aria-current={atual(`ag:${item.agendamento.id}`) || undefined}
                          onClick={() => {
                            ver(item.agendamento.id);
                            setPainel({ tipo: 'detalhes', agendamento: item.agendamento });
                          }}
                        >
                          <span className="h">{item.hora}</span>{' '}
                          <span className="quem">
                            <span className="n">{item.agendamento.cliente.nome}</span>{' '}
                            <span className="s">· {item.agendamento.servico?.nome ?? '—'}</span>
                            {item.agendamento.origem === 'link' && <span className="etiqueta"> pelo link</span>}
                            {nomeDivergente(item.agendamento.cliente.nome, item.agendamento.nome_informado) && (
                              <span className="etiqueta alerta">
                                {' '}digitou: {nomeDivergente(item.agendamento.cliente.nome, item.agendamento.nome_informado)}
                              </span>
                            )}
                          </span>{' '}
                          <SeloStatus status={item.agendamento.status} />
                        </button>
                      ) : item.tipo === 'fechado' ? (
                        <button
                          type="button"
                          className={`fechado${sel(`h:${data}:${item.hora}`)}`}
                          aria-current={atual(`h:${data}:${item.hora}`) || undefined}
                          onClick={() => setPainel({ tipo: 'fechado', data, hora: item.hora, ajusteId: item.ajusteId })}
                        >
                          <s>{item.hora}</s> fechado
                        </button>
                      ) : item.tipo === 'livres' ? (
                        <button
                          type="button"
                          className={`livre grupo${sel(`h:${data}:${item.de}`)}`}
                          aria-current={atual(`h:${data}:${item.de}`) || undefined}
                          aria-label={
                            item.de === item.ate
                              ? `Marcar ${abreviaDia(data)} ${ddmm(data)} às ${item.de}`
                              : `Marcar ${abreviaDia(data)} ${ddmm(data)} entre ${item.de} e ${item.ate}`
                          }
                          onClick={() => setPainel({ tipo: 'livre', data, hora: item.de, extraId: extraQueCria(data, item.de) })}
                        >
                          {item.de === item.ate ? item.de : `${item.de}–${item.ate}`} livre
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`livre${sel(`h:${data}:${item.hora}`)}`}
                          aria-current={atual(`h:${data}:${item.hora}`) || undefined}
                          aria-label={`Marcar ${abreviaDia(data)} ${ddmm(data)} às ${item.hora}`}
                          onClick={() => setPainel({ tipo: 'livre', data, hora: item.hora, extraId: extraQueCria(data, item.hora) })}
                        >
                          {item.hora} livre <IconeMais tamanho={18} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        </div>
        {larga && painel === null && <ResumoLateral novos={avisoNovos} versao={versao} />}
        {/* sempre aqui, nos dois modos: trocar a largura não desmonta o que está aberto */}
        <Painel
          aberto={painel !== null}
          onFechar={() => setPainel(null)}
          rotulo={ultimoPainel.current ? ROTULOS[ultimoPainel.current.tipo] : ''}
          modo={larga ? 'lateral' : 'sobreposto'}
        >
          {ultimoPainel.current && conteudoPainel(ultimoPainel.current)}
        </Painel>
      </div>
    </main>
  );
}
