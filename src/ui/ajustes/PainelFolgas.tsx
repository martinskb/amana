import { useState } from 'react';
import { saveConfig } from '../../data/configuracoes';
import { salvarFolgasPessoa } from '../../data/pessoas';
import { supabase } from '../../data/supabase';
import { ativas, nomeDaPessoa, variasPessoas } from '../../lib/pessoas';
import { useConfig } from '../contexto';
import { IconeX } from '../icones';
import FormPainel, { ERRO_SALVAR } from './FormPainel';

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const ddmmaaaa = (data: string) => data.split('-').reverse().join('/');

/** A linha das folgas: "nenhuma", ou "3 folgas · próxima 20/12" (a próxima a partir de hoje, se houver). */
export function resumoFolgas(folgas: string[], hoje: string): string {
  if (folgas.length === 0) return 'nenhuma';
  const total = folgas.length === 1 ? '1 folga' : `${folgas.length} folgas`;
  const proxima = [...folgas].sort().find((f) => f >= hoje);
  return proxima ? `${total} · próxima ${ddmm(proxima)}` : total;
}

/** Uma folga e de quem é: `quem` null é o negócio todo. */
interface Folga {
  data: string;
  quem: string | null;
}

const mesmaLista = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();

/**
 * Ajustes → Folgas: a lista, adicionar e remover; "Salvar" grava só as folgas.
 * Com duas ou mais pessoas ativas, cada folga diz de quem é (o negócio todo ou uma pessoa).
 */
export default function PainelFolgas({ onSalvo }: { onSalvo: () => void }) {
  const { config, pessoas, recarregar, recarregarPessoas } = useConfig();
  const varias = variasPessoas(pessoas);
  const quem = ativas(pessoas);
  const [folgas, setFolgas] = useState<Folga[]>(() =>
    [
      ...config.folgas.map((data) => ({ data, quem: null })),
      ...(varias ? quem.flatMap((p) => p.folgas.map((data) => ({ data, quem: p.id }))) : []),
    ].sort((a, b) => a.data.localeCompare(b.data)),
  );
  const [nova, setNova] = useState('');
  const [novaDeQuem, setNovaDeQuem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const nomeDeQuem = (id: string | null) => {
    const p = id && quem.find((x) => x.id === id);
    return p ? nomeDaPessoa(p, pessoas) : 'o negócio todo';
  };

  function adicionar() {
    if (nova && !folgas.some((f) => f.data === nova && f.quem === novaDeQuem)) {
      setFolgas([...folgas, { data: nova, quem: novaDeQuem }].sort((a, b) => a.data.localeCompare(b.data)));
    }
    setNova('');
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await saveConfig(supabase, { folgas: folgas.filter((f) => f.quem === null).map((f) => f.data) });
      if (varias) {
        for (const p of quem) {
          const dela = folgas.filter((f) => f.quem === p.id).map((f) => f.data);
          if (!mesmaLista(dela, p.folgas)) await salvarFolgasPessoa(supabase, p.id, dela);
        }
      }
    } catch {
      setErro(ERRO_SALVAR);
      setSalvando(false);
      return;
    }
    await Promise.all([recarregar(), varias ? recarregarPessoas() : undefined]);
    setSalvando(false);
    onSalvo();
  }

  return (
    <FormPainel titulo="Folgas" resumo="Dias em que a agenda e o link ficam fechados." erro={erro} salvando={salvando} onSalvar={() => void salvar()}>
      {folgas.length === 0 && <p className="sutil">Nenhuma folga.</p>}
      <ul className="linhas-painel">
        {folgas.map((f) => (
          <li key={`${f.data}:${f.quem ?? ''}`}>
            <span>{varias ? `${ddmmaaaa(f.data)} · ${nomeDeQuem(f.quem)}` : ddmmaaaa(f.data)}</span>
            <button
              type="button"
              className="icone-redondo"
              aria-label={varias ? `Remover folga ${f.data} de ${nomeDeQuem(f.quem)}` : `Remover folga ${f.data}`}
              onClick={() => setFolgas(folgas.filter((x) => x !== f))}
            >
              <IconeX tamanho={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className={varias ? "linha nova-folga com-quem" : "linha nova-folga"}>
        {varias && (
          <label className="campo-linha">
            De quem
            <select value={novaDeQuem ?? ''} onChange={(e) => setNovaDeQuem(e.target.value || null)}>
              <option value="">o negócio todo</option>
              {quem.map((p) => (
                <option key={p.id} value={p.id}>
                  {nomeDaPessoa(p, pessoas)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="campo-linha">
          Nova folga
          <input type="date" value={nova} onChange={(e) => setNova(e.target.value)} />
        </label>
        <button type="button" className="texto" onClick={adicionar}>
          Adicionar folga
        </button>
      </div>
    </FormPainel>
  );
}
