// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { novoBanco } from '../helpers/pg';

async function base() {
  const db = await novoBanco();
  const { rows: [c] } = await db.query<{ id: string }>(
    `insert into clientes (nome, telefone) values ('Ana', '5511987654321') returning id`,
  );
  const { rows: [s] } = await db.query<{ id: string }>(
    `insert into servicos (nome, duracao_min) values ('Corte', 60) returning id`,
  );
  const marcar = (inicio: string, fim: string, status = 'marcado') =>
    db.query(
      `insert into agendamentos (cliente_id, servico_id, inicio, fim, status) values ($1, $2, $3, $4, $5)`,
      [c.id, s.id, `2026-11-17 ${inicio}-03`, `2026-11-17 ${fim}-03`, status],
    );
  return { db, marcar };
}

describe('esquema do banco', () => {
  it('rejeita dois agendamentos marcados que se sobrepõem', async () => {
    const { marcar } = await base();
    await marcar('10:00', '11:00');
    await expect(marcar('10:30', '11:30')).rejects.toMatchObject({ code: '23P01' });
  });

  it('aceita agendamentos adjacentes', async () => {
    const { marcar } = await base();
    await marcar('10:00', '11:00');
    await expect(marcar('11:00', '12:00')).resolves.toBeDefined();
  });

  it('agendamento cancelado não bloqueia o horário', async () => {
    const { marcar } = await base();
    await marcar('10:00', '11:00', 'cancelado');
    await expect(marcar('10:00', '11:00')).resolves.toBeDefined();
  });

  it('rejeita telefone duplicado em clientes', async () => {
    const { db } = await base();
    await expect(
      db.query(`insert into clientes (nome, telefone) values ('Outra', '5511987654321')`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejeita status inválido', async () => {
    const { marcar } = await base();
    await expect(marcar('10:00', '11:00', 'pendente')).rejects.toMatchObject({ code: '23514' });
  });

  it('seed cria uma única linha de configuracoes com os padrões', async () => {
    const { db } = await base();
    const { rows } = await db.query<{ passo_min: number; antecedencia_min: number; fuso: string }>(
      `select passo_min, antecedencia_min, fuso from configuracoes`,
    );
    expect(rows).toEqual([{ passo_min: 30, antecedencia_min: 60, fuso: 'America/Sao_Paulo' }]);
    await expect(db.query(`insert into configuracoes (id) values (2)`)).rejects.toMatchObject({ code: '23514' });
  });

  it('anon não lê nada, authenticated lê', async () => {
    const { db } = await base();
    await db.exec('set role anon');
    expect((await db.query('select * from clientes')).rows).toHaveLength(0);
    await expect(
      db.query(`insert into clientes (nome, telefone) values ('X', '5511900000000')`),
    ).rejects.toMatchObject({ code: '42501' });
    await db.exec('reset role; set role authenticated');
    const { rows } = await db.query('select * from clientes');
    expect(rows).toHaveLength(1);
  });
});
