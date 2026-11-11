import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { mensagemLembrar } from '../lib/mensagens';
import { diasDoPeriodo, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto } from '../types';
import { useConfig } from './contexto';
import { useAoVoltar } from './useAoVoltar';

/** Cartão "Amanhã" na Agenda (spec v3, seção 2.1): substitui a antiga aba Lembretes. */
export default function CartaoAmanha() {
  const { config } = useConfig();
  const voltas = useAoVoltar();
  const { de: amanha } = diasDoPeriodo('amanha', new Date(), config.fuso);
  const [lista, setLista] = useState<AgendamentoCompleto[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setErro(false);
    listAgendamentos(supabase, amanha, amanha).then(
      (r) => setLista(r.filter((a) => a.status === 'marcado' || a.status === 'confirmado')),
      () => setErro(true),
    );
  }, [amanha, voltas]);

  if (erro) return <p className="sutil">Não foi possível carregar os clientes de amanhã.</p>;
  if (!lista) return null;

  const n = lista.length;
  const titulo = n === 0 ? 'Amanhã: nenhum cliente' : n === 1 ? 'Amanhã: 1 cliente' : `Amanhã: ${n} clientes`;

  return (
    <aside className="cartao-amanha">
      <div className="linha">
        <strong>{titulo}</strong>
        {n > 0 && !aberto && (
          <button type="button" onClick={() => setAberto(true)}>
            Lembrar
          </button>
        )}
      </div>
      {aberto && (
        <>
          <ul className="lista">
            {lista.map((a) => (
              <li key={a.id}>
                <span>
                  {horaLocal(new Date(a.inicio), config.fuso)} {a.cliente.nome}
                </span>
                <a
                  className="botao"
                  style={{ marginLeft: 'auto' }}
                  href={waLink(a.cliente.telefone, mensagemLembrar({ nome: a.cliente.nome, inicio: a.inicio, fuso: config.fuso }))}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Lembrar ${a.cliente.nome}`}
                >
                  WhatsApp
                </a>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setAberto(false)}>
            Voltar
          </button>
        </>
      )}
    </aside>
  );
}
