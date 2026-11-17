// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { sp } from '../helpers/cenario';
import { comoUsuario, DONO, novoBanco } from '../helpers/pg';

// Pessoa 1 (sem nome, ordem 1) vem da migração 0006. Ana (ordem 2) e Bia (ordem 3) têm nome.
const AGORA = sp('2026-11-16 20:00'); // segunda à noite
const ANA = 'eeeeeeee-0000-0000-0000-0000000000a1';
const BIA = 'eeeeeeee-0000-0000-0000-0000000000b1';
const JOAO = 'bbbbbbbb-0000-0000-0000-000000000001';
const MARIA = 'bbbbbbbb-0000-0000-0000-000000000002';
const CORTE = 'dddddddd-0000-0000-0000-000000000001';
const CODIGO_ANA = 'a'.repeat(64);

type Cliente = { inicio: string; fim: string; cliente: string; servico: string | null; status: string; telefone?: string };
type Agenda =
  | { ok: false }
  | { ok: true; negocio: string; pessoa: string; whatsapp: boolean; hoje: string; amanha: string; dias: { data: string; clientes: Cliente[] }[] };

async function banco(): Promise<PGlite> {
  const db = await novoBanco();
  await db.query(`insert into pessoas (id, nome, ordem) values ($1, 'Ana', 2), ($2, 'Bia', 3)`, [ANA, BIA]);
  await db.query(`insert into servicos (id, nome, duracao_min, ativo) values ($1, 'Corte', 30, true)`, [CORTE]);
  await db.query(
    `insert into clientes (id, nome, telefone) values ($1, 'João', '5511987654321'), ($2, 'Maria', '5511911112222')`,
    [JOAO, MARIA],
  );
  await db.query('update pessoas set link_codigo = $1 where id = $2', [CODIGO_ANA, ANA]);
  return db;
}

async function agendar(db: PGlite, pessoa: string, cliente: string, local: string, status = 'marcado', servico: string | null = CORTE) {
  const ini = sp(local);
  await db.query(
    `insert into agendamentos (cliente_id, servico_id, inicio, fim, status, origem, pessoa_id) values ($1, $2, $3, $4, $5, 'dono', $6)`,
    [cliente, servico, ini.toISOString(), new Date(ini.getTime() + 30 * 60_000).toISOString(), status, pessoa],
  );
}

async function agenda(db: PGlite, codigo: string | null, agora = AGORA): Promise<Agenda> {
  const { rows: [r] } = await db.query<{ j: Agenda }>('select agenda_da_equipe_em($1, $2) j', [codigo, agora.toISOString()]);
  return r.j;
}

const nomesDe = (a: Agenda, i: number) => (a.ok ? a.dias[i].clientes.map((c) => c.cliente) : []);

describe('gerar_link_pessoa', { timeout: 60_000 }, () => {
  it('devolve 64 hex e troca o anterior', async () => {
    const db = await banco();
    await db.query('insert into donos (user_id) values ($1)', [DONO]);
    await comoUsuario(db, DONO);
    const { rows: [a] } = await db.query<{ c: string }>('select gerar_link_pessoa($1) c', [BIA]);
    const { rows: [b] } = await db.query<{ c: string }>('select gerar_link_pessoa($1) c', [BIA]);
    expect(a.c).toMatch(/^[0-9a-f]{64}$/);
    expect(b.c).toMatch(/^[0-9a-f]{64}$/);
    expect(b.c).not.toBe(a.c);
    const { rows: [p] } = await db.query<{ link_codigo: string }>('select link_codigo from pessoas where id = $1', [BIA]);
    expect(p.link_codigo).toBe(b.c);
  });

  it('anon não executa gerar_link_pessoa nem lê o código', async () => {
    const db = await banco();
    await db.exec('set role anon');
    await expect(db.query('select gerar_link_pessoa($1)', [ANA])).rejects.toMatchObject({ code: '42501' });
    const { rows } = await db.query('select link_codigo from pessoas');
    expect(rows).toEqual([]);
  });

  it('link_whatsapp começa desligado', async () => {
    const db = await banco();
    const { rows } = await db.query<{ link_whatsapp: boolean }>('select link_whatsapp from pessoas');
    expect(rows.every((r) => r.link_whatsapp === false)).toBe(true);
  });
});

describe('agenda_da_equipe', { timeout: 60_000 }, () => {
  it('código certo: só os clientes dela, hoje e amanhã, pela hora, com nome do negócio e da pessoa', async () => {
    const db = await banco();
    await agendar(db, ANA, JOAO, '2026-11-16 21:00');
    await agendar(db, ANA, MARIA, '2026-11-16 09:00', 'concluido', null);
    await agendar(db, BIA, MARIA, '2026-11-16 21:00'); // outra pessoa, mesmo horário
    await agendar(db, ANA, MARIA, '2026-11-17 10:00', 'confirmado');
    const a = await agenda(db, CODIGO_ANA);
    expect(a).toMatchObject({ ok: true, pessoa: 'Ana', whatsapp: false, hoje: '2026-11-16', amanha: '2026-11-17' });
    if (!a.ok) return;
    expect(a.negocio).toEqual(expect.any(String));
    expect(a.dias.map((d) => d.data)).toEqual(['2026-11-16', '2026-11-17']);
    expect(nomesDe(a, 0)).toEqual(['Maria', 'João']);
    expect(a.dias[0].clientes[0]).toMatchObject({ servico: null, status: 'concluido' });
    expect(a.dias[0].clientes[1]).toMatchObject({ servico: 'Corte', status: 'marcado', inicio: expect.any(String), fim: expect.any(String) });
    expect(nomesDe(a, 1)).toEqual(['Maria']);
  });

  it('cancelado não aparece; concluido e faltou aparecem', async () => {
    const db = await banco();
    await agendar(db, ANA, JOAO, '2026-11-17 09:00', 'cancelado');
    await agendar(db, ANA, MARIA, '2026-11-17 10:00', 'faltou');
    await agendar(db, ANA, JOAO, '2026-11-17 11:00', 'concluido');
    const a = await agenda(db, CODIGO_ANA);
    expect(a.ok && a.dias[1].clientes.map((c) => c.status)).toEqual(['faltou', 'concluido']);
  });

  it('virada do dia: 23:30 de hoje fica em hoje; depois de amanhã não aparece', async () => {
    const db = await banco();
    await agendar(db, ANA, JOAO, '2026-11-16 23:30'); // 02:30Z do dia 17
    await agendar(db, ANA, MARIA, '2026-11-18 00:30');
    await agendar(db, ANA, MARIA, '2026-11-17 23:30');
    const a = await agenda(db, CODIGO_ANA);
    expect(nomesDe(a, 0)).toEqual(['João']);
    expect(nomesDe(a, 1)).toEqual(['Maria']);
  });

  it('WhatsApp desligado: o telefone não aparece no JSON inteiro; ligado: cada cliente tem telefone', async () => {
    const db = await banco();
    await agendar(db, ANA, JOAO, '2026-11-16 21:00');
    const sem = await agenda(db, CODIGO_ANA);
    expect(JSON.stringify(sem)).not.toContain('5511987654321');
    expect(JSON.stringify(sem)).not.toContain('telefone');
    await db.query('update pessoas set link_whatsapp = true where id = $1', [ANA]);
    const com = await agenda(db, CODIGO_ANA);
    expect(com).toMatchObject({ whatsapp: true });
    expect(com.ok && com.dias[0].clientes[0].telefone).toBe('5511987654321');
  });

  it('código trocado, inválido, vazio e null respondem só {ok:false}', async () => {
    const db = await banco();
    await db.query('update pessoas set link_codigo = $1 where id = $2', ['b'.repeat(64), ANA]);
    for (const c of [CODIGO_ANA, 'x', '', null]) expect(await agenda(db, c)).toEqual({ ok: false });
  });

  it('o código chega aparado (espaço e quebra de linha colados do WhatsApp)', async () => {
    const db = await banco();
    expect(await agenda(db, ` ${CODIGO_ANA}\n`)).toMatchObject({ ok: true });
  });

  it('pessoa desativada: {ok:false}; reativada: o mesmo código volta a valer', async () => {
    const db = await banco();
    await db.query('update pessoas set ativo = false where id = $1', [ANA]);
    expect(await agenda(db, CODIGO_ANA)).toEqual({ ok: false });
    await db.query('update pessoas set ativo = true where id = $1', [ANA]);
    expect(await agenda(db, CODIGO_ANA)).toMatchObject({ ok: true });
  });

  it('pessoa sem nome aparece como "Pessoa N" pela posição entre as ativas', async () => {
    const db = await banco();
    await db.query('update pessoas set nome = null where id = $1', [BIA]);
    await db.query('update pessoas set link_codigo = $1 where id = $2', ['c'.repeat(64), BIA]);
    expect(await agenda(db, 'c'.repeat(64))).toMatchObject({ ok: true, pessoa: 'Pessoa 3' });
  });

  it('a pública chama com o relógio de agora e anon pode chamar', async () => {
    const db = await banco();
    await db.exec('set role anon');
    const { rows: [r] } = await db.query<{ j: Agenda }>('select agenda_da_equipe($1) j', [CODIGO_ANA]);
    expect(r.j).toMatchObject({ ok: true, pessoa: 'Ana' });
    await expect(db.query('select agenda_da_equipe_em($1, now())', [CODIGO_ANA])).rejects.toMatchObject({ code: '42501' });
  });
});
