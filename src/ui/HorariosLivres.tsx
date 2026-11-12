import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { listAjustes } from '../data/ajustes';
import { supabase } from '../data/supabase';
import { diasDoPeriodo, formatSlotsMessage, freeSlots } from '../lib/slots';
import { linkAgendamento } from '../lib/link';
import { renderModelo, waLink } from '../lib/whatsapp';
import { useConfig } from './contexto';
import { useAoVoltar } from './useAoVoltar';

type Periodo = 'hoje' | 'amanha' | 'semana';

export default function HorariosLivres() {
  const { config } = useConfig();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const voltas = useAoVoltar();

  // os mesmos horários que o link oferece (expediente + extras − fechados − ocupados)
  useEffect(() => {
    let ativo = true;
    const agora = new Date();
    const { de, ate } = diasDoPeriodo(periodo, agora, config.fuso);
    setErro(null);
    Promise.all([listAgendamentos(supabase, de, ate), listAjustes(supabase, de, ate)]).then(
      ([agendamentos, ajustes]) => {
        if (!ativo) return;
        const slots = freeSlots({ config, agendamentos, ajustes, de, ate, agora });
        const modelo = renderModelo(config.modelo_livres, { link: linkAgendamento() });
        setTexto(formatSlotsMessage(slots, modelo));
      },
      () => ativo && setErro('Não foi possível carregar a agenda. Confira a internet.'),
    );
    return () => {
      ativo = false;
    };
  }, [periodo, config, voltas]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Copiado!');
    } catch {
      setAviso('Não deu para copiar. Selecione o texto e copie manualmente.');
    }
  }

  return (
    <main>
      <h2>Horários livres</h2>
      <div className="linha">
        <label>
          Período
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="hoje">Hoje</option>
            <option value="amanha">Amanhã</option>
            <option value="semana">Semana</option>
          </select>
        </label>
      </div>
      {erro && <p role="alert">{erro}</p>}
      <label>
        Mensagem
        <textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <div className="linha">
        <button type="button" className="primario" onClick={copiar}>
          Copiar
        </button>
        <a className="botao" href={waLink(null, texto)} target="_blank" rel="noreferrer">
          Abrir WhatsApp
        </a>
      </div>
      {aviso && <p role="status">{aviso}</p>}
    </main>
  );
}
