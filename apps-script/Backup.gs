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

function pastaDeBackups() {
  var it = DriveApp.getFoldersByName(NOME_PASTA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NOME_PASTA);
}

/** Um backup por dia: a cópia anterior com o mesmo nome vai para a lixeira. */
function mandarParaLixeiraMesmoNome(pasta, nome) {
  var it = pasta.getFilesByName(nome);
  while (it.hasNext()) it.next().setTrashed(true);
}

function fazerBackup() {
  var pasta = pastaDeBackups();
  return executarBackup({
    nomes: nomesDoBackup(new Date(), FUSO),
    exportar: function () {
      return chamarSupabase('exportar_backup');
    },
    criarPlanilha: function (nome, abas) {
      mandarParaLixeiraMesmoNome(pasta, nome);
      var planilha = SpreadsheetApp.create(nome);
      Object.keys(abas).forEach(function (nomeAba, i) {
        var aba = i === 0 ? planilha.getSheets()[0] : planilha.insertSheet(nomeAba);
        if (i === 0) aba.setName(nomeAba);
        var linhas = abas[nomeAba];
        aba.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
      });
      DriveApp.getFileById(planilha.getId()).moveTo(pasta);
    },
    salvarJson: function (nome, texto) {
      mandarParaLixeiraMesmoNome(pasta, nome);
      pasta.createFile(nome, texto, 'application/json');
    },
    limparAntigas: function () {
      var nomes = [];
      var porNome = {};
      var it = pasta.getFiles();
      while (it.hasNext()) {
        var arquivo = it.next();
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
  pastaDeBackups();
  return fazerBackup();
}
