/**
 * Agenda Fácil — lógica do backup semanal no Google Drive.
 *
 * Funções puras (sem nada do Google), usadas por Backup.gs. No Apps Script, este arquivo e o
 * Backup.gs ficam no mesmo projeto e as funções são globais (sem import/export).
 * Testado em tests/appsScript/logica.test.ts.
 */

var SITUACOES = {
  marcado: 'Marcado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
  faltou: 'Faltou',
};

var DIAS_SEMANA = [
  [1, 'Segunda-feira'],
  [2, 'Terça-feira'],
  [3, 'Quarta-feira'],
  [4, 'Quinta-feira'],
  [5, 'Sexta-feira'],
  [6, 'Sábado'],
  [0, 'Domingo'],
];

var PADRAO_PLANILHA = /^Backup Agenda (\d{4}-\d{2}-\d{2})$/;
var PADRAO_ARQUIVO = /^backup-agenda-(\d{4}-\d{2}-\d{2})\.json$/;

/** "17/11/2026" no fuso dado. */
function dataBr(iso, fuso) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );
}

/** "14:30" no fuso dado. */
function horaBr(iso, fuso) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}

/** "2026-11-15" no fuso dado. */
function dataIso(instante, fuso) {
  var partes = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instante)
    .forEach(function (p) {
      partes[p.type] = p.value;
    });
  return partes.year + '-' + partes.month + '-' + partes.day;
}

function porId(lista) {
  var mapa = {};
  (lista || []).forEach(function (item) {
    mapa[item.id] = item;
  });
  return mapa;
}

function linhasAgendamentos(dados, fuso) {
  var clientes = porId(dados.clientes);
  var servicos = porId(dados.servicos);
  var ordenados = (dados.agendamentos || []).slice().sort(function (a, b) {
    return new Date(a.inicio).getTime() - new Date(b.inicio).getTime();
  });
  var linhas = [['Data', 'Hora', 'Cliente', 'WhatsApp', 'Serviço', 'Situação', 'Origem', 'Observação']];
  ordenados.forEach(function (a) {
    var c = clientes[a.cliente_id] || {};
    var s = a.servico_id ? servicos[a.servico_id] : null;
    linhas.push([
      dataBr(a.inicio, fuso),
      horaBr(a.inicio, fuso),
      c.nome || '',
      c.telefone || '',
      s ? s.nome : '—',
      SITUACOES[a.status] || a.status,
      a.origem === 'link' ? 'Link' : 'Dono',
      a.observacao || '',
    ]);
  });
  return linhas;
}

function linhasClientes(dados, fuso) {
  var ordenados = (dados.clientes || []).slice().sort(function (a, b) {
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
  var linhas = [['Nome', 'WhatsApp', 'Cliente desde']];
  ordenados.forEach(function (c) {
    linhas.push([c.nome, c.telefone, c.criado_em ? dataBr(c.criado_em, fuso) : '']);
  });
  return linhas;
}

function linhasServicos(dados) {
  var linhas = [['Nome', 'Duração (min)', 'Ativo']];
  (dados.servicos || []).forEach(function (s) {
    linhas.push([s.nome, s.duracao_min, s.ativo ? 'Sim' : 'Não']);
  });
  return linhas;
}

function linhasConfiguracoes(dados) {
  var c = (dados.configuracoes || [])[0] || {};
  var folgas = (c.folgas || [])
    .map(function (f) {
      return f.split('-').reverse().join('/');
    })
    .join(', ');
  var linhas = [
    ['Campo', 'Valor'],
    ['Nome do negócio', c.nome_negocio || ''],
    ['WhatsApp do negócio', c.telefone_negocio || ''],
    ['Duração de cada horário (min)', c.passo_min],
    ['Dias que o link mostra', c.dias_abertos],
    ['Folgas', folgas],
  ];
  var expediente = c.expediente || {};
  DIAS_SEMANA.forEach(function (d) {
    var intervalos = expediente[d[0]] || expediente[String(d[0])] || [];
    var texto = intervalos.length
      ? intervalos
          .map(function (iv) {
            return iv.inicio + '–' + iv.fim;
          })
          .join(', ')
      : 'fechado';
    linhas.push([d[1], texto]);
  });
  return linhas;
}

function nomesDoBackup(agora, fuso) {
  var dia = dataIso(agora, fuso);
  return { planilha: 'Backup Agenda ' + dia, arquivo: 'backup-agenda-' + dia + '.json' };
}

/** Nomes a mandar para a lixeira: além das `manter` cópias mais recentes de cada tipo. */
function copiasParaApagar(nomes, manter) {
  if (manter === undefined) manter = 12;
  var resultado = [];
  [PADRAO_PLANILHA, PADRAO_ARQUIVO].forEach(function (padrao) {
    var doTipo = nomes
      .filter(function (n) {
        return padrao.test(n);
      })
      .sort(function (a, b) {
        var da = a.match(padrao)[1];
        var db = b.match(padrao)[1];
        return da < db ? 1 : da > db ? -1 : 0; // mais recente primeiro
      });
    resultado = resultado.concat(doTipo.slice(manter));
  });
  return resultado;
}

/**
 * Faz o backup na ordem segura: exportar → planilha → JSON → limpar cópias antigas → concluir.
 * `concluir` (que marca a data e apaga agendamentos com mais de 1 ano) só roda se tudo antes deu certo.
 */
function executarBackup(deps) {
  try {
    var dados = deps.exportar();
    var fuso = 'America/Sao_Paulo';
    deps.criarPlanilha(deps.nomes.planilha, {
      Agendamentos: linhasAgendamentos(dados, fuso),
      Clientes: linhasClientes(dados, fuso),
      Serviços: linhasServicos(dados),
      Configurações: linhasConfiguracoes(dados),
    });
    deps.salvarJson(deps.nomes.arquivo, JSON.stringify(dados, null, 2));
    deps.limparAntigas();
    var r = deps.concluir();
    deps.log('Backup concluído. Agendamentos antigos apagados: ' + r.apagados);
    return { ok: true, apagados: r.apagados };
  } catch (e) {
    var mensagem = e && e.message ? e.message : String(e);
    deps.avisarFalha(mensagem);
    return { ok: false, erro: mensagem };
  }
}
