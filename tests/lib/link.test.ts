import { describe, expect, it } from 'vitest';
import { linkAgendamento } from '../../src/lib/link';

describe('linkAgendamento', () => {
  it('monta o endereço da página pública', () => {
    expect(linkAgendamento({ origin: 'https://b.pages.dev', pathname: '/' })).toBe('https://b.pages.dev/#/agendar');
  });
});
