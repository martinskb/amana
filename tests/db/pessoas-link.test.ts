// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { inserirCenario, PESSOA_1, sp } from '../helpers/cenario';
import { novoBanco } from '../helpers/pg';

// Cenário: Pessoa 1 (sem nome, ordem 1) já tem cliente na terça 14:00. Ana (ordem 2) e Bia (ordem 3)
// têm nome. Corte (30 min) e Barba (30 min) ativos, ligados a todas as ativas.
// no formato do link: sem milissegundos
const iso = (local: string) => sp(local).toISOString().replace('.000Z', 'Z');
const AGORA = sp('2026-11-16 20:00'); // segunda à noite
type R = { ok: boolean; erro?: string; inicio?: string; pessoa?: string | null };
type PessoaServico = { id: string; horarios: string[] };
type ServicoPub = { id: string; nome: string; duracao_min: number; horarios: string[]; pessoas: PessoaServico[]; com_escolha: boolean };
type Pub = { horarios: string[]; pessoas: { id: string; nome: string }[]; servicos: ServicoPub[] };

const ANA = 'eeeeeeee-0000-0000-0000-0000000000a1';
const BIA = 'eeeeeeee-0000-0000-0000-0000000000b1';
const CORTE = 'dddddddd-0000-0000-0000-000000000001';
const BARBA = 'dddddddd-0000-0000-0000-000000000002';

async function banco(opcoes: { pessoas?: boolean; servicos?: boolean } = {}): Promise<PGlite> {
  const { pessoas = true, servicos = true } = opcoes;
  const db = await novoBanco();
  await inserirCenario(db);
  if (pessoas) {
    await db.query(`insert into pessoas (id, nome, ordem) values ($1, 'Ana', 2), ($2, 'Bia', 3)`, [ANA, BIA]);
  }
  if (servicos) {
    await db.query(`insert into servicos (id, nome, duracao_min, ativo) values ($1, 'Corte', 30, true), ($2, 'Barba', 30, true)`, [
      CORTE, BARBA,
    ]);
  }
  return db;
}

async function publico(db: PGlite): Promise<Pub> {
  const { rows: [r] } = await db.query<{ j: Pub }>(`select horarios_publicos() j`);
  return r.j;
}

let ip = 0;
async function agendar(db: PGlite, inicio: string, servico: string | null, pessoa: string | null = null, telefone?: string) {
  ip += 1;
  const tel = telefone ?? `119${String(10_000_000 + ip).slice(-8)}`;
  const { rows: [r] } = await db.query<{ r: R }>('select agendar_publico_em($1, $2, $3, $4, $5, $6, $7) r', [
    'Cliente', tel, inicio, AGORA.toISOString(), `10.0.0.${ip}`, servico, pessoa,
  ]);
  return r.r;
}

async function pessoaDe(db: PGlite, inicio: string): Promise<string[]> {
  const { rows } = await db.query<{ pessoa_id: string }>(
    `select pessoa_id from agendamentos where inicio = $1 and status = 'marcado' order by criado_em`, [inicio],
  );
  return rows.map((r) => r.pessoa_id);
}

/** horarios_publicos num instante fixo (a interna que a pública chama com now()). */
async function publicoEm(db: PGlite, agora: Date): Promise<Pub> {
  const { rows: [r] } = await db.query<{ j: Pub }>(`select horarios_publicos_em($1) j`, [agora.toISOString()]);
  return r.j;
}

describe('horarios_publicos com pessoas', { timeout: 60_000 }, () => {
  it('não expõe pessoa sem nome (nem o id), em lugar nenhum do JSON', async () => {
    const db = await banco();
    const { rows: [r] } = await db.query<{ t: string }>(`select horarios_publicos()::text t`);
    expect(r.t).not.toContain(PESSOA_1);
    const j = JSON.parse(r.t) as Pub;
    expect(j.pessoas).toEqual([{ id: ANA, nome: 'Ana' }, { id: BIA, nome: 'Bia' }]);
    for (const s of j.servicos) expect(s.pessoas.map((p) => p.id)).toEqual([ANA, BIA]);
  });

  it('a sem nome entra na união do serviço', async () => {
    const db = await banco();
    // só a Pessoa 1 faz Barba
    await db.query(`delete from pessoa_servicos where servico_id = $1 and pessoa_id <> $2`, [BARBA, PESSOA_1]);
    const j = await publicoEm(db, AGORA);
    const barba = j.servicos.find((s) => s.id === BARBA)!;
    expect(barba.horarios).toContain(iso('2026-11-17 09:30'));
    expect(barba.pessoas).toEqual([]);
    expect(barba.com_escolha).toBe(false);
  });

  it('serviço que ninguém ativo faz não aparece', async () => {
    const db = await banco();
    await db.query(`delete from pessoa_servicos where servico_id = $1 and pessoa_id <> $2`, [BARBA, BIA]);
    await db.query(`update pessoas set ativo = false where id = $1`, [BIA]);
    const j = await publico(db);
    expect(j.servicos.map((s) => s.id)).toEqual([CORTE]);
  });

  it('com_escolha: quando alguém com nome faz o serviço e mais de uma ativa o faz', async () => {
    const db = await banco();
    await db.query(`delete from pessoa_servicos where servico_id = $1 and pessoa_id <> $2`, [BARBA, ANA]);
    const j = await publico(db);
    expect(j.servicos.find((s) => s.id === CORTE)!.com_escolha).toBe(true);
    // só a Ana faz Barba: não há o que escolher
    const barba = j.servicos.find((s) => s.id === BARBA)!;
    expect(barba.com_escolha).toBe(false);
    expect(barba.pessoas.map((p) => p.id)).toEqual([ANA]);
  });

  it('cada pessoa do serviço traz os horários dela; a união traz os de todas', async () => {
    const db = await banco();
    const j = await publicoEm(db, AGORA);
    const corte = j.servicos.find((s) => s.id === CORTE)!;
    const ana = corte.pessoas.find((p) => p.id === ANA)!;
    // 14:00 de terça: a Pessoa 1 está ocupada, a Ana não
    expect(ana.horarios).toContain(iso('2026-11-17 14:00'));
    expect(corte.horarios).toContain(iso('2026-11-17 14:00'));
  });

  it('negócio de uma pessoa: igual a antes, mais pessoas: [] e sem escolha', async () => {
    const db = await banco({ pessoas: false });
    const j = await publicoEm(db, AGORA);
    expect(j.pessoas).toEqual([]);
    expect(j.horarios).not.toContain(iso('2026-11-17 14:00'));
    expect(j.horarios).toContain(iso('2026-11-17 09:00'));
    for (const s of j.servicos) {
      expect(s.pessoas).toEqual([]);
      expect(s.com_escolha).toBe(false);
      expect(s.horarios).toEqual(j.horarios);
    }
    expect(Object.keys(j).sort()).toEqual(['horarios', 'link_ativo', 'nome_negocio', 'pessoas', 'servicos', 'telefone_negocio']);
  });
});

describe('agendar pelo link com pessoa', { timeout: 60_000 }, () => {
  it('com pessoa escolhida: grava nela e devolve o nome', async () => {
    const db = await banco();
    const nove = iso('2026-11-17 09:00');
    expect(await agendar(db, nove, CORTE, BIA)).toEqual({ ok: true, inicio: nove, pessoa: 'Bia' });
    expect(await pessoaDe(db, nove)).toEqual([BIA]);
  });

  it('pessoa que não faz o serviço → servico_invalido', async () => {
    const db = await banco();
    await db.query(`delete from pessoa_servicos where servico_id = $1 and pessoa_id = $2`, [BARBA, ANA]);
    expect(await agendar(db, iso('2026-11-17 09:00'), BARBA, ANA)).toEqual({ ok: false, erro: 'servico_invalido' });
  });

  it('pessoa sem nome, desativada ou inexistente → servico_invalido', async () => {
    const db = await banco();
    await db.query(`update pessoas set ativo = false where id = $1`, [BIA]);
    const nove = iso('2026-11-17 09:00');
    expect(await agendar(db, nove, CORTE, PESSOA_1)).toEqual({ ok: false, erro: 'servico_invalido' });
    expect(await agendar(db, nove, CORTE, BIA)).toEqual({ ok: false, erro: 'servico_invalido' });
    expect(await agendar(db, nove, CORTE, 'eeeeeeee-0000-0000-0000-00000000ffff')).toEqual({ ok: false, erro: 'servico_invalido' });
  });

  it('pessoa ocupada → horario_indisponivel', async () => {
    const db = await banco();
    const nove = iso('2026-11-17 09:00');
    expect(await agendar(db, nove, CORTE, ANA)).toMatchObject({ ok: true });
    expect(await agendar(db, nove, CORTE, ANA)).toEqual({ ok: false, erro: 'horario_indisponivel' });
  });

  it('sem preferência: quem tem menos clientes no dia; empate → menor ordem', async () => {
    const db = await banco();
    // terça: a Pessoa 1 já tem um cliente (14:00); Ana e Bia nenhum → Ana (ordem 2)
    const terca = iso('2026-11-17 09:00');
    expect(await agendar(db, terca, CORTE)).toEqual({ ok: true, inicio: terca, pessoa: 'Ana' });
    // quarta: ninguém tem cliente → Pessoa 1 (ordem 1), que não tem nome
    const quarta = iso('2026-11-18 09:00');
    expect(await agendar(db, quarta, CORTE)).toEqual({ ok: true, inicio: quarta, pessoa: null });
    expect(await pessoaDe(db, quarta)).toEqual([PESSOA_1]);
  });

  it('sem preferência só considera quem faz o serviço', async () => {
    const db = await banco();
    await db.query(`delete from pessoa_servicos where servico_id = $1 and pessoa_id <> $2`, [BARBA, BIA]);
    const nove = iso('2026-11-18 09:00');
    expect(await agendar(db, nove, BARBA)).toMatchObject({ ok: true, pessoa: 'Bia' });
  });

  it('pedidos sem preferência no mesmo horário: cada um vai para outra pessoa; sem ninguém livre → horario_indisponivel', async () => {
    const db = await banco();
    const nove = iso('2026-11-18 09:00');
    expect(await agendar(db, nove, CORTE)).toMatchObject({ ok: true, pessoa: null });
    expect(await agendar(db, nove, CORTE)).toMatchObject({ ok: true, pessoa: 'Ana' });
    expect(await agendar(db, nove, CORTE)).toMatchObject({ ok: true, pessoa: 'Bia' });
    expect(await agendar(db, nove, CORTE)).toEqual({ ok: false, erro: 'horario_indisponivel' });
    expect(await pessoaDe(db, nove)).toEqual([PESSOA_1, ANA, BIA]);
  });

  it('sem nenhum serviço ativo: sem preferência escolhe entre todas', async () => {
    const db = await banco({ servicos: false });
    // 14:00 de terça: a Pessoa 1 está ocupada → Ana
    const duas = iso('2026-11-17 14:00');
    expect(await agendar(db, duas, null)).toMatchObject({ ok: true, pessoa: 'Ana' });
    // e a escolhida, sem serviço, também vale
    expect(await agendar(db, iso('2026-11-17 15:00'), null, BIA)).toMatchObject({ ok: true, pessoa: 'Bia' });
  });

  it('chamada no formato antigo (argumentos nomeados, sem pessoa) continua funcionando', async () => {
    const db = await banco();
    await db.exec('set role anon');
    const { rows: [r] } = await db.query<{ r: R }>(
      `select agendar_publico(nome => 'Ana', telefone => '11912345678', inicio => now() - interval '1 day', servico => $1::uuid) r`,
      [CORTE],
    );
    expect(r.r).toEqual({ ok: false, erro: 'horario_indisponivel' });
    await expect(db.query(`select horarios_publicos_em(now())`)).rejects.toMatchObject({ code: '42501' });
    const { rows: [comPessoa] } = await db.query<{ r: R }>(
      `select agendar_publico(nome => 'Ana', telefone => '11912345678', inicio => now() - interval '1 day', servico => $1::uuid, pessoa => $2::uuid) r`,
      [CORTE, ANA],
    );
    expect(comPessoa.r).toEqual({ ok: false, erro: 'horario_indisponivel' });
    await db.exec('reset role');
    // e a interna com 6 argumentos (sem pessoa) marca sem preferência
    const { rows: [seis] } = await db.query<{ r: R }>('select agendar_publico_em($1, $2, $3, $4, $5, $6) r', [
      'Ana', '11912345678', iso('2026-11-18 10:00'), AGORA.toISOString(), '9.9.9.9', CORTE,
    ]);
    expect(seis.r).toMatchObject({ ok: true });
  });
});
