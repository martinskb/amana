// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const raiz = resolve(__dirname, '..');
let saida: string;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : [p];
  });
}

describe('build de produção', { timeout: 120_000 }, () => {
  beforeAll(() => {
    saida = mkdtempSync(join(tmpdir(), 'agenda-build-'));
    execFileSync('npx', ['vite', 'build', '--outDir', saida, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: raiz,
      stdio: 'pipe',
      env: { ...process.env, VITE_SUPABASE_URL: 'https://exemplo.supabase.co', VITE_SUPABASE_ANON_KEY: 'chave-publica', VITE_NOME_NEGOCIO: 'Teste' },
    });
  }, 120_000);

  afterAll(() => rmSync(saida, { recursive: true, force: true }));

  it('gera o manifest com display standalone', () => {
    const manifest = JSON.parse(readFileSync(join(saida, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('pt-BR');
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']);
  });

  it('gera o service worker', () => {
    expect(existsSync(join(saida, 'sw.js'))).toBe(true);
  });

  it('não contém segredo nenhum', () => {
    for (const f of arquivos(saida)) {
      const texto = readFileSync(f, 'utf8');
      expect(texto, f).not.toMatch(/service_role|SUPABASE_DB_URL|SUPABASE_SERVICE/);
    }
  });

  it('o login antigo (Google e código por e-mail) não está mais no app', () => {
    const js = arquivos(saida).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(js).not.toContain('Entrar com Google');
    expect(js).not.toContain('Receber código por e-mail');
    expect(js).toContain('#/agendar');
  });

  it('manifest usa as cores do tema escuro', () => {
    const manifest = JSON.parse(readFileSync(join(saida, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.background_color).toBe('#161412');
    expect(manifest.theme_color).toBe('#161412');
  });

  it('embute as fontes latinas no build e no cache do PWA', () => {
    const fontes = arquivos(saida).filter((f) => f.endsWith('.woff2'));
    expect(fontes.some((f) => f.includes('playfair-display-latin'))).toBe(true);
    expect(fontes.some((f) => f.includes('hanken-grotesk-latin'))).toBe(true);
    expect(fontes.filter((f) => /cyrillic|greek|vietnamese/.test(f))).toEqual([]);
    expect(readFileSync(join(saida, 'sw.js'), 'utf8')).toContain('.woff2');
  });

  it('o .env não está no repositório', () => {
    expect(readFileSync(join(raiz, '.gitignore'), 'utf8')).toMatch(/^\.env$/m);
  });
});
