import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { agendarPublico, getHorariosPublicos } from '../../data/publico';
import { supabase } from '../../data/supabase';
import { abreviaDia, dataLocal, diaDaSemana, FUSO, horaCurta, horaLocal } from '../../lib/slots';
import { MSG_WHATSAPP_INVALIDO, normalizePhone, waLink } from '../../lib/whatsapp';
import type { ErroPublico, HorariosPublicos } from '../../types';
import Esqueleto from '../Esqueleto';
import { IconeDireita, IconeEsquerda } from '../icones';
import MarcaAmana from '../MarcaAmana';

const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const MENSAGENS: Record<ErroPublico, string> = {
  horario_indisponivel: 'Esse horário acabou de ser ocupado. Escolha outro.',
  // três limites (IP, WhatsApp, teto geral) com a mesma mensagem: não revela qual foi nem se o número tem horários
  limite: 'Não foi possível marcar pelo link agora. Chame no WhatsApp para marcar seu horário.',
  link_fechado: 'Agendamento online fechado no momento.',
  dados_invalidos: 'Confira o nome e o WhatsApp.',
  servico_invalido: 'Esse serviço não está mais disponível. Escolha outro.',
};

/** "qua 18/11 às 9h" a partir de um instante. */
function descrever(iso: string) {
  const d = new Date(iso);
  const data = dataLocal(d, FUSO);
  return { dia: abreviaDia(data), ddmm: `${data.slice(8, 10)}/${data.slice(5, 7)}`, hora: horaCurta(horaLocal(d, FUSO)) };
}

/** "Quarta, 18/11 às 9h": resumo do horário escolhido, acima do formulário. */
function resumo(iso: string) {
  const { ddmm, hora } = descrever(iso);
  return `${DIAS_LONGOS[diaDaSemana(dataLocal(new Date(iso), FUSO))]}, ${ddmm} às ${hora}`;
}

/** Página pública /#/agendar: o cliente escolhe um horário livre e informa nome e WhatsApp. Sem login. */
export default function Agendar() {
  const [dados, setDados] = useState<HorariosPublicos | null>(null);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [whats, setWhats] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechado, setFechado] = useState(false);
  const [marcado, setMarcado] = useState<{ nome: string; inicio: string; servico: string | null } | null>(null);
  const fichas = useRef<HTMLDivElement>(null);
  const rolarDias = (sentido: -1 | 1) => fichas.current?.scrollBy({ left: sentido * 3 * 70, behavior: 'smooth' });

  const carregar = useCallback(async () => {
    setFalhaCarga(false);
    try {
      setDados(await getHorariosPublicos(supabase));
    } catch {
      setFalhaCarga(true); // sem internet ou projeto pausado
    }
  }, []);

  // na aba do navegador o cliente vê o nome do negócio, não o da Amana
  useEffect(() => {
    if (dados) document.title = dados.nome_negocio;
  }, [dados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Com serviços ativos, o cliente escolhe um e os horários são os em que ele cabe inteiro.
  // Sem nenhum (ou banco sem a 0005), segue como antes: blocos simples, sem serviço.
  const servicos = dados?.servicos ?? [];
  const comServico = servicos.length > 0;
  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const horariosVisiveis = comServico ? (servico?.horarios ?? []) : (dados?.horarios ?? []);
  const temHorario = comServico ? servicos.some((s) => s.horarios.length > 0) : (dados?.horarios.length ?? 0) > 0;

  const porDia = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const h of horariosVisiveis) {
      const d = dataLocal(new Date(h), FUSO);
      mapa.set(d, [...(mapa.get(d) ?? []), h]);
    }
    return mapa;
  }, [horariosVisiveis]);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (enviando || !horario) return;
    setErro(null);
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return setErro('Informe seu nome.');
    const tel = normalizePhone(whats);
    if (!tel) return setErro(MSG_WHATSAPP_INVALIDO);

    setEnviando(true);
    try {
      // com "+": o servidor normaliza de novo e um número estrangeiro não vira brasileiro
      const r = await agendarPublico(supabase, nomeLimpo, `+${tel}`, horario, servico?.id ?? null);
      if (r.ok) {
        setMarcado({ nome: nomeLimpo, inicio: r.inicio, servico: servico?.nome ?? null });
      } else if (r.erro === 'link_fechado') {
        setFechado(true);
      } else {
        setErro(MENSAGENS[r.erro]);
        if (r.erro === 'servico_invalido') {
          setServicoId(null);
          setDia(null);
        }
        if (r.erro === 'horario_indisponivel' || r.erro === 'servico_invalido') {
          setHorario(null);
          void carregar();
        }
      }
    } catch {
      setErro('Não foi possível carregar. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  }

  const telNegocio = dados?.telefone_negocio ?? null;
  const falar = (texto: string) =>
    telNegocio ? (
      <a className="botao" href={waLink(telNegocio, texto)} target="_blank" rel="noreferrer">
        Falar com a barbearia
      </a>
    ) : null;

  if (falhaCarga)
    return (
      <main className="publico">
        <p role="alert" className="cartao aviso-publico">
          Não foi possível carregar. Tente de novo em instantes.
        </p>
        <button type="button" onClick={carregar}>
          Tentar de novo
        </button>
      </main>
    );
  if (!dados)
    return (
      <main className="publico">
        <Esqueleto />
      </main>
    );

  const titulo = <h1>{dados.nome_negocio}</h1>;
  const assinatura = (
    <footer className="assinatura">
      agendado com <MarcaAmana tamanho={14} />
    </footer>
  );

  if (marcado) {
    const { dia: d, ddmm, hora } = descrever(marcado.inicio);
    return (
      <>
        <main className="publico">
          {titulo}
          <div role="status" className="sucesso">
            <svg className="check" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle className="check-circulo" cx="48" cy="48" r="44" />
              <path className="check-traco" d="M30 49l12 12 24-26" />
            </svg>
            <h2>Pronto, {marcado.nome}!</h2>
            <p className="resumo-sucesso">
              {marcado.servico ? `${marcado.servico}: ` : 'Seu horário: '}
              {d} {ddmm} às {hora}.
            </p>
          </div>
          {falar(
            marcado.servico
              ? `Oi! Marquei ${marcado.servico} ${d} ${ddmm} às ${hora} pelo link.`
              : `Oi! Marquei ${d} ${ddmm} às ${hora} pelo link.`,
          )}
        </main>
        {assinatura}
      </>
    );
  }

  if (fechado || !dados.link_ativo || !temHorario)
    return (
      <>
        <main className="publico">
          {titulo}
          <p className="cartao aviso-publico">
            {fechado || !dados.link_ativo ? 'Agendamento online fechado no momento.' : 'Sem horários livres nos próximos dias.'}
          </p>
          {falar('Oi! Quero marcar um horário.')}
        </main>
        {assinatura}
      </>
    );

  return (
    <>
      <main className="publico">
        {titulo}
        <p className="sutil lead">
          {comServico ? 'Escolha o serviço, o dia e o horário.' : 'Escolha o dia e o horário do seu atendimento.'}
        </p>
        {comServico && (
          <>
            <p className="rotulo">Serviço</p>
            <div className="servicos" role="group" aria-label="Serviços">
              {servicos.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={servicoId === s.id}
                  disabled={s.horarios.length === 0}
                  onClick={() => {
                    setServicoId(s.id);
                    setHorario(null);
                    setErro(null);
                  }}
                >
                  <span className="servico-nome">{s.nome}</span>{' '}
                  <span className="servico-duracao">
                    {s.horarios.length === 0 ? 'sem horário' : `${s.duracao_min} min`}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {(!comServico || servico) && <p className="rotulo">Dia</p>}
        {(!comServico || servico) && (
        <div className="dias-faixa">
          <button type="button" className="red seta" aria-label="Dias anteriores" onClick={() => rolarDias(-1)}>
            <IconeEsquerda />
          </button>
          <div className="dias" role="group" aria-label="Dias" ref={fichas}>
            {[...porDia.keys()].map((d) => (
              <button
                key={d}
                type="button"
                className="ficha"
                aria-pressed={dia === d}
                onClick={() => {
                  setDia(d);
                  setHorario(null);
                }}
              >
                <span className="ficha-dia">{abreviaDia(d)}</span> <span className="ficha-num">{d.slice(8, 10)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="red seta" aria-label="Mais dias" onClick={() => rolarDias(1)}>
            <IconeDireita />
          </button>
        </div>
        )}

        {dia && porDia.has(dia) && <p className="rotulo">Horário</p>}
        {dia && porDia.has(dia) && (
          <div key={dia} className="horarios" role="group" aria-label="Horários">
            {porDia.get(dia)!.map((h) => (
              <button key={h} type="button" aria-pressed={horario === h} onClick={() => setHorario(h)}>
                {horaCurta(horaLocal(new Date(h), FUSO))}
              </button>
            ))}
          </div>
        )}

        {horario && (
          <form onSubmit={confirmar} className="cartao formulario">
            <p className="resumo-escolha">
              {servico ? `${servico.nome} · ${servico.duracao_min} min` : null}
              {servico ? <br /> : null}
              {resumo(horario)}
            </p>
            <label>
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={80} />
            </label>
            <label>
              WhatsApp com DDD
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={whats}
                onChange={(e) => setWhats(e.target.value)}
                placeholder="(11) 98765-4321"
              />
            </label>
            <p className="sutil">
              Seu nome e WhatsApp ficam só com {dados.nome_negocio}, para marcar e lembrar seus horários.
            </p>
            <details className="privacidade sutil" aria-label="Como usamos seus dados">
              <summary>Como usamos seus dados</summary>
              <ul>
                <li>
                  Guardamos seu nome, WhatsApp e os horários que você marcar, para confirmar o atendimento e mandar
                  lembretes. Isso não é vendido nem repassado a ninguém.
                </li>
                <li>
                  Os dados ficam em serviços de nuvem usados pela agenda (banco de dados e cópia de segurança no
                  Google Drive). O histórico de cada horário é apagado 1 ano depois do atendimento.
                </li>
                <li>
                  Para ver, corrigir ou apagar seus dados, é só{' '}
                  {telNegocio ? (
                    <a
                      href={waLink(telNegocio, 'Oi! Quero ver, corrigir ou apagar meus dados da agenda.')}
                      target="_blank"
                      rel="noreferrer"
                    >
                      pedir pelo WhatsApp
                    </a>
                  ) : (
                    <>falar com {dados.nome_negocio}</>
                  )}
                  .
                </li>
              </ul>
            </details>
            <button type="submit" className="primario" disabled={enviando}>
              Confirmar horário
            </button>
          </form>
        )}

        {erro && <p role="alert">{erro}</p>}
        {erro === MENSAGENS.limite && falar('Oi! Quero marcar um horário.')}
      </main>
      {assinatura}
    </>
  );
}
