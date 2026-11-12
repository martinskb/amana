// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { comoUsuario, DONO, ESTRANHO, novoBanco } from '../helpers/pg';

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

// o PGlite demora alguns segundos para iniciar quando a suíte roda em paralelo
describe('esquema do banco', { timeout: 30_000 }, () => {
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
    await db.exec(`reset role; insert into donos (user_id) values ('${DONO}')`);
    await comoUsuario(db, DONO);
    const { rows } = await db.query('select * from clientes');
    expect(rows).toHaveLength(1);
  });

  it('usuário logado que não é o dono não lê nem escreve nada', async () => {
    const { db } = await base();
    await db.exec(`insert into donos (user_id) values ('${DONO}')`);
    await comoUsuario(db, ESTRANHO);
    expect((await db.query('select * from clientes')).rows).toHaveLength(0);
    expect((await db.query('select * from configuracoes')).rows).toHaveLength(0);
    await expect(db.query('select * from donos')).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query(`insert into clientes (nome, telefone) values ('X', '5511900000000')`),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(db.query(`insert into donos (user_id) values ('${ESTRANHO}')`)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

describe('esquema v2', { timeout: 30_000 }, () => {
  const MODELO_CANCELAMENTO =
    'Oi {nome}, infelizmente não vou conseguir te atender {dia} às {hora}. Quer marcar outro horário? {link}';

  it('configuracoes tem os padrões da v2', async () => {
    const db = await novoBanco();
    const { rows } = await db.query('select dias_abertos, link_ativo, telefone_negocio, modelo_cancelamento from configuracoes');
    expect(rows).toEqual([
      { dias_abertos: 14, link_ativo: true, telefone_negocio: null, modelo_cancelamento: MODELO_CANCELAMENTO },
    ]);
  });

  it('o modelo de horários livres do seed termina com o link', async () => {
    const db = await novoBanco();
    const { rows: [c] } = await db.query<{ modelo_livres: string }>('select modelo_livres from configuracoes');
    expect(c.modelo_livres.endsWith('Marque aqui: {link}')).toBe(true);
  });

  it('agendamento sem serviço e com origem link é aceito; origem desconhecida é recusada', async () => {
    const db = await novoBanco();
    const { rows: [c] } = await db.query<{ id: string }>(
      `insert into clientes (nome, telefone) values ('Ana', '5511987654321') returning id`,
    );
    const inserir = (inicio: string, origem: string) =>
      db.query(
        `insert into agendamentos (cliente_id, inicio, fim, origem) values ($1, $2, $2::timestamptz + interval '30 minutes', $3)`,
        [c.id, inicio, origem],
      );
    await inserir('2026-11-17 10:00-03', 'link');
    const { rows } = await db.query('select servico_id, origem from agendamentos');
    expect(rows).toEqual([{ servico_id: null, origem: 'link' }]);
    await expect(inserir('2026-11-17 11:00-03', 'site')).rejects.toMatchObject({ code: '23514' });
    const { rows: [padrao] } = await db.query<{ column_default: string }>(
      `select column_default from information_schema.columns where table_name = 'agendamentos' and column_name = 'origem'`,
    );
    expect(padrao.column_default).toContain('dono');
  });

  it('horarios_ajuste aceita fechado e extra, recusa outro tipo e duplicata', async () => {
    const db = await novoBanco();
    const ajustar = (tipo: string) =>
      db.query(`insert into horarios_ajuste (inicio, tipo) values ('2026-11-17 10:00-03', $1)`, [tipo]);
    await ajustar('fechado');
    await ajustar('extra');
    await expect(ajustar('pausa')).rejects.toMatchObject({ code: '23514' });
    await expect(ajustar('fechado')).rejects.toMatchObject({ code: '23505' });
  });

  it('telefone internacional é aceito; 7 dígitos é recusado', async () => {
    const db = await novoBanco();
    await db.query(`insert into clientes (nome, telefone) values ('Rui', '351912345678')`);
    await expect(
      db.query(`insert into clientes (nome, telefone) values ('X', '1234567')`),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('estranho não lê horarios_ajuste; ninguém lê tentativas_publicas pela API', async () => {
    const db = await novoBanco();
    await db.exec(`
      insert into donos (user_id) values ('${DONO}');
      insert into horarios_ajuste (inicio, tipo) values ('2026-11-17 10:00-03', 'fechado');
      insert into tentativas_publicas (ip) values ('1.1.1.1');
    `);
    await comoUsuario(db, ESTRANHO);
    expect((await db.query('select * from horarios_ajuste')).rows).toHaveLength(0);
    await comoUsuario(db, DONO);
    expect((await db.query('select * from horarios_ajuste')).rows).toHaveLength(1);
    await expect(db.query('select * from tentativas_publicas')).rejects.toMatchObject({ code: '42501' });
    await db.exec('reset role; set role anon');
    await expect(db.query('select * from tentativas_publicas')).rejects.toMatchObject({ code: '42501' });
  });
});
