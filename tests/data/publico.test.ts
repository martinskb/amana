// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { criarExtra, fecharHorario, listAjustes, removerAjuste } from '../../src/data/ajustes';
import { SemConexaoError } from '../../src/data/erros';
import { agendarPublico, getHorariosPublicos } from '../../src/data/publico';
import { dbTeste as db, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

describe('dados do link público', () => {
  it('agendarPublico envia { nome, telefone, inicio } e devolve o JSON', async () => {
    let corpo: unknown;
    servidor.use(
      http.post(`${REST}/rpc/agendar_publico`, async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json({ ok: false, erro: 'limite' });
      }),
    );
    await expect(agendarPublico(db, 'Ana', '5511987654321', '2026-11-18T12:00:00Z')).resolves.toEqual({
      ok: false,
      erro: 'limite',
    });
    expect(corpo).toEqual({ nome: 'Ana', telefone: '5511987654321', inicio: '2026-11-18T12:00:00Z' });
  });

  it('getHorariosPublicos devolve o JSON da função', async () => {
    const j = { nome_negocio: 'B', telefone_negocio: null, link_ativo: true, horarios: ['2026-11-18T12:00:00Z'] };
    servidor.use(http.post(`${REST}/rpc/horarios_publicos`, () => HttpResponse.json(j)));
    await expect(getHorariosPublicos(db)).resolves.toEqual(j);
  });

  it('getHorariosPublicos com 503 → SemConexaoError', async () => {
    servidor.use(http.post(`${REST}/rpc/horarios_publicos`, () => new HttpResponse('pausado', { status: 503 })));
    await expect(getHorariosPublicos(db)).rejects.toBeInstanceOf(SemConexaoError);
  });
});

describe('horários ajustados', () => {
  it('fecharHorario e criarExtra enviam o tipo certo', async () => {
    const corpos: unknown[] = [];
    servidor.use(
      http.post(`${REST}/horarios_ajuste`, async ({ request }) => {
        corpos.push(await request.json());
        return new HttpResponse(null, { status: 201 });
      }),
    );
    await fecharHorario(db, '2026-11-17T12:00:00.000Z');
    await criarExtra(db, '2026-11-17T22:00:00.000Z');
    expect(corpos).toEqual([
      { inicio: '2026-11-17T12:00:00.000Z', tipo: 'fechado' },
      { inicio: '2026-11-17T22:00:00.000Z', tipo: 'extra' },
    ]);
  });

  it('removerAjuste apaga pelo id', async () => {
    let params: URLSearchParams | undefined;
    servidor.use(
      http.delete(`${REST}/horarios_ajuste`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await removerAjuste(db, 'a1');
    expect(params!.get('id')).toBe('eq.a1');
  });

  it('listAjustes usa limites em hora local', async () => {
    let params: URLSearchParams | undefined;
    servidor.use(
      http.get(`${REST}/horarios_ajuste`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      }),
    );
    await listAjustes(db, '2026-11-17', '2026-11-17');
    expect(params!.getAll('inicio')).toEqual(['gte.2026-11-17T03:00:00.000Z', 'lt.2026-11-18T03:00:00.000Z']);
  });
});
