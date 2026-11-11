// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { exportBackup } from '../../src/lib/backup';
import { dbTeste, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

describe('exportBackup', () => {
  it('com tabelas vazias devolve versao 1 e quatro listas vazias', async () => {
    servidor.use(http.get(`${REST}/:tabela`, () => HttpResponse.json([])));
    const b = await exportBackup(dbTeste);
    expect(b).toMatchObject({ versao: 1, clientes: [], servicos: [], agendamentos: [], configuracoes: [] });
    expect(Number.isNaN(Date.parse(b.gerado_em))).toBe(false);
  });

  it('traz as linhas cruas de cada tabela', async () => {
    servidor.use(
      http.get(`${REST}/:tabela`, ({ params }) =>
        HttpResponse.json(params.tabela === 'clientes' ? [{ id: 'c1', nome: 'Ana', telefone: '5511900000000' }] : []),
      ),
    );
    const b = await exportBackup(dbTeste);
    expect(b.clientes).toEqual([{ id: 'c1', nome: 'Ana', telefone: '5511900000000' }]);
  });
});
