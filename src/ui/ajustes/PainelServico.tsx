import { useState } from 'react';
import { saveServico } from '../../data/servicos';
import { supabase } from '../../data/supabase';
import type { Servico } from '../../types';
import FormPainel from './FormPainel';

/**
 * Ajustes → Serviços: editar o nome e a duração de um serviço, ou criar um novo (sem `servico`, já ativo).
 * Os serviços não ficam na config: quem abriu recebe o serviço gravado em `onSalvo`.
 */
export default function PainelServico({ servico, onSalvo }: { servico?: Servico; onSalvo: (gravado: Servico) => void }) {
  const [nome, setNome] = useState(servico?.nome ?? '');
  const [duracao, setDuracao] = useState(String(servico?.duracao_min ?? 30));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const duracao_min = Number(duracao);
    if (!nome.trim() || !(duracao_min > 0)) return setErro('Informe o nome e a duração do serviço.');
    setErro(null);
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), duracao_min };
      const gravado = await saveServico(supabase, servico ? { ...servico, ...dados } : { ...dados, ativo: true });
      setSalvando(false);
      onSalvo(gravado);
    } catch {
      setErro('Não foi possível salvar o serviço.');
      setSalvando(false);
    }
  }

  return (
    <FormPainel titulo={servico ? servico.nome : 'Novo serviço'} erro={erro} salvando={salvando} onSalvar={() => void salvar()}>
      <label className="campo-linha">
        Nome do serviço
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="campo-linha">
        Duração (min)
        <input type="number" min={5} step={5} inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
      </label>
    </FormPainel>
  );
}
