import { useState } from 'react';
import { infoDia, ordenarIntervalos, rotuloDosDias, validarExpediente } from '../../lib/expediente';
import type { DiaSemana, Expediente, Intervalo } from '../../types';
import { useConfig } from '../contexto';
import { IconeX } from '../icones';
import FormPainel, { useSalvarConfig } from './FormPainel';

/** "segunda, terça e quarta" */
const juntar = (nomes: string[]) => (nomes.length < 2 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);

/**
 * Ajustes → Expediente: os intervalos de um dia (tocado na faixa) ou de um grupo de dias com o mesmo
 * horário (tocado na linha). Salvar grava a mesma lista em todos os dias do painel.
 */
export default function PainelExpediente({ dias, onSalvo }: { dias: DiaSemana[]; onSalvo: () => void }) {
  const { config } = useConfig();
  const { erro, setErro, salvando, salvar } = useSalvarConfig(onSalvo);
  const [lista, setLista] = useState<Intervalo[]>(config.expediente[dias[0]]);

  const umDia = dias.length === 1;
  const titulo = umDia ? infoDia(dias[0]).nome : rotuloDosDias(dias);

  function mudar(i: number, campo: keyof Intervalo, valor: string) {
    setLista((l) => l.map((iv, j) => (j === i ? { ...iv, [campo]: valor } : iv)));
  }

  function salvarDias() {
    const ordenada = ordenarIntervalos(lista);
    const expediente = { ...config.expediente } as Expediente;
    for (const d of dias) expediente[d] = ordenada;
    const problema = validarExpediente(expediente);
    if (problema) return setErro(problema);
    void salvar({ expediente });
  }

  return (
    <FormPainel
      titulo={titulo}
      resumo={umDia ? undefined : `O mesmo horário para ${juntar(dias.map((d) => infoDia(d).extenso))}.`}
      erro={erro}
      salvando={salvando}
      onSalvar={salvarDias}
    >
      {lista.length === 0 && <p className="sutil">Fechado</p>}
      <ul className="intervalos">
        {lista.map((iv, i) => (
          <li key={i} className="intervalo">
            <input type="time" aria-label={`Início ${i + 1}`} value={iv.inicio} onChange={(e) => mudar(i, 'inicio', e.target.value)} />
            <span className="sutil">até</span>
            <input type="time" aria-label={`Fim ${i + 1}`} value={iv.fim} onChange={(e) => mudar(i, 'fim', e.target.value)} />
            <button
              type="button"
              className="icone-redondo"
              aria-label={`Remover intervalo ${i + 1}`}
              onClick={() => setLista((l) => l.filter((_, j) => j !== i))}
            >
              <IconeX tamanho={14} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="texto" aria-label="Adicionar intervalo" onClick={() => setLista((l) => [...l, { inicio: '', fim: '' }])}>
        + intervalo
      </button>
    </FormPainel>
  );
}
