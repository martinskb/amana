// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { editarAgendamento, listAgendamentos } from '../../src/data/agendamentos';
import { criarExtra, fecharHorario, listAjustes } from '../../src/data/ajustes';
import {
  apagarPessoa,
  criarPessoa,
  desativarPessoa,
  listPessoas,
  pessoaTemAgendamentos,
  reativarPessoa,
  salvarFolgasPessoa,
  salvarPessoa,
} from '../../src/data/pessoas';
import { agendarPublico } from '../../src/data/publico';
import { dbTeste as db, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

const linhaAna = { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: ['2026-11-20'], pessoa_servicos: [{ servico_id: 's1' }, { servico_id: 's2' }] };

describe('dados das pessoas', () => {
  it('listPessoas ordena por ordem e traz os serviços de pessoa_servicos', async () => {
    let params: URLSearchParams | undefined;
    servidor.use(
      http.get(`${REST}/pessoas`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json([linhaAna, { id: 'p2', nome: null, ativo: false, ordem: 2, folgas: [], pessoa_servicos: [] }]);
      }),
    );
    await expect(listPessoas(db)).resolves.toEqual([
      { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: ['2026-11-20'], servicos: ['s1', 's2'] },
      { id: 'p2', nome: null, ativo: false, ordem: 2, folgas: [], servicos: [] },
    ]);
    expect(params!.get('select')).toContain('pessoa_servicos(servico_id)');
    expect(params!.get('order')).toBe('ordem.asc');
  });

  it('criarPessoa usa ordem = maior + 1, apara o nome e liga os serviços', async () => {
    const corpos: Record<string, unknown> = {};
    servidor.use(
      http.get(`${REST}/pessoas`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get('order')).toBe('ordem.desc');
        expect(p.get('limit')).toBe('1');
        return HttpResponse.json([{ ordem: 4 }]);
      }),
      http.post(`${REST}/pessoas`, async ({ request }) => {
        corpos.pessoa = await request.json();
        return HttpResponse.json({ id: 'p9', nome: 'Bia', ativo: true, ordem: 5, folgas: [] }, { status: 201 });
      }),
      http.post(`${REST}/pessoa_servicos`, async ({ request }) => {
        corpos.servicos = await request.json();
        return new HttpResponse(null, { status: 201 });
      }),
    );
    await expect(criarPessoa(db, { nome: '  Bia ', servicos: ['s1'] })).resolves.toEqual({
      id: 'p9', nome: 'Bia', ativo: true, ordem: 5, folgas: [], servicos: ['s1'],
    });
    expect(corpos.pessoa).toEqual({ nome: 'Bia', ordem: 5 });
    expect(corpos.servicos).toEqual([{ pessoa_id: 'p9', servico_id: 's1' }]);
  });

  it('criarPessoa sem ninguém antes começa em 1; nome em branco vira null; sem serviço não grava ligação', async () => {
    let corpo: unknown;
    servidor.use(
      http.get(`${REST}/pessoas`, () => HttpResponse.json([])),
      http.post(`${REST}/pessoas`, async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json({ id: 'p1', nome: null, ativo: true, ordem: 1, folgas: [] }, { status: 201 });
      }),
    );
    const p = await criarPessoa(db, { nome: '   ', servicos: [] });
    expect(corpo).toEqual({ nome: null, ordem: 1 });
    expect(p.servicos).toEqual([]);
  });

  it('salvarPessoa grava o nome e troca os serviços', async () => {
    const feito: string[] = [];
    servidor.use(
      http.patch(`${REST}/pessoas`, async ({ request }) => {
        expect(new URL(request.url).searchParams.get('id')).toBe('eq.p1');
        expect(await request.json()).toEqual({ nome: null });
        feito.push('nome');
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${REST}/pessoa_servicos`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('pessoa_id')).toBe('eq.p1');
        feito.push('apaga');
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(`${REST}/pessoa_servicos`, async ({ request }) => {
        expect(await request.json()).toEqual([
          { pessoa_id: 'p1', servico_id: 's2' },
          { pessoa_id: 'p1', servico_id: 's3' },
        ]);
        feito.push('liga');
        return new HttpResponse(null, { status: 201 });
      }),
    );
    await salvarPessoa(db, 'p1', { nome: '', servicos: ['s2', 's3'] });
    expect(feito).toEqual(['nome', 'apaga', 'liga']);
  });

  it('salvarFolgasPessoa, reativarPessoa e apagarPessoa', async () => {
    const pedidos: unknown[] = [];
    servidor.use(
      http.patch(`${REST}/pessoas`, async ({ request }) => {
        pedidos.push(['patch', new URL(request.url).searchParams.get('id'), await request.json()]);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${REST}/pessoas`, ({ request }) => {
        pedidos.push(['delete', new URL(request.url).searchParams.get('id')]);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await salvarFolgasPessoa(db, 'p1', ['2026-11-20']);
    await reativarPessoa(db, 'p2');
    await apagarPessoa(db, 'p3');
    expect(pedidos).toEqual([
      ['patch', 'eq.p1', { folgas: ['2026-11-20'] }],
      ['patch', 'eq.p2', { ativo: true }],
      ['delete', 'eq.p3'],
    ]);
  });

  it('desativarPessoa chama desativar_pessoa(p) e devolve a resposta', async () => {
    let corpo: unknown;
    servidor.use(
      http.post(`${REST}/rpc/desativar_pessoa`, async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json({ ok: false, erro: 'clientes_futuros' });
      }),
    );
    await expect(desativarPessoa(db, 'p2')).resolves.toEqual({ ok: false, erro: 'clientes_futuros' });
    expect(corpo).toEqual({ p: 'p2' });
  });

  it('pessoaTemAgendamentos procura um agendamento qualquer dela', async () => {
    let resposta: unknown[] = [];
    servidor.use(
      http.get(`${REST}/agendamentos`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get('pessoa_id')).toBe('eq.p1');
        expect(p.get('limit')).toBe('1');
        return HttpResponse.json(resposta);
      }),
    );
    await expect(pessoaTemAgendamentos(db, 'p1')).resolves.toBe(false);
    resposta = [{ id: 'a1' }];
    await expect(pessoaTemAgendamentos(db, 'p1')).resolves.toBe(true);
  });
});

describe('dados existentes com pessoa', () => {
  it('listAgendamentos e listAjustes pedem pessoa_id', async () => {
    const selects: string[] = [];
    servidor.use(
      http.get(`${REST}/agendamentos`, ({ request }) => {
        selects.push(new URL(request.url).searchParams.get('select')!);
        return HttpResponse.json([]);
      }),
      http.get(`${REST}/horarios_ajuste`, ({ request }) => {
        selects.push(new URL(request.url).searchParams.get('select')!);
        return HttpResponse.json([]);
      }),
    );
    await listAgendamentos(db, '2026-11-17', '2026-11-17');
    await listAjustes(db, '2026-11-17', '2026-11-17');
    expect(selects.every((s) => s.split(',').map((c) => c.trim()).includes('pessoa_id'))).toBe(true);
  });

  it('fecharHorario manda a pessoa (null = o negócio todo); criarExtra manda a pessoa quando há', async () => {
    const corpos: unknown[] = [];
    servidor.use(
      http.post(`${REST}/horarios_ajuste`, async ({ request }) => {
        corpos.push(await request.json());
        return new HttpResponse(null, { status: 201 });
      }),
    );
    await fecharHorario(db, '2026-11-17T12:00:00.000Z', null);
    await fecharHorario(db, '2026-11-17T12:30:00.000Z', 'p2');
    await criarExtra(db, '2026-11-17T22:00:00.000Z', 'p2');
    expect(corpos).toEqual([
      { inicio: '2026-11-17T12:00:00.000Z', tipo: 'fechado', pessoa_id: null },
      { inicio: '2026-11-17T12:30:00.000Z', tipo: 'fechado', pessoa_id: 'p2' },
      { inicio: '2026-11-17T22:00:00.000Z', tipo: 'extra', pessoa_id: 'p2' },
    ]);
  });

  it('editarAgendamento aceita trocar a pessoa', async () => {
    let corpo: unknown;
    servidor.use(
      http.patch(`${REST}/agendamentos`, async ({ request }) => {
        corpo = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await editarAgendamento(db, 'a1', { pessoa_id: 'p2' });
    expect(corpo).toEqual({ pessoa_id: 'p2' });
  });

  it('agendarPublico com pessoa envia { ..., servico, pessoa } e devolve o nome', async () => {
    let corpo: unknown;
    servidor.use(
      http.post(`${REST}/rpc/agendar_publico`, async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json({ ok: true, inicio: '2026-11-18T12:00:00Z', pessoa: 'Ana' });
      }),
    );
    await expect(agendarPublico(db, 'Bia', '5511987654321', '2026-11-18T12:00:00Z', 's1', 'p1')).resolves.toEqual({
      ok: true, inicio: '2026-11-18T12:00:00Z', pessoa: 'Ana',
    });
    expect(corpo).toEqual({ nome: 'Bia', telefone: '5511987654321', inicio: '2026-11-18T12:00:00Z', servico: 's1', pessoa: 'p1' });
  });
});
