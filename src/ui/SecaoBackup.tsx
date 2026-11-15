import { useState } from 'react';
import { definirChaveBackup } from '../data/configuracoes';
import { supabase } from '../data/supabase';
import { gerarChaveBackup } from '../lib/chaveBackup';
import { diaPorExtenso } from '../lib/mensagens';
import { dataLocal, horaLocal } from '../lib/slots';
import { BotaoBackup } from './BackupBanner';
import { useConfig } from './contexto';

/** Ajustes → Backup (spec backup-drive, seção 6). */
export default function SecaoBackup() {
  const { config, recarregar } = useConfig();
  const [chave, setChave] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  let ultimo = 'Nenhum backup ainda';
  if (config.ultimo_backup) {
    const d = new Date(config.ultimo_backup);
    const data = dataLocal(d, config.fuso);
    ultimo = `Último backup: ${diaPorExtenso(data)}, ${data.slice(8, 10)}/${data.slice(5, 7)} às ${horaLocal(d, config.fuso)}`;
  }

  async function gerar() {
    setErro(null);
    setConfirmando(false);
    setGerando(true);
    const nova = gerarChaveBackup();
    try {
      await definirChaveBackup(supabase, nova);
      setChave(nova); // só no estado deste componente: some ao sair da tela
      await recarregar();
    } catch {
      setErro('Não foi possível gerar a chave. Confira a internet e tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!chave) return;
    try {
      await navigator.clipboard.writeText(chave);
      setAviso('Chave copiada!');
    } catch {
      setAviso('Não deu para copiar. Selecione a chave e copie manualmente.');
    }
  }

  return (
    <>
      <h3>Backup</h3>
      <p>{ultimo}</p>

      <h4>Backup automático no Google Drive</h4>
      {chave ? (
        <div className="caixa">
          <label>
            Chave de backup
            <input readOnly value={chave} onFocus={(e) => e.target.select()} />
          </label>
          <p className="sutil">Guarde e cole no script de backup. Esta chave não aparece de novo.</p>
          <button type="button" onClick={copiar}>
            Copiar
          </button>
          {aviso && <span role="status"> {aviso}</span>}
        </div>
      ) : config.backup_ativo ? (
        confirmando ? (
          <div className="caixa">
            <p>Gerar uma nova chave? O backup automático para até você colar a nova no script.</p>
            <div className="linha">
              <button type="button" className="perigo" disabled={gerando} onClick={gerar}>
                Gerar nova
              </button>
              <button type="button" onClick={() => setConfirmando(false)}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="sutil">Backup automático ativado.</p>
            <button type="button" onClick={() => setConfirmando(true)}>
              Gerar nova chave
            </button>
          </>
        )
      ) : (
        <button type="button" disabled={gerando} onClick={gerar}>
          Gerar chave de backup
        </button>
      )}
      {erro && <p role="alert">{erro}</p>}

      <h4>Backup na hora</h4>
      <p className="sutil">Salve o arquivo no iCloud Drive ou no Google Drive pelo menu de compartilhar.</p>
      <BotaoBackup />
    </>
  );
}
