import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ saveConfig: vi.fn() }));
vi.mock('../../src/data/configuracoes', () => ({ saveConfig: m.saveConfig }));

import { backupIsStale, salvarBackup, type BackupFile } from '../../src/lib/backup';

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date('2026-11-17T12:00:00Z');
const ARQUIVO: BackupFile = { versao: 1, gerado_em: agora.toISOString(), clientes: [], servicos: [], agendamentos: [], configuracoes: [] };
const db = {} as never;

describe('backupIsStale', () => {
  it('nunca fez backup', () => expect(backupIsStale(null, agora)).toBe(true));
  it('8 dias', () => expect(backupIsStale(new Date(agora.getTime() - 8 * DIA).toISOString(), agora)).toBe(true));
  it('6 dias', () => expect(backupIsStale(new Date(agora.getTime() - 6 * DIA).toISOString(), agora)).toBe(false));
});

describe('salvarBackup', () => {
  const nav = navigator as unknown as Record<string, unknown>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(agora);
    m.saveConfig.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete nav.share;
    delete nav.canShare;
  });

  it('compartilha o arquivo e registra a data do backup', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    nav.canShare = () => true;
    nav.share = share;
    await expect(salvarBackup(ARQUIVO, db)).resolves.toBe(true);
    const arquivo: File = share.mock.calls[0][0].files[0];
    expect(arquivo.name).toBe('backup-agenda-2026-11-17.json');
    expect(JSON.parse(await arquivo.text())).toEqual(ARQUIVO);
    expect(m.saveConfig).toHaveBeenCalledWith(db, { ultimo_backup: agora.toISOString() });
  });

  it('compartilhamento cancelado não registra o backup', async () => {
    nav.canShare = () => true;
    nav.share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    await expect(salvarBackup(ARQUIVO, db)).resolves.toBe(false);
    expect(m.saveConfig).not.toHaveBeenCalled();
  });

  it('sem compartilhamento, baixa o arquivo', async () => {
    const criar = vi.fn(() => 'blob:x');
    URL.createObjectURL = criar;
    URL.revokeObjectURL = vi.fn();
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(salvarBackup(ARQUIVO, db)).resolves.toBe(true);
    expect(criar).toHaveBeenCalled();
    expect(clique).toHaveBeenCalled();
    expect(m.saveConfig).toHaveBeenCalled();
  });
});
