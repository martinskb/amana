import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FaixaSemConexao from '../../src/ui/FaixaSemConexao';
import { renderComConfig } from '../helpers/render';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T15:00:00Z')); // sábado 12:00 em São Paulo
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FaixaSemConexao', () => {
  it('salvo hoje: só a hora, no fuso do negócio', () => {
    renderComConfig(<FaixaSemConexao salvoEm="2026-11-14T14:32:00Z" onTentar={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('sem conexão · mostrando o que estava salvo às 11:32');
  });

  it('salvo ontem: "salvo ontem às"', () => {
    renderComConfig(<FaixaSemConexao salvoEm="2026-11-13T17:32:00Z" onTentar={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('sem conexão · mostrando o que estava salvo ontem às 14:32');
  });

  it('salvo antes de ontem: "salvo em DD/MM às"', () => {
    renderComConfig(<FaixaSemConexao salvoEm="2026-11-12T17:32:00Z" onTentar={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('sem conexão · mostrando o que estava salvo em 12/11 às 14:32');
  });

  it('o dia conta no fuso do negócio, não em UTC', () => {
    // 01:30Z do dia 14 ainda é 22:30 do dia 13 em São Paulo
    renderComConfig(<FaixaSemConexao salvoEm="2026-11-14T01:30:00Z" onTentar={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('salvo ontem às 22:30');
  });

  it('"Tentar de novo" chama onTentar', async () => {
    const onTentar = vi.fn();
    renderComConfig(<FaixaSemConexao salvoEm="2026-11-14T14:32:00Z" onTentar={onTentar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onTentar).toHaveBeenCalledTimes(1);
  });
});
