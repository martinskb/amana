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
    // números diferentes no mesmo IP: o que trava aqui é o limite por IP, não o por WhatsApp
    for (const [h, tel] of [['09:00', '11912345671'], ['09:30', '11912345672'], ['10:30', '11912345673']]) {
      expect((await agendar('Ana', tel, iso(`2026-11-17 ${h}`))).ok).toBe(true);
    }
    expect(await agendar('Ana', '11912345674', iso('2026-11-17 11:00'))).toEqual({ ok: false, erro: 'limite' });
    expect((await agendar('Bia', '11912340000', iso('2026-11-17 11:00'), AGORA, '2.2.2.2')).ok).toBe(true);
    const depois = new Date(AGORA.getTime() + 61 * 60_000);
    expect((await agendar('Ana', '11912345674', iso('2026-11-17 11:30'), depois)).ok).toBe(true);
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

  // SEC-001: o número identifica o cliente que volta, mas o nome digitado fica guardado para o dono conferir
  it('o agendamento pelo link guarda o nome digitado, mesmo quando o número já é de outro cliente', async () => {
    const { db, agendar } = await preparar();
    expect((await agendar('  Bia  ', '5511987654321', NOVE)).ok).toBe(true);
    const { rows } = await db.query(
      `select c.nome, a.nome_informado from agendamentos a join clientes c on c.id = a.cliente_id where a.inicio = $1`, [NOVE]);
    expect(rows).toEqual([{ nome: 'João', nome_informado: 'Bia' }]);
  });

  // SEC-002: freios que não dependem do IP
  it('mesmo WhatsApp: no máximo 2 horários futuros pelo link; o 3º → limite, mesmo de outro IP', async () => {
    const { agendar } = await preparar();
    expect((await agendar('Ana', '11912345678', iso('2026-11-17 09:00'), AGORA, '1.1.1.1')).ok).toBe(true);
    expect((await agendar('Ana', '11912345678', iso('2026-11-17 09:30'), AGORA, '2.2.2.2')).ok).toBe(true);
    expect(await agendar('Ana', '11912345678', iso('2026-11-17 10:30'), AGORA, '3.3.3.3')).toEqual({ ok: false, erro: 'limite' });
    expect((await agendar('Bia', '11912340000', iso('2026-11-17 10:30'), AGORA, '3.3.3.3')).ok).toBe(true);
  });

  it('o limite por WhatsApp conta só horários futuros e ativos: o cliente que volta a cada duas semanas passa', async () => {
    const { db, agendar } = await preparar();
    expect((await agendar('Ana', '11912345678', iso('2026-11-17 09:00'), AGORA, '1.1.1.1')).ok).toBe(true);
    expect((await agendar('Ana', '11912345678', iso('2026-11-17 09:30'), AGORA, '2.2.2.2')).ok).toBe(true);
    await db.query(`update agendamentos set status = 'cancelado' where inicio = $1`, [iso('2026-11-17 09:30')]);
    expect((await agendar('Ana', '11912345678', iso('2026-11-17 10:30'), AGORA, '3.3.3.3')).ok).toBe(true);
    // duas semanas depois, os horários antigos já passaram
    const depois = sp('2026-11-30 20:00');
    expect((await agendar('Ana', '11912345678', iso('2026-12-01 09:00'), depois, '4.4.4.4')).ok).toBe(true);
  });

  it('teto geral: 10 agendamentos pelo link por hora, de IPs e números diferentes; o 11º → limite; 61 min depois passa', async () => {
    const { db, agendar } = await preparar();
    const livres = (await livresEm(db, AGORA)).slice(0, 12);
    for (let i = 0; i < 10; i++) {
      expect((await agendar(`P${i}`, `119123400${String(i).padStart(2, '0')}`, livres[i], AGORA, `10.0.0.${i}`)).ok).toBe(true);
    }
    expect(await agendar('P10', '11912340010', livres[10], AGORA, '10.0.0.10')).toEqual({ ok: false, erro: 'limite' });
    const depois = new Date(AGORA.getTime() + 61 * 60_000);
    expect((await agendar('P10', '11912340010', livres[10], depois, '10.0.0.10')).ok).toBe(true);
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

describe('correções da revisão final', { timeout: 30_000 }, () => {
  it.each(CASOS_TELEFONE.filter(([, e]) => e !== null))(
    'o que a página manda ("+" + normalizado de %j) volta igual no servidor',
    async (_entrada, esperado) => {
      const db = await novoBanco();
      const { rows: [r] } = await db.query<{ t: string | null }>('select normalizar_telefone($1) t', [`+${esperado}`]);
      expect(r.t).toBe(esperado);
    },
  );

  it('corrida perdida (trava do banco) não deixa cliente órfão', async () => {
    const db = await novoBanco();
    await inserirCenario(db);
    // simula a outra pessoa gravando o mesmo horário entre a checagem e o insert
    await db.exec(`
      create function simula_corrida() returns trigger language plpgsql as $$
      begin raise exclusion_violation using message = 'corrida'; end $$;
      create trigger simula_corrida before insert on agendamentos for each row execute function simula_corrida();
    `);
    const { rows: [r] } = await db.query<{ r: { ok: boolean; erro?: string } }>(
      'select agendar_publico_em($1, $2, $3, $4, $5) r',
      ['Nova', '11955554444', iso('2026-11-17 09:00'), sp('2026-11-16 20:00').toISOString(), '1.1.1.1'],
    );
    expect(r.r).toEqual({ ok: false, erro: 'horario_indisponivel' });
    expect((await db.query(`select 1 from clientes where telefone = '5511955554444'`)).rows).toHaveLength(0);
  });

  it('a checagem do limite é serializada por IP (trava consultiva na transação)', async () => {
    const db = await novoBanco();
    const { rows: [f] } = await db.query<{ src: string }>(
      `select prosrc as src from pg_proc where proname = 'agendar_publico_em'`,
    );
    expect(f.src).toMatch(/pg_advisory_xact_lock\(\s*hashtext\(\s*'agendar_publico:'\s*\|\|\s*p_ip\s*\)\s*\)/);
    expect(f.src.indexOf('pg_advisory_xact_lock')).toBeLessThan(f.src.indexOf('from tentativas_publicas'));
  });

  it('o teto geral é serializado por uma trava única antes de contar', async () => {
    const db = await novoBanco();
    const { rows: [f] } = await db.query<{ src: string }>(
      `select prosrc as src from pg_proc where proname = 'agendar_publico_em'`,
    );
    expect(f.src).toMatch(/pg_advisory_xact_lock\(\s*hashtext\(\s*'agendar_publico'\s*\)\s*\)/);
    expect(f.src.search(/hashtext\(\s*'agendar_publico'\s*\)/)).toBeLessThan(f.src.indexOf('from tentativas_publicas'));
  });

  it('IPv6 é agrupado por /64; IPv4 e valor estranho ficam como estão', async () => {
    const db = await novoBanco();
    const ip = async (h: string) => {
      await db.exec(`set request.headers = '${JSON.stringify({ 'cf-connecting-ip': h })}'`);
      return (await db.query<{ ip: string }>('select ip_cliente() ip')).rows[0].ip;
    };
    expect(await ip('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(await ip('2001:db8:1:2:bbbb:cccc:dddd:2')).toBe('2001:db8:1:2::/64');
    expect(await ip('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
    expect(await ip('9.9.9.9')).toBe('9.9.9.9');
    expect(await ip('lixo:::x')).toBe('lixo:::x');
  });
});
