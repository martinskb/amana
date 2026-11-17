import { describe, expect, it } from 'vitest';
import { linkAgendamento, linkEquipe } from '../../src/lib/link';

describe('linkAgendamento', () => {
  it('monta o endereço da página pública', () => {
    expect(linkAgendamento({ origin: 'https://b.pages.dev', pathname: '/' })).toBe('https://b.pages.dev/#/agendar');
  });
});

describe('linkEquipe', () => {
  it('monta o endereço da agenda da pessoa', () => {
    expect(linkEquipe('abc123', { origin: 'https://b.pages.dev', pathname: '/' })).toBe('https://b.pages.dev/#/equipe/abc123');
  });
});
