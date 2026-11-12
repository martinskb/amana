import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const raiz = resolve(__dirname, '../..');

/** Carrega apps-script/logica.js como o Apps Script faz: funções globais, sem import/export. */
export function carregarLogica(extra: Record<string, unknown> = {}): Record<string, any> {
  const ctx = vm.createContext({ ...extra });
  vm.runInContext(readFileSync(resolve(raiz, 'apps-script/logica.js'), 'utf8'), ctx, { filename: 'logica.js' });
  return ctx as Record<string, any>;
}

/** Copia valores vindos do contexto do vm para o contexto do teste (comparação com toEqual). */
export const deVm = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/* ---------- Google falso para testar apps-script/Backup.gs ---------- */

interface ArquivoFalso {
  id: string;
  nome: string;
  conteudo?: string;
  pasta: string | null;
  lixeira: boolean;
  abas?: Record<string, unknown[][]>;
}

function iterador<T>(itens: T[]) {
  let i = 0;
  return { hasNext: () => i < itens.length, next: () => itens[i++] };
}

/** Monta um Google falso: Drive, Planilhas, URL, e-mail, gatilhos e log. */
export function criarGoogleFalso(opcoes: { responder: (url: string, corpo: string) => { codigo: number; texto: string } }) {
  const arquivos: ArquivoFalso[] = [];
  const pastas: string[] = [];
  const emails: { para: string; assunto: string; corpo: string }[] = [];
  const chamadas: { url: string; corpo: string; headers: Record<string, string> }[] = [];
  let gatilhos: { funcao: string; dia?: unknown; hora?: number; semanas?: number }[] = [];
  let seq = 0;

  const arquivoApi = (f: ArquivoFalso) => ({
    getId: () => f.id,
    getName: () => f.nome,
    setTrashed: (v: boolean) => {
      f.lixeira = v;
    },
    moveTo: (p: { _nome: string }) => {
      f.pasta = p._nome;
    },
  });
  const pastaApi = (nome: string) => ({
    _nome: nome,
    getFiles: () => iterador(arquivos.filter((f) => f.pasta === nome && !f.lixeira).map(arquivoApi)),
    getFilesByName: (n: string) => iterador(arquivos.filter((f) => f.pasta === nome && !f.lixeira && f.nome === n).map(arquivoApi)),
    createFile: (n: string, conteudo: string) => {
      const f = { id: `f${++seq}`, nome: n, conteudo, pasta: nome, lixeira: false };
      arquivos.push(f);
      return arquivoApi(f);
    },
  });

  const globais = {
    DriveApp: {
      getFoldersByName: (n: string) => iterador(pastas.filter((p) => p === n).map(pastaApi)),
      createFolder: (n: string) => {
        pastas.push(n);
        return pastaApi(n);
      },
      getFileById: (id: string) => arquivoApi(arquivos.find((f) => f.id === id)!),
    },
    SpreadsheetApp: {
      create: (nome: string) => {
        const f: ArquivoFalso = { id: `s${++seq}`, nome, pasta: null, lixeira: false, abas: {} };
        arquivos.push(f);
        const aba = (nomeAba: string) => {
          let atual = nomeAba;
          f.abas![atual] = [];
          return {
            setName: (n: string) => {
              f.abas![n] = f.abas![atual];
              delete f.abas![atual];
              atual = n;
            },
            getRange: (_l: number, _c: number, nl: number, nc: number) => ({
              setValues: (v: unknown[][]) => {
                if (v.length !== nl || v.some((linha) => linha.length !== nc)) throw new Error('tamanho errado');
                f.abas![atual] = v;
              },
            }),
          };
        };
        const primeira = aba('Página1');
        return { getId: () => f.id, getSheets: () => [primeira], insertSheet: (n: string) => aba(n) };
      },
    },
    UrlFetchApp: {
      fetch: (url: string, params: { payload: string; headers: Record<string, string> }) => {
        chamadas.push({ url, corpo: params.payload, headers: params.headers });
        const r = opcoes.responder(url, params.payload);
        return { getResponseCode: () => r.codigo, getContentText: () => r.texto };
      },
    },
    MailApp: {
      sendEmail: (para: string, assunto: string, corpo: string) => {
        emails.push({ para, assunto, corpo });
      },
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'negocio@exemplo.com' }) },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' },
      getProjectTriggers: () => gatilhos.map((g) => ({ getHandlerFunction: () => g.funcao, _g: g })),
      deleteTrigger: (t: { _g: unknown }) => {
        gatilhos = gatilhos.filter((g) => g !== t._g);
      },
      newTrigger: (funcao: string) => {
        const g: { funcao: string; dia?: unknown; hora?: number; semanas?: number } = { funcao };
        const b = {
          timeBased: () => b,
          onWeekDay: (d: unknown) => ((g.dia = d), b),
          atHour: (h: number) => ((g.hora = h), b),
          everyWeeks: (n: number) => ((g.semanas = n), b),
          create: () => {
            gatilhos.push(g);
          },
        };
        return b;
      },
    },
    Logger: { log: () => {} },
  };

  return {
    globais,
    arquivos,
    emails,
    chamadas,
    gatilhos: () => gatilhos,
    preencherPasta(nomes: string[]) {
      if (!pastas.includes('Backups da Agenda')) pastas.push('Backups da Agenda');
      for (const n of nomes) arquivos.push({ id: `p${++seq}`, nome: n, pasta: 'Backups da Agenda', lixeira: false });
    },
  };
}

/** Carrega logica.js + Backup.gs com o Google falso e a configuração dada. */
export function carregarScript(google: ReturnType<typeof criarGoogleFalso>, config: Record<string, string>) {
  // Date do teste: o relógio falso (vi.useFakeTimers) vale também dentro do script
  const ctx = vm.createContext({ ...google.globais, Date: globalThis.Date });
  vm.runInContext(readFileSync(resolve(raiz, 'apps-script/logica.js'), 'utf8'), ctx, { filename: 'logica.js' });
  vm.runInContext(readFileSync(resolve(raiz, 'apps-script/Backup.gs'), 'utf8'), ctx, { filename: 'Backup.gs' });
  Object.assign((ctx as Record<string, any>).CONFIG, config);
  return ctx as Record<string, any>;
}
