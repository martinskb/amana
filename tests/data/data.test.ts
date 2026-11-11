// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { criarAgendamento, editarAgendamento, listAgendamentos, listAgendamentosDoCliente } from '../../src/data/agendamentos';
import { findOrCreateCliente } from '../../src/data/clientes';
import { getConfig } from '../../src/data/configuracoes';
import { ConflitoDeHorarioError, SemConexaoError } from '../../src/data/erros';
import { listServicos } from '../../src/data/servicos';
import { dbTeste as db, REST, servidor, usarServidor } from '../helpers/msw';

usarServidor();

const conflito = () =>
  HttpResponse.json(
    { code: '23P01', message: 'conflicting key value violates exclusion constraint', details: null, hint: null },
    { status: 409 },
  );

const novo = {
  cliente_id: 'c1',
  servico_id: 's1',
  inicio: '2026-11-17T13:00:00.000Z',
  fim: '2026-11-17T14:00:00.000Z',
  status: 'marcado' as const,
  observacao: null,
};

describe('camada de dados', () => {
  it('criarAgendamento traduz 23P01 em ConflitoDeHorarioError', async () => {
    servidor.use(http.post(`${REST}/agendamentos`, conflito));
    await expect(criarAgendamento(db, novo)).rejects.toBeInstanceOf(ConflitoDeHorarioError);
  });

  it('editarAgendamento traduz 23P01 em ConflitoDeHorarioError', async () => {
    servidor.use(http.patch(`${REST}/agendamentos`, conflito));
    await expect(editarAgendamento(db, 'a1', { inicio: novo.inicio, fim: novo.fim })).rejects.toBeInstanceOf(
      ConflitoDeHorarioError,
    );
  });

  it('findOrCreateCliente reaproveita cliente com o mesmo telefone', async () => {
    let posts = 0;
    const ana = { id: 'c1', nome: 'Ana', telefone: '5511987654321', criado_em: '2026-11-01T00:00:00Z' };
    servidor.use(
      http.get(`${REST}/clientes`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('telefone')).toBe('eq.5511987654321');
        return HttpResponse.json([ana]);
      }),
      http.post(`${REST}/clientes`, () => {
        posts++;
        return HttpResponse.json([]);
      }),
    );
    await expect(findOrCreateCliente(db, 'Ana Paula', '5511987654321')).resolves.toEqual(ana);
    expect(posts).toBe(0);
  });

  it('findOrCreateCliente cria quando não existe', async () => {
    const criado = { id: 'c2', nome: 'Bia', telefone: '5511900000000', criado_em: '2026-11-01T00:00:00Z' };
    servidor.use(
      http.get(`${REST}/clientes`, () => HttpResponse.json([])),
      http.post(`${REST}/clientes`, async ({ request }) => {
        expect(await request.json()).toEqual({ nome: 'Bia', telefone: '5511900000000' });
        return HttpResponse.json(criado, { status: 201 });
      }),
    );
    await expect(findOrCreateCliente(db, ' Bia ', '5511900000000')).resolves.toEqual(criado);
  });

  it('listAgendamentos usa limites em hora local', async () => {
    let params: URLSearchParams | undefined;
    servidor.use(
      http.get(`${REST}/agendamentos`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      }),
    );
    await listAgendamentos(db, '2026-11-17', '2026-11-17');
    expect(params!.getAll('inicio')).toEqual(['gte.2026-11-17T03:00:00.000Z', 'lt.2026-11-18T03:00:00.000Z']);
  });

  it('listAgendamentosDoCliente filtra pelo cliente e ordena decrescente', async () => {
    let params: URLSearchParams | undefined;
    servidor.use(
      http.get(`${REST}/agendamentos`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      }),
    );
    await listAgendamentosDoCliente(db, 'c1');
    expect(params!.get('cliente_id')).toBe('eq.c1');
    expect(params!.get('order')).toBe('inicio.desc');
  });

  it('listServicos({soAtivos:true}) filtra ativo=eq.true', async () => {
    let params: URLSearchParams | undefined;
    servidor.use(
      http.get(`${REST}/servicos`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      }),
    );
    await listServicos(db, { soAtivos: true });
    expect(params!.get('ativo')).toBe('eq.true');
  });

  it('falha de rede vira SemConexaoError', async () => {
    servidor.use(http.get(`${REST}/configuracoes`, () => HttpResponse.error()));
    await expect(getConfig(db)).rejects.toBeInstanceOf(SemConexaoError);
  });

  it('resposta 503 vira SemConexaoError', async () => {
    servidor.use(http.get(`${REST}/configuracoes`, () => new HttpResponse('pausado', { status: 503 })));
    await expect(getConfig(db)).rejects.toBeInstanceOf(SemConexaoError);
  });
});
