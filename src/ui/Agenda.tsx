import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { criarExtra, fecharHorario, removerAjuste } from '../data/ajustes';
import { listServicos } from '../data/servicos';
import { supabase } from '../data/supabase';
import { abreviaDia, dataLocal, freeSlots, gerarHorarios, horaLocal, instanteLocal, nomeDiaExtenso, somarDias } from '../lib/slots';
import type { AgendamentoCompleto, Servico } from '../types';
import { useConfig } from './contexto';
import BackupBanner from './BackupBanner';
import CabecalhoAgenda from './CabecalhoAgenda';
import CartaoAmanha from './CartaoAmanha';
import DetalhesAgendamento from './DetalhesAgendamento';
import NovoAgendamento from './NovoAgendamento';
import Painel from './Painel';
import { IconeFaltou, IconeMais, IconeX } from './icones';
import ResumoLateral from './ResumoLateral';
import { usePrefereMenosMovimento, useTelaLarga } from './animacao';
import Esqueleto from './Esqueleto';
import { agruparLivres, type Item } from './semana';
import BotaoMais from './BotaoMais';
import Chuva from './Chuva';
import DiaVazio from './DiaVazio';
import FaixaSemana from './FaixaSemana';
import LinhaDoTempo, { type ItemLinha } from './LinhaDoTempo';
import { useAoVoltar } from './useAoVoltar';
import { useAgendaSemana } from './useAgendaSemana';
import { useNovosPeloLink } from './useNovosPeloLink';
import FaixaSemConexao from './FaixaSemConexao';
import { AnuncioNovos, NotaNovosFora } from './NovosNaAgenda';
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
  // como a grade entra: desliza para o lado do dia escolhido, ou fade ao trocar dia ↔ semana
  const [transicao, setTransicao] = useState<'esq' | 'dir' | 'modo' | null>(null);
  const menosMovimento = usePrefereMenosMovimento();
  // a cascata dos horários só acontece na primeira vez que a grade aparece
  const primeiraCarga = useRef(true);
  useEffect(() => {
    if (agendamentos) primeiraCarga.current = false;
  }, [agendamentos]);
  /** Vai para um dia; a linha do tempo desliza para o lado de onde ele está. */
  function irPara(d: string) {
    setTransicao(d < diaSelecionado ? 'esq' : d > diaSelecionado ? 'dir' : null);
    setDiaSelecionado(d);
  }
  /** Tocar num dia (faixa, nota dos novos): no modo dia desliza; da semana, volta ao modo dia. */
  function escolherDia(d: string) {
    if (modo === 'dia') return irPara(d);
    setDiaSelecionado(d);
    trocarModo('dia');
  }
  // as setas da faixa andam uma semana e mantêm o dia da semana escolhido (quinta → quinta)
  const andarSemana = (passo: -1 | 1) => irPara(somarDias(diaSelecionado, passo * 7));
  function trocarModo(m: 'dia' | 'semana') {
    if (m === modo) return;
    setTransicao('modo');
    setModo(m);
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
  const selecionado = larga && painel !== null ? chaveDoPainel(painel) : null;

  // agendamentos novos pelo link, vistos por agendamento (busca a cada 30 s e ao voltar, como a semana)
  const { novos, chegaramAgora, ver, verTodos, buscar: buscarNovos } = useNovosPeloLink();
  const idsNovos = useMemo(() => new Set(novos.map((a) => a.id)), [novos]);
  const diasComNovo = useMemo(() => new Set(novos.map((a) => dataLocal(new Date(a.inicio), config.fuso))), [novos, config.fuso]);
  // trocou de semana: busca os novos junto com a semana nova (o hook já busca ao montar)
  const semanaAnterior = useRef(segunda);
  useEffect(() => {
    if (semanaAnterior.current === segunda) return;
    semanaAnterior.current = segunda;
    void buscarNovos();
  }, [segunda, buscarNovos]);

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
  const { porDia, comExpediente } = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    const comExpediente = new Set<string>();
    for (const d of diasDaSemana(segunda)) mapa.set(d, []);
    if (!agendamentos) return { porDia: mapa, comExpediente };
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
      comExpediente.add(h.data);
      if (!h.fechado) continue;
      const ini = h.inicio.getTime();
      const ajuste = fechados.find((f) => {
        const fi = new Date(f.inicio).getTime();
        return ini < fi + passo && fi < ini + passo;
      });
      if (ajuste) mapa.get(h.data)?.push({ tipo: 'fechado', hora: h.hora, ajusteId: ajuste.id });
    }
    for (const itens of mapa.values()) itens.sort((x, y) => x.hora.localeCompare(y.hora));
    return { porDia: mapa, comExpediente };
  }, [agendamentos, ajustes, config, segunda, ate]);
  // quantos clientes cada dia tem, para a bolinha e o nome da faixa
  const contagem = useMemo(
    () => Object.fromEntries([...porDia].map(([d, itens]) => [d, itens.filter((i) => i.tipo === 'agendamento').length])),
    [porDia],
  );

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

  /** Abre o horário extra já no dia que está na tela. */
  function abrirExtra(data = diaSelecionado) {
    setExtraData(data);
    setPainel({ tipo: 'extra' });
  }

  /** Tocar numa linha da linha do tempo abre o painel daquele item. */
  function abrirItem(data: string, item: ItemLinha) {
    if (item.tipo === 'agendamento') {
      ver(item.agendamento);
      setPainel({ tipo: 'detalhes', agendamento: item.agendamento });
    } else if (item.tipo === 'fechado') {
      setPainel({ tipo: 'fechado', data, hora: item.hora, ajusteId: item.ajusteId });
    } else {
      const hora = item.tipo === 'livres' ? item.de : item.hora;
      setPainel({ tipo: 'livre', data, hora, extraId: extraQueCria(data, hora) });
    }
  }

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
        <div className="painel-conteudo">
          <h3 className="painel-titulo">
            {abreviaDia(p.data)} {ddmm(p.data)} às {p.hora}
          </h3>
          <p className="painel-resumo">{p.extraId ? 'Horário extra, livre' : 'Horário livre'}</p>
          <button type="button" className="primario larga" onClick={() => setPainel({ tipo: 'novo', data: p.data, hora: p.hora })}>
            <IconeMais /> Marcar cliente
          </button>
          <ul className="acoes">
            <li>
              {p.extraId ? (
                <button type="button" className="acao-linha" onClick={() => ajustar(() => removerAjuste(supabase, p.extraId!))}>
                  <IconeX /> Remover horário extra
                </button>
              ) : (
                <button
                  type="button"
                  className="acao-linha"
                  onClick={() => ajustar(() => fecharHorario(supabase, instanteLocal(p.data, p.hora, config.fuso).toISOString()))}
                >
                  <IconeFaltou /> Fechar este horário
                </button>
              )}
            </li>
          </ul>
          {erroAjuste && <p role="alert">{erroAjuste}</p>}
          <button type="button" className="texto fechar-texto" onClick={() => setPainel(null)}>
            Voltar
          </button>
        </div>
      );

    if (p.tipo === 'fechado')
      return (
        <div className="painel-conteudo">
          <h3 className="painel-titulo">
            {abreviaDia(p.data)} {ddmm(p.data)} às {p.hora} — fechado
          </h3>
          <p className="painel-resumo">Este horário não aparece no link de agendamento.</p>
          <button type="button" className="primario larga" onClick={() => ajustar(() => removerAjuste(supabase, p.ajusteId))}>
            Reabrir
          </button>
          {erroAjuste && <p role="alert">{erroAjuste}</p>}
          <button type="button" className="texto fechar-texto" onClick={() => setPainel(null)}>
            Voltar
          </button>
        </div>
      );

    if (p.tipo === 'extra')
      return (
        <div className="painel-conteudo">
          <h3 className="painel-titulo">Abrir horário extra</h3>
          <p className="painel-resumo">Um horário fora do expediente, que aparece no link.</p>
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
            {erroAjuste && <p role="alert">{erroAjuste}</p>}
            <div className="botoes-painel">
              <button type="submit" className="primario larga">
                Abrir horário
              </button>
              <button type="button" className="texto" onClick={() => setPainel(null)}>
                Voltar
              </button>
            </div>
          </form>
        </div>
      );

    if (p.tipo === 'detalhes')
      return (
        <DetalhesAgendamento
          agendamento={p.agendamento}
          onEditar={() => setPainel({ tipo: 'editar', agendamento: p.agendamento })}
          onMudou={() => {
            ver(p.agendamento);
            depoisDeSalvar();
          }}
          onFechar={() => setPainel(null)}
        />
      );

    return null;
  }

  // com menos movimento, nada anima: a grade já aparece no lugar
  const classeTransicao = menosMovimento
    ? ''
    : `${transicao === 'modo' ? ' troca-modo' : transicao ? ` entra-${transicao}` : ''}${primeiraCarga.current ? ' cascata' : ''}`;
  const ehHoje = modo === 'dia' ? diaSelecionado === hoje : segunda === segundaDe(hoje);
  const itensDoDia = porDia.get(diaSelecionado) ?? [];

  /** O dia escolhido: fechado, dia livre (sem agendamento) ou a linha do tempo. */
  function dia() {
    if (itensDoDia.length === 0 && !comExpediente.has(diaSelecionado))
      return <DiaVazio fechado hoje={diaSelecionado === hoje} onExtra={() => abrirExtra(diaSelecionado)} />;
    const semAgendamento = !itensDoDia.some((i) => i.tipo === 'agendamento');
    return (
      <>
        {semAgendamento && itensDoDia.some((i) => i.tipo === 'livre') && <DiaVazio fechado={false} onExtra={() => abrirExtra()} />}
        {itensDoDia.length === 0 ? (
          <p className="sutil">nenhum cliente</p>
        ) : (
          <LinhaDoTempo
            data={diaSelecionado}
            itens={itensDoDia}
            modo="dia"
            novos={idsNovos}
            chegaram={chegaramAgora}
            selecionado={selecionado}
            onItem={(item) => abrirItem(diaSelecionado, item)}
          />
        )}
      </>
    );
  }

  return (
    <main className="agenda">
      <Chuva altura={larga ? 280 : 230} />
      <AnuncioNovos novos={novos} chegaram={chegaramAgora} fuso={config.fuso} />
      <div className="agenda-layout">
        <div className="agenda-coluna" inert={modal} aria-hidden={modal || undefined}>
          <CabecalhoAgenda />
          {/* na tela larga, a lista do resumo faz esse papel */}
          {!larga && (
            <NotaNovosFora novos={novos} chegaram={chegaramAgora} de={segunda} ate={ate} fuso={config.fuso} onIr={escolherDia} />
          )}
          <div className="agenda-titulo">
            <div className="titulo-sup">
              <span className="negocio">{config.nome_negocio}</span>
              <div role="group" aria-label="Visão" className="alterna">
                <button type="button" aria-pressed={modo === 'dia'} onClick={() => trocarModo('dia')}>
                  dia
                </button>
                <button type="button" aria-pressed={modo === 'semana'} onClick={() => trocarModo('semana')}>
                  semana
                </button>
              </div>
            </div>
            <div className="titulo-dia">
              <h1 className={modo === 'semana' ? 'semana' : undefined}>
                {modo === 'dia' ? nomeDiaExtenso(diaSelecionado) : `${ddmm(segunda)} a ${ddmm(ate)}`}
              </h1>
              {!ehHoje && (
                <button type="button" className="texto" onClick={() => irPara(hoje)}>
                  hoje
                </button>
              )}
              {atualizando && <span className="sutil atualizando">atualizando…</span>}
            </div>
          </div>
          {larga && (
            <div className="acoes-topo">
              <button type="button" className="texto" onClick={() => setPainel({ tipo: 'novo', data: diaSelecionado, hora: '' })}>
                + Novo
              </button>
              <button type="button" className="texto" onClick={() => abrirExtra()}>
                + Horário extra
              </button>
            </div>
          )}
          <FaixaSemana
            dias={diasDaSemana(segunda)}
            selecionado={diaSelecionado}
            contagem={contagem}
            comNovo={diasComNovo}
            onEscolher={escolherDia}
            onSemana={andarSemana}
          />

          {(semConexao || configSemConexao) && salvoEm && (
            <FaixaSemConexao
              salvoEm={salvoEm}
              onTentar={() => {
                void carregar();
                if (configSemConexao) void recarregarConfig();
              }}
            />
          )}

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
              className={`dias-grade${modo === 'semana' ? ' semana' : ''}${classeTransicao}`}
            >
              {modo === 'dia'
                ? dia()
                : [...porDia].map(([data, itens]) => (
                    <section key={data} className="dia">
                      <h3>
                        {abreviaDia(data)} {ddmm(data)}
                      </h3>
                      {itens.length === 0 ? (
                        <p className="sutil">{comExpediente.has(data) ? 'nenhum cliente' : 'Fechado'}</p>
                      ) : (
                        <LinhaDoTempo
                          data={data}
                          itens={agruparLivres(itens, config.passo_min)}
                          modo="semana"
                          novos={idsNovos}
                          chegaram={chegaramAgora}
                          selecionado={selecionado}
                          onItem={(item) => abrirItem(data, item)}
                        />
                      )}
                    </section>
                  ))}
            </div>
          )}

          {!larga && <CartaoAmanha />}
          <BackupBanner />
        </div>
        {larga && painel === null && <ResumoLateral novos={novos} onEntendi={verTodos} versao={versao} />}
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
      {!larga && (
        <div inert={modal} aria-hidden={modal || undefined}>
          <BotaoMais onNovo={() => setPainel({ tipo: 'novo', data: diaSelecionado, hora: '' })} onExtra={() => abrirExtra()} />
        </div>
      )}
    </main>
  );
}
