import { useEffect, useState, type FormEvent } from 'react';
import { criarAgendamento, editarAgendamento } from '../data/agendamentos';
import { findOrCreateCliente, listClientes } from '../data/clientes';
import { ConflitoDeHorarioError } from '../data/erros';
import { supabase } from '../data/supabase';
import { dataLocal, horaLocal, instanteLocal } from '../lib/slots';
import { mensagemConfirmar } from '../lib/mensagens';
import { ativas, fazServico, livresPara, nomeDaPessoa, nomeNaMensagem, variasPessoas } from '../lib/pessoas';
import { MSG_WHATSAPP_INVALIDO, normalizePhone, waLink } from '../lib/whatsapp';
import type { Agendamento, AgendamentoCompleto, Cliente, Pessoa, Servico } from '../types';
import { useConfig } from './contexto';

interface Props {
  inicial?: { data: string; hora: string };
  /** Quando presente, o formulário edita este agendamento. */
  agendamento?: AgendamentoCompleto;
  servicos: Servico[];
  /** Os agendamentos já carregados (com pessoa), para saber quem está livre no horário. */
  agendamentos?: readonly Agendamento[];
  /** A pessoa do filtro da agenda: vem escolhida se estiver livre. */
  filtro?: string | null;
  onSalvo: () => void;
  onFechar: () => void;
}

export default function NovoAgendamento({ inicial, agendamento, servicos, agendamentos = [], filtro = null, onSalvo, onFechar }: Props) {
  const { config, pessoas } = useConfig();
  const varias = variasPessoas(pessoas);
  const editando = Boolean(agendamento);
  const [data, setData] = useState(agendamento ? dataLocal(new Date(agendamento.inicio), config.fuso) : inicial?.data ?? '');
  const [hora, setHora] = useState(agendamento ? horaLocal(new Date(agendamento.inicio), config.fuso) : inicial?.hora ?? '');
  const opcoes = servicos.filter((s) => s.ativo || s.id === agendamento?.servico_id);
  // '' = sem serviço: ocupa um horário (passo_min)
  const [servicoId, setServicoId] = useState(agendamento?.servico_id ?? '');
  const [observacao, setObservacao] = useState(agendamento?.observacao ?? '');
  // a pessoa pedida (a do agendamento, a do filtro ou a escolhida no campo); null = a primeira livre
  const [pessoaId, setPessoaId] = useState<string | null>(agendamento?.pessoa_id ?? filtro);

  // "Com quem": quem faz o serviço e está livre no horário (sem horário ainda, quem faz o serviço)
  const servicoEscolhido = servicos.find((s) => s.id === servicoId) ?? null;
  const servicosAtivos = servicos.filter((s) => s.ativo).length;
  let quemPode: Pessoa[] = [];
  if (varias) {
    if (data && hora) {
      const ini = instanteLocal(data, hora, config.fuso);
      quemPode = livresPara({
        pessoas,
        servicoId: servicoId || null,
        servicosAtivos,
        inicio: ini,
        fim: new Date(ini.getTime() + (servicoEscolhido?.duracao_min ?? config.passo_min) * 60_000),
        agendamentos,
        ignorar: agendamento?.id,
      });
    } else {
      quemPode = ativas(pessoas).filter((p) => fazServico(p, servicoId || null, servicosAtivos));
    }
  }
  // nunca troca escondido: a escolhida é a que aparece no campo
  const escolhida = quemPode.find((p) => p.id === pessoaId) ?? quemPode[0] ?? null;
  const pedida = pessoaId ? pessoas.find((p) => p.id === pessoaId) : undefined;

  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // depois de marcar na mão: painel para mandar a confirmação (spec v3, seção 4)
  const [marcado, setMarcado] = useState<{ nome: string; telefone: string; inicio: string; pessoa: string | null } | null>(null);

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
    if (varias && !escolhida) return setErro('Ninguém livre que faça esse serviço nesse horário.');
    const comPessoa = varias && escolhida ? { pessoa_id: escolhida.id } : {};

    setSalvando(true);
    try {
      if (agendamento) {
        await editarAgendamento(supabase, agendamento.id, {
          servico_id: servico?.id ?? null,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          observacao: obs,
          ...comPessoa,
        });
      } else {
        let quem = cliente;
        if (!quem) {
          if (!termo.trim()) return setErro('Informe o nome do cliente.');
          const tel = normalizePhone(telefone);
          if (!tel) return setErro(MSG_WHATSAPP_INVALIDO);
          quem = await findOrCreateCliente(supabase, termo.trim(), tel);
        }
        await criarAgendamento(supabase, {
          cliente_id: quem.id,
          servico_id: servico?.id ?? null,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          status: 'marcado',
          observacao: obs,
          origem: 'dono',
          ...comPessoa,
        });
        setMarcado({ nome: quem.nome, telefone: quem.telefone, inicio: inicio.toISOString(), pessoa: nomeNaMensagem(escolhida?.id, pessoas) });
        return;
      }
      onSalvo();
    } catch (e) {
      setErro(e instanceof ConflitoDeHorarioError ? 'Esse horário já está ocupado.' : 'Não foi possível salvar. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (marcado)
    return (
      <div className="painel-conteudo">
        <h3 className="painel-titulo">Agendamento marcado</h3>
        <p className="painel-resumo">{marcado.nome}</p>
        <div className="botoes-painel">
          <a
            className="botao larga"
            href={waLink(marcado.telefone, mensagemConfirmar({ nome: marcado.nome, inicio: marcado.inicio, fuso: config.fuso, pessoa: marcado.pessoa }))}
            target="_blank"
            rel="noreferrer"
          >
            Mandar confirmação no WhatsApp
          </a>
          <button type="button" className="texto" onClick={onSalvo}>
            Fechar
          </button>
        </div>
      </div>
    );

  return (
    <div className="painel-conteudo">
      <h3 className="painel-titulo">{agendamento ? agendamento.cliente.nome : 'Novo agendamento'}</h3>
      {agendamento && <p className="painel-resumo">Editar agendamento</p>}
      <form onSubmit={salvar}>
        {agendamento ? null : cliente ? (
          <p className="cliente-escolhido">
            <strong>{cliente.nome}</strong>{' '}
            <button type="button" className="texto" onClick={() => setCliente(null)}>
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
        {varias &&
          (escolhida ? (
            <>
              <label>
                Com quem
                <select value={escolhida.id} onChange={(e) => setPessoaId(e.target.value)}>
                  {quemPode.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nomeDaPessoa(p, pessoas)}
                    </option>
                  ))}
                </select>
              </label>
              {pedida && pedida.id !== escolhida.id && (
                <p className="sutil">
                  {nomeDaPessoa(pedida, pessoas)} não faz esse serviço ou não está livre nesse horário: vai com {nomeDaPessoa(escolhida, pessoas)}.
                </p>
              )}
            </>
          ) : (
            <p className="sutil">Ninguém livre que faça esse serviço nesse horário.</p>
          ))}
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
        <div className="botoes-painel">
          <button type="submit" className="primario larga" disabled={salvando}>
            Salvar
          </button>
          <button type="button" className="texto" onClick={onFechar}>
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
