// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gerarLinkPessoa, getAgendaEquipe, salvarWhatsappPessoa } from '../../src/data/equipe';
import { dbTeste as db, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

describe('dados do link da equipe', () => {
  it('getAgendaEquipe chama agenda_da_equipe com o código aparado e devolve o JSON', async () => {
    let corpo: unknown;
    servidor.use(
      http.post(`${REST}/rpc/agenda_da_equipe`, async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json({ ok: false });
      }),
    );
    await expect(getAgendaEquipe(db, '  abc\n')).resolves.toEqual({ ok: false });
    expect(corpo).toEqual({ codigo: 'abc' });
  });

  it('gerarLinkPessoa chama gerar_link_pessoa(p) e devolve o código', async () => {
    let corpo: unknown;
    servidor.use(
      http.post(`${REST}/rpc/gerar_link_pessoa`, async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json('f'.repeat(64));
      }),
    );
    await expect(gerarLinkPessoa(db, 'p2')).resolves.toBe('f'.repeat(64));
    expect(corpo).toEqual({ p: 'p2' });
  });

  it('salvarWhatsappPessoa grava link_whatsapp na pessoa', async () => {
    let pedido: unknown[] = [];
    servidor.use(
      http.patch(`${REST}/pessoas`, async ({ request }) => {
        pedido = [new URL(request.url).searchParams.get('id'), await request.json()];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await salvarWhatsappPessoa(db, 'p1', true);
    expect(pedido).toEqual(['eq.p1', { link_whatsapp: true }]);
  });
});
