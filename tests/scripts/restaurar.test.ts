// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { BancoNaoVazioError, restaurar, type Consulta } from '../../scripts/restaurar';
import type { BackupFile } from '../../src/lib/backup';
import { novoBanco } from '../helpers/pg';

const consulta = (db: PGlite): Consulta => (sql, params) => db.query(sql, params);

const S1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const C1 = 'bbbbbbbb-0000-0000-0000-000000000001';
const C2 = 'bbbbbbbb-0000-0000-0000-000000000002';

const ARQUIVO: BackupFile = {
  versao: 1,
  gerado_em: '2026-11-17T12:00:00.000Z',
  servicos: [{ id: S1, nome: 'Corte', duracao_min: 30, ativo: true }],
  clientes: [
    { id: C1, nome: 'Ana', telefone: '5511900000001', criado_em: '2026-11-01T10:00:00.000Z' },
    { id: C2, nome: 'Bia', telefone: '5511900000002', criado_em: '2026-11-02T10:00:00.000Z' },
  ],
  agendamentos: [
    { id: 'cccccccc-0000-0000-0000-000000000001', cliente_id: C1, servico_id: S1, inicio: '2026-11-17T13:00:00.000Z', fim: '2026-11-17T13:30:00.000Z', status: 'marcado', observacao: null, origem: 'dono' },
    { id: 'cccccccc-0000-0000-0000-000000000002', cliente_id: C2, servico_id: S1, inicio: '2026-11-17T13:30:00.000Z', fim: '2026-11-17T14:00:00.000Z', status: 'confirmado', observacao: 'barba também', origem: 'link' },
    { id: 'cccccccc-0000-0000-0000-000000000003', cliente_id: C1, servico_id: null, inicio: '2026-11-10T13:00:00.000Z', fim: '2026-11-10T13:30:00.000Z', status: 'concluido', observacao: null, origem: 'dono' },
  ],
  horarios_ajuste: [{ id: 'dddddddd-0000-0000-0000-000000000001', inicio: '2026-11-17T22:00:00.000Z', tipo: 'extra' }],
  configuracoes: [
    {
      nome_negocio: 'Barbearia', fuso: 'America/Sao_Paulo',
      expediente: { 0: [], 1: [], 2: [{ inicio: '09:00', fim: '12:00' }], 3: [], 4: [], 5: [], 6: [] },
      folgas: ['2026-12-25'], passo_min: 30, antecedencia_min: 60,
      modelo_livres: 'Livres: {horarios}', modelo_lembrete: 'Oi {nome}', ultimo_backup: '2026-11-17T12:00:00.000Z',
      dias_abertos: 21, link_ativo: false, telefone_negocio: '5511900001111', modelo_cancelamento: 'Não vai dar, {nome}.',
    },
  ],
};

const iso = (v: unknown) => new Date(v as string).toISOString();

// o PGlite demora alguns segundos para iniciar quando a suíte roda em paralelo
describe('restaurar', { timeout: 30_000 }, () => {
  it('ida e volta: restaurar num banco limpo reproduz os mesmos dados', async () => {
    const db = await novoBanco();
    await restaurar(consulta(db), ARQUIVO, { confirmarSubstituir: false });

    const clientes = (await db.query<Record<string, unknown>>('select * from clientes order by nome')).rows;
    expect(clientes.map((c) => ({ ...c, criado_em: iso(c.criado_em) }))).toEqual(ARQUIVO.clientes);

    expect((await db.query('select * from servicos')).rows).toEqual(ARQUIVO.servicos);

    const ags = (await db.query<Record<string, unknown>>(
      'select id, cliente_id, servico_id, inicio, fim, status, observacao, origem from agendamentos order by id',
    )).rows;
    expect(ags.map((a) => ({ ...a, inicio: iso(a.inicio), fim: iso(a.fim) }))).toEqual(ARQUIVO.agendamentos);

    const ajustes = (await db.query<Record<string, unknown>>('select id, inicio, tipo from horarios_ajuste')).rows;
    expect(ajustes.map((a) => ({ ...a, inicio: iso(a.inicio) }))).toEqual(ARQUIVO.horarios_ajuste);

    const [cfg] = (await db.query<Record<string, unknown>>('select * from configuracoes')).rows;
    expect({ ...cfg, ultimo_backup: iso(cfg.ultimo_backup) }).toEqual({ id: 1, ...ARQUIVO.configuracoes[0], backup_chave_hash: null, backup_ativo: false });
  });

  it('banco com dados e sem confirmação aborta sem alterar nada', async () => {
    const db = await novoBanco();
    await db.query(`insert into clientes (nome, telefone) values ('Já existe', '5511988887777')`);
    await expect(restaurar(consulta(db), ARQUIVO, { confirmarSubstituir: false })).rejects.toBeInstanceOf(BancoNaoVazioError);
    const { rows } = await db.query<{ nome: string }>('select nome from clientes');
    expect(rows).toEqual([{ nome: 'Já existe' }]);
    expect((await db.query('select * from configuracoes where nome_negocio = $1', ['Meu negócio'])).rows).toHaveLength(1);
  });

  it('com confirmação substitui tudo', async () => {
    const db = await novoBanco();
    await db.query(`insert into clientes (nome, telefone) values ('Já existe', '5511988887777')`);
    await restaurar(consulta(db), ARQUIVO, { confirmarSubstituir: true });
    const { rows } = await db.query<{ nome: string }>('select nome from clientes order by nome');
    expect(rows).toEqual([{ nome: 'Ana' }, { nome: 'Bia' }]);
  });

  it('erro no meio desfaz tudo', async () => {
    const db = await novoBanco();
    const quebrado = { ...ARQUIVO, agendamentos: [{ ...ARQUIVO.agendamentos[0], status: 'invalido' as never }] };
    await expect(restaurar(consulta(db), quebrado, { confirmarSubstituir: false })).rejects.toThrow();
    expect((await db.query('select * from clientes')).rows).toHaveLength(0);
    expect((await db.query('select * from configuracoes where nome_negocio = $1', ['Meu negócio'])).rows).toHaveLength(1);
  });

  it('recusa arquivo de outra versão', async () => {
    const db = await novoBanco();
    await expect(restaurar(consulta(db), { ...ARQUIVO, versao: 2 as 1 }, { confirmarSubstituir: true })).rejects.toThrow(/versão/);
  });

  it('recusa backup sem a linha de configuração e não mexe no banco', async () => {
    const db = await novoBanco();
    await expect(restaurar(consulta(db), { ...ARQUIVO, configuracoes: [] }, { confirmarSubstituir: true })).rejects.toThrow(
      /configura/,
    );
    expect((await db.query('select * from configuracoes')).rows).toHaveLength(1);
    expect((await db.query('select * from clientes')).rows).toHaveLength(0);
  });

  it('backup da v1 (sem horarios_ajuste) restaura normalmente', async () => {
    const db = await novoBanco();
    const { horarios_ajuste: _, ...v1 } = ARQUIVO;
    await restaurar(consulta(db), v1 as BackupFile, { confirmarSubstituir: false });
    expect((await db.query('select * from clientes')).rows).toHaveLength(2);
    expect((await db.query('select * from horarios_ajuste')).rows).toHaveLength(0);
  });
});
