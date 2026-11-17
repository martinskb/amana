import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _reiniciarParaTeste,
  aoMudarInstalacao,
  estadoInstalacao,
  iniciarCapturaInstalacao,
  instalar,
} from '../../src/lib/instalar';
import { eventoInstalacao, simularAparelho } from '../helpers/instalacao';

beforeEach(() => {
  _reiniciarParaTeste();
  simularAparelho();
  iniciarCapturaInstalacao();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('instalar na tela inicial', () => {
  it('sem o aviso do navegador, orienta pelo menu', () => {
    expect(estadoInstalacao()).toBe('manual');
  });

  it('guarda o aviso do navegador e segura o banner automático', () => {
    const e = eventoInstalacao();
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(estadoInstalacao()).toBe('disponivel');
  });

  it('dono aceita: devolve true e chama o prompt', async () => {
    const e = eventoInstalacao('accepted');
    window.dispatchEvent(e);
    expect(await instalar()).toBe(true);
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('dono dispensa: devolve false e o aviso não pode ser usado de novo', async () => {
    window.dispatchEvent(eventoInstalacao('dismissed'));
    expect(await instalar()).toBe(false);
    expect(estadoInstalacao()).toBe('manual');
  });

  it('depois de instalado, avisa quem está ouvindo e mostra "instalado"', () => {
    const ouvinte = vi.fn();
    const parar = aoMudarInstalacao(ouvinte);
    window.dispatchEvent(new Event('appinstalled'));
    expect(ouvinte).toHaveBeenCalled();
    expect(estadoInstalacao()).toBe('instalado');
    parar();
  });

  it('aberto pela tela inicial já conta como instalado', () => {
    simularAparelho({ standalone: true });
    expect(estadoInstalacao()).toBe('instalado');
  });

  it('iPhone: instrução própria', () => {
    simularAparelho({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' });
    expect(estadoInstalacao()).toBe('iphone');
  });

  it('iPad que se diz Mac também recebe a instrução do iPhone', () => {
    simularAparelho({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', toques: 5 });
    expect(estadoInstalacao()).toBe('iphone');
  });

  it('Mac de verdade (sem toque) não é iPhone', () => {
    simularAparelho({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', toques: 0 });
    expect(estadoInstalacao()).toBe('manual');
  });

  it('chamar a captura duas vezes não duplica os ouvintes', () => {
    iniciarCapturaInstalacao();
    const ouvinte = vi.fn();
    aoMudarInstalacao(ouvinte);
    window.dispatchEvent(eventoInstalacao());
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
