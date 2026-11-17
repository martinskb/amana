// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { novoBanco } from '../helpers/pg';

const sql = (nome: string) => readFileSync(resolve(__dirname, '../../scripts/demo', nome), 'utf8');

describe('dados de demonstração do vídeo', { timeout: 30_000 }, () => {
  it('popular monta pessoas e agendamentos, roda de novo sem duplicar, e limpar volta ao que era', async () => {
    const db = await novoBanco();
    await db.exec(`insert into servicos (nome, duracao_min) values
      ('Corte', 30), ('Barba', 30), ('Corte + barba', 60), ('Pigmentação', 60)`);
    await db.exec(`insert into pessoa_servicos select p.id, s.id from pessoas p, servicos s on conflict do nothing`);
    await db.exec(`insert into clientes (nome, telefone) values ('Cliente real', '5511900000000')`);
    const antes = (await db.query('select count(*)::int n from clientes')).rows;

    await db.exec(sql('demo-popular.sql'));
    await db.exec(sql('demo-popular.sql'));
    const pessoas = (await db.query<{ nome: string }>('select nome from pessoas order by ordem')).rows.map((p) => p.nome);
    expect(pessoas).toEqual(['Zé', 'Rafa', 'Bia']);
    const { rows: [ag] } = await db.query<{ n: number }>(
      `select count(*)::int n from agendamentos where cliente_id::text like 'de300000-%'`,
    );
    expect(ag.n).toBe(26);
    // Bia só faz corte e pigmentação
    const { rows: bia } = await db.query<{ nome: string }>(
      `select s.nome from pessoa_servicos ps join servicos s on s.id = ps.servico_id
       where ps.pessoa_id = 'de300000-0000-4000-8000-000000000002' order by s.nome`,
    );
    expect(bia.map((s) => s.nome)).toEqual(['Corte', 'Pigmentação']);

    await db.exec(sql('demo-limpar.sql'));
    expect((await db.query('select count(*)::int n from clientes')).rows).toEqual(antes);
    expect((await db.query('select nome from pessoas')).rows).toEqual([{ nome: null }]);
    expect((await db.query('select count(*)::int n from agendamentos')).rows).toEqual([{ n: 0 }]);
  });
});
