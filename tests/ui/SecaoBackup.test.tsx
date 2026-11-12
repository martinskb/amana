import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_TESTE } from '../helpers/config';
import { renderComConfig } from '../helpers/render';

const m = vi.hoisted(() => ({ definirChaveBackup: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({ supabase: {} }));
vi.mock('../../src/data/configuracoes', () => ({ definirChaveBackup: m.definirChaveBackup, saveConfig: vi.fn(), getConfig: vi.fn() }));
vi.mock('../../src/lib/chaveBackup', () => ({ gerarChaveBackup: () => 'x'.repeat(43) }));

import SecaoBackup from '../../src/ui/SecaoBackup';

const CHAVE = 'x'.repeat(43);

beforeEach(() => {
  m.definirChaveBackup.mockReset().mockResolvedValue(undefined);
});

describe('seção Backup', () => {
  it('mostra a data do último backup por extenso', () => {
    renderComConfig(<SecaoBackup />, { ...CONFIG_TESTE, ultimo_backup: '2026-11-15T06:02:00Z' });
    expect(screen.getByText('Último backup: domingo, 15/11 às 03:02')).toBeInTheDocument();
  });

  it('sem backup mostra "Nenhum backup ainda"', () => {
    renderComConfig(<SecaoBackup />, { ...CONFIG_TESTE, ultimo_backup: null });
    expect(screen.getByText('Nenhum backup ainda')).toBeInTheDocument();
  });

  it('sem chave: gerar grava, mostra a chave uma vez e recarrega', async () => {
    const { recarregar } = renderComConfig(<SecaoBackup />, { ...CONFIG_TESTE, backup_ativo: false });
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave de backup' }));
    expect(m.definirChaveBackup).toHaveBeenCalledWith({}, CHAVE);
    expect(await screen.findByLabelText('Chave de backup')).toHaveValue(CHAVE);
    expect(screen.getByLabelText('Chave de backup')).toHaveAttribute('readonly');
    expect(screen.getByText('Guarde e cole no script de backup. Esta chave não aparece de novo.')).toBeInTheDocument();
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
  });

  it('Copiar copia a chave', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderComConfig(<SecaoBackup />, { ...CONFIG_TESTE, backup_ativo: false });
    await user.click(screen.getByRole('button', { name: 'Gerar chave de backup' }));
    await user.click(await screen.findByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith(CHAVE);
  });

  it('com chave: mostra "ativado" e "Gerar nova chave" pede confirmação', async () => {
    renderComConfig(<SecaoBackup />, { ...CONFIG_TESTE, backup_ativo: true });
    expect(screen.getByText('Backup automático ativado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar nova chave' }));
    expect(screen.getByText('Gerar uma nova chave? O backup automático para até você colar a nova no script.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(m.definirChaveBackup).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar nova chave' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gerar nova' }));
    expect(m.definirChaveBackup).toHaveBeenCalledWith({}, CHAVE);
  });

  it('falha de rede avisa e não mostra chave', async () => {
    m.definirChaveBackup.mockRejectedValue(new Error('rede'));
    renderComConfig(<SecaoBackup />, { ...CONFIG_TESTE, backup_ativo: false });
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave de backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível gerar a chave. Confira a internet e tente de novo.');
    expect(screen.queryByLabelText('Chave de backup')).not.toBeInTheDocument();
  });

  it('a seção continua com "Baixar backup"', () => {
    renderComConfig(<SecaoBackup />);
    expect(screen.getByRole('button', { name: 'Baixar backup' })).toBeInTheDocument();
  });
});
