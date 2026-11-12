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

const vivos = (g: ReturnType<typeof criarGoogleFalso>) => g.arquivos.filter((f) => f.pasta === PASTA && !f.lixeira).map((f) => f.nome);

describe('Backup.gs', () => {
  it('fazerBackup cria a planilha com as 4 abas e o JSON, e chama concluir_backup', () => {
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
    expect(Object.keys(planilha.abas!)).toEqual(['Agendamentos', 'Clientes', 'Serviços', 'Configurações']);
    expect(planilha.abas!.Agendamentos[1]).toEqual(['18/11/2026', '09:00', 'João', '5511987654321', '—', 'Marcado', 'Link', '']);
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
});
