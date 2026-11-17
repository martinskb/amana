import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apagar, apagarAgendaESessao, gravar, ler, podarAgenda } from '../../src/lib/cache';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('cache', () => {
  it('grava e lê com "em" em ISO', () => {
    gravar('config', { a: 1 });
    const lido = ler<{ a: number }>('config');
    expect(lido?.valor).toEqual({ a: 1 });
    expect(new Date(lido!.em).toISOString()).toBe(lido!.em);
    expect(localStorage.getItem('amana:config')).not.toBeNull();
  });

  it('ausente ou JSON corrompido devolve null', () => {
    expect(ler('config')).toBeNull();
    localStorage.setItem('amana:config', '{quebrado');
    expect(ler('config')).toBeNull();
  });

  it('setItem lançando (cota cheia) não lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    expect(() => gravar('config', 1)).not.toThrow();
  });

  it('localStorage bloqueado não lança em nenhuma função', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(ler('config')).toBeNull();
    expect(() => apagar('config')).not.toThrow();
    expect(() => apagarAgendaESessao()).not.toThrow();
    expect(() => podarAgenda()).not.toThrow();
  });

  it('apagar remove só a chave', () => {
    gravar('config', 1);
    gravar('nome', 'X');
    apagar('config');
    expect(ler('config')).toBeNull();
    expect(ler('nome')).not.toBeNull();
  });

  it('apagarAgendaESessao mantém nome, vistos, corte-novos e filtro-pessoa', () => {
    for (const k of ['config', 'servicos', 'pessoas', 'agenda:2026-11-09', 'agenda:2026-11-16', 'nome', 'vistos', 'corte-novos', 'filtro-pessoa']) gravar(k, 1);
    localStorage.setItem('outro', 'x');
    apagarAgendaESessao();
    expect(ler('config')).toBeNull();
    expect(ler('servicos')).toBeNull();
    expect(ler('pessoas')).toBeNull();
    expect(ler('filtro-pessoa')).not.toBeNull();
    expect(ler('agenda:2026-11-09')).toBeNull();
    expect(ler('agenda:2026-11-16')).toBeNull();
    expect(ler('nome')).not.toBeNull();
    expect(ler('vistos')).not.toBeNull();
    expect(ler('corte-novos')).not.toBeNull();
    expect(localStorage.getItem('outro')).toBe('x');
  });

  it('podarAgenda deixa as 8 mais recentes', () => {
    for (let i = 0; i < 11; i++) {
      localStorage.setItem(
        `amana:agenda:s${i}`,
        JSON.stringify({ valor: i, em: new Date(2026, 0, 1 + i).toISOString() }),
      );
    }
    gravar('config', 1);
    podarAgenda();
    const restantes = Object.keys(localStorage).filter((k) => k.startsWith('amana:agenda:'));
    expect(restantes).toHaveLength(8);
    expect(ler('agenda:s0')).toBeNull();
    expect(ler('agenda:s2')).toBeNull();
    expect(ler('agenda:s3')).not.toBeNull();
    expect(ler('config')).not.toBeNull();
  });
});
