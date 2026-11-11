import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { agendarPublico, getHorariosPublicos } from '../../data/publico';
import { supabase } from '../../data/supabase';
import { abreviaDia, dataLocal, FUSO, horaCurta, horaLocal } from '../../lib/slots';
import { MSG_WHATSAPP_INVALIDO, normalizePhone, waLink } from '../../lib/whatsapp';
import type { ErroPublico, HorariosPublicos } from '../../types';

const MENSAGENS: Record<ErroPublico, string> = {
  horario_indisponivel: 'Esse horário acabou de ser ocupado. Escolha outro.',
  limite: 'Muitos agendamentos desta rede agora. Tente mais tarde ou chame no WhatsApp.',
  link_fechado: 'Agendamento online fechado no momento.',
  dados_invalidos: 'Confira o nome e o WhatsApp.',
};

/** "qua 18/11 às 9h" a partir de um instante. */
function descrever(iso: string) {
  const d = new Date(iso);
  const data = dataLocal(d, FUSO);
  return { dia: abreviaDia(data), ddmm: `${data.slice(8, 10)}/${data.slice(5, 7)}`, hora: horaCurta(horaLocal(d, FUSO)) };
}

/** Página pública /#/agendar: o cliente escolhe um horário livre e informa nome e WhatsApp. Sem login. */
export default function Agendar() {
  const [dados, setDados] = useState<HorariosPublicos | null>(null);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [whats, setWhats] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechado, setFechado] = useState(false);
  const [marcado, setMarcado] = useState<{ nome: string; inicio: string } | null>(null);

  const carregar = useCallback(async () => {
    setFalhaCarga(false);
    try {
      setDados(await getHorariosPublicos(supabase));
    } catch {
      setFalhaCarga(true); // sem internet ou projeto pausado
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const h of dados?.horarios ?? []) {
      const d = dataLocal(new Date(h), FUSO);
      mapa.set(d, [...(mapa.get(d) ?? []), h]);
    }
    return mapa;
  }, [dados]);

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
      const r = await agendarPublico(supabase, nomeLimpo, `+${tel}`, horario);
      if (r.ok) {
        setMarcado({ nome: nomeLimpo, inicio: r.inicio });
      } else if (r.erro === 'link_fechado') {
        setFechado(true);
      } else {
        setErro(MENSAGENS[r.erro]);
        if (r.erro === 'horario_indisponivel') {
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
        <p role="alert">Não foi possível carregar. Tente de novo em instantes.</p>
        <button type="button" onClick={carregar}>
          Tentar de novo
        </button>
      </main>
    );
  if (!dados) return <p className="carregando">Carregando…</p>;

  const titulo = <h1>{dados.nome_negocio}</h1>;

  if (marcado) {
    const { dia: d, ddmm, hora } = descrever(marcado.inicio);
    return (
      <main className="publico">
        {titulo}
        <p role="status" className="sucesso">
          Pronto, {marcado.nome}! Seu horário: {d} {ddmm} às {hora}.
        </p>
        {falar(`Oi! Marquei ${d} ${ddmm} às ${hora} pelo link.`)}
      </main>
    );
  }

  if (fechado || !dados.link_ativo || porDia.size === 0)
    return (
      <main className="publico">
        {titulo}
        <p>{fechado || !dados.link_ativo ? 'Agendamento online fechado no momento.' : 'Sem horários livres nos próximos dias.'}</p>
        {falar('Oi! Quero marcar um horário.')}
      </main>
    );

  return (
    <main className="publico">
      {titulo}
      <p className="sutil">Escolha o dia e o horário:</p>
      <div className="dias" role="group" aria-label="Dias">
        {[...porDia.keys()].map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={dia === d}
            onClick={() => {
              setDia(d);
              setHorario(null);
            }}
          >
            {abreviaDia(d)} {d.slice(8, 10)}
          </button>
        ))}
      </div>

      {dia && porDia.has(dia) && (
        <div className="horarios" role="group" aria-label="Horários">
          {porDia.get(dia)!.map((h) => (
            <button key={h} type="button" aria-pressed={horario === h} onClick={() => setHorario(h)}>
              {horaCurta(horaLocal(new Date(h), FUSO))}
            </button>
          ))}
        </div>
      )}

      {horario && (
        <form onSubmit={confirmar} className="painel">
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
          <p className="sutil">Seu nome e WhatsApp são usados só para este agendamento.</p>
          <button type="submit" className="primario" disabled={enviando}>
            Confirmar horário
          </button>
        </form>
      )}

      {erro && <p role="alert">{erro}</p>}
      {erro === MENSAGENS.limite && falar('Oi! Quero marcar um horário.')}
    </main>
  );
}
