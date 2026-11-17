// Simula o aviso de instalação do navegador (beforeinstallprompt) e o tipo de aparelho.
import { vi } from 'vitest';

export function eventoInstalacao(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

export function simularAparelho({ standalone = false, ua = 'Mozilla/5.0 (Linux; Android 14)', platform = 'Linux armv8l', toques = 5 } = {}) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: standalone && q.includes('standalone'), media: q }));
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  Object.defineProperty(navigator, 'maxTouchPoints', { value: toques, configurable: true });
}
