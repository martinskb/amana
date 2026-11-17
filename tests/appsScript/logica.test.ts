import { describe, expect, it } from 'vitest';
import { carregarLogica, deVm } from '../helpers/appsScript';

const F = 'America/Sao_Paulo';
const L = carregarLogica();

const util = [{ inicio: '09:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];
const DADOS = {
  versao: 1,
  gerado_em: '2026-11-15T06:02:00Z',
  clientes: [{ id: 'c1', nome: 'João', telefone: '5511987654321', criado_em: '2026-11-01T13:00:00Z' }],
  servicos: [{ id: 's1', nome: 'Corte', duracao_min: 30, ativo: true }],
  agendamentos: [
    { id: 'a2', cliente_id: 'c1', servico_id: null, inicio: '2026-11-18T12:00:00Z', fim: '2026-11-18T12:30:00Z', status: 'marcado', origem: 'link', observacao: null },
    { id: 'a1', cliente_id: 'c1', servico_id: 's1', inicio: '2026-11-17T17:30:00Z', fim: '2026-11-17T18:00:00Z', status: 'concluido', origem: 'dono', observacao: 'barba' },
  ],
  horarios_ajuste: [],
  configuracoes: [{
    nome_negocio: 'Barbearia do João', telefone_negocio: '5511900001111', passo_min: 30, dias_abertos: 14,
    folgas: ['2026-12-25'], expediente: { 0: [], 1: util, 2: util, 3: util, 4: util, 5: util, 6: [] },
  }],
};
const VAZIO = { ...DADOS, clientes: [], servicos: [], agendamentos: [] };

describe('logica.js do script de backup', () => {
  it('linhasAgendamentos em hora de São Paulo, em ordem, em português', () => {
    expect(deVm(L.linhasAgendamentos(DADOS, F))).toEqual([
      ['Data', 'Hora', 'Cliente', 'WhatsApp', 'Serviço', 'Pessoa', 'Situação', 'Origem', 'Observação'],
      ['17/11/2026', '14:30', 'João', '5511987654321', 'Corte', '', 'Concluído', 'Dono', 'barba'],
      ['18/11/2026', '09:00', 'João', '5511987654321', '—', '', 'Marcado', 'Link', ''],
    ]);
  });

  it('linhasClientes', () => {
    expect(deVm(L.linhasClientes(DADOS, F))).toEqual([
      ['Nome', 'WhatsApp', 'Cliente desde'],
      ['João', '5511987654321', '01/11/2026'],
    ]);
  });

  it('linhasServicos', () => {
    expect(deVm(L.linhasServicos(DADOS))).toEqual([['Nome', 'Duração (min)', 'Ativo'], ['Corte', 30, 'Sim']]);
  });

  it('linhasConfiguracoes', () => {
    const linhas = deVm(L.linhasConfiguracoes(DADOS)) as string[][];
    expect(linhas[0]).toEqual(['Campo', 'Valor']);
    expect(linhas).toContainEqual(['Nome do negócio', 'Barbearia do João']);
    expect(linhas).toContainEqual(['Folgas', '25/12/2026']);
    expect(linhas).toContainEqual(['Terça-feira', '09:00–12:00, 14:00–18:00']);
    expect(linhas).toContainEqual(['Domingo', 'fechado']);
    expect(linhas.slice(-7).map((l) => l[0])).toEqual([
      'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo',
    ]);
  });

  it('tabelas vazias geram só os cabeçalhos', () => {
    expect(deVm(L.linhasAgendamentos(VAZIO, F))).toHaveLength(1);
    expect(deVm(L.linhasClientes(VAZIO, F))).toHaveLength(1);
    expect(deVm(L.linhasServicos(VAZIO))).toHaveLength(1);
  });

  it('nomesDoBackup usa a data local', () => {
    expect(deVm(L.nomesDoBackup(new Date('2026-11-15T06:02:00Z'), F))).toEqual({
      planilha: 'Backup Agenda 2026-11-15',
      arquivo: 'backup-agenda-2026-11-15.json',
    });
    expect(deVm(L.nomesDoBackup(new Date('2026-11-16T02:30:00Z'), F)).planilha).toBe('Backup Agenda 2026-11-15');
  });

  it('copiasParaApagar mantém as 12 mais recentes de cada tipo e ignora nomes fora do padrão', () => {
    const datas = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 0, 4 + 7 * i)).toISOString().slice(0, 10));
    const planilhas = datas.map((d) => `Backup Agenda ${d}`);
    const jsons = datas.slice(2).map((d) => `backup-agenda-${d}.json`);
    const estranhos = ['Backup Agenda (cópia)', 'minhas notas', 'backup-agenda-final.json'];
    const r = deVm(L.copiasParaApagar([...estranhos, ...planilhas.slice().reverse(), ...jsons]));
    expect(r.sort()).toEqual([planilhas[0], planilhas[1]].sort());
    expect(deVm(L.copiasParaApagar(planilhas.slice(0, 12)))).toEqual([]);
  });

  function deps(falhar?: string) {
    const chamadas: string[] = [];
    const avisos: string[] = [];
    const d = {
      nomes: { planilha: 'Backup Agenda 2026-11-15', arquivo: 'backup-agenda-2026-11-15.json' },
      exportar: () => { chamadas.push('exportar'); return DADOS; },
      criarPlanilha: (_n: string, abas: Record<string, unknown[][]>) => {
        chamadas.push('criarPlanilha');
        if (falhar === 'planilha') throw new Error('planilha falhou');
        expect(Object.keys(abas)).toEqual(['Agendamentos', 'Clientes', 'Serviços', 'Pessoas', 'Configurações']);
      },
      salvarJson: (_n: string, texto: string) => { chamadas.push('salvarJson'); expect(JSON.parse(texto)).toEqual(DADOS); },
      limparAntigas: () => { chamadas.push('limparAntigas'); },
      concluir: () => {
        chamadas.push('concluir');
        if (falhar === 'concluir') throw new Error('HTTP 500: erro');
        return { apagados: 2 };
      },
      avisarFalha: (msg: string) => { avisos.push(msg); },
      log: () => {},
    };
    return { d, chamadas, avisos };
  }

  it('executarBackup na ordem certa', () => {
    const { d, chamadas, avisos } = deps();
    expect(deVm(L.executarBackup(d))).toEqual({ ok: true, apagados: 2 });
    expect(chamadas).toEqual(['exportar', 'criarPlanilha', 'salvarJson', 'limparAntigas', 'concluir']);
    expect(avisos).toEqual([]);
  });

  it('executarBackup com falha na planilha não salva nem conclui, e avisa', () => {
    const { d, chamadas, avisos } = deps('planilha');
    expect(deVm(L.executarBackup(d))).toEqual({ ok: false, erro: 'planilha falhou' });
    expect(chamadas).toEqual(['exportar', 'criarPlanilha']);
    expect(avisos).toEqual(['planilha falhou']);
  });

  it('executarBackup com falha só no concluir: a cópia existe e o aviso sai', () => {
    const { d, chamadas, avisos } = deps('concluir');
    expect(deVm(L.executarBackup(d)).ok).toBe(false);
    expect(chamadas).toEqual(['exportar', 'criarPlanilha', 'salvarJson', 'limparAntigas', 'concluir']);
    expect(avisos).toEqual(['HTTP 500: erro']);
  });

  it('copiasParaApagar conta datas, não nomes repetidos', () => {
    const datas = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 0, 4 + 7 * i)).toISOString().slice(0, 10));
    const nomes = [...datas.map((d) => `Backup Agenda ${d}`), `Backup Agenda ${datas[11]}`, `Backup Agenda ${datas[11]}`];
    expect(deVm(L.copiasParaApagar(nomes))).toEqual([]);
  });

  it('protegerLinhas põe aspas simples antes de = + - @ e não mexe no resto', () => {
    expect(deVm(L.protegerLinhas([['=HYPERLINK("x")', '+55', '-1', '@a', 'Ana', 30, '']]))).toEqual([
      ["'=HYPERLINK(\"x\")", "'+55", "'-1", "'@a", 'Ana', 30, ''],
    ]);
  });
});

describe('logica.js: pessoas (backup v2)', () => {
  const COM_PESSOAS = {
    ...DADOS,
    versao: 2,
    servicos: [
      { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true },
      { id: 's2', nome: 'Escova', duracao_min: 30, ativo: true },
    ],
    pessoas: [
      { id: 'p2', nome: null, ativo: true, ordem: 2, folgas: [] },
      { id: 'p1', nome: '=Ana', ativo: true, ordem: 1, folgas: [] },
      { id: 'p3', nome: null, ativo: false, ordem: 3, folgas: [] },
    ],
    pessoa_servicos: [
      { pessoa_id: 'p1', servico_id: 's2' },
      { pessoa_id: 'p1', servico_id: 's1' },
      { pessoa_id: 'p2', servico_id: 's1' },
    ],
    agendamentos: DADOS.agendamentos.map((a, i) => ({ ...a, pessoa_id: i === 0 ? 'p2' : 'p3' })),
  };

  it('linhasPessoas: nome de exibição, ativa e serviços, pela ordem', () => {
    expect(deVm(L.linhasPessoas(COM_PESSOAS))).toEqual([
      ['Nome', 'Ativa', 'Serviços'],
      ['=Ana', 'Sim', 'Corte, Escova'],
      ['Pessoa 2', 'Sim', 'Corte'],
      ['Pessoa (desativada)', 'Não', ''],
    ]);
    expect(deVm(L.linhasPessoas(DADOS))).toEqual([['Nome', 'Ativa', 'Serviços']]);
  });

  it('a coluna Pessoa dos agendamentos usa o nome de exibição', () => {
    const linhas = deVm(L.linhasAgendamentos(COM_PESSOAS, F)) as unknown[][];
    expect(linhas.map((l) => l[5])).toEqual(['Pessoa', 'Pessoa (desativada)', 'Pessoa 2']);
  });

  it('nome que começa com = continua escapado na planilha', () => {
    const protegidas = deVm(L.protegerLinhas(L.linhasPessoas(COM_PESSOAS))) as unknown[][];
    expect(protegidas[1][0]).toBe("'=Ana");
  });
});
