// Instalação do app na tela inicial.
// No Android/Chrome o navegador dispara `beforeinstallprompt` logo na abertura, bem antes de o dono
// abrir os Ajustes. Por isso a captura começa em main.tsx e o evento fica guardado aqui. Ele só
// pode ser usado uma vez. No iPhone esse evento não existe: lá a instalação é pelo Compartilhar.

export type EstadoInstalacao = 'instalado' | 'disponivel' | 'iphone' | 'manual';

interface AvisoInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let aviso: AvisoInstalacao | null = null;
let instalou = false;
let capturando = false;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((fn) => fn());

function aoAviso(e: Event) {
  e.preventDefault(); // o app mostra o próprio botão, sem o banner automático
  aviso = e as AvisoInstalacao;
  avisar();
}

function aoInstalar() {
  instalou = true;
  aviso = null;
  avisar();
}

export function iniciarCapturaInstalacao(): void {
  if (capturando) return;
  capturando = true;
  window.addEventListener('beforeinstallprompt', aoAviso);
  window.addEventListener('appinstalled', aoInstalar);
}

function abertoComoApp(): boolean {
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function ehIOS(): boolean {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  // o iPadOS se apresenta como Mac; um Mac de verdade não tem tela de toque
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function estadoInstalacao(): EstadoInstalacao {
  if (instalou || abertoComoApp()) return 'instalado';
  if (aviso) return 'disponivel';
  if (ehIOS()) return 'iphone';
  return 'manual';
}

/** Abre o aviso de instalação do navegador. Devolve true se o dono aceitou. */
export async function instalar(): Promise<boolean> {
  const atual = aviso;
  if (!atual) return false;
  aviso = null; // o navegador não deixa usar o mesmo aviso duas vezes
  await atual.prompt();
  const { outcome } = await atual.userChoice;
  avisar();
  return outcome === 'accepted';
}

export function aoMudarInstalacao(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function _reiniciarParaTeste(): void {
  window.removeEventListener('beforeinstallprompt', aoAviso);
  window.removeEventListener('appinstalled', aoInstalar);
  aviso = null;
  instalou = false;
  capturando = false;
  ouvintes.clear();
}
