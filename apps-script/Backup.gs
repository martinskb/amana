/**
 * Agenda Fácil — backup semanal no Google Drive.
 *
 * Instalação (uma vez, na conta Google do negócio): veja docs/implantacao.md, passo "Backup automático".
 *   1. Preencha os três campos de CONFIG abaixo.
 *   2. Rode a função "instalar" e autorize.
 * Depois disso, todo domingo às 3h o Google roda "fazerBackup" sozinho.
 */
var CONFIG = {
  // Supabase → Project Settings → API → Project URL
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  // Supabase → Project Settings → API → chave anon / publishable (nunca a service_role)
  SUPABASE_ANON_KEY: 'COLE_AQUI_A_CHAVE_PUBLICA',
  // No app: Ajustes → Backup → Gerar chave de backup
  CHAVE_BACKUP: 'COLE_AQUI_A_CHAVE_DE_BACKUP',
};

var NOME_PASTA = 'Backups da Agenda';
var FUSO = 'America/Sao_Paulo';

/** Chama uma função do Supabase com a chave de backup. Erro HTTP vira exceção curta. */
function chamarSupabase(funcao) {
  var url = String(CONFIG.SUPABASE_URL).trim().replace(/\/+$/, '') + '/rest/v1/rpc/' + funcao;
  var anon = String(CONFIG.SUPABASE_ANON_KEY).trim();
  var resposta = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: anon, Authorization: 'Bearer ' + anon },
    payload: JSON.stringify({ chave: String(CONFIG.CHAVE_BACKUP).trim() }),
    muteHttpExceptions: true,
  });
  var codigo = resposta.getResponseCode();
  var texto = resposta.getContentText() || '';
  if (codigo < 200 || codigo >= 300) {
    throw new Error('HTTP ' + codigo + ': ' + texto.replace(/\s+/g, ' ').slice(0, 200));
  }
  return texto ? JSON.parse(texto) : null;
}

var PROPRIEDADE_PASTA = 'PASTA_BACKUPS_ID';

/** Procura na raiz uma pasta "Backups da Agenda" fora da lixeira; se não houver, cria. Guarda o ID. */
function prepararPasta() {
  var raiz = DriveApp.getRootFolder();
  var it = raiz.getFoldersByName(NOME_PASTA);
  var pasta = null;
  while (it.hasNext()) {
    var p = it.next();
    if (!p.isTrashed()) {
      pasta = p;
      break;
    }
  }
  if (!pasta) pasta = raiz.createFolder(NOME_PASTA);
  PropertiesService.getScriptProperties().setProperty(PROPRIEDADE_PASTA, pasta.getId());
  return pasta;
}

/**
 * A pasta guardada pelo instalar. Se foi para a lixeira, o backup falha (com e-mail) em vez de
 * gravar dentro da lixeira e mesmo assim apagar os agendamentos antigos.
 */
function pastaDeBackups() {
  var id = PropertiesService.getScriptProperties().getProperty(PROPRIEDADE_PASTA);
  if (!id) return prepararPasta();
  var pasta = DriveApp.getFolderById(id);
  if (pasta.isTrashed()) {
    throw new Error('a pasta "' + NOME_PASTA + '" está na lixeira do Drive. Tire da lixeira ou rode "instalar" de novo');
  }
  return pasta;
}

/** Um backup por dia: a cópia anterior com o mesmo nome vai para a lixeira. */
function mandarParaLixeiraMesmoNome(pasta, nome) {
  var it = pasta.getFilesByName(nome);
  while (it.hasNext()) {
    var arquivo = it.next();
    if (!arquivo.isTrashed()) arquivo.setTrashed(true);
  }
}

function fazerBackup() {
  // a pasta é aberta dentro do executarBackup: qualquer falha do Drive também manda o e-mail
  var pastaAberta = null;
  function pasta() {
    if (!pastaAberta) pastaAberta = pastaDeBackups();
    return pastaAberta;
  }
  return executarBackup({
    nomes: nomesDoBackup(new Date(), FUSO),
    exportar: function () {
      return chamarSupabase('exportar_backup');
    },
    criarPlanilha: function (nome, abas) {
      mandarParaLixeiraMesmoNome(pasta(), nome);
      var planilha = SpreadsheetApp.create(nome);
      Object.keys(abas).forEach(function (nomeAba, i) {
        var aba = i === 0 ? planilha.getSheets()[0] : planilha.insertSheet(nomeAba);
        if (i === 0) aba.setName(nomeAba);
        var linhas = protegerLinhas(abas[nomeAba]);
        var faixa = aba.getRange(1, 1, linhas.length, linhas[0].length);
        faixa.setNumberFormat('@'); // texto puro: datas e telefones não são reinterpretados
        faixa.setValues(linhas);
      });
      DriveApp.getFileById(planilha.getId()).moveTo(pasta());
    },
    salvarJson: function (nome, texto) {
      mandarParaLixeiraMesmoNome(pasta(), nome);
      pasta().createFile(nome, texto, 'application/json');
    },
    limparAntigas: function () {
      var nomes = [];
      var porNome = {};
      var it = pasta().getFiles();
      while (it.hasNext()) {
        var arquivo = it.next();
        if (arquivo.isTrashed()) continue; // o Drive devolve também o que está na lixeira
        var n = arquivo.getName();
        nomes.push(n);
        (porNome[n] = porNome[n] || []).push(arquivo);
      }
      copiasParaApagar(nomes, 12).forEach(function (n) {
        porNome[n].forEach(function (arquivo) {
          arquivo.setTrashed(true);
        });
      });
    },
    concluir: function () {
      return chamarSupabase('concluir_backup');
    },
    avisarFalha: function (mensagem) {
      MailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        'Backup da agenda falhou',
        'O backup da agenda desta semana falhou: ' + mensagem + '. Abra o app e use Ajustes → Baixar backup enquanto isso.',
      );
    },
    log: function (texto) {
      Logger.log(texto);
    },
  });
}

/** Rode uma vez: agenda o backup para todo domingo às 3h e já faz o primeiro. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === 'fazerBackup') ScriptApp.deleteTrigger(g);
  });
  ScriptApp.newTrigger('fazerBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).everyWeeks(1).create();
  prepararPasta(); // se a pasta antiga foi para a lixeira, usa ou cria outra
  return fazerBackup();
}
