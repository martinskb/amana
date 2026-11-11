import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ exportBackup: vi.fn(), salvarBackup: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/lib/backup', async (original) => ({
  ...(await original<typeof import('../../src/lib/backup')>()),
  exportBackup: m.exportBackup,
  salvarBackup: m.salvarBackup,
}));

import BackupBanner from '../../src/ui/BackupBanner';

const DIA = 24 * 60 * 60 * 1000;
const velho = { ...CONFIG_TESTE, ultimo_backup: new Date(Date.now() - 8 * DIA).toISOString() };

beforeEach(() => {
  m.exportBackup.mockReset().mockResolvedValue({ versao: 1 });
  m.salvarBackup.mockReset().mockResolvedValue(true);
});

describe('aviso de backup', () => {
  it('não aparece com backup recente', () => {
    renderComConfig(<BackupBanner />);
    expect(screen.queryByText(/último backup/)).not.toBeInTheDocument();
  });

  it('aparece com backup de 8 dias e some depois de salvar', async () => {
    const { recarregar } = renderComConfig(<BackupBanner />, velho);
    expect(screen.getByText(/último backup/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Baixar backup' }));
    expect(m.salvarBackup).toHaveBeenCalledWith({ versao: 1 }, {});
    await waitFor(() => expect(screen.queryByText(/último backup/)).not.toBeInTheDocument());
    expect(recarregar).toHaveBeenCalled();
  });

  it('se o salvamento for cancelado, o aviso continua', async () => {
    m.salvarBackup.mockResolvedValue(false);
    renderComConfig(<BackupBanner />, velho);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar backup' }));
    await waitFor(() => expect(m.salvarBackup).toHaveBeenCalled());
    expect(screen.getByText(/último backup/)).toBeInTheDocument();
  });
});
