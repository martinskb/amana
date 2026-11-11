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
    // 1º toque busca os dados; o menu de compartilhar só abre no 2º toque (exigência do Safari)
    expect(m.exportBackup).toHaveBeenCalled();
    expect(m.salvarBackup).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar arquivo' }));
    expect(m.salvarBackup).toHaveBeenCalledWith({ versao: 1 }, {});
    await waitFor(() => expect(screen.queryByText(/último backup/)).not.toBeInTheDocument());
    expect(recarregar).toHaveBeenCalled();
  });

  it('se o salvamento for cancelado, o aviso continua', async () => {
    m.salvarBackup.mockResolvedValue(false);
    renderComConfig(<BackupBanner />, velho);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar backup' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar arquivo' }));
    await waitFor(() => expect(m.salvarBackup).toHaveBeenCalled());
    expect(screen.getByText(/último backup/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro ao abrir o compartilhamento aparece na tela', async () => {
    m.salvarBackup.mockRejectedValue(new DOMException('sem gesto', 'NotAllowedError'));
    renderComConfig(<BackupBanner />, velho);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar backup' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar arquivo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar o arquivo');
  });
});
