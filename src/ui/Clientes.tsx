import { useEffect, useState } from 'react';
import { listAgendamentosDoCliente } from '../data/agendamentos';
import { listClientes } from '../data/clientes';
import { supabase } from '../data/supabase';
import { dataLocal, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto, Cliente, Status } from '../types';
import { useConfig } from './contexto';

const STATUS: Record<Status, string> = {
  marcado: 'Marcado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
  faltou: 'Faltou',
};

export default function Clientes() {
  const { config } = useConfig();
  const [busca, setBusca] = useState('');
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [aberto, setAberto] = useState<Cliente | null>(null);
  const [historico, setHistorico] = useState<AgendamentoCompleto[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      listClientes(supabase, busca.trim() || undefined).then(setClientes, () => setErro(true));
    }, busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!aberto) return;
    setHistorico(null);
    listAgendamentosDoCliente(supabase, aberto.id).then(setHistorico, () => setErro(true));
  }, [aberto]);

  if (aberto) {
    return (
      <main>
        <button type="button" onClick={() => setAberto(null)}>
          ‹ Clientes
        </button>
        <h2>{aberto.nome}</h2>
        <p>
          <a className="botao" href={waLink(aberto.telefone, '')} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </p>
        {erro && <p role="alert">Não foi possível carregar o histórico.</p>}
        {historico?.length === 0 && <p className="sutil">Nenhum atendimento ainda.</p>}
        <ul className="lista" aria-label="Histórico">
          {historico?.map((a) => {
            const ini = new Date(a.inicio);
            const data = dataLocal(ini, config.fuso).split('-').reverse().join('/');
            return (
              <li key={a.id}>
                {data} {horaLocal(ini, config.fuso)} · {a.servico?.nome ?? '—'} · {STATUS[a.status]}
              </li>
            );
          })}
        </ul>
      </main>
    );
  }

  return (
    <main>
      <h2>Clientes</h2>
      <label>
        Buscar
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone" />
      </label>
      {erro && <p role="alert">Não foi possível carregar os clientes.</p>}
      {clientes?.length === 0 && <p className="sutil">Nenhum cliente encontrado.</p>}
      <ul className="lista">
        {clientes?.map((c) => (
          <li key={c.id}>
            <button type="button" className="link" onClick={() => setAberto(c)}>
              {c.nome} <span className="sutil">{c.telefone.slice(2)}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
