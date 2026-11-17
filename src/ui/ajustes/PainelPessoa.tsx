import { useEffect, useState } from 'react';
import { listAgendamentosFuturosDaPessoa } from '../../data/agendamentos';
import { apagarPessoa, criarPessoa, desativarPessoa, pessoaTemAgendamentos, reativarPessoa, salvarPessoa } from '../../data/pessoas';
import { supabase } from '../../data/supabase';
import { ativas, nomeDaPessoa } from '../../lib/pessoas';
import { abreviaDia, dataLocal, horaLocal } from '../../lib/slots';
import type { AgendamentoCompleto, Pessoa, Servico } from '../../types';
import { useConfig } from '../contexto';
import FormPainel, { ERRO_SALVAR } from './FormPainel';

const MAX_NOME = 40;

/** "ter 17/11 10:00 · João" */
function linhaCliente(a: AgendamentoCompleto, fuso: string): string {
  const instante = new Date(a.inicio);
  const data = dataLocal(instante, fuso);
  return `${abreviaDia(data)} ${data.slice(8, 10)}/${data.slice(5, 7)} ${horaLocal(instante, fuso)} · ${a.cliente.nome}`;
}

function ListaClientes({ itens, fuso }: { itens: AgendamentoCompleto[]; fuso: string }) {
  return (
    <ul className="lista-clientes-pessoa">
      {itens.map((a) => (
        <li key={a.id}>{linhaCliente(a, fuso)}</li>
      ))}
    </ul>
  );
}

/**
 * Ajustes → Pessoas: nome (opcional) e serviços de uma pessoa, ou uma pessoa nova (sem `pessoa`,
 * já com todos os serviços ativos). Embaixo, Desativar; ou Apagar, se ela nunca teve agendamento.
 * `onSalvo` recebe a chave da linha onde o "salvo! ✓" aparece.
 */
export default function PainelPessoa({
  pessoa,
  servicos,
  onSalvo,
}: {
  pessoa?: Pessoa;
  servicos: Servico[];
  onSalvo: (chave: string) => void;
}) {
  const { config, pessoas, recarregarPessoas } = useConfig();
  const servicosAtivos = servicos.filter((s) => s.ativo);
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [marcados, setMarcados] = useState<string[]>(() => (pessoa ? pessoa.servicos : servicosAtivos.map((s) => s.id)));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [futuros, setFuturos] = useState<AgendamentoCompleto[]>([]);
  const [temAgendamentos, setTemAgendamentos] = useState<boolean | null>(null);
  const [problema, setProblema] = useState<'ultima' | 'clientes_futuros' | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  const pessoaId = pessoa?.id;
  useEffect(() => {
    if (!pessoaId) return;
    let ativo = true;
    listAgendamentosFuturosDaPessoa(supabase, pessoaId).then(
      (l) => ativo && setFuturos(l),
      () => {},
    );
    pessoaTemAgendamentos(supabase, pessoaId).then(
      (t) => ativo && setTemAgendamentos(t),
      () => ativo && setTemAgendamentos(true), // na dúvida, só desativar
    );
    return () => {
      ativo = false;
    };
  }, [pessoaId]);

  const titulo = pessoa ? nomeDaPessoa(pessoa, pessoas) : 'Nova pessoa';
  const placeholder = pessoa ? nomeDaPessoa({ ...pessoa, nome: null }, pessoas) : `Pessoa ${ativas(pessoas).length + 1}`;
  const idsAtivos = new Set(servicosAtivos.map((s) => s.id));
  const tirados = (pessoa?.servicos ?? []).filter((id) => idsAtivos.has(id) && !marcados.includes(id));
  const afetados = futuros.filter((a) => a.servico_id !== null && tirados.includes(a.servico_id));
  const ultimaAtiva = !!pessoa?.ativo && ativas(pessoas).length <= 1;

  function alternar(id: string) {
    setMarcados((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  async function salvar() {
    const limpo = nome.trim();
    if (limpo.length > MAX_NOME) return setErro(`O nome pode ter até ${MAX_NOME} letras.`);
    setErro(null);
    setProblema(null);
    setSalvando(true);
    // os serviços desativados que ela já fazia continuam com ela
    const dados = {
      nome: limpo || null,
      servicos: [
        ...servicosAtivos.filter((s) => marcados.includes(s.id)).map((s) => s.id),
        ...(pessoa?.servicos ?? []).filter((id) => !idsAtivos.has(id)),
      ],
    };
    let id: string;
    try {
      if (pessoa) {
        await salvarPessoa(supabase, pessoa.id, dados);
        id = pessoa.id;
      } else {
        id = (await criarPessoa(supabase, dados)).id;
      }
    } catch {
      setErro(ERRO_SALVAR);
      setSalvando(false);
      return;
    }
    await recarregarPessoas();
    setSalvando(false);
    onSalvo(`pessoa:${id}`);
  }

  async function desativar() {
    if (!pessoa) return;
    setErro(null);
    setProblema(null);
    setSalvando(true);
    try {
      const r = await desativarPessoa(supabase, pessoa.id);
      if (r.ok) {
        await recarregarPessoas();
        setSalvando(false);
        onSalvo('desativadas');
        return;
      }
      if (r.erro === 'clientes_futuros') setFuturos(await listAgendamentosFuturosDaPessoa(supabase, pessoa.id).catch(() => futuros));
      setProblema(r.erro);
    } catch {
      setErro(ERRO_SALVAR);
    }
    setSalvando(false);
  }

  async function apagar() {
    if (!pessoa) return;
    setErro(null);
    if (ultimaAtiva) return setProblema('ultima');
    setSalvando(true);
    try {
      await apagarPessoa(supabase, pessoa.id);
    } catch {
      setErro(ERRO_SALVAR);
      setSalvando(false);
      return;
    }
    await recarregarPessoas();
    setSalvando(false);
    onSalvo('pessoas');
  }

  return (
    <FormPainel titulo={titulo} erro={erro} salvando={salvando} onSalvar={() => void salvar()}>
      <label className="campo-linha">
        Nome (opcional)
        <input value={nome} placeholder={placeholder} autoComplete="off" onChange={(e) => setNome(e.target.value)} />
      </label>

      {servicosAtivos.length > 0 && (
        <fieldset className="servicos-pessoa">
          <legend>Serviços que faz</legend>
          {servicosAtivos.map((s) => (
            <label key={s.id} className="marca-servico">
              <input type="checkbox" checked={marcados.includes(s.id)} onChange={() => alternar(s.id)} />
              {s.nome}
            </label>
          ))}
        </fieldset>
      )}

      {afetados.length > 0 && (
        <div className="aviso-pessoa">
          <p>Estes clientes continuam marcados com ela; troque no detalhe se precisar:</p>
          <ListaClientes itens={afetados} fuso={config.fuso} />
        </div>
      )}

      {problema && (
        <div role="alert" className="aviso-pessoa">
          {problema === 'ultima' ? (
            <p>É a única pessoa ativa. Adicione outra pessoa antes de tirar esta.</p>
          ) : (
            <>
              <p>Ela tem clientes marcados: passe cada um para outra pessoa no detalhe do agendamento e desative depois.</p>
              <ListaClientes itens={futuros} fuso={config.fuso} />
            </>
          )}
        </div>
      )}

      {pessoa && temAgendamentos !== null && (
        <div className="acoes-pessoa">
          {temAgendamentos ? (
            <button type="button" className="texto" disabled={salvando} onClick={() => void desativar()}>
              Desativar
            </button>
          ) : confirmarApagar ? (
            <>
              <p className="sutil">Apagar {titulo}? Não dá para desfazer.</p>
              <button type="button" className="texto perigo" disabled={salvando} onClick={() => void apagar()}>
                Apagar de vez
              </button>
            </>
          ) : (
            <button type="button" className="texto" onClick={() => setConfirmarApagar(true)}>
              Apagar
            </button>
          )}
        </div>
      )}
    </FormPainel>
  );
}

/** Ajustes → Pessoas → desativadas (N): a lista, com Reativar em cada uma. */
export function PainelDesativadas({ onSalvo }: { onSalvo: (chave: string) => void }) {
  const { pessoas, recarregarPessoas } = useConfig();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const desativadas = pessoas.filter((p) => !p.ativo);

  async function reativar(p: Pessoa) {
    setErro(null);
    setOcupado(true);
    try {
      await reativarPessoa(supabase, p.id);
    } catch {
      setErro(ERRO_SALVAR);
      setOcupado(false);
      return;
    }
    await recarregarPessoas();
    setOcupado(false);
    onSalvo(`pessoa:${p.id}`);
  }

  return (
    <div className="painel-conteudo">
      <h3 className="painel-titulo">Desativadas</h3>
      <p className="painel-resumo">Não aparecem na agenda nem no link. Os clientes antigos continuam com elas.</p>
      <ul className="linhas-painel">
        {desativadas.map((p) => {
          const n = nomeDaPessoa(p, pessoas);
          return (
            <li key={p.id}>
              <span>{n}</span>
              <button type="button" className="texto" aria-label={`Reativar ${n}`} disabled={ocupado} onClick={() => void reativar(p)}>
                Reativar
              </button>
            </li>
          );
        })}
      </ul>
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
