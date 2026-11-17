// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { aplicarMigracao, comoUsuario, DONO, ESTRANHO, novoBanco } from '../helpers/pg';

async function um<T>(db: PGlite, sql: string, params?: unknown[]): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}

async function cliente(db: PGlite, telefone = '5511987654321') {
  return um<{ id: string }>(db, `insert into clientes (nome, telefone) values ('Ana', $1) returning id`, [telefone]);
}

async function pessoa(db: PGlite, nome: string | null, ordem: number) {
  return um<{ id: string }>(db, `insert into pessoas (nome, ordem) values ($1, $2) returning id`, [nome, ordem]);
}

function marcar(db: PGlite, clienteId: string, inicio: string, fim: string, pessoaId?: string | null) {
  return db.query<{ pessoa_id: string }>(
    `insert into agendamentos (cliente_id, inicio, fim, pessoa_id) values ($1, $2, $3, $4) returning pessoa_id`,
    [clienteId, `2026-11-17 ${inicio}-03`, `2026-11-17 ${fim}-03`, pessoaId ?? null],
  );
}

describe('pessoas (0006)', { timeout: 30_000 }, () => {
  it('migração cria a Pessoa 1 sem nome, ligada a todos os serviços', async () => {
    const db = await novoBanco(5);
    await db.exec(`insert into servicos (nome, duracao_min) values ('Corte', 30), ('Barba', 30)`);
    await aplicarMigracao(db, 6);
    const { rows } = await db.query(`select nome, ordem, ativo from pessoas`);
    expect(rows).toEqual([{ nome: null, ordem: 1, ativo: true }]);
    expect((await db.query(`select * from pessoa_servicos`)).rows).toHaveLength(2);
  });

  it('agendamentos e extras antigos ficam com a Pessoa 1', async () => {
    const db = await novoBanco(5);
    const c = await cliente(db);
    await db.query(`insert into agendamentos (cliente_id, inicio, fim) values ($1, '2026-11-17 10:00-03', '2026-11-17 10:30-03')`, [c.id]);
    await db.exec(`insert into horarios_ajuste (inicio, tipo) values ('2026-11-17 20:00-03', 'extra'), ('2026-11-17 11:00-03', 'fechado')`);
    await aplicarMigracao(db, 6);
    const p1 = await um<{ id: string }>(db, `select id from pessoas`);
    expect((await db.query(`select pessoa_id from agendamentos`)).rows).toEqual([{ pessoa_id: p1.id }]);
    const ajustes = (await db.query<{ tipo: string; pessoa_id: string | null }>(`select tipo, pessoa_id from horarios_ajuste order by tipo`)).rows;
    expect(ajustes).toEqual([
      { tipo: 'extra', pessoa_id: p1.id },
      { tipo: 'fechado', pessoa_id: null },
    ]);
  });

  it('mesma pessoa no mesmo horário: a trava recusa', async () => {
    const db = await novoBanco();
    const c = await cliente(db);
    const p1 = await um<{ id: string }>(db, `select id from pessoas`);
    await marcar(db, c.id, '10:00', '10:30', p1.id);
    await expect(marcar(db, c.id, '10:00', '10:30', p1.id)).rejects.toMatchObject({ code: '23P01' });
  });

  it('pessoas diferentes no mesmo horário: passa', async () => {
    const db = await novoBanco();
    const c = await cliente(db);
    const p1 = await um<{ id: string }>(db, `select id from pessoas`);
    const p2 = await pessoa(db, 'João', 2);
    await marcar(db, c.id, '10:00', '10:30', p1.id);
    await expect(marcar(db, c.id, '10:00', '10:30', p2.id)).resolves.toBeDefined();
  });

  it('insert sem pessoa vai para a primeira pessoa livre', async () => {
    const db = await novoBanco();
    const c = await cliente(db);
    const p1 = await um<{ id: string }>(db, `select id from pessoas`);
    const p2 = await pessoa(db, 'João', 2);
    expect((await marcar(db, c.id, '10:00', '10:30')).rows[0].pessoa_id).toBe(p1.id);
    expect((await marcar(db, c.id, '10:00', '10:30')).rows[0].pessoa_id).toBe(p2.id);
    // ninguém livre: vai para a primeira e a trava recusa
    await expect(marcar(db, c.id, '10:00', '10:30')).rejects.toMatchObject({ code: '23P01' });
  });

  it('insert sem pessoa ignora pessoa desativada', async () => {
    const db = await novoBanco();
    const c = await cliente(db);
    await db.exec(`update pessoas set ativo = false`);
    const p2 = await pessoa(db, 'João', 2);
    expect((await marcar(db, c.id, '10:00', '10:30')).rows[0].pessoa_id).toBe(p2.id);
  });

  it('extra sem pessoa vai para a primeira ativa', async () => {
    const db = await novoBanco();
    const p1 = await um<{ id: string }>(db, `select id from pessoas`);
    await pessoa(db, 'João', 2);
    const r = await um<{ pessoa_id: string }>(
      db,
      `insert into horarios_ajuste (inicio, tipo) values ('2026-11-17 20:00-03', 'extra') returning pessoa_id`,
    );
    expect(r.pessoa_id).toBe(p1.id);
  });

  it('fechado do negócio todo (pessoa null) é permitido, e não se repete', async () => {
    const db = await novoBanco();
    const p1 = await um<{ id: string }>(db, `select id from pessoas`);
    await db.exec(`insert into horarios_ajuste (inicio, tipo) values ('2026-11-17 10:00-03', 'fechado')`);
    await expect(
      db.exec(`insert into horarios_ajuste (inicio, tipo) values ('2026-11-17 10:00-03', 'fechado')`),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.query(`insert into horarios_ajuste (inicio, tipo, pessoa_id) values ('2026-11-17 10:00-03', 'fechado', $1)`, [p1.id]),
    ).resolves.toBeDefined();
  });

  it('serviço novo é ligado a todas as pessoas ativas', async () => {
    const db = await novoBanco();
    const p2 = await pessoa(db, 'João', 2);
    const p3 = await pessoa(db, 'Bia', 3);
    await db.query(`update pessoas set ativo = false where id = $1`, [p3.id]);
    const s = await um<{ id: string }>(db, `insert into servicos (nome, duracao_min) values ('Corte', 30) returning id`);
    const ligadas = (await db.query<{ pessoa_id: string }>(`select pessoa_id from pessoa_servicos where servico_id = $1`, [s.id])).rows.map((r) => r.pessoa_id);
    expect(ligadas).toHaveLength(2);
    expect(ligadas).toContain(p2.id);
    expect(ligadas).not.toContain(p3.id);
  });

  it('nome vazio ou com mais de 40 caracteres é recusado', async () => {
    const db = await novoBanco();
    await expect(pessoa(db, '', 2)).rejects.toMatchObject({ code: '23514' });
    await expect(pessoa(db, 'a'.repeat(41), 2)).rejects.toMatchObject({ code: '23514' });
  });

  describe('desativar_pessoa', () => {
    it('recusa a última ativa', async () => {
      const db = await novoBanco();
      const p1 = await um<{ id: string }>(db, `select id from pessoas`);
      const r = await um<{ r: unknown }>(db, `select desativar_pessoa($1) as r`, [p1.id]);
      expect(r.r).toEqual({ ok: false, erro: 'ultima' });
    });

    it('recusa quem tem cliente futuro', async () => {
      const db = await novoBanco();
      const c = await cliente(db);
      const p2 = await pessoa(db, 'João', 2);
      await db.query(
        `insert into agendamentos (cliente_id, inicio, fim, pessoa_id) values ($1, now() + interval '1 day', now() + interval '1 day 30 min', $2)`,
        [c.id, p2.id],
      );
      const r = await um<{ r: unknown }>(db, `select desativar_pessoa($1) as r`, [p2.id]);
      expect(r.r).toEqual({ ok: false, erro: 'clientes_futuros' });
    });

    it('desativa, apaga só os ajustes futuros dela e mantém as folgas', async () => {
      const db = await novoBanco();
      const p2 = await pessoa(db, 'João', 2);
      await db.query(`update pessoas set folgas = '["2026-12-01"]' where id = $1`, [p2.id]);
      await db.query(
        `insert into horarios_ajuste (inicio, tipo, pessoa_id) values
           (now() + interval '1 day', 'extra', $1),
           (now() + interval '2 day', 'fechado', $1),
           (now() - interval '1 day', 'extra', $1),
           (now() + interval '1 day', 'fechado', null)`,
        [p2.id],
      );
      const r = await um<{ r: unknown }>(db, `select desativar_pessoa($1) as r`, [p2.id]);
      expect(r.r).toEqual({ ok: true });
      const p = await um<{ ativo: boolean; folgas: string[] }>(db, `select ativo, folgas from pessoas where id = $1`, [p2.id]);
      expect(p).toEqual({ ativo: false, folgas: ['2026-12-01'] });
      expect((await db.query(`select * from horarios_ajuste where pessoa_id = $1`, [p2.id])).rows).toHaveLength(1);
      expect((await db.query(`select * from horarios_ajuste where pessoa_id is null`)).rows).toHaveLength(1);
    });
  });

  it('RLS: estranho não lê pessoas nem pessoa_servicos; o dono lê', async () => {
    const db = await novoBanco();
    await db.exec(`insert into servicos (nome, duracao_min) values ('Corte', 30); insert into donos (user_id) values ('${DONO}')`);
    await comoUsuario(db, ESTRANHO);
    expect((await db.query('select * from pessoas')).rows).toHaveLength(0);
    expect((await db.query('select * from pessoa_servicos')).rows).toHaveLength(0);
    await comoUsuario(db, DONO);
    expect((await db.query('select * from pessoas')).rows).toHaveLength(1);
    expect((await db.query('select * from pessoa_servicos')).rows).toHaveLength(1);
  });
});
