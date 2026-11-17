// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { comoUsuario, DONO, novoBanco } from '../helpers/pg';

const AGORA = '2026-11-17T12:00:00Z';
const limpar = (db: PGlite) => db.query<{ r: { clientes: number; agendamentos: number } }>('select limpar_dados_antigos_em($1) r', [AGORA]);

async function cliente(db: PGlite, nome: string, telefone: string, criado = "'2026-01-01'"): Promise<string> {
  const { rows: [c] } = await db.query<{ id: string }>(
    `insert into clientes (nome, telefone, criado_em) values ($1, $2, ${criado}) returning id`,
    [nome, telefone],
  );
  return c.id;
}

/** Agendamento de 30 min que começa em AGORA + `inicio` (um interval do Postgres, ex.: '-8 days'). */
async function atendimento(db: PGlite, cliente_id: string, inicio: string, status = 'marcado'): Promise<void> {
  await db.query(
    `insert into agendamentos (cliente_id, inicio, fim, status, origem)
     values ($1, $2::timestamptz + $3::interval, $2::timestamptz + $3::interval + interval '30 minutes', $4, 'dono')`,
    [cliente_id, AGORA, inicio, status],
  );
}

describe('limpeza de dados antigos', { timeout: 60_000 }, () => {
  it('cliente_nome é preenchido no insert e acompanha o nome do cliente', async () => {
    const db = await novoBanco();
    const id = await cliente(db, 'Ana', '5511900000001');
    await atendimento(db, id, '1 day');
    const nome = async () => (await db.query<{ cliente_nome: string }>('select cliente_nome from agendamentos')).rows[0].cliente_nome;
    expect(await nome()).toBe('Ana');
    await db.query("update clientes set nome = 'Ana Lima' where id = $1", [id]);
    expect(await nome()).toBe('Ana Lima');
  });

  it('cliente com último atendimento há 8 dias sai; o atendimento fica com o nome e sem cliente_id', async () => {
    const db = await novoBanco();
    const id = await cliente(db, 'Ana', '5511900000001');
    await atendimento(db, id, '-8 days');
    await limpar(db);
    expect((await db.query('select * from clientes')).rows).toHaveLength(0);
    const { rows } = await db.query<{ cliente_id: string | null; cliente_nome: string }>('select cliente_id, cliente_nome from agendamentos');
    expect(rows).toEqual([{ cliente_id: null, cliente_nome: 'Ana' }]);
  });

  it('cliente com atendimento há 6 dias fica', async () => {
    const db = await novoBanco();
    const id = await cliente(db, 'Ana', '5511900000001');
    await atendimento(db, id, '-6 days');
    const { rows: [{ r }] } = await limpar(db);
    expect(r.clientes).toBe(0);
    expect((await db.query('select * from clientes')).rows).toHaveLength(1);
  });

  it('cliente com agendamento para a frente fica, mesmo cancelado', async () => {
    const db = await novoBanco();
    const id = await cliente(db, 'Ana', '5511900000001');
    await atendimento(db, id, '-20 days');
    await atendimento(db, id, '5 days', 'cancelado');
    await limpar(db);
    expect((await db.query('select * from clientes')).rows).toHaveLength(1);
  });

  it('cliente sem atendimento cadastrado há 8 dias sai; há 6 dias fica', async () => {
    const db = await novoBanco();
    await cliente(db, 'Velho', '5511900000001', `'${AGORA}'::timestamptz - interval '8 days'`);
    await cliente(db, 'Novo', '5511900000002', `'${AGORA}'::timestamptz - interval '6 days'`);
    await limpar(db);
    const { rows } = await db.query<{ nome: string }>('select nome from clientes');
    expect(rows).toEqual([{ nome: 'Novo' }]);
  });

  it('atendimento de 3 meses e 1 dia atrás sai; de 2 meses fica', async () => {
    const db = await novoBanco();
    const id = await cliente(db, 'Ana', '5511900000001');
    await atendimento(db, id, '-3 months -1 day');
    await atendimento(db, id, '-2 months');
    await limpar(db);
    expect((await db.query('select * from agendamentos')).rows).toHaveLength(1);
  });

  it('devolve as contagens', async () => {
    const db = await novoBanco();
    const id = await cliente(db, 'Ana', '5511900000001');
    await atendimento(db, id, '-8 days');
    const { rows: [{ r }] } = await limpar(db);
    expect(r).toEqual({ clientes: 1, agendamentos: 0 });
    const outro = await cliente(db, 'Bia', '5511900000002');
    await atendimento(db, outro, '-4 months');
    const { rows: [{ r: r2 }] } = await limpar(db);
    expect(r2).toEqual({ clientes: 1, agendamentos: 1 });
  });

  it('ninguém de fora executa', async () => {
    const db = await novoBanco();
    await db.query('insert into donos (user_id) values ($1)', [DONO]);
    for (const papel of ['anon', 'dono']) {
      if (papel === 'anon') await db.exec('reset role; set role anon');
      else await comoUsuario(db, DONO);
      for (const sql of ['select limpar_dados_antigos()', `select limpar_dados_antigos_em('${AGORA}')`]) {
        await expect(db.query(sql)).rejects.toMatchObject({ code: '42501' });
      }
    }
  });
});
