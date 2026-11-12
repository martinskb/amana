import { useState } from 'react';
import { mudarStatus } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { linkAgendamento } from '../lib/link';
import { mensagemCancelar, mensagemConfirmar } from '../lib/mensagens';
import { abreviaDia, dataLocal, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto, Status } from '../types';
import { useConfig } from './contexto';

const NOMES: Record<Status, string> = {
  marcado: 'Marcado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
  faltou: 'Faltou',
};

interface Props {
  agendamento: AgendamentoCompleto;
  onEditar: () => void;
  onMudou: () => void;
  onFechar: () => void;
}

export default function DetalhesAgendamento({ agendamento: a, onEditar, onMudou, onFechar }: Props) {
  const { config } = useConfig();
  const [erro, setErro] = useState<string | null>(null);
  const [cancelado, setCancelado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const dados = { nome: a.cliente.nome, inicio: a.inicio, fuso: config.fuso };

  // grava antes e só depois oferece o WhatsApp: o Safari não abre janela depois de esperar a rede
  async function confirmarNoWhatsApp() {
    if (confirmando) return;
    setErro(null);
    setConfirmando(true);
    try {
      await mudarStatus(supabase, a.id, 'confirmado');
      setConfirmado(true);
    } catch {
      setErro('Não foi possível atualizar. Confira a internet e tente de novo.');
    } finally {
      setConfirmando(false);
    }
  }
  const inicio = new Date(a.inicio);
  const data = dataLocal(inicio, config.fuso);

  async function mudar(status: Status) {
    setErro(null);
    try {
      await mudarStatus(supabase, a.id, status);
      if (status === 'cancelado') {
        setCancelado(true); // fica aberto para o dono avisar o cliente
        return;
      }
      onMudou();
    } catch {
      setErro('Não foi possível atualizar. Confira a internet e tente de novo.');
    }
  }

  if (confirmado)
    return (
      <section role="dialog" aria-label="Agendamento" className="painel">
        <h3>{a.cliente.nome}</h3>
        <p className="sutil">Situação: {NOMES.confirmado}</p>
        <div className="linha">
          <a className="botao" href={waLink(a.cliente.telefone, mensagemConfirmar(dados))} target="_blank" rel="noreferrer">
            Abrir WhatsApp
          </a>
          <button type="button" onClick={onMudou}>
            Fechar
          </button>
        </div>
      </section>
    );

  if (cancelado) {
    const mensagem = mensagemCancelar(dados, linkAgendamento());
    return (
      <section role="dialog" aria-label="Agendamento" className="painel">
        <h3>{a.cliente.nome}</h3>
        <p>
          {abreviaDia(data)} {data.slice(8, 10)}/{data.slice(5, 7)} às {horaLocal(inicio, config.fuso)}
        </p>
        <p className="sutil">Situação: {NOMES.cancelado}</p>
        <div className="linha">
          <a className="botao" href={waLink(a.cliente.telefone, mensagem)} target="_blank" rel="noreferrer">
            Avisar no WhatsApp
          </a>
          <button type="button" onClick={onMudou}>
            Fechar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section role="dialog" aria-label="Agendamento" className="painel">
      <h3>{a.cliente.nome}</h3>
      <p>
        {abreviaDia(data)} {data.slice(8, 10)}/{data.slice(5, 7)} às {horaLocal(inicio, config.fuso)} · {a.servico?.nome ?? 'sem serviço'}
      </p>
      <p className="sutil">Situação: {NOMES[a.status]}</p>
      {a.observacao && <p>{a.observacao}</p>}
      {erro && <p role="alert">{erro}</p>}
      <div className="linha">
        {a.status === 'marcado' && (
          <button type="button" className="primario" disabled={confirmando} onClick={confirmarNoWhatsApp}>
            Confirmar no WhatsApp
          </button>
        )}
        <button type="button" onClick={() => mudar('concluido')}>
          Concluir
        </button>
        <button type="button" onClick={() => mudar('faltou')}>
          Faltou
        </button>
        <button type="button" onClick={onEditar}>
          Editar
        </button>
        <a className="botao" href={waLink(a.cliente.telefone, '')} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
      <div className="linha">
        <button type="button" className="perigo" onClick={() => mudar('cancelado')}>
          Cancelar agendamento
        </button>
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </section>
  );
}
