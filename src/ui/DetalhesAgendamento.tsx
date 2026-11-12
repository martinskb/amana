import { useState } from 'react';
import { mudarStatus } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { linkAgendamento } from '../lib/link';
import { mensagemCancelar, mensagemConfirmar } from '../lib/mensagens';
import { abreviaDia, dataLocal, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto, Status } from '../types';
import { useConfig } from './contexto';
import { IconeWhatsApp } from './icones';

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
  const [perguntandoCancelar, setPerguntandoCancelar] = useState(false);
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
      <div className="painel-conteudo">
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
      </div>
    );

  if (cancelado) {
    const mensagem = mensagemCancelar(dados, linkAgendamento());
    return (
      <div className="painel-conteudo">
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
      </div>
    );
  }

  return (
    <div className="painel-conteudo">
      <h3>{a.cliente.nome}</h3>
      <p>
        {abreviaDia(data)} {data.slice(8, 10)}/{data.slice(5, 7)} às {horaLocal(inicio, config.fuso)} · {a.servico?.nome ?? 'sem serviço'}
      </p>
      <p className="sutil">Situação: {NOMES[a.status]}</p>
      {a.observacao && <p>{a.observacao}</p>}
      {erro && <p role="alert">{erro}</p>}
      <div className="acoes">
        {a.status === 'marcado' && (
          <button type="button" className="primario larga" disabled={confirmando} onClick={confirmarNoWhatsApp}>
            <IconeWhatsApp /> Confirmar no WhatsApp
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
          <IconeWhatsApp /> WhatsApp
        </a>
      </div>
      {perguntandoCancelar ? (
        <div className="confirmar-cancelar" role="group" aria-label="Confirmar cancelamento">
          <p>Cancelar o horário de {a.cliente.nome}?</p>
          <div className="linha">
            <button type="button" className="perigo-cheio" onClick={() => mudar('cancelado')}>
              Sim, cancelar
            </button>
            <button type="button" onClick={() => setPerguntandoCancelar(false)}>
              Não
            </button>
          </div>
        </div>
      ) : (
        <div className="linha">
          <button type="button" className="perigo" onClick={() => setPerguntandoCancelar(true)}>
            Cancelar agendamento
          </button>
          <button type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
