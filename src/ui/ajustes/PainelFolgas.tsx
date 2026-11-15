import { useState } from 'react';
import { useConfig } from '../contexto';
import { IconeX } from '../icones';
import FormPainel, { useSalvarConfig } from './FormPainel';

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** A linha das folgas: "nenhuma", ou "3 folgas · próxima 20/12" (a próxima a partir de hoje, se houver). */
export function resumoFolgas(folgas: string[], hoje: string): string {
  if (folgas.length === 0) return 'nenhuma';
  const total = folgas.length === 1 ? '1 folga' : `${folgas.length} folgas`;
  const proxima = [...folgas].sort().find((f) => f >= hoje);
  return proxima ? `${total} · próxima ${ddmm(proxima)}` : total;
}

/** Ajustes → Folgas: a lista, adicionar e remover; "Salvar" grava só as folgas. */
export default function PainelFolgas({ onSalvo }: { onSalvo: () => void }) {
  const { config } = useConfig();
  const { erro, salvando, salvar } = useSalvarConfig(onSalvo);
  const [folgas, setFolgas] = useState<string[]>(config.folgas);
  const [nova, setNova] = useState('');

  function adicionar() {
    if (nova && !folgas.includes(nova)) setFolgas([...folgas, nova].sort());
    setNova('');
  }

  return (
    <FormPainel titulo="Folgas" resumo="Dias em que a agenda e o link ficam fechados." erro={erro} salvando={salvando} onSalvar={() => salvar({ folgas })}>
      {folgas.length === 0 && <p className="sutil">Nenhuma folga.</p>}
      <ul className="linhas-painel">
        {folgas.map((f) => (
          <li key={f}>
            <span>{f.split('-').reverse().join('/')}</span>
            <button type="button" className="icone-redondo" aria-label={`Remover folga ${f}`} onClick={() => setFolgas(folgas.filter((x) => x !== f))}>
              <IconeX tamanho={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="linha nova-folga">
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
