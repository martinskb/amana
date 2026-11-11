import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { abreviaDia, diasDoPeriodo, horaCurta, horaLocal } from '../lib/slots';
import { renderModelo, waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto } from '../types';
import { useConfig } from './contexto';
import { useAoVoltar } from './useAoVoltar';

export default function Lembretes() {
  const { config } = useConfig();
  const [lista, setLista] = useState<AgendamentoCompleto[] | null>(null);
  const [erro, setErro] = useState(false);
  const voltas = useAoVoltar();
  const { de: amanha } = diasDoPeriodo('amanha', new Date(), config.fuso);

  useEffect(() => {
    listAgendamentos(supabase, amanha, amanha).then(
      (r) => setLista(r.filter((a) => a.status === 'marcado' || a.status === 'confirmado')),
      () => setErro(true),
    );
  }, [amanha, voltas]);

  return (
    <main>
      <h2>Lembretes de amanhã</h2>
      {erro && <p role="alert">Não foi possível carregar a agenda. Confira a internet.</p>}
      {!lista && !erro && <p className="carregando">Carregando…</p>}
      {lista?.length === 0 && <p>Nenhum atendimento amanhã.</p>}
      <ul className="lista">
        {lista?.map((a) => {
          const hora = horaCurta(horaLocal(new Date(a.inicio), config.fuso));
          const mensagem = renderModelo(config.modelo_lembrete, {
            nome: a.cliente.nome,
            dia: abreviaDia(amanha),
            hora,
            nome_negocio: config.nome_negocio,
          });
          return (
            <li key={a.id}>
              <span>
                {hora} {a.cliente.nome} <span className="sutil">· {a.servico.nome}</span>
              </span>
              <a
                className="botao"
                style={{ marginLeft: 'auto' }}
                href={waLink(a.cliente.telefone, mensagem)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Lembrar ${a.cliente.nome}`}
              >
                WhatsApp
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
