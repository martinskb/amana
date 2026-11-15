import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { saveConfig } from '../data/configuracoes';
import { supabase } from '../data/supabase';
import { linkAgendamento } from '../lib/link';
import { useConfig } from './contexto';
import { IconeCopiar, IconeEngrenagem } from './icones';
import MarcaAmana from './MarcaAmana';

const AVISO_MS = 4000;

/** Topo da agenda: logo à esquerda; à direita, a chave do link de agendamento, copiar o link e Ajustes. */
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
      <MarcaAmana tamanho={18} />
      <div className="cab-icones">
        <button
          type="button"
          className={`icone-redondo${ligado ? '' : ' fechado'}`}
          aria-pressed={ligado}
          aria-label={ligado ? 'Link de agendamento aberto' : 'Link de agendamento fechado'}
          disabled={salvando}
          onClick={alternar}
        >
          <span className="ponto" aria-hidden="true" />
          <span className="so-leitor">{ligado ? 'Link aberto' : 'Link fechado'}</span>
        </button>
        <button type="button" className={`icone-redondo${copiado ? ' feito' : ''}`} aria-label="Copiar link" onClick={copiar}>
          <IconeCopiar tamanho={18} />
          <span className="so-leitor">{copiado ? 'Copiado ✓' : 'Copiar link'}</span>
        </button>
        <Link to="/config" className="icone-redondo" aria-label="Ajustes">
          <IconeEngrenagem tamanho={18} />
        </Link>
      </div>
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
