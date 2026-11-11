import { useState } from 'react';
import { supabase } from '../data/supabase';
import { backupIsStale, exportBackup, salvarBackup } from '../lib/backup';
import { useConfig } from './contexto';

/** Botão que gera o arquivo de backup e abre o menu de salvar/compartilhar. */
export function BotaoBackup({ onSalvo }: { onSalvo?: () => void }) {
  const { recarregar } = useConfig();
  const [estado, setEstado] = useState<'livre' | 'gerando' | 'erro'>('livre');

  async function baixar() {
    setEstado('gerando');
    try {
      const salvou = await salvarBackup(await exportBackup(supabase), supabase);
      setEstado('livre');
      if (salvou) {
        onSalvo?.();
        await recarregar();
      }
    } catch {
      setEstado('erro');
    }
  }

  return (
    <>
      <button type="button" onClick={baixar} disabled={estado === 'gerando'}>
        Baixar backup
      </button>
      {estado === 'erro' && <p role="alert">Não foi possível gerar o backup. Confira a internet.</p>}
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
