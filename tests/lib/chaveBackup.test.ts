import { describe, expect, it } from 'vitest';
import { gerarChaveBackup } from '../../src/lib/chaveBackup';

describe('gerarChaveBackup', () => {
  it('tem 43 caracteres de base64url e muda a cada vez', () => {
    const a = gerarChaveBackup();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarChaveBackup()).not.toBe(a);
  });
});
