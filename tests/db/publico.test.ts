// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inserirCenario, livresEm, sp } from '../helpers/cenario';
import { novoBanco } from '../helpers/pg';

const iso = (local: string) => sp(local).toISOString();

describe('horarios_publicos', { timeout: 30_000 }, () => {
  it('horarios_livres_em(terça 08:30) começa em 09:30 e não traz o fechado nem o ocupado', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    const r = await livresEm(db, sp('2026-11-17 08:30'));
    expect(r[0]).toBe(iso('2026-11-17 09:30'));
    expect(r).not.toContain(iso('2026-11-17 10:00')); // fechado
    expect(r).not.toContain(iso('2026-11-17 14:00')); // marcado
    expect(r).toContain(iso('2026-11-17 15:00')); // cancelado libera
    expect(r).toContain(iso('2026-11-17 19:00')); // extra
    expect(r).toContain(iso('2026-11-20 10:00')); // extra na folga
    expect(r).not.toContain(iso('2026-11-20 11:00')); // folga
  });

  it('só até hoje + dias_abertos − 1', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    const r = await livresEm(db, sp('2026-11-17 08:30'));
    expect(r.at(-1)).toBe(iso('2026-11-30 17:30'));
  });

  it('com link_ativo = false, horarios_livres_em e horarios_publicos vêm vazios', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    await db.query('update configuracoes set link_ativo = false');
    expect(await livresEm(db, sp('2026-11-17 08:30'))).toEqual([]);
    const { rows: [r] } = await db.query<{ j: { horarios: string[]; link_ativo: boolean } }>('select horarios_publicos() j');
    expect(r.j).toMatchObject({ link_ativo: false, horarios: [] });
  });

  it('horarios_publicos traz só nome, telefone do negócio, link_ativo e horários', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    const { rows: [r] } = await db.query<{ j: Record<string, unknown> }>('select horarios_publicos() j');
    expect(Object.keys(r.j).sort()).toEqual(['horarios', 'link_ativo', 'nome_negocio', 'telefone_negocio']);
    expect(r.j).toMatchObject({ nome_negocio: 'Barbearia do Teste', telefone_negocio: '5511900001111', link_ativo: true });
    expect((r.j.horarios as string[]).every((h) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(h))).toBe(true);
  });

  it('anon executa horarios_publicos, mas não horarios_livres_em', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    await db.exec('set role anon');
    await expect(db.query('select horarios_publicos()')).resolves.toBeDefined();
    await expect(db.query('select * from horarios_livres_em(now())')).rejects.toMatchObject({ code: '42501' });
  });

  it('passo 40 com agendamento antigo 14:00–14:30: 13:40 não existe, 14:20 e 14:00 saem, 14:40 fica', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    await db.query('update configuracoes set passo_min = 40');
    const r = await livresEm(db, sp('2026-11-16 20:00'));
    expect(r).not.toContain(iso('2026-11-17 14:00'));
    expect(r).toContain(iso('2026-11-17 14:40'));
    expect(r).toContain(iso('2026-11-17 09:00'));
  });

  it('extra no mesmo início de um horário do expediente aparece uma vez só', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    await db.query(`insert into horarios_ajuste (inicio, tipo) values ($1, 'extra')`, [iso('2026-11-18 09:00')]);
    const r = await livresEm(db, sp('2026-11-16 20:00'));
    expect(r.filter((h) => h === iso('2026-11-18 09:00'))).toHaveLength(1);
  });
});
