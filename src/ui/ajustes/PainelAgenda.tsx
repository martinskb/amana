import { useState } from 'react';
import { useConfig } from '../contexto';
import FormPainel, { useSalvarConfig } from './FormPainel';

/** Ajustes → Agenda: a duração de cada horário ou quantos dias o link mostra, um campo por painel. */
export default function PainelAgenda({ campo, onSalvo }: { campo: 'passo' | 'dias'; onSalvo: () => void }) {
  const { config } = useConfig();
  const { erro, setErro, salvando, salvar } = useSalvarConfig(onSalvo);
  const passo = campo === 'passo';
  const [valor, setValor] = useState(String(passo ? config.passo_min : config.dias_abertos));

  function salvarCampo() {
    const n = Number(valor);
    if (passo) {
      if (!Number.isInteger(n) || n < 5 || n > 240) return setErro('A duração de cada horário precisa ficar entre 5 e 240 minutos.');
      return void salvar({ passo_min: n });
    }
    if (!Number.isInteger(n) || n < 1 || n > 60) return setErro('Os dias do link precisam ficar entre 1 e 60.');
    void salvar({ dias_abertos: n });
  }

  return (
    <FormPainel
      titulo={passo ? 'Duração de cada horário' : 'Quantos dias o link mostra'}
      resumo={passo ? 'O espaço entre um horário e o próximo, na agenda e no link.' : 'Até quantos dias à frente o cliente pode marcar.'}
      erro={erro}
      salvando={salvando}
      onSalvar={salvarCampo}
    >
      <div className="com-unidade">
        <label className="campo-linha">
          <span className="so-leitor">{passo ? 'Duração de cada horário (min)' : 'Quantos dias o link mostra'}</span>
          <input type="number" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <span className="unidade" aria-hidden="true">
          {passo ? 'min' : 'dias'}
        </span>
      </div>
    </FormPainel>
  );
}
