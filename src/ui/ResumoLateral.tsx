import { useEffect, useState, type ReactNode } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { faltaPara, proximoCliente } from '../lib/proximo';
import { dataLocal, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto } from '../types';
import CartaoAmanha from './CartaoAmanha';
import { useConfig } from './contexto';
import { IconeWhatsApp } from './icones';
import { useAoVoltar } from './useAoVoltar';

interface Props {
  /** Aviso de agendamentos novos pelo link (ou null). */
  novos: ReactNode;
  /** Muda quando a agenda gravou algo: recarrega o próximo cliente. */
  versao: number;
}

/** Coluna lateral da tela larga sem nada selecionado: próximo cliente de hoje, Amanhã e novos pelo link. */
export default function ResumoLateral({ novos, versao }: Props) {
  const { config } = useConfig();
  const voltas = useAoVoltar();
  const [hojeAgs, setHojeAgs] = useState<AgendamentoCompleto[] | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const hoje = dataLocal(new Date(), config.fuso);
    listAgendamentos(supabase, hoje, hoje).then(setHojeAgs, () => setHojeAgs([]));
  }, [config.fuso, versao, voltas]);

  // o "em N min" acompanha o relógio
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const proximo = hojeAgs ? proximoCliente(hojeAgs, agora, config.fuso) : null;

  return (
    <aside className="resumo-lateral" aria-label="Resumo">
      <section className="cartao proximo-cliente">
        <h3 className="rotulo">Próximo cliente</h3>
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
            <a
              className="botao redondo"
              href={waLink(proximo.cliente.telefone, '')}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp de ${proximo.cliente.nome}`}
            >
              <IconeWhatsApp />
            </a>
          </div>
        )}
      </section>
      <CartaoAmanha />
      {novos}
    </aside>
  );
}
