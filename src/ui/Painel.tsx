import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useSaida } from './animacao';

const SAIDA_MS = 200;
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let proximoId = 1;

interface Props {
  aberto: boolean;
  onFechar: () => void;
  rotulo: string;
  children: ReactNode;
}

/**
 * Painel sobre a tela: folha que sobe de baixo no celular, caixa central a partir de 768px.
 * Fecha com Esc, tocando no fundo e com o Voltar do navegador (empurra uma entrada no histórico
 * ao abrir e a consome ao fechar pelo botão). Prende o foco e trava a rolagem do fundo.
 */
export default function Painel({ aberto, onFechar, rotulo, children }: Props) {
  const { montado, saindo } = useSaida(aberto, SAIDA_MS);
  const caixa = useRef<HTMLElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let empurrado = true;
    history.pushState({ ...(history.state ?? {}), painelId: proximoId++ }, '');
    // Só fecha quando o Voltar leva a uma entrada sem painel. Chegar numa entrada de painel é o eco de um
    // back() do próprio app (ex.: remontagem do StrictMode) ou o Avançar, e não deve fechar.
    const aoVoltar = (e: PopStateEvent) => {
      if (e.state?.painelId != null) return;
      empurrado = false;
      fechar.current();
    };
    window.addEventListener('popstate', aoVoltar);
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current();
    };
    document.addEventListener('keydown', aoTeclar);

    caixa.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();

    return () => {
      window.removeEventListener('popstate', aoVoltar);
      document.removeEventListener('keydown', aoTeclar);
      if (empurrado) {
        history.back(); // fechado pelo app: tira a entrada que o painel criou
      }
      document.body.style.overflow = rolagem;
      antes?.focus?.();
    };
  }, [aberto]);

  function prenderFoco(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Tab' || !caixa.current) return;
    const itens = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
    if (itens.length === 0) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  if (!montado) return null;

  return (
    <div className={`painel-camada${saindo ? ' saindo' : ''}`} aria-hidden={saindo || undefined}>
      <div className="fundo-escuro" onClick={() => !saindo && onFechar()} />
      <section ref={caixa} role="dialog" aria-modal="true" aria-label={rotulo} className="painel" onKeyDown={prenderFoco}>
        <div className="alca" aria-hidden="true" />
        {children}
      </section>
    </div>
  );
}
