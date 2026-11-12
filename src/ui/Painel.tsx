import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useSaida } from './animacao';
import { IconeX } from './icones';

const SAIDA_MS = 200;
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CAMPOS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

let proximoId = 1;

interface Props {
  aberto: boolean;
  onFechar: () => void;
  rotulo: string;
  children: ReactNode;
  /** 'sobreposto' (padrão): janela modal. 'lateral': coluna ao lado da agenda, na tela larga. */
  modo?: 'sobreposto' | 'lateral';
}

/**
 * Painel de detalhes e ações.
 *
 * Sobreposto: folha que sobe de baixo no celular, caixa central a partir de 768px. Fecha com Esc,
 * tocando no fundo e com o Voltar do navegador (empurra uma entrada no histórico ao abrir e a consome
 * ao fechar pelo botão). Prende o foco e trava a rolagem do fundo.
 *
 * Lateral: a mesma marcação como região comum ao lado da agenda, com "×" para fechar; Esc fecha só com
 * o foco dentro e fora de campos de texto. Sem histórico, foco preso nem trava de rolagem.
 *
 * Os dois modos usam o mesmo elemento: trocar `modo` com o painel aberto não desmonta o conteúdo.
 */
export default function Painel({ aberto, onFechar, rotulo, children, modo = 'sobreposto' }: Props) {
  const { montado, saindo } = useSaida(aberto, SAIDA_MS);
  const caixa = useRef<HTMLElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  const lateral = modo === 'lateral';

  // foco: entra no painel ao abrir e volta para quem abriu ao fechar (nos dois modos)
  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    caixa.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    return () => antes?.focus?.();
  }, [aberto]);

  // comportamento de janela modal: só no sobreposto
  useEffect(() => {
    if (!aberto || lateral) return;
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

    return () => {
      window.removeEventListener('popstate', aoVoltar);
      document.removeEventListener('keydown', aoTeclar);
      // fechado pelo app (ou virou lateral): tira a entrada que o painel criou
      if (empurrado) history.back();
      document.body.style.overflow = rolagem;
    };
  }, [aberto, lateral]);

  function teclado(e: KeyboardEvent<HTMLElement>) {
    if (lateral) {
      // Esc num campo fecha só as sugestões do campo, não o formulário inteiro
      if (e.key === 'Escape' && !CAMPOS.has((e.target as HTMLElement).tagName)) onFechar();
      return;
    }
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
    <div className={`painel-camada${lateral ? ' lateral' : ''}${saindo ? ' saindo' : ''}`} aria-hidden={saindo || undefined}>
      <div className="fundo-escuro" onClick={() => !saindo && onFechar()} />
      <section
        ref={caixa}
        role={lateral ? 'region' : 'dialog'}
        aria-modal={lateral ? undefined : 'true'}
        aria-label={rotulo}
        className="painel"
        onKeyDown={teclado}
      >
        <div className="alca" aria-hidden="true" />
        {lateral && (
          <button type="button" className="fechar-painel red" aria-label="Fechar painel" onClick={onFechar}>
            <IconeX tamanho={16} />
          </button>
        )}
        {children}
      </section>
    </div>
  );
}
