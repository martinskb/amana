import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { faltaPara, proximoCliente } from '../lib/proximo';
import { abreviaDia, dataLocal, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto } from '../types';
import CartaoAmanha from './CartaoAmanha';
import { useConfig } from './contexto';
import { IconeWhatsApp } from './icones';
import { agendamentosGuardadosDoDia } from './useAgendaSemana';
import { useAoVoltar } from './useAoVoltar';

interface Props {
  /** Agendamentos novos pelo link: na tela larga continuam como lista. */
  novos: AgendamentoCompleto[];
  /** "Entendi": marca todos como vistos. */
  onEntendi: () => void;
  /** Muda quando a agenda gravou algo: recarrega o próximo cliente. */
  versao: number;
  /** O filtro da agenda: só os clientes dela; null = todos. */
  pessoa?: string | null;
}

/** Coluna lateral da tela larga sem nada selecionado: próximo cliente de hoje, Amanhã e novos pelo link. */
export default function ResumoLateral({ novos, onEntendi, versao, pessoa = null }: Props) {
  const { config } = useConfig();
  const voltas = useAoVoltar();
  const [hojeAgs, setHojeAgs] = useState<AgendamentoCompleto[] | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  // o relógio do "em N min" também busca de novo na meia-noite com a tela aberta
  const diaDoRelogio = dataLocal(agora, config.fuso);
  useEffect(() => {
    const hoje = dataLocal(new Date(), config.fuso);
    // sem conexão: o de hoje que está na semana guardada (sem ela, como antes: lista vazia)
    listAgendamentos(supabase, hoje, hoje).then(setHojeAgs, () => setHojeAgs(agendamentosGuardadosDoDia(hoje, config.fuso) ?? []));
  }, [config.fuso, versao, voltas, diaDoRelogio]);

  // o "em N min" acompanha o relógio
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const daPessoa = hojeAgs && pessoa !== null ? hojeAgs.filter((a) => a.pessoa_id === pessoa) : hojeAgs;
  const proximo = daPessoa ? proximoCliente(daPessoa, agora, config.fuso) : null;

  return (
    <aside className="resumo-lateral" aria-label="Resumo">
      <section className="resumo-secao">
        <h3 className="capitulo">Próximo cliente</h3>
        {hojeAgs && !proximo && <p className="sutil">Nenhum cliente até o fim do dia.</p>}
        {proximo && (
          <div className="linha proximo">
            <span className="proximo-hora">{horaLocal(new Date(proximo.inicio), config.fuso)}</span>
            <div className="proximo-quem">
              <strong>{proximo.cliente.nome}</strong>
              <span className="sutil">
                {proximo.servico?.nome ?? 'sem serviço'} · {faltaPara(proximo.inicio, agora)}
              </span>
            </div>
            {proximo.cliente.telefone && (
              <a
                className="botao redondo"
                href={waLink(proximo.cliente.telefone, '')}
                target="_blank"
                rel="noreferrer"
                aria-label={`WhatsApp de ${proximo.cliente.nome}`}
              >
                <IconeWhatsApp />
              </a>
            )}
          </div>
        )}
      </section>
      <CartaoAmanha pessoa={pessoa} />
      {novos.length > 0 && (
        <section className="resumo-secao" role="status">
          <h3 className="capitulo">Pelo link</h3>
          <p className="novos-titulo">
            {novos.length === 1 ? '1 agendamento novo pelo link' : `${novos.length} agendamentos novos pelo link`}
          </p>
          <ul className="novos-lista">
            {novos.map((a) => {
              const ini = new Date(a.inicio);
              const d = dataLocal(ini, config.fuso);
              return (
                <li key={a.id}>
                  {abreviaDia(d)} {d.slice(8, 10)}/{d.slice(5, 7)} {horaLocal(ini, config.fuso)} · {a.cliente.nome}
                </li>
              );
            })}
          </ul>
          <button type="button" className="texto" onClick={onEntendi}>
            Entendi
          </button>
        </section>
      )}
    </aside>
  );
}
