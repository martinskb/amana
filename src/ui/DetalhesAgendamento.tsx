import { useState } from 'react';
import { mudarStatus } from '../data/agendamentos';
import { supabase } from '../data/supabase';
import { linkAgendamento } from '../lib/link';
import { mensagemCancelar, mensagemConfirmar } from '../lib/mensagens';
import { abreviaDia, dataLocal, horaLocal } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { AgendamentoCompleto, Status } from '../types';
import { useConfig } from './contexto';
import { IconeCheck, IconeFaltou, IconeLapis, IconeWhatsApp, IconeX } from './icones';
import { nomeDivergente } from '../lib/nomes';

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
  const quando = `${abreviaDia(data)} ${data.slice(8, 10)}/${data.slice(5, 7)} às ${horaLocal(inicio, config.fuso)}`;

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
        <h3 className="painel-titulo">{a.cliente.nome}</h3>
        <p className="painel-resumo">{quando}</p>
        <p className="sutil">Situação: {NOMES.confirmado}</p>
        <a className="botao larga" href={waLink(a.cliente.telefone, mensagemConfirmar(dados))} target="_blank" rel="noreferrer">
          <IconeWhatsApp /> Abrir WhatsApp
        </a>
        <button type="button" className="texto fechar-texto" onClick={onMudou}>
          Fechar
        </button>
      </div>
    );

  if (cancelado) {
    const mensagem = mensagemCancelar(dados, linkAgendamento());
    return (
      <div className="painel-conteudo">
        <h3 className="painel-titulo">{a.cliente.nome}</h3>
        <p className="painel-resumo">{quando}</p>
        <p className="sutil">Situação: {NOMES.cancelado}</p>
        <a className="botao larga" href={waLink(a.cliente.telefone, mensagem)} target="_blank" rel="noreferrer">
          <IconeWhatsApp /> Avisar no WhatsApp
        </a>
        <button type="button" className="texto fechar-texto" onClick={onMudou}>
          Fechar
        </button>
      </div>
    );
  }

  const minutos = Math.round((new Date(a.fim).getTime() - inicio.getTime()) / 60000);

  return (
    <div className="painel-conteudo">
      <h3 className="painel-titulo">{a.cliente.nome}</h3>
      <p className="painel-resumo">
        {quando} · {a.servico?.nome ?? 'sem serviço'}
        {minutos > 0 && ` · ${minutos} min`}
      </p>
      <p className="sutil">Situação: {NOMES[a.status]}</p>
      {a.observacao && <p>{a.observacao}</p>}
      {nomeDivergente(a.cliente.nome, a.nome_informado) && (
        <p role="note" className="aviso-nome">
          Pelo link, a pessoa digitou o nome "{nomeDivergente(a.cliente.nome, a.nome_informado)}", diferente do cadastro
          deste WhatsApp. Confirme com o cliente.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {a.status === 'marcado' && (
        <button type="button" className="primario larga" disabled={confirmando} onClick={confirmarNoWhatsApp}>
          <IconeWhatsApp /> Confirmar no WhatsApp
        </button>
      )}
      <ul className="acoes">
        <li>
          <button type="button" className="acao-linha" onClick={() => mudar('concluido')}>
            <IconeCheck /> Concluir
          </button>
        </li>
        <li>
          <button type="button" className="acao-linha" onClick={() => mudar('faltou')}>
            <IconeFaltou /> Faltou
          </button>
        </li>
        <li>
          <button type="button" className="acao-linha" onClick={onEditar}>
            <IconeLapis /> Editar
          </button>
        </li>
        <li>
          <a className="acao-linha" href={waLink(a.cliente.telefone, '')} target="_blank" rel="noreferrer">
            <IconeWhatsApp /> WhatsApp
          </a>
        </li>
      </ul>
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
        <>
          <button type="button" className="acao-linha perigo" onClick={() => setPerguntandoCancelar(true)}>
            <IconeX /> Cancelar agendamento
          </button>
          <button type="button" className="texto fechar-texto" onClick={onFechar}>
            Fechar
          </button>
        </>
      )}
    </div>
  );
}
