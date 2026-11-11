// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inserirCenario, livresEm, sp } from '../helpers/cenario';
import { novoBanco } from '../helpers/pg';
import { CASOS_TELEFONE } from '../lib/casosTelefone';

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

describe('agendar_publico', { timeout: 30_000 }, () => {
  const AGORA = sp('2026-11-16 20:00');
  const NOVE = iso('2026-11-17 09:00');
  type R = { ok: boolean; erro?: string; inicio?: string };

  async function preparar() {
    const db = await novoBanco();
    await inserirCenario(db);
    const agendar = async (nome: string, telefone: string, inicio: string, agora = AGORA, ip = '1.1.1.1') => {
      const { rows: [r] } = await db.query<{ r: R }>('select agendar_publico_em($1, $2, $3, $4, $5) r', [
        nome, telefone, inicio, agora.toISOString(), ip,
      ]);
      return r.r;
    };
    return { db, agendar };
  }

  it('sucesso cria cliente e agendamento pelo link', async () => {
    const { db, agendar } = await preparar();
    const r = await agendar('  Ana  ', '(11) 91234-5678', NOVE);
    expect(r.ok).toBe(true);
    expect(new Date(r.inicio!).toISOString()).toBe(NOVE);
    const { rows: [a] } = await db.query<Record<string, unknown>>(
      `select c.nome, c.telefone, a.status, a.origem, a.servico_id, a.fim - a.inicio as duracao
       from agendamentos a join clientes c on c.id = a.cliente_id where a.inicio = $1`, [NOVE]);
    expect(a).toMatchObject({ nome: 'Ana', telefone: '5511912345678', status: 'marcado', origem: 'link', servico_id: null });
    expect(String(a.duracao)).toMatch(/00:30:00|30 min/);
  });

  it('link desligado → link_fechado', async () => {
    const { db, agendar } = await preparar();
    await db.query('update configuracoes set link_ativo = false');
    expect(await agendar('Ana', '11912345678', NOVE)).toEqual({ ok: false, erro: 'link_fechado' });
  });

  it.each([['   '], ['x'.repeat(81)]])('nome %j → dados_invalidos', async (nome) => {
    const { agendar } = await preparar();
    expect(await agendar(nome, '11912345678', NOVE)).toEqual({ ok: false, erro: 'dados_invalidos' });
  });

  it('telefone inválido → dados_invalidos', async () => {
    const { agendar } = await preparar();
    expect(await agendar('Ana', '98765-4321', NOVE)).toEqual({ ok: false, erro: 'dados_invalidos' });
  });

  it("nome 'José 💈' é gravado igual", async () => {
    const { db, agendar } = await preparar();
    expect((await agendar('José 💈', '11912345678', NOVE)).ok).toBe(true);
    const { rows } = await db.query(`select nome from clientes where telefone = '5511912345678'`);
    expect(rows).toEqual([{ nome: 'José 💈' }]);
  });

  it.each(CASOS_TELEFONE)('normalizar_telefone(%j) = %j', async (entrada, esperado) => {
    const db = await novoBanco();
    const { rows: [r] } = await db.query<{ t: string | null }>('select normalizar_telefone($1) t', [entrada]);
    expect(r.t).toBe(esperado);
  });

  it('quarto agendamento do mesmo IP na mesma hora → limite; outro IP passa; depois de 61 min passa', async () => {
    const { agendar } = await preparar();
    for (const h of ['09:00', '09:30', '10:30']) {
      expect((await agendar('Ana', '11912345678', iso(`2026-11-17 ${h}`))).ok).toBe(true);
    }
    expect(await agendar('Ana', '11912345678', iso('2026-11-17 11:00'))).toEqual({ ok: false, erro: 'limite' });
    expect((await agendar('Bia', '11912340000', iso('2026-11-17 11:00'), AGORA, '2.2.2.2')).ok).toBe(true);
    const depois = new Date(AGORA.getTime() + 61 * 60_000);
    expect((await agendar('Ana', '11912345678', iso('2026-11-17 11:30'), depois)).ok).toBe(true);
  });

  it('horário fora da lista ou ocupado → horario_indisponivel', async () => {
    const { agendar } = await preparar();
    expect(await agendar('Ana', '11912345678', iso('2026-11-17 03:00'))).toEqual({ ok: false, erro: 'horario_indisponivel' });
    expect(await agendar('Ana', '11912345678', iso('2026-11-17 14:00'))).toEqual({ ok: false, erro: 'horario_indisponivel' });
    expect(await agendar('Ana', '11912345678', iso('2026-11-17 10:00'))).toEqual({ ok: false, erro: 'horario_indisponivel' });
  });

  it('mesmo número com outro nome reaproveita o cliente e mantém o nome antigo', async () => {
    const { db, agendar } = await preparar();
    expect((await agendar('Bia', '5511987654321', NOVE)).ok).toBe(true);
    const { rows } = await db.query(`select nome from clientes where telefone = '5511987654321'`);
    expect(rows).toEqual([{ nome: 'João' }]);
  });

  it('duas reservas no mesmo horário: a segunda é recusada e só existe um agendamento', async () => {
    const { db, agendar } = await preparar();
    expect((await agendar('Ana', '11912345678', NOVE)).ok).toBe(true);
    expect(await agendar('Bia', '11912340000', NOVE, AGORA, '2.2.2.2')).toEqual({ ok: false, erro: 'horario_indisponivel' });
    expect((await db.query('select 1 from agendamentos where inicio = $1', [NOVE])).rows).toHaveLength(1);
  });

  it('tentativas com mais de 30 dias são apagadas a cada sucesso', async () => {
    const { db, agendar } = await preparar();
    await db.query(`insert into tentativas_publicas (ip, criado_em) values ('9.9.9.9', $1)`, [
      new Date(AGORA.getTime() - 31 * 86_400_000).toISOString(),
    ]);
    expect((await agendar('Ana', '11912345678', NOVE)).ok).toBe(true);
    const { rows } = await db.query<{ ip: string }>('select ip from tentativas_publicas');
    expect(rows).toEqual([{ ip: '1.1.1.1' }]);
  });

  it('ip_cliente lê só cf-connecting-ip (nem x-forwarded-for nem x-real-ip); sem ele → desconhecido', async () => {
    const db = await novoBanco();
    await db.exec(`set request.headers = '{"cf-connecting-ip":"9.9.9.9","x-forwarded-for":"6.6.6.6"}'`);
    expect((await db.query<{ ip: string }>('select ip_cliente() ip')).rows[0].ip).toBe('9.9.9.9');
    // x-real-ip pode ser forjado por quem chama (verificado no projeto real): não é usado
    await db.exec(`set request.headers = '{"x-real-ip":"8.8.8.8"}'`);
    expect((await db.query<{ ip: string }>('select ip_cliente() ip')).rows[0].ip).toBe('desconhecido');
    await db.exec(`set request.headers = '{"x-forwarded-for":"6.6.6.6"}'`);
    expect((await db.query<{ ip: string }>('select ip_cliente() ip')).rows[0].ip).toBe('desconhecido');
    await db.exec(`reset request.headers`);
    expect((await db.query<{ ip: string }>('select ip_cliente() ip')).rows[0].ip).toBe('desconhecido');
  });

  it('anon executa agendar_publico, mas não as funções internas, e continua sem ler clientes', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    await db.exec('set role anon');
    const { rows: [r] } = await db.query<{ r: R }>(`select agendar_publico('Ana', '11912345678', now() - interval '1 day') r`);
    expect(r.r).toEqual({ ok: false, erro: 'horario_indisponivel' });
    for (const sql of [
      `select agendar_publico_em('a', '11912345678', now(), now(), 'x')`,
      `select normalizar_telefone('11912345678')`,
      `select ip_cliente()`,
    ]) {
      await expect(db.query(sql)).rejects.toMatchObject({ code: '42501' });
    }
    expect((await db.query('select * from clientes')).rows).toHaveLength(0);
  });
});
