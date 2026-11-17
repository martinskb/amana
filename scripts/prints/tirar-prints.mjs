// Prints de conferência de todas as telas, com o Supabase falso (servidor-falso.cjs) e uma sessão
// falsa no localStorage. Sobe o servidor falso e o vite, abre um Chromium headless (perfil novo,
// sem extensões) e fala com ele pelo Chrome DevTools Protocol.
//
// uso: node scripts/prints/tirar-prints.mjs <pasta-de-saída> [nome,nome...]
//   NAVEGADOR    binário (padrão: o primeiro entre chromium, chromium-browser, google-chrome, brave)
//   PORTA_FALSO  Supabase falso (5198)   PORTA_APP  vite (5199)   PORTA_CDP  DevTools (9333)
//   ESCALA       pixels por ponto (2)   HORA  hh:mm de Belém que o app e o servidor falso acham que é
//   VIDEO=1      tira as telas do vídeo de apresentação (Zé, Rafa e Bia na "Barbearia do Zé")
// Cada tela sai como <nome>-<largura>.png (390 e 1280; a agenda também em 360).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [saida, filtro] = process.argv.slice(2);
if (!saida) {
  console.error('uso: node scripts/prints/tirar-prints.mjs <pasta-de-saída> [nome,nome...]');
  process.exit(1);
}
const PORTA_FALSO = Number(process.env.PORTA_FALSO || 5198);
const PORTA_APP = Number(process.env.PORTA_APP || 5199);
const PORTA_CDP = Number(process.env.PORTA_CDP || 9333);
const BASE = `http://localhost:${PORTA_APP}/`;
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ESCALA = Number(process.env.ESCALA || 2);
// HORA: o relógio fica adiantado (ou atrasado) até essa hora de hoje em Belém (UTC-3)
let DESVIO = 0;
if (process.env.HORA) {
  const [hh, mm] = process.env.HORA.split(':').map(Number);
  const belem = new Date(Date.now() - 3 * 3600e3);
  const alvoMs = Date.UTC(belem.getUTCFullYear(), belem.getUTCMonth(), belem.getUTCDate(), hh + 3, mm);
  DESVIO = alvoMs - Date.now();
}

const NAVEGADOR =
  process.env.NAVEGADOR ||
  ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'brave', 'brave-browser'].find(
    (b) => spawnSync('which', [b], { stdio: 'ignore' }).status === 0,
  );
if (!NAVEGADOR) {
  console.error('nenhum Chromium encontrado: defina NAVEGADOR=/caminho/do/navegador');
  process.exit(1);
}

// ---- servidores ----
const filhos = [];
const perfil = mkdtempSync(join(tmpdir(), 'amana-prints-'));
function encerrar() {
  for (const f of filhos) f.kill();
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 5 });
  } catch {} // o navegador ainda fechando: o perfil temporário fica para o sistema limpar
}
process.on('exit', encerrar);
process.on('SIGINT', () => process.exit(130));

async function esperarUrl(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await espera(200);
  }
  throw new Error(`não respondeu: ${url}`);
}

filhos.push(spawn(process.execPath, [join(RAIZ, 'scripts/prints/servidor-falso.cjs')], { env: { ...process.env, PORTA_FALSO: String(PORTA_FALSO), ...(DESVIO ? { AGORA_MS: String(Date.now() + DESVIO) } : {}) }, stdio: 'inherit' }));
filhos.push(
  spawn(process.execPath, [join(RAIZ, 'node_modules/vite/bin/vite.js'), '--port', String(PORTA_APP), '--strictPort'], {
    cwd: RAIZ,
    // variáveis do ambiente valem mais que o .env: o app fala com o Supabase falso
    env: { ...process.env, VITE_SUPABASE_URL: `http://localhost:${PORTA_FALSO}`, VITE_SUPABASE_ANON_KEY: 'chave-falsa', VITE_NOME_NEGOCIO: '' },
    stdio: 'ignore',
  }),
);
await esperarUrl(`http://localhost:${PORTA_FALSO}/__modo`);
await esperarUrl(BASE);
filhos.push(
  spawn(NAVEGADOR, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${PORTA_CDP}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' }),
);

// ---- DevTools ----
let alvo;
for (let i = 0; i < 60 && !alvo; i++) {
  await espera(250);
  try {
    alvo = (await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
}
if (!alvo) throw new Error(`o navegador (${NAVEGADOR}) não abriu o DevTools na porta ${PORTA_CDP}`);
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0;
const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    pend.get(m.id)(m);
    pend.delete(m.id);
  }
});
const cmd = (method, params = {}) =>
  new Promise((r) => {
    const id = ++n;
    pend.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const avaliar = async (expression) => (await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

// ---- ajudas dentro da página ----
/** Clica no primeiro elemento de `seletor` cujo texto ou aria-label contém `texto`. */
const clicar = (seletor, texto = '') =>
  avaliar(`(() => { const t = ${JSON.stringify(texto)};
    const el = [...document.querySelectorAll(${JSON.stringify(seletor)})].find((e) => (e.textContent + ' ' + (e.getAttribute('aria-label') || '')).includes(t));
    el?.click(); return !!el; })()`);
/** Escolhe na faixa da semana o dia `dias` depois de hoje, passando de semana se precisar. */
async function irParaDia(dias) {
  let i = (await avaliar(`[...document.querySelectorAll('.faixa-dia')].findIndex((b) => b.getAttribute('aria-pressed') === 'true')`)) + dias;
  while (i > 6) {
    await clicar('.faixa-seta', 'Próxima semana');
    await espera(900);
    i -= 7;
  }
  await avaliar(`document.querySelectorAll('.faixa-dia')[${i}].click()`);
  await espera(700);
}

const sessao = {
  access_token: 'falso', token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, refresh_token: 'falso',
  user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'dono@exemplo.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
};
const embrulho = (valor) => JSON.stringify({ valor, em: new Date().toISOString() });

// ---- telas ----
const AGENDA = [360, 390, 1280];
const TELAS = [
  { nome: 'login', rota: '/', logado: false },
  { nome: 'agenda-hoje', rota: '/', larguras: AGENDA },
  { nome: 'agenda-semana', rota: '/', larguras: AGENDA, passos: () => clicar('.alterna button', 'semana') },
  { nome: 'agenda-fechado', rota: '/', larguras: AGENDA, passos: () => irParaDia(2) },
  { nome: 'agenda-vazio', rota: '/', larguras: AGENDA, passos: () => irParaDia(3) },
  { nome: 'agenda-menu-mais', rota: '/', larguras: [390], passos: () => clicar('.fab') },
  { nome: 'detalhes', rota: '/', passos: () => clicar('.lt-ag', 'Pedro Lima') },
  { nome: 'novo-agendamento', rota: '/', passos: () => clicar('.lt-livre') },
  { nome: 'ajustes', rota: '/config', inteira: true },
  { nome: 'ajustes-painel', rota: '/config', passos: () => clicar('button', 'Barbearia do João') },
  {
    nome: 'ajustes-salvo', rota: '/config', depois: 400,
    passos: async () => {
      await clicar('button', 'Barbearia do João');
      await espera(600);
      await clicar('.painel button', 'Salvar'); // "salvo! ✓" fica 1,5 s: o print sai antes de sumir
    },
  },
  { nome: 'publico', rota: '/agendar', logado: false, inteira: true },
  { nome: 'publico-sem-servico', rota: '/agendar', logado: false, inteira: true, servicos: false },
  // ---- pessoas (3 ativas: Ana, uma sem nome e João; Carla desativada) ----
  { nome: 'p3-agenda', rota: '/', larguras: AGENDA, pessoas: 3 },
  { nome: 'p3-agenda-filtro', rota: '/', larguras: AGENDA, pessoas: 3, passos: () => clicar('.filtro-pessoas button', 'Ana') },
  { nome: 'p3-agenda-semana', rota: '/', larguras: [390, 1280], pessoas: 3, passos: () => clicar('.alterna button', 'semana') },
  { nome: 'p3-livre-fechar', rota: '/', pessoas: 3, passos: () => clicar('.lt-livre') },
  {
    nome: 'p3-novo', rota: '/', pessoas: 3,
    passos: async () => {
      await clicar('.lt-livre');
      await espera(600);
      await clicar('.painel button', 'Marcar cliente');
    },
  },
  {
    nome: 'p3-detalhes-trocar', rota: '/', pessoas: 3,
    passos: async () => {
      await clicar('.lt-ag', 'Rafael Costa');
      await espera(600);
      await clicar('.painel button.com-quem');
    },
  },
  { nome: 'p3-ajustes', rota: '/config', inteira: true, pessoas: 3 },
  { nome: 'p3-painel-pessoa', rota: '/config', pessoas: 3, passos: () => clicar('button', 'Ana, ') },
  { nome: 'p3-painel-nova', rota: '/config', pessoas: 3, passos: () => clicar('button', '+ adicionar pessoa') },
  { nome: 'p3-folgas', rota: '/config', pessoas: 3, passos: () => clicar('button', 'Folgas,') },
  { nome: 'p3-publico', rota: '/agendar', logado: false, inteira: true, pessoas: 3, passos: () => clicar('.servicos button', 'Corte 30') },
  {
    nome: 'p3-publico-escolhida', rota: '/agendar', logado: false, inteira: true, pessoas: 3,
    passos: async () => {
      await clicar('.servicos button', 'Corte 30');
      await espera(400);
      await clicar('.com-quem button', 'João');
      await espera(400);
      await clicar('.ficha');
    },
  },
  // ---- link da equipe ----
  { nome: 'equipe', rota: '/equipe/ana', logado: false, inteira: true },
  { nome: 'equipe-whatsapp', rota: '/equipe/com-whats', logado: false, inteira: true },
  { nome: 'equipe-invalido', rota: '/equipe/x', logado: false },
  { nome: 'p3-painel-pessoa-link', rota: '/config', pessoas: 3, passos: () => clicar('button', 'Ana, ') },
  { nome: 'p20-agenda', rota: '/', larguras: [360, 390], pessoas: 20 },
  { nome: 'p20-agenda-rolada', rota: '/', larguras: [390], pessoas: 20, passos: () => avaliar(`document.querySelector('.filtro-pessoas').scrollLeft = 400`) },
  { nome: 'carregando', rota: '/', pendurar: true },
  // sem rede, o app espera as novas tentativas do supabase-js e o prazo de 10 s antes de avisar
  { nome: 'sem-conexao', rota: '/', bloquear: true, espera: 16000 },
  { nome: 'sem-conexao-cache', rota: '/', bloquear: true, cacheAntes: true, espera: 16000 },
];

/** Escreve num campo controlado pelo React (o setter nativo e um evento de input). */
const preencher = (seletor, valor) =>
  avaliar(`(() => { const el = document.querySelector(${JSON.stringify(seletor)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(valor)});
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const V = { pessoas: 'video', negocio: 'Barbearia do Zé', larguras: [390] };
const publicoAte = async (passo) => {
  await clicar('.servicos button', 'Corte + barba');
  await espera(500);
  if (passo < 2) return;
  await clicar('.com-quem button', 'Rafa');
  await espera(500);
  if (passo < 3) return;
  await clicar('.ficha');
  await espera(500);
  await avaliar(`document.querySelector('.horarios button')?.click()`);
  await espera(500);
  if (passo < 4) return;
  await preencher('.formulario input', 'Lucas');
  await preencher('.formulario input[type=tel], .formulario input[inputmode=tel], .formulario label:nth-of-type(2) input', '91 98888-7777');
  await espera(300);
  if (passo < 5) return;
  await clicar('.formulario button[type=submit]');
};
const TELAS_VIDEO = [
  { ...V, nome: 'v-agenda', rota: '/', inteira: true },
  { ...V, nome: 'v-filtro', rota: '/', inteira: true, passos: () => clicar('.filtro-pessoas button', 'Rafa') },
  { ...V, nome: 'v-semana', rota: '/', passos: () => clicar('.alterna button', 'semana') },
  { ...V, nome: 'v-menu-mais', rota: '/', passos: () => clicar('.fab') },
  { ...V, nome: 'v-detalhes', rota: '/', passos: () => clicar('.lt-ag', 'Pedro Lima') },
  { ...V, nome: 'v-pub-0', rota: '/agendar', logado: false, inteira: true },
  { ...V, nome: 'v-pub-1', rota: '/agendar', logado: false, inteira: true, passos: () => publicoAte(1) },
  { ...V, nome: 'v-pub-2', rota: '/agendar', logado: false, inteira: true, passos: () => publicoAte(2) },
  { ...V, nome: 'v-pub-3', rota: '/agendar', logado: false, inteira: true, passos: () => publicoAte(3) },
  { ...V, nome: 'v-pub-4', rota: '/agendar', logado: false, inteira: true, passos: () => publicoAte(4) },
  { ...V, nome: 'v-pub-5', rota: '/agendar', logado: false, passos: () => publicoAte(5), depois: 1800 },
  { ...V, nome: 'v-equipe', rota: '/equipe/com-whats', logado: false, inteira: true },
  { ...V, nome: 'v-pessoa-link', rota: '/config', passos: () => clicar('button', 'Rafa, ') },
  { ...V, nome: 'v-ajustes', rota: '/config', inteira: true },
  { ...V, nome: 'v-offline', rota: '/', bloquear: true, cacheAntes: true, espera: 16000 },
  { ...V, nome: 'v-pc', rota: '/', larguras: [1280] },
  { ...V, nome: 'v-pc-semana', rota: '/', larguras: [1280], passos: () => clicar('.alterna button', 'semana') },
];

mkdirSync(saida, { recursive: true });
await cmd('Page.enable');
await cmd('Network.enable');
if (DESVIO) {
  // o app também acha que é HORA: Date adiantado pelo mesmo desvio em todo documento novo
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const D = Date, d = ${DESVIO};
    class F extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + d); } static now() { return D.now() + d; } }
    globalThis.Date = F; })();` });
}
const escolhidas = filtro ? filtro.split(',') : null;
for (const t of (process.env.VIDEO ? TELAS_VIDEO : TELAS).filter((t) => !escolhidas || escolhidas.includes(t.nome))) {
  for (const w of t.larguras ?? [390, 1280]) {
    const h = w < 700 ? 844 : 800;
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: ESCALA, mobile: w < 700 });
    await fetch(`http://localhost:${PORTA_FALSO}/__modo?servicos=${t.servicos === false ? 0 : 1}&pessoas=${t.pessoas ?? 1}${t.negocio ? '&negocio=' + encodeURIComponent(t.negocio) : ''}`);
    // um arquivo estático da mesma origem, só para mexer no localStorage antes de o app abrir
    await cmd('Page.navigate', { url: BASE + 'favicon.svg' });
    await espera(300);
    await avaliar(`localStorage.clear();
      localStorage.setItem('amana:corte-novos', ${JSON.stringify(embrulho(new Date(Date.now() - 864e5).toISOString()))});
      ${t.logado === false ? '' : `localStorage.setItem('sb-localhost-auth-token', ${JSON.stringify(JSON.stringify(sessao))});`}`);
    if (t.cacheAntes) {
      await cmd('Page.navigate', { url: BASE + '#' + t.rota });
      await espera(2500);
      await cmd('Page.navigate', { url: BASE + 'favicon.svg' }); // senão a próxima navegação só troca o hash
      await espera(300);
    }
    const falso = `*localhost:${PORTA_FALSO}*`;
    if (t.bloquear) await cmd('Network.setBlockedURLs', { urls: [falso] });
    if (t.pendurar) await cmd('Fetch.enable', { patterns: [{ urlPattern: falso }] }); // pedidos sem resposta
    await cmd('Page.navigate', { url: BASE + '#' + t.rota });
    await espera(t.espera ?? 2500);
    if (t.passos) {
      await t.passos();
      await espera(t.depois ?? 900);
    }
    // AUDITAR=1: mede o que estoura a largura e os toques menores que 44 px (só elementos visíveis)
    if (process.env.AUDITAR) {
      const r = await avaliar(`(() => {
        const vw = innerWidth;
        const largo = document.documentElement.scrollWidth > vw + 1;
        const vis = (e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect();
          return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !e.closest('[inert],[aria-hidden="true"]'); };
        const fora = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > vw + 1 && !e.closest('.filtro-pessoas,.dias,.chuva,.faixa-dias'))
          .slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.'));
        const pequenos = [...document.querySelectorAll('button, a[href], input, select, [role=button]')].filter(vis).filter((e) => {
          const b = e.getBoundingClientRect(); const alvo = e.closest('label') ?? e; const bl = alvo.getBoundingClientRect();
          return Math.max(b.height, bl.height) < 44 || Math.max(b.width, bl.width) < 24;
        }).slice(0, 4).map((e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        return JSON.stringify({ largo, fora, pequenos });
      })()`);
      console.log('auditoria', `${t.nome}-${w}`, r);
    }
    let clip;
    if (t.inteira) {
      const altura = await avaliar('document.documentElement.scrollHeight');
      clip = { x: 0, y: 0, width: w, height: Math.max(h, altura), scale: 1 };
    }
    const { result } = await cmd('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
    writeFileSync(join(saida, `${t.nome}-${w}.png`), Buffer.from(result.data, 'base64'));
    console.log('ok', `${t.nome}-${w}`);
    if (t.bloquear) await cmd('Network.setBlockedURLs', { urls: [] });
    if (t.pendurar) await cmd('Fetch.disable');
  }
}
await fetch(`http://localhost:${PORTA_FALSO}/__modo?servicos=1&pessoas=1`);
ws.close();
for (const f of filhos) f.kill();
await espera(500); // o navegador termina de gravar o perfil antes de ele ser apagado
process.exit(0);
