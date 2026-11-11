import { useEffect, useState } from 'react';
import { listAgendamentos } from '../data/agendamentos';
import { listServicos } from '../data/servicos';
import { supabase } from '../data/supabase';
import { diasDoPeriodo, formatSlotsMessage, freeSlots } from '../lib/slots';
import { waLink } from '../lib/whatsapp';
import type { Servico } from '../types';
import { useConfig } from './contexto';
import { useAoVoltar } from './useAoVoltar';

type Periodo = 'hoje' | 'amanha' | 'semana';

export default function HorariosLivres() {
  const { config } = useConfig();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState('');
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listServicos(supabase, { soAtivos: true }).then(
      (lista) => {
        setServicos(lista);
        setServicoId((atual) => atual || lista[0]?.id || '');
      },
      () => setErro('Não foi possível carregar os serviços.'),
    );
  }, []);

  const servico = servicos.find((s) => s.id === servicoId);
  const voltas = useAoVoltar();

  useEffect(() => {
    if (!servico) return;
    let ativo = true;
    const agora = new Date();
    const { de, ate } = diasDoPeriodo(periodo, agora, config.fuso);
    setErro(null);
    listAgendamentos(supabase, de, ate).then(
      (agendamentos) => {
        if (!ativo) return;
        const slots = freeSlots({ config, agendamentos, ajustes: [], de, ate, agora });
        setTexto(formatSlotsMessage(slots, config.modelo_livres));
      },
      () => ativo && setErro('Não foi possível carregar a agenda. Confira a internet.'),
    );
    return () => {
      ativo = false;
    };
  }, [periodo, servico, config, voltas]);

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
        <label>
          Serviço
          <select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} ({s.duracao_min} min)
              </option>
            ))}
          </select>
        </label>
      </div>
      {servicos.length === 0 && !erro && <p className="sutil">Cadastre um serviço em Ajustes.</p>}
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
