import { useEffect, useState, type FormEvent } from 'react';
import { criarAgendamento, editarAgendamento } from '../data/agendamentos';
import { findOrCreateCliente, listClientes } from '../data/clientes';
import { ConflitoDeHorarioError } from '../data/erros';
import { supabase } from '../data/supabase';
import { dataLocal, horaLocal, instanteLocal } from '../lib/slots';
import { MSG_WHATSAPP_INVALIDO, normalizePhone } from '../lib/whatsapp';
import type { AgendamentoCompleto, Cliente, Servico } from '../types';
import { useConfig } from './contexto';

interface Props {
  inicial?: { data: string; hora: string };
  /** Quando presente, o formulário edita este agendamento. */
  agendamento?: AgendamentoCompleto;
  servicos: Servico[];
  onSalvo: () => void;
  onFechar: () => void;
}

export default function NovoAgendamento({ inicial, agendamento, servicos, onSalvo, onFechar }: Props) {
  const { config } = useConfig();
  const editando = Boolean(agendamento);
  const [data, setData] = useState(agendamento ? dataLocal(new Date(agendamento.inicio), config.fuso) : inicial?.data ?? '');
  const [hora, setHora] = useState(agendamento ? horaLocal(new Date(agendamento.inicio), config.fuso) : inicial?.hora ?? '');
  const opcoes = servicos.filter((s) => s.ativo || s.id === agendamento?.servico_id);
  // '' = sem serviço: ocupa um horário (passo_min)
  const [servicoId, setServicoId] = useState(agendamento?.servico_id ?? '');
  const [observacao, setObservacao] = useState(agendamento?.observacao ?? '');

  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (editando || cliente || termo.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    const t = setTimeout(() => {
      listClientes(supabase, termo.trim()).then(setSugestoes, () => setSugestoes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [termo, cliente, editando]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const servico = servicos.find((s) => s.id === servicoId) ?? null;
    if (!data || !hora) return setErro('Escolha a data e a hora.');
    const inicio = instanteLocal(data, hora, config.fuso);
    const fim = new Date(inicio.getTime() + (servico?.duracao_min ?? config.passo_min) * 60_000);
    const obs = observacao.trim() || null;

    setSalvando(true);
    try {
      if (agendamento) {
        await editarAgendamento(supabase, agendamento.id, {
          servico_id: servico?.id ?? null,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          observacao: obs,
        });
      } else {
        let clienteId = cliente?.id;
        if (!clienteId) {
          if (!termo.trim()) return setErro('Informe o nome do cliente.');
          const tel = normalizePhone(telefone);
          if (!tel) return setErro(MSG_WHATSAPP_INVALIDO);
          clienteId = (await findOrCreateCliente(supabase, termo.trim(), tel)).id;
        }
        await criarAgendamento(supabase, {
          cliente_id: clienteId,
          servico_id: servico?.id ?? null,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          status: 'marcado',
          observacao: obs,
          origem: 'dono',
        });
      }
      onSalvo();
    } catch (e) {
      setErro(e instanceof ConflitoDeHorarioError ? 'Esse horário já está ocupado.' : 'Não foi possível salvar. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section role="dialog" aria-label={editando ? 'Editar agendamento' : 'Novo agendamento'} className="painel">
      <h3>{editando ? 'Editar agendamento' : 'Novo agendamento'}</h3>
      <form onSubmit={salvar}>
        {agendamento ? (
          <p>
            <strong>{agendamento.cliente.nome}</strong>
          </p>
        ) : cliente ? (
          <p>
            <strong>{cliente.nome}</strong>{' '}
            <button type="button" onClick={() => setCliente(null)}>
              trocar
            </button>
          </p>
        ) : (
          <>
            <label>
              Cliente
              <input value={termo} onChange={(e) => setTermo(e.target.value)} autoComplete="off" placeholder="Nome" />
            </label>
            {sugestoes.length > 0 && (
              <ul className="sugestoes">
                {sugestoes.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setCliente(c)}>
                      {c.nome} <span className="sutil">{c.telefone.slice(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label>
              Telefone
              <input type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 98765-4321" />
            </label>
          </>
        )}

        <label>
          Serviço
          <select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
            <option value="">Sem serviço</option>
            {opcoes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} ({s.duracao_min} min)
              </option>
            ))}
          </select>
        </label>
        <div className="linha">
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Hora
            <input type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
        <label>
          Observação
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </label>
        {erro && <p role="alert">{erro}</p>}
        <div className="linha">
          <button type="submit" className="primario" disabled={salvando}>
            Salvar
          </button>
          <button type="button" onClick={onFechar}>
            Voltar
          </button>
        </div>
      </form>
    </section>
  );
}
