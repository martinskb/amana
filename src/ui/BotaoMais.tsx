import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IconeMais } from './icones';

/**
 * Botão flutuante "+" do celular: abre um menu curto com "Novo agendamento" e "Horário extra".
 * Com o menu aberto, o Tab fica preso nele; Esc ou um toque fora fecham.
 */
export default function BotaoMais({ onNovo, onExtra }: { onNovo: () => void; onExtra: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const mais = useRef<HTMLButtonElement>(null);
  const primeiro = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.focus();
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  function teclado(e: KeyboardEvent) {
    if (!aberto) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      setAberto(false);
      mais.current?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const focaveis = [...(caixa.current?.querySelectorAll('button') ?? [])];
    const i = focaveis.indexOf(document.activeElement as HTMLButtonElement);
    const proximo = focaveis[(i + (e.shiftKey ? -1 : 1) + focaveis.length) % focaveis.length];
    e.preventDefault();
    proximo?.focus();
  }

  // o foco volta ao "+" antes de abrir o painel: ao fechar, o painel devolve o foco a ele
  function escolher(acao: () => void) {
    setAberto(false);
    mais.current?.focus();
    acao();
  }

  return (
    <div className="botao-mais" ref={caixa} onKeyDown={teclado}>
      {aberto && (
        <ul className="menu-mais">
          <li>
            <button type="button" ref={primeiro} onClick={() => escolher(onNovo)}>
              Novo agendamento
            </button>
          </li>
          <li>
            <button type="button" onClick={() => escolher(onExtra)}>
              Horário extra
            </button>
          </li>
        </ul>
      )}
      <button
        type="button"
        ref={mais}
        className="fab"
        aria-label="Adicionar"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <IconeMais tamanho={28} />
      </button>
    </div>
  );
}
