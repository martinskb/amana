// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { inserirCenario, livresEm, sp } from '../helpers/cenario';
import { novoBanco } from '../helpers/pg';

const iso = (local: string) => sp(local).toISOString();
const AGORA = sp('2026-11-17 08:30'); // terça; antecedência 60 → primeiro horário 09:30
type Servico = { id: string; nome: string; duracao_min: number; horarios: string[] };
type R = { ok: boolean; erro?: string; inicio?: string };

const CORTE = 'dddddddd-0000-0000-0000-000000000001';
const COMBO = 'dddddddd-0000-0000-0000-000000000002';
const PIGMENTACAO = 'dddddddd-0000-0000-0000-000000000003';
const INATIVO = 'dddddddd-0000-0000-0000-000000000004';

async function comServicos(): Promise<PGlite> {
  const db = await novoBanco();
  await inserirCenario(db);
  await db.query(`insert into servicos (id, nome, duracao_min, ativo) values
    ($1, 'Corte', 30, true), ($2, 'Corte + barba', 60, true), ($3, 'Pigmentação', 45, true), ($4, 'Luzes', 90, false)`,
  [CORTE, COMBO, PIGMENTACAO, INATIVO]);
  return db;
}

async function iniciosPara(db: PGlite, duracao: number, agora = AGORA): Promise<string[]> {
  const { rows } = await db.query<{ h: Date }>('select h from inicios_para_duracao_em($1, $2) h', [agora.toISOString(), duracao]);
  return rows.map((r) => new Date(r.h).toISOString());
}

async function agendar(db: PGlite, inicio: string, servico: string | null, telefone = '11912345678', agora = sp('2026-11-16 20:00')) {
  const { rows: [r] } = await db.query<{ r: R }>('select agendar_publico_em($1, $2, $3, $4, $5, $6) r', [
    'Ana', telefone, inicio, agora.toISOString(), '1.1.1.1', servico,
  ]);
  return r.r;
}

describe('horários por duração do serviço', { timeout: 30_000 }, () => {
  it('serviço do tamanho do passo: os mesmos horários livres de sempre', async () => {
    const db = await comServicos();
    expect(await iniciosPara(db, 30)).toEqual(await livresEm(db, AGORA));
  });

  it('60 min só começa onde há dois blocos seguidos livres (fechado, almoço, fim do dia e extra solto ficam de fora)', async () => {
    const db = await comServicos();
    const r = await iniciosPara(db, 60);
    expect(r).not.toContain(iso('2026-11-17 09:30')); // 10:00 fechado
    expect(r).toContain(iso('2026-11-17 11:00'));
    expect(r).not.toContain(iso('2026-11-17 11:30')); // 12:00 é almoço
    expect(r).not.toContain(iso('2026-11-17 13:30')); // fora do expediente
    expect(r).toContain(iso('2026-11-17 14:30')); // 15:00 cancelado libera
    expect(r).not.toContain(iso('2026-11-17 17:30')); // 18:00 fecha
    expect(r).not.toContain(iso('2026-11-17 19:00')); // extra de um bloco só
  });

  it('45 min com passo 30 precisa de dois blocos', async () => {
    const db = await comServicos();
    const r = await iniciosPara(db, 45);
    expect(r).toContain(iso('2026-11-17 11:00'));
    expect(r).not.toContain(iso('2026-11-17 11:30'));
  });
});

describe('horarios_publicos com serviços', { timeout: 30_000 }, () => {
  it('traz os serviços ativos em ordem de nome, cada um com os seus horários; inativos não aparecem', async () => {
    const db = await comServicos();
    const { rows: [r] } = await db.query<{ j: { servicos: Servico[] } }>('select horarios_publicos() j');
    expect(r.j.servicos.map((s) => [s.nome, s.duracao_min])).toEqual([
      ['Corte', 30], ['Corte + barba', 60], ['Pigmentação', 45],
    ]);
    const combo = r.j.servicos.find((s) => s.id === COMBO)!;
    const corte = r.j.servicos.find((s) => s.id === CORTE)!;
    expect(combo.horarios.length).toBeGreaterThan(0);
    expect(combo.horarios.length).toBeLessThan(corte.horarios.length);
    expect(combo.horarios.every((h) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(h))).toBe(true);
  });

  it('sem serviços ativos, servicos vem vazio', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    const { rows: [r] } = await db.query<{ j: { servicos: Servico[] } }>('select horarios_publicos() j');
    expect(r.j.servicos).toEqual([]);
  });
});

describe('agendar pelo link com serviço', { timeout: 30_000 }, () => {
  it('grava o serviço e a duração dele (Corte + barba = 60 min)', async () => {
    const db = await comServicos();
    const onze = iso('2026-11-17 11:00');
    expect(await agendar(db, onze, COMBO)).toMatchObject({ ok: true });
    const { rows: [a] } = await db.query<{ servico_id: string; fim: Date }>('select servico_id, fim from agendamentos where inicio = $1', [onze]);
    expect(a.servico_id).toBe(COMBO);
    expect(new Date(a.fim).toISOString()).toBe(iso('2026-11-17 12:00'));
  });

  it('depois de um serviço de 60 min, o bloco seguinte deixa de ser oferecido', async () => {
    const db = await comServicos();
    await agendar(db, iso('2026-11-17 11:00'), COMBO);
    expect(await livresEm(db, AGORA)).not.toContain(iso('2026-11-17 11:30'));
  });

  it('serviço longo onde o segundo bloco está ocupado → horario_indisponivel', async () => {
    const db = await comServicos();
    expect(await agendar(db, iso('2026-11-17 13:30'), COMBO)).toEqual({ ok: false, erro: 'horario_indisponivel' });
    expect(await agendar(db, iso('2026-11-17 11:30'), COMBO)).toEqual({ ok: false, erro: 'horario_indisponivel' });
  });

  it('com serviços ativos, sem serviço ou com serviço inativo/inexistente → servico_invalido', async () => {
    const db = await comServicos();
    const nove = iso('2026-11-17 09:00');
    expect(await agendar(db, nove, null)).toEqual({ ok: false, erro: 'servico_invalido' });
    expect(await agendar(db, nove, INATIVO)).toEqual({ ok: false, erro: 'servico_invalido' });
    expect(await agendar(db, nove, 'eeeeeeee-0000-0000-0000-000000000000')).toEqual({ ok: false, erro: 'servico_invalido' });
  });

  it('sem nenhum serviço ativo, o link continua marcando um bloco sem serviço', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    const nove = iso('2026-11-17 09:00');
    expect(await agendar(db, nove, null)).toMatchObject({ ok: true });
  });

  it('anon chama agendar_publico com serviço (o app antigo, sem serviço, recebe servico_invalido) e não a interna', async () => {
    const db = await comServicos();
    await db.exec('set role anon');
    const { rows: [comServico] } = await db.query<{ r: R }>(
      `select agendar_publico('Ana', '11912345678', now() - interval '1 day', $1::uuid) r`, [CORTE]);
    expect(comServico.r).toEqual({ ok: false, erro: 'horario_indisponivel' });
    const { rows: [antigo] } = await db.query<{ r: R }>(`select agendar_publico('Ana', '11912345678', now() + interval '1 day') r`);
    expect(antigo.r).toEqual({ ok: false, erro: 'servico_invalido' });
    await expect(db.query(`select * from inicios_para_duracao_em(now(), 30)`)).rejects.toMatchObject({ code: '42501' });
  });
});
