import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { mensagemLembrar } from '../lib/mensagens';
import { nomeNaMensagem } from '../lib/pessoas';
import { diasDoPeriodo, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto } from '../types';
import { useContador } from './animacao';
import { useConfig } from './contexto';
import { agendamentosGuardadosDoDia } from './useAgendaSemana';
import { useAoVoltar } from './useAoVoltar';

/**
 * Cartão "Amanhã" na Agenda (spec v3, seção 2.1): substitui a antiga aba Lembretes.
 * `pessoa`: só os clientes dela (o filtro da agenda); null = todos.
 */
export default function CartaoAmanha({ pessoa = null }: { pessoa?: string | null }) {
  const { config, pessoas } = useConfig();
  const voltas = useAoVoltar();
  const { de: amanha } = diasDoPeriodo('amanha', new Date(), config.fuso);
  const [lista, setLista] = useState<AgendamentoCompleto[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setErro(false);
    const aLembrar = (r: AgendamentoCompleto[]) =>
      r.filter((a) => (a.status === 'marcado' || a.status === 'confirmado') && (pessoa === null || a.pessoa_id === pessoa));
    listAgendamentos(supabase, amanha, amanha).then(
      (r) => setLista(aLembrar(r)),
      () => {
        // sem conexão: usa a semana guardada no aparelho, se amanhã estiver nela
        const guardados = agendamentosGuardadosDoDia(amanha, config.fuso);
        if (guardados) setLista(aLembrar(guardados));
        else setErro(true);
      },
    );
  }, [amanha, voltas, config.fuso, pessoa]);

  const contagem = useContador(lista?.length ?? 0);

  if (erro) return <p className="sutil">Não foi possível carregar os clientes de amanhã.</p>;

  const n = lista?.length ?? 0;
  // enquanto carrega, ocupa o mesmo lugar: a grade não pula quando a resposta chega
  const resumo = !lista ? '…' : n === 0 ? 'nenhum cliente' : n === 1 ? '1 cliente pra lembrar' : `${n} clientes pra lembrar`;

  return (
    <aside className={`cartao-amanha${n > 0 ? ' com-clientes' : ''}`} aria-label="Amanhã">
      <div className="linha">
        <span className="num" aria-hidden="true">
          {contagem}
        </span>
        <div className="amanha-texto">
          <strong>amanhã</strong>
          <span className="sutil">{resumo}</span>
        </div>
        {n > 0 && !aberto && (
          <button type="button" className="lembrar" onClick={() => setAberto(true)}>
            Lembrar
          </button>
        )}
      </div>
      {aberto && lista && (
        <div className="desdobra">
          <ul className="lista">
            {lista.map((a) => (
              <li key={a.id}>
                <span>
                  {horaLocal(new Date(a.inicio), config.fuso)} {a.cliente.nome}
                </span>
                {a.cliente.telefone && (
                  <a
                    className="botao"
                    style={{ marginLeft: 'auto' }}
                    href={waLink(a.cliente.telefone, mensagemLembrar({ nome: a.cliente.nome, inicio: a.inicio, fuso: config.fuso, pessoa: nomeNaMensagem(a.pessoa_id, pessoas) }))}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Lembrar ${a.cliente.nome}`}
                  >
                    WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setAberto(false)}>
            Voltar
          </button>
        </div>
      )}
    </aside>
  );
}
