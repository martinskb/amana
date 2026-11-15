import { useState } from 'react';
import { supabase } from '../data/supabase';
import { backupIsStale, exportBackup, salvarBackup, type BackupFile } from '../lib/backup';
import { useConfig } from './contexto';

/**
 * Backup em dois toques: o 1º busca os dados; o 2º abre o menu de compartilhar na hora.
 * O Safari só abre esse menu logo depois de um toque, e a busca pode demorar.
 */
export function BotaoBackup({ onSalvo }: { onSalvo?: () => void }) {
  const { recarregar } = useConfig();
  const [arquivo, setArquivo] = useState<BackupFile | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setErro(null);
    setOcupado(true);
    try {
      setArquivo(await exportBackup(supabase));
    } catch {
      setErro('Não foi possível gerar o backup. Confira a internet.');
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (!arquivo) return;
    setErro(null);
    try {
      if (await salvarBackup(arquivo, supabase)) {
        setArquivo(null);
        onSalvo?.();
        await recarregar();
      }
    } catch {
      setErro('Não foi possível salvar o arquivo. Toque em "Salvar arquivo" de novo.');
    }
  }

  return (
    <>
      {arquivo ? (
        <button type="button" className="contorno" onClick={salvar}>
          Salvar arquivo
        </button>
      ) : (
        <button type="button" onClick={gerar} disabled={ocupado}>
          {ocupado ? 'Preparando…' : 'Baixar backup'}
        </button>
      )}
      {erro && <p role="alert">{erro}</p>}
    </>
  );
}

export default function BackupBanner() {
  const { config } = useConfig();
  const [feito, setFeito] = useState(false);
  if (feito || !backupIsStale(config.ultimo_backup, new Date())) return null;
  return (
    <aside className="aviso-backup">
      <p>{config.ultimo_backup ? 'Seu último backup tem mais de 7 dias.' : 'Você ainda não fez nenhum backup.'}</p>
      <BotaoBackup onSalvo={() => setFeito(true)} />
    </aside>
  );
}
