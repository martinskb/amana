// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { comoUsuario, DONO, ESTRANHO, novoBanco } from '../helpers/pg';

const CHAVE = 'k'.repeat(43);

async function comChave(db: PGlite, chave = CHAVE) {
  await db.query(`update configuracoes set backup_chave_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [chave]);
}

async function exportar(db: PGlite, chave = CHAVE) {
  const { rows: [r] } = await db.query<{ j: Record<string, unknown> }>('select exportar_backup($1) j', [chave]);
  return r.j;
}

describe('backup no Drive: banco', { timeout: 30_000 }, () => {
  it('exportar_backup com a chave certa devolve as sete chaves e os dados', async () => {
    const db = await novoBanco();
    await comChave(db);
    await db.query(`insert into clientes (nome, telefone) values ('Ana', '5511987654321')`);
    const j = await exportar(db);
    expect(Object.keys(j).sort()).toEqual(
      ['agendamentos', 'clientes', 'configuracoes', 'gerado_em', 'horarios_ajuste', 'servicos', 'versao'],
    );
    expect(j.versao).toBe(1);
    expect((j.clientes as { nome: string }[]).map((c) => c.nome)).toEqual(['Ana']);
  });

  it('o hash não sai no backup', async () => {
    const db = await novoBanco();
    await comChave(db);
    const j = await exportar(db);
    expect((j.configuracoes as Record<string, unknown>[])[0]).not.toHaveProperty('backup_chave_hash');
  });

  it('chave errada e hash nulo → 42501', async () => {
    const db = await novoBanco();
    await expect(exportar(db)).rejects.toMatchObject({ code: '42501' });
    await comChave(db);
    await expect(exportar(db, 'x'.repeat(43))).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('select concluir_backup($1)', ['x'.repeat(43)])).rejects.toMatchObject({ code: '42501' });
  });

  it('concluir_backup marca a data, apaga só o que terminou há mais de 1 ano e nunca o cliente', async () => {
    const db = await novoBanco();
    await comChave(db);
    const { rows: [c] } = await db.query<{ id: string }>(
      `insert into clientes (nome, telefone) values ('Ana', '5511987654321') returning id`,
    );
    for (const dias of [-366, -364, 1]) {
      await db.query(
        `insert into agendamentos (cliente_id, inicio, fim, status) values ($1, now() + make_interval(days => $2) - interval '30 minutes', now() + make_interval(days => $2), 'concluido')`,
        [c.id, dias],
      );
    }
    const { rows: [r] } = await db.query<{ j: { apagados: number } }>('select concluir_backup($1) j', [CHAVE]);
    expect(r.j).toEqual({ apagados: 1 });
    expect((await db.query('select 1 from agendamentos')).rows).toHaveLength(2);
    expect((await db.query('select 1 from clientes')).rows).toHaveLength(1);
    const { rows: [u] } = await db.query<{ ok: boolean }>(
      `select ultimo_backup > now() - interval '1 minute' as ok from configuracoes`,
    );
    expect(u.ok).toBe(true);
  });

  it('definir_chave_backup só para o dono', async () => {
    const db = await novoBanco();
    await db.query(`insert into donos (user_id) values ($1)`, [DONO]);
    await comoUsuario(db, ESTRANHO);
    await expect(db.query('select definir_chave_backup($1)', [CHAVE])).rejects.toMatchObject({ code: '42501' });
    await db.exec('reset role; set role anon');
    await expect(db.query('select definir_chave_backup($1)', [CHAVE])).rejects.toMatchObject({ code: '42501' });
    await comoUsuario(db, DONO);
    await db.query('select definir_chave_backup($1)', [CHAVE]);
    await db.exec('reset role');
    await expect(exportar(db)).resolves.toBeDefined();
  });

  it('definir_chave_backup recusa chave curta', async () => {
    const db = await novoBanco();
    await db.query(`insert into donos (user_id) values ($1)`, [DONO]);
    await comoUsuario(db, DONO);
    await expect(db.query('select definir_chave_backup($1)', ['k'.repeat(31)])).rejects.toMatchObject({ code: '22023' });
  });

  it('uma chave nova invalida a antiga', async () => {
    const db = await novoBanco();
    await comChave(db);
    await comChave(db, 'n'.repeat(43));
    await expect(exportar(db)).rejects.toMatchObject({ code: '42501' });
    await expect(exportar(db, 'n'.repeat(43))).resolves.toBeDefined();
  });

  it('backup_ativo acompanha o hash', async () => {
    const db = await novoBanco();
    const ativo = async () => (await db.query<{ b: boolean }>('select backup_ativo b from configuracoes')).rows[0].b;
    expect(await ativo()).toBe(false);
    await comChave(db);
    expect(await ativo()).toBe(true);
  });

  it('anon chama exportar_backup sem a chave certa e não recebe dados', async () => {
    const db = await novoBanco();
    await comChave(db);
    await db.exec('set role anon');
    await expect(db.query('select exportar_backup($1)', ['errada'])).rejects.toMatchObject({ code: '42501' });
  });

  it('chave_backup_confere não é executável por anon', async () => {
    const db = await novoBanco();
    await db.exec('set role anon');
    await expect(db.query('select chave_backup_confere($1)', [CHAVE])).rejects.toMatchObject({ code: '42501' });
  });
});
