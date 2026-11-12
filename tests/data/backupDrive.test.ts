// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { definirChaveBackup, getConfig } from '../../src/data/configuracoes';
import { SemConexaoError } from '../../src/data/erros';
import { exportBackup } from '../../src/lib/backup';
import { dbTeste as db, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

describe('dados do backup no Drive', () => {
  it('getConfig não pede "*" nem o hash e pede backup_ativo', async () => {
    let select = '';
    servidor.use(
      http.get(`${REST}/configuracoes`, ({ request }) => {
        select = new URL(request.url).searchParams.get('select') ?? '';
        return HttpResponse.json([{ id: 1, backup_ativo: true }]);
      }),
    );
    await getConfig(db);
    expect(select).not.toContain('*');
    expect(select).not.toContain('backup_chave_hash');
    expect(select).toContain('backup_ativo');
  });

  it('exportBackup pede configuracoes sem o hash e sem backup_ativo', async () => {
    const selects: Record<string, string> = {};
    servidor.use(
      http.get(`${REST}/:tabela`, ({ params, request }) => {
        selects[params.tabela as string] = new URL(request.url).searchParams.get('select') ?? '';
        return HttpResponse.json([]);
      }),
    );
    await exportBackup(db);
    expect(selects.configuracoes).not.toContain('backup_chave_hash');
    expect(selects.configuracoes).not.toContain('backup_ativo');
    expect(selects.configuracoes).not.toContain('*');
    expect(selects.clientes).toBe('*');
  });

  it('definirChaveBackup envia { chave }', async () => {
    let corpo: unknown;
    servidor.use(
      http.post(`${REST}/rpc/definir_chave_backup`, async ({ request }) => {
        corpo = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await definirChaveBackup(db, 'x'.repeat(43));
    expect(corpo).toEqual({ chave: 'x'.repeat(43) });
  });

  it('definirChaveBackup com 503 → SemConexaoError', async () => {
    servidor.use(http.post(`${REST}/rpc/definir_chave_backup`, () => new HttpResponse('fora', { status: 503 })));
    await expect(definirChaveBackup(db, 'x'.repeat(43))).rejects.toBeInstanceOf(SemConexaoError);
  });
});
