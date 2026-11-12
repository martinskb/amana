import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { listAjustes } from '../data/ajustes';
import { saveConfig } from '../data/configuracoes';
import { supabase } from '../data/supabase';
import { linkAgendamento } from '../lib/link';
import { mensagemDivulgar } from '../lib/mensagens';
import { diasDoLink, formatSlotsMessage, freeSlots } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import { useConfig } from './contexto';
import { useAoVoltar } from './useAoVoltar';

const RESUMO_MAX = 8;

/** Aba Link (spec v3, seção 2.2): o link de agendamento em destaque e o que o cliente vai ver. */
export default function AbaLink() {
  const { config, recarregar } = useConfig();
  const link = linkAgendamento();
  const [ligado, setLigado] = useState(config.link_ativo);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<string | null>(null);
  const voltas = useAoVoltar();

  useEffect(() => setLigado(config.link_ativo), [config.link_ativo]);

  useEffect(() => {
    if (!ligado) return;
    let ativo = true;
    const agora = new Date();
    const { de, ate } = diasDoLink(agora, config);
    Promise.all([listAgendamentos(supabase, de, ate), listAjustes(supabase, de, ate)]).then(
      ([agendamentos, ajustes]) => {
        if (!ativo) return;
        const slots = freeSlots({ config, agendamentos, ajustes, de, ate, agora }).slice(0, RESUMO_MAX);
        setResumo(formatSlotsMessage(slots, '{horarios}'));
      },
      () => ativo && setResumo('Não foi possível carregar os horários.'),
    );
    return () => {
      ativo = false;
    };
  }, [config, ligado, voltas]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setAviso('Link copiado!');
    } catch {
      setAviso(`Não deu para copiar. O link é: ${link}`);
    }
  }

  async function alternar() {
    const novo = !ligado;
    setErro(null);
    setSalvando(true);
    setLigado(novo);
    try {
      await saveConfig(supabase, { link_ativo: novo });
      await recarregar();
    } catch {
      setLigado(!novo);
      setErro('Não foi possível salvar. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="aba-link">
      <h2>Seu link de agendamento</h2>
      <p className="link-destaque">{link}</p>
      <div className="linha">
        {ligado ? (
          <a className="botao" href={waLink(null, mensagemDivulgar(link))} target="_blank" rel="noreferrer">
            Mandar no WhatsApp
          </a>
        ) : (
          // link desligado: não deixa divulgar um link que mostraria "fechado"
          <button type="button" disabled>
            Ligue o link para divulgar
          </button>
        )}
        <button type="button" onClick={copiar}>
          Copiar link
        </button>
      </div>
      {aviso && <p role="status">{aviso}</p>}

      <label className="inline chave">
        <input type="checkbox" checked={ligado} disabled={salvando} onChange={alternar} />
        Link ligado
      </label>
      {erro && <p role="alert">{erro}</p>}
      {!ligado && <p className="sutil">O link está fechado: quem abrir verá 'Agendamento online fechado no momento.'</p>}

      {ligado && resumo !== null && (
        <p className="sutil" data-testid="resumo-livres">
          Próximos horários livres: {resumo}
        </p>
      )}
    </main>
  );
}
