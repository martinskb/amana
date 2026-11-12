import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { saveConfig } from '../data/configuracoes';
import { supabase } from '../data/supabase';
import { linkAgendamento } from '../lib/link';
import { useConfig } from './contexto';
import { IconeCopiar, IconeEngrenagem } from './icones';

const AVISO_MS = 4000;

/** Topo da agenda: nome do negócio, chave do link de agendamento, copiar o link e Ajustes. */
export default function CabecalhoAgenda() {
  const { config, recarregar } = useConfig();
  const link = linkAgendamento();
  const [ligado, setLigado] = useState(config.link_ativo);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => setLigado(config.link_ativo), [config.link_ativo]);
  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  function depois(ms: number, f: () => void) {
    temporizadores.current.push(setTimeout(f, ms));
  }

  function avisar(texto: string, some = true) {
    setAviso(texto);
    if (some) depois(AVISO_MS, () => setAviso((atual) => (atual === texto ? null : atual)));
  }

  async function alternar() {
    const novo = !ligado;
    setErro(null);
    setSalvando(true);
    setLigado(novo);
    try {
      await saveConfig(supabase, { link_ativo: novo });
      await recarregar();
      avisar(novo ? 'Link aberto: clientes já podem agendar.' : "Link fechado: quem abrir verá 'Agendamento online fechado no momento.'");
    } catch {
      setLigado(!novo);
      setErro('Não foi possível salvar. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      avisar('Link copiado!');
      setCopiado(true);
      depois(2000, () => setCopiado(false));
    } catch {
      avisar(`Não deu para copiar. O link é: ${link}`, false); // fica até a próxima ação: a pessoa precisa copiar à mão
    }
  }

  return (
    <header className="cab">
      <span className="cab-nome">{config.nome_negocio}</span>
      <button
        type="button"
        className={`chip${ligado ? '' : ' fechado'}`}
        aria-pressed={ligado}
        aria-label={ligado ? 'Link de agendamento aberto' : 'Link de agendamento fechado'}
        disabled={salvando}
        onClick={alternar}
      >
        <span className="ponto" aria-hidden="true" />
        <span className="chip-texto">{ligado ? 'Link aberto' : 'Link fechado'}</span>
      </button>
      <button type="button" className="chip" aria-label="Copiar link" onClick={copiar}>
        <IconeCopiar />
        <span className="chip-texto">{copiado ? 'Copiado ✓' : 'Copiar link'}</span>
      </button>
      <Link to="/config" className="chip redondo" aria-label="Ajustes">
        <IconeEngrenagem />
      </Link>
      {aviso && (
        <p role="status" className="cab-aviso">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="cab-aviso">
          {erro}
        </p>
      )}
    </header>
  );
}
