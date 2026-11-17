// Supabase falso, só para tirar prints das telas com dados de exemplo (nenhum dado real, nenhuma chave).
// Os agendamentos são montados em volta da hora em que ele sobe, para a agenda de hoje mostrar
// passados, a linha do "agora" e futuros (de madrugada ou depois das 21h, a linha do agora pode
// ficar fora do lugar).
//
//   hoje      passados (concluído, confirmado, faltou), um novo pelo link logo depois do agora, um futuro
//   hoje + 1  dois agendamentos (o cartão "amanhã" tem clientes)
//   hoje + 2  fechado (sem expediente nesse dia da semana)
//   hoje + 3  aberto e sem nenhum agendamento (dia livre)
//   hoje + 7  um novo pelo link em outra semana ("1 novo pelo link →")
//
// "Novo" depende do corte guardado no aparelho: o tirar-prints.mjs grava `amana:corte-novos` um dia
// antes de agora; os agendamentos antigos foram criados 30 dias antes e os novos, 10 minutos antes.
//
// uso: node scripts/prints/servidor-falso.cjs   (PORTA_FALSO, padrão 5198)
// GET /__modo?servicos=0 tira os serviços (página do cliente sem serviço); ?servicos=1 devolve.
// GET /__modo?negocio=<nome> troca o nome do negócio. GET /__modo?pessoas=video: Zé, Rafa e Bia.
// GET /__modo?pessoas=1|3|20: uma pessoa sem nome (como depois da 0006); três (Ana, uma sem nome e
// João, cada uma com seus serviços); ou vinte, para ver o filtro rolar.
const http = require('http');

const PORTA = Number(process.env.PORTA_FALSO || 5198);
const FUSO_H = -3; // America/Sao_Paulo, sem horário de verão
// AGORA_MS: um instante fixo (o tirar-prints.mjs passa quando HORA=hh:mm), para os prints do vídeo
const agora = Number(process.env.AGORA_MS) || Date.now();
const local = new Date(agora + FUSO_H * 3600e3); // relógio de Belém nos campos UTC
const minAgora = local.getUTCHours() * 60 + local.getUTCMinutes();
// o próximo horário cheio ou meia hora, preso entre 4h e 21h para os agendamentos de hoje caberem no dia
const m0 = Math.min(Math.max(Math.ceil((minAgora + 1) / 30) * 30, 4 * 60), 21 * 60);

const hhmm = (min) => {
  const m = Math.max(0, Math.min(min, 23 * 60 + 30));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// instante (ISO) de `min` minutos depois da meia-noite de hoje + `dias`, em Belém
function em(dias, min) {
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dias));
  return new Date(d.getTime() + (min - FUSO_H * 60) * 60e3).toISOString();
}
const diaSemana = (dias) => new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dias)).getUTCDay();

const util = [{ inicio: '09:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];
const expediente = { 0: util, 1: util, 2: util, 3: util, 4: util, 5: util, 6: util };
expediente[diaSemana(0)] = [{ inicio: hhmm(m0 - 240), fim: hhmm(m0 + 150) }];
expediente[diaSemana(2)] = [];

const config = {
  id: 1, nome_negocio: 'Barbearia do João', fuso: 'America/Sao_Paulo', expediente,
  folgas: [], passo_min: 30, antecedencia_min: 60, modelo_livres: 'Horários livres: {horarios}',
  modelo_lembrete: 'Oi {nome}! Lembrete: amanhã ({dia}) às {hora}.', ultimo_backup: new Date(agora).toISOString(),
  dias_abertos: 14, link_ativo: true, telefone_negocio: '5591900001111',
  modelo_cancelamento: 'Oi {nome}, não vou conseguir {dia} às {hora}. {link}', backup_ativo: true,
};
const todosServicos = [
  { id: 's1', nome: 'Corte', duracao_min: 30, ativo: true },
  { id: 's2', nome: 'Corte + barba', duracao_min: 60, ativo: true },
  { id: 's3', nome: 'Barba', duracao_min: 30, ativo: true },
];
let servicos = todosServicos;
const antigo = new Date(agora - 30 * 864e5).toISOString();
const recente = new Date(agora - 10 * 60e3).toISOString();
const clientes = [
  { id: 'c1', nome: 'Marcos Silva', telefone: '5591988887777', criado_em: antigo },
  { id: 'c2', nome: 'Ana Souza', telefone: '5591977776666', criado_em: antigo },
  { id: 'c3', nome: 'Pedro Lima', telefone: '5591966665555', criado_em: antigo },
  { id: 'c4', nome: 'Rafael Costa', telefone: '5591955554444', criado_em: antigo },
  { id: 'c5', nome: 'Juliana Rocha', telefone: '5591944443333', criado_em: antigo },
];
const [marcos, ana, pedro, rafael, juliana] = clientes;
const [corte, corteBarba, barba] = todosServicos;

const ag = (id, c, s, dias, min, status, origem, extra = {}) => ({
  id, cliente_id: c.id, servico_id: s?.id ?? null, inicio: em(dias, min), fim: em(dias, min + (s?.duracao_min ?? 30)),
  status, observacao: null, origem, nome_informado: origem === 'link' ? c.nome.split(' ')[0] : null, criado_em: antigo,
  cliente: { nome: c.nome, telefone: c.telefone }, servico: s ? { nome: s.nome } : null, ...extra,
});
const agendamentos = [
  ag('a1', marcos, corte, 0, m0 - 210, 'concluido', 'dono'),
  ag('a2', ana, corteBarba, 0, m0 - 150, 'confirmado', 'link'),
  ag('a3', juliana, barba, 0, m0 - 60, 'faltou', 'dono'),
  // novo pelo link, com nome digitado diferente do cadastro ("digitou Pedrinho" em vermelho)
  ag('a4', pedro, corte, 0, m0, 'marcado', 'link', { criado_em: recente, nome_informado: 'Pedrinho' }),
  ag('a5', rafael, barba, 0, m0 + 60, 'marcado', 'dono'),
  ag('a6', marcos, corte, 1, 9 * 60 + 30, 'marcado', 'dono'),
  ag('a7', pedro, corteBarba, 1, 15 * 60, 'confirmado', 'link'),
  ag('a8', ana, corteBarba, 7, 10 * 60, 'marcado', 'link', { criado_em: recente }),
].sort((a, b) => a.inicio.localeCompare(b.inicio));

// ---- pessoas ----
const todos = todosServicos.map((s) => s.id);
const PESSOAS = {
  1: [{ id: 'p1', nome: null, ativo: true, ordem: 1, folgas: [], servicos: todos }],
  3: [
    { id: 'p1', nome: 'Ana', ativo: true, ordem: 1, folgas: [], servicos: todos, link_codigo: 'ana', link_whatsapp: false },
    { id: 'p2', nome: null, ativo: true, ordem: 2, folgas: [], servicos: ['s1', 's3'] },
    { id: 'p3', nome: 'João', ativo: true, ordem: 3, folgas: [], servicos: ['s1', 's2'] },
    { id: 'p4', nome: 'Carla', ativo: false, ordem: 4, folgas: [], servicos: ['s1'] },
  ],
  // vídeo de apresentação: três pessoas com nome (Zé, Rafa e Bia), a Rafa com link
  video: [
    { id: 'p1', nome: 'Zé', ativo: true, ordem: 1, folgas: [], servicos: todos },
    { id: 'p2', nome: 'Rafa', ativo: true, ordem: 2, folgas: [], servicos: todos, link_codigo: 'ana', link_whatsapp: true },
    { id: 'p3', nome: 'Bia', ativo: true, ordem: 3, folgas: [], servicos: ['s1', 's3'] },
  ],
  20: Array.from({ length: 20 }, (_, i) => ({
    id: `p${i + 1}`,
    nome: ['Ana', 'João', 'Bia', 'Rafa', 'Duda', 'Léo', 'Marina', 'Caio', 'Lu', 'Teo'][i % 10] + (i >= 10 ? ' ' + (i - 9) : ''),
    ativo: true, ordem: i + 1, folgas: [], servicos: todos,
  })),
};
let pessoas = PESSOAS[1];
const ativas = () => pessoas.filter((x) => x.ativo);
// os agendamentos se espalham entre as ativas, pela posição
const comPessoa = (lista) => lista.map((a, i) => ({ ...a, pessoa_id: ativas()[i % ativas().length].id }));
const linhaPessoa = ({ servicos: ss, ...x }) => ({ ...x, pessoa_servicos: ss.map((servico_id) => ({ servico_id })) });

const livres = [1, 3, 4].flatMap((d) => [9 * 60, 11 * 60, 14 * 60, 17 * 60 + 30].map((m) => em(d, m)));
const publico = () => ({
  nome_negocio: config.nome_negocio, telefone_negocio: config.telefone_negocio, link_ativo: true, horarios: livres,
  pessoas: ativas().filter((x) => x.nome).map((x) => ({ id: x.id, nome: x.nome })),
  servicos: servicos
    .map((s) => {
      const fazem = ativas().filter((x) => x.servicos.includes(s.id));
      const comNome = fazem.filter((x) => x.nome);
      // cada pessoa com uma parte dos horários, para a escolha mudar a lista
      const dela = (i) => livres.filter((_, j) => j % comNome.length === i);
      return {
        ...s,
        horarios: livres,
        com_escolha: comNome.length > 0 && fazem.length > 1,
        pessoas: comNome.map((x, i) => ({ id: x.id, horarios: dela(i) })),
      };
    })
    .filter((s) => ativas().some((x) => x.servicos.includes(s.id))),
});
// link da equipe: "ana" (sem WhatsApp), "com-whats" (com), qualquer outro código é inválido
function agendaEquipe(codigo) {
  if (codigo !== 'ana' && codigo !== 'com-whats') return { ok: false };
  const dia = (n) => em(n, 12 * 60).slice(0, 10); // meio-dia em Belém cai no mesmo dia em UTC
  const clientesDe = (n) =>
    agendamentos
      .filter((a) => a.status !== 'cancelado' && a.inicio >= em(n, 0) && a.inicio < em(n + 1, 0))
      .map((a) => ({
        inicio: a.inicio, fim: a.fim, cliente: a.cliente.nome, servico: a.servico?.nome ?? null, status: a.status,
        ...(codigo === 'com-whats' ? { telefone: a.cliente.telefone } : {}),
      }));
  return {
    ok: true, negocio: config.nome_negocio, pessoa: pessoas.find((p) => p.link_codigo === 'ana')?.nome ?? 'Ana', whatsapp: codigo === 'com-whats',
    hoje: dia(0), amanha: dia(1), dias: [{ data: dia(0), clientes: clientesDe(0) }, { data: dia(1), clientes: clientesDe(1) }],
  };
}

const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'dono@exemplo.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

// filtros do PostgREST que o app usa: eq, neq, gt, gte, lt, lte (cliente_id, origem, inicio, criado_em, status)
const OPS = { eq: (a, b) => a === b, neq: (a, b) => a !== b, gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b };
function filtrar(lista, params) {
  return lista.filter((linha) =>
    [...params].every(([campo, valor]) => {
      if (['select', 'order', 'limit', 'offset', 'or'].includes(campo) || !(campo in linha)) return true;
      const i = valor.indexOf('.');
      const op = OPS[valor.slice(0, i)];
      return !op || op(String(linha[campo]), valor.slice(i + 1));
    }),
  );
}

http.createServer((q, r) => {
  r.setHeader('Access-Control-Allow-Origin', '*');
  r.setHeader('Access-Control-Allow-Headers', '*');
  r.setHeader('Access-Control-Allow-Methods', '*');
  r.setHeader('Access-Control-Expose-Headers', '*');
  if (q.method === 'OPTIONS') return r.end();
  r.setHeader('Content-Type', 'application/json');
  const u = new URL(q.url, 'http://x');
  const p = u.pathname;
  const um = (q.headers.accept || '').includes('vnd.pgrst.object');
  let corpo = '';
  q.on('data', (c) => (corpo += c));
  q.on('end', () => {
    let body = [];
    if (p === '/__modo') {
      if (u.searchParams.has('servicos')) servicos = u.searchParams.get('servicos') === '0' ? [] : todosServicos;
      if (u.searchParams.has('pessoas')) pessoas = PESSOAS[u.searchParams.get('pessoas')] ?? PESSOAS[1];
      if (u.searchParams.has('negocio')) config.nome_negocio = u.searchParams.get('negocio');
      body = { servicos: servicos.length, pessoas: pessoas.length };
    } else if (p.startsWith('/auth/v1/user')) body = user;
    else if (p.endsWith('/rpc/horarios_publicos')) body = publico();
    else if (p.endsWith('/rpc/agendar_publico')) {
      // sempre aceita: só para o print da tela de "Pronto!"
      const c = JSON.parse(corpo || '{}');
      body = { ok: true, inicio: c.inicio, pessoa: pessoas.find((x) => x.id === c.pessoa)?.nome ?? null };
    } else if (p.endsWith('/rpc/agenda_da_equipe')) body = agendaEquipe(JSON.parse(corpo || '{}').codigo);
    else if (p.endsWith('/configuracoes')) {
      if (q.method === 'PATCH' && corpo) Object.assign(config, JSON.parse(corpo));
      body = um ? config : [config];
    } else if (p.endsWith('/agendamentos')) body = filtrar(comPessoa(agendamentos), u.searchParams);
    else if (p.endsWith('/pessoas')) body = pessoas.map(linhaPessoa);
    else if (p.endsWith('/servicos')) body = servicos;
    else if (p.endsWith('/clientes')) body = filtrar(clientes, u.searchParams);
    else if (p.endsWith('/horarios_ajuste')) body = [];
    r.end(JSON.stringify(body));
  });
}).listen(PORTA, () => console.log(`Supabase falso em http://localhost:${PORTA} (agora ${hhmm(minAgora)} em Belém)`));
