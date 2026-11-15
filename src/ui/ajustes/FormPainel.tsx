import { useState, type ReactNode } from 'react';
import { saveConfig } from '../../data/configuracoes';
import { supabase } from '../../data/supabase';
import type { Config } from '../../types';
import { useConfig } from '../contexto';

export const ERRO_SALVAR = 'Não foi possível salvar. Confira a internet e tente de novo.';

/**
 * Salva só os campos de um painel dos Ajustes. Deu certo: recarrega a config e chama `onSalvo` (o índice
 * fecha o painel e escreve "salvo! ✓"). Deu errado: o erro fica no painel e nada mais muda.
 */
export function useSalvarConfig(onSalvo: () => void) {
  const { recarregar } = useConfig();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(parcial: Partial<Config>) {
    setErro(null);
    setSalvando(true);
    try {
      await saveConfig(supabase, parcial);
    } catch {
      setErro(ERRO_SALVAR);
      setSalvando(false);
      return;
    }
    await recarregar();
    setSalvando(false);
    onSalvo();
  }

  return { erro, setErro, salvando, salvar };
}

interface Props {
  titulo: string;
  /** Uma linha curta abaixo do título. */
  resumo?: string;
  erro: string | null;
  salvando: boolean;
  onSalvar: () => void;
  children: ReactNode;
}

/** O miolo de um painel de edição dos Ajustes: título grande, campos, o erro e o único botão cheio, "Salvar". */
export default function FormPainel({ titulo, resumo, erro, salvando, onSalvar, children }: Props) {
  return (
    <form
      className="painel-conteudo"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar();
      }}
    >
      <h3 className="painel-titulo">{titulo}</h3>
      {resumo && <p className="painel-resumo">{resumo}</p>}
      {children}
      {erro && <p role="alert">{erro}</p>}
      <button type="submit" className="primario larga" disabled={salvando}>
        Salvar
      </button>
    </form>
  );
}
