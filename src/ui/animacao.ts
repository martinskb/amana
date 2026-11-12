import { useEffect, useRef, useState } from 'react';

function lerConsulta(consulta: string): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : false;
}

/** Acompanha uma media query; false quando o navegador não tem matchMedia. */
function useConsultaMidia(consulta: string): boolean {
  const [vale, setVale] = useState(() => lerConsulta(consulta));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(consulta);
    setVale(mq.matches);
    const mudou = (e: { matches: boolean }) => setVale(e.matches);
    mq.addEventListener('change', mudou);
    return () => mq.removeEventListener('change', mudou);
  }, [consulta]);
  return vale;
}

/** true quando o sistema pede menos movimento (Android, iOS, Windows, macOS). */
export function usePrefereMenosMovimento(): boolean {
  return useConsultaMidia('(prefers-reduced-motion: reduce)');
}

/** true a partir de 1280px: a agenda ganha a coluna lateral de resumo e detalhes. */
export function useTelaLarga(): boolean {
  return useConsultaMidia('(min-width: 1280px)');
}

/** Mantém um elemento montado durante a animação de saída. */
export function useSaida(aberto: boolean, ms: number): { montado: boolean; saindo: boolean } {
  const [montado, setMontado] = useState(aberto);
  useEffect(() => {
    if (aberto) {
      setMontado(true);
      return;
    }
    const t = setTimeout(() => setMontado(false), ms);
    return () => clearTimeout(t);
  }, [aberto, ms]);
  return { montado: aberto || montado, saindo: !aberto && montado };
}

/** Conta de onde está até `alvo` em `ms`; com menos movimento, mostra o alvo direto. */
export function useContador(alvo: number, ms = 600): number {
  const menos = usePrefereMenosMovimento();
  const [valor, setValor] = useState(() => (menos ? alvo : 0));
  const atual = useRef(valor);
  atual.current = valor;

  useEffect(() => {
    if (menos) {
      setValor(alvo); // guarda para quando a preferência mudar
      return;
    }
    const de = atual.current;
    if (de === alvo) return;
    const inicio = Date.now();
    let quadro = 0;
    const passo = () => {
      const t = Math.min(1, (Date.now() - inicio) / ms);
      const suave = 1 - (1 - t) ** 3;
      setValor(Math.round(de + (alvo - de) * suave));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ms, menos]);

  return menos ? alvo : valor;
}
