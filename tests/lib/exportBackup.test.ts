// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { exportBackup } from '../../src/lib/backup';
import { dbTeste, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

describe('exportBackup', () => {
  it('com tabelas vazias devolve versao 2 e as listas vazias, com pessoas e pessoa_servicos', async () => {
    servidor.use(http.get(`${REST}/:tabela`, () => HttpResponse.json([])));
    const b = await exportBackup(dbTeste);
    expect(b).toMatchObject({
      versao: 2, clientes: [], servicos: [], agendamentos: [], configuracoes: [], horarios_ajuste: [], pessoas: [], pessoa_servicos: [],
    });
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

  it('pagina as tabelas grandes (o Supabase devolve no máximo 1000 linhas por vez)', async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: String(i).padStart(5, '0') }));
    servidor.use(
      http.get(`${REST}/:tabela`, ({ params, request }) => {
        if (params.tabela !== 'agendamentos') return HttpResponse.json([]);
        const q = new URL(request.url).searchParams;
        const offset = Number(q.get('offset') ?? 0);
        const limit = Math.min(Number(q.get('limit') ?? 1000), 1000);
        return HttpResponse.json(linhas.slice(offset, offset + limit));
      }),
    );
    const b = await exportBackup(dbTeste);
    expect(b.agendamentos).toHaveLength(2500);
    expect(b.agendamentos.at(-1)).toEqual({ id: '02499' });
  });

  it('pessoa_servicos (sem coluna id) é ordenada pelas chaves', async () => {
    let ordem: string | null = null;
    servidor.use(
      http.get(`${REST}/:tabela`, ({ params, request }) => {
        if (params.tabela === 'pessoa_servicos') {
          ordem = new URL(request.url).searchParams.get('order');
          return HttpResponse.json([{ pessoa_id: 'p1', servico_id: 's1' }]);
        }
        return HttpResponse.json([]);
      }),
    );
    const b = await exportBackup(dbTeste);
    expect(ordem).toBe('pessoa_id.asc,servico_id.asc');
    expect(b.pessoa_servicos).toEqual([{ pessoa_id: 'p1', servico_id: 's1' }]);
  });
});
