# Backup automático no Google Drive — Plano de Implementação

> **Para quem for executar:** use superpowers:subagent-driven-development ou superpowers:executing-plans. Os passos usam caixas de seleção (`- [ ]`). Os títulos são "### Task N" porque os scripts de execução procuram esse formato.

**Objetivo:** toda semana, um Google Apps Script na conta do negócio copia os dados da agenda para uma planilha e um JSON no Drive, mantém 12 semanas e, só depois de dar certo, o banco apaga os agendamentos com mais de 1 ano.

**Arquitetura:**
- A migração `0003` traz uma chave de backup guardada só como hash e duas funções `security definer` (`exportar_backup`, `concluir_backup`) que exigem a chave. Um `backup_ativo` gerado avisa o app sem expor o hash.
- O script tem a lógica pura em `apps-script/logica.js` (testada com o Vitest via `node:vm`) e a parte que fala com o Google em `apps-script/Backup.gs`, testada com objetos do Google falsos.
- O app ganha a seção de backup em Ajustes.

**Tecnologias:** as mesmas da v3, mais Google Apps Script (V8, `UrlFetchApp`, `SpreadsheetApp`, `DriveApp`, `MailApp`, `ScriptApp`).

**Especificação:** `docs/superpowers/specs/2026-11-11-backup-drive-design.md`

## Restrições gerais

- Valem as dos planos v1, v2 e v3.
- **Chave:** 32 bytes aleatórios em base64url, 43 caracteres. O banco guarda só `encode(sha256(convert_to(chave,'UTF8')),'hex')` em `configuracoes.backup_chave_hash`.
- **Hash nunca sai do banco:** não aparece no `exportar_backup`, no backup manual, no `getConfig` nem no app.
- **Agendamento:** domingo às 3h, `America/Sao_Paulo`.
- **Nomes no Drive:**
  - pasta: `Backups da Agenda`;
  - planilha: `Backup Agenda AAAA-MM-DD`;
  - arquivo: `backup-agenda-AAAA-MM-DD.json`;
  - mantém as 12 mais recentes de cada tipo.
- **Limpeza:** apaga só agendamentos com `fim < now() - interval '1 year'`, só dentro de `concluir_backup` e só depois de a planilha e o JSON estarem salvos.
- **E-mail de falha:**
  - assunto: `Backup da agenda falhou`;
  - corpo: `O backup da agenda desta semana falhou: {mensagem}. Abra o app e use Ajustes → Baixar backup enquanto isso.`

## Pontos de atenção na revisão

1. Chave colada no script com espaço ou quebra de linha nas pontas: funciona igual (o script apara). → Task 5.
2. Projeto novo com tabelas vazias: a planilha sai só com os cabeçalhos, sem erro. → Task 4.
3. Arquivos que o dono pôs ou renomeou na pasta: a limpeza ignora tudo que não segue o padrão de nome. → Task 4.
4. Supabase pausado ou fora do ar (HTML ou 5xx em vez de JSON): o e-mail traz "HTTP {código}" e um trecho curto, não a página inteira, e nada é apagado. → Task 5.
5. Dois backups no mesmo dia (rodar na mão e depois o gatilho): fica uma planilha e um JSON por dia; a cópia anterior do mesmo nome vai para a lixeira. → Task 5.

---

## Estrutura de arquivos

```
supabase/migrations/0003_backup_drive.sql   chave, backup_ativo, funções
src/lib/chaveBackup.ts                      gerarChaveBackup()
src/data/configuracoes.ts                   select explícito com backup_ativo; definirChaveBackup
src/lib/backup.ts                           exportBackup com colunas explícitas de configuracoes
src/ui/SecaoBackup.tsx                      seção Backup de Ajustes
src/ui/Configuracoes.tsx                    usa SecaoBackup
apps-script/logica.js                       funções puras do script
apps-script/Backup.gs                       instalar(), fazerBackup()
apps-script/appsscript.json                 fuso e V8
tests/db/backupDrive.test.ts, tests/data/backupDrive.test.ts, tests/ui/SecaoBackup.test.tsx,
tests/appsScript/logica.test.ts, tests/appsScript/backupGs.test.ts, tests/helpers/appsScript.ts
docs/implantacao.md, docs/manual-cliente.md
```

---

### Task 1: Migração 0003 (chave e funções)

**Arquivos:** Criar `supabase/migrations/0003_backup_drive.sql`. Alterar `tests/helpers/pg.ts` (aplica a `0003` depois da `0002`, antes do seed). Testes: `tests/db/backupDrive.test.ts`.

**Interfaces:**
- Fornece:
  - coluna `configuracoes.backup_chave_hash text`;
  - coluna gerada `configuracoes.backup_ativo boolean generated always as (backup_chave_hash is not null) stored`;
  - `definir_chave_backup(chave text) returns void` (execute só para `authenticated`);
  - `exportar_backup(chave text) returns jsonb` e `concluir_backup(chave text) returns jsonb` (execute para `anon` e `authenticated`);
  - a função interna `chave_backup_confere(chave text) returns boolean`, sem execute para `anon`/`authenticated`.
  - Chave errada ou hash nulo: `raise exception 'chave de backup inválida' using errcode = '42501'`.

- [ ] **Passo 1: Escrever os testes que falham.** O helper `comChave(db, chave)` grava o hash como superusuário. Chave de teste: `'k'.repeat(43)`.
  - `exportar_backup com a chave certa devolve as sete chaves`: as chaves do JSON, em ordem, são `agendamentos, clientes, configuracoes, gerado_em, horarios_ajuste, servicos, versao`; `versao = 1`; um cliente inserido aparece.
  - `o hash não sai no backup`: `configuracoes[0]` não tem `backup_chave_hash`.
  - `chave errada → 42501` e `sem chave definida (hash nulo) → 42501`.
  - `concluir_backup marca ultimo_backup, apaga só o que terminou há mais de 1 ano e nunca o cliente`: agendamentos com `fim` = now − 366 dias (sai), now − 364 dias (fica) e now + 1 dia (fica). Devolve `{ apagados: 1 }`; o cliente do agendamento apagado continua; `ultimo_backup` fica a menos de 1 minuto de `now()`.
  - `definir_chave_backup só para o dono`: o estranho (`comoUsuario(ESTRANHO)`) recebe `42501`; o anon não tem execute (`42501`); o dono grava.
  - `definir_chave_backup recusa chave curta`: 31 caracteres dá erro com `22023`.
  - `uma chave nova invalida a antiga`.
  - `backup_ativo acompanha o hash`: `false` antes e `true` depois de `definir_chave_backup`.
  - `anon chama exportar_backup sem a chave certa e não recebe dados` (`set role anon`, `42501`).
  - `chave_backup_confere não é executável por anon` (`42501`).
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/db/backupDrive.test.ts`. FAIL.
- [ ] **Passo 3: Implementar.** Para tirar o hash de `configuracoes`, use `to_jsonb(c) - 'backup_chave_hash'`. As funções seguem o padrão da `0002` (`security definer`, `set search_path = public`, `revoke … from public, anon, authenticated` antes de cada `grant`).
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS (a restauração não muda: a lista de colunas da v2 não inclui as colunas novas).
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: chave de backup e funções de exportação e limpeza"`

### Task 2: Chave no app e dados sem o hash

**Arquivos:**
- Criar: `src/lib/chaveBackup.ts`.
- Alterar: `src/types.ts` (`Config.backup_ativo: boolean`), `src/data/configuracoes.ts`, `src/lib/backup.ts`, `tests/helpers/config.ts` (`backup_ativo: false`), `tests/lib/slots.test.ts` e `tests/helpers/cenario.ts` (campo novo nos objetos de config).
- Testes: `tests/data/backupDrive.test.ts`, `tests/lib/chaveBackup.test.ts`.

**Interfaces:**
- Fornece:
  - `gerarChaveBackup(): string`;
  - `definirChaveBackup(db, chave: string): Promise<void>` (`rpc('definir_chave_backup', { chave })`);
  - `COLUNAS_CONFIG: string` (lista explícita das colunas de `configuracoes`, sem `backup_chave_hash`), exportada de `src/data/configuracoes.ts`;
  - `getConfig` com `select(COLUNAS_CONFIG + ', backup_ativo')`.
  - `exportBackup` busca `configuracoes` com `select(COLUNAS_CONFIG)`, sem `backup_ativo` (a restauração não grava coluna gerada).

- [ ] **Passo 1: Escrever os testes que falham:**
  - `gerarChaveBackup tem 43 caracteres de base64url`: casa com `/^[A-Za-z0-9_-]{43}$/`; duas chamadas dão valores diferentes.
  - `getConfig não pede '*' nem o hash e pede backup_ativo` (MSW: o parâmetro `select` não contém `*` nem `backup_chave_hash` e contém `backup_ativo`).
  - `exportBackup pede configuracoes sem o hash e sem backup_ativo` (o `select` da chamada a `configuracoes` não contém `backup_chave_hash` nem `backup_ativo`; as outras tabelas continuam com `*`).
  - `definirChaveBackup envia { chave }` para `rpc/definir_chave_backup`; com 503 dá `SemConexaoError`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/data/backupDrive.test.ts tests/lib/chaveBackup.test.ts`. FAIL.
- [ ] **Passo 3: Implementar.** Base64url a partir de `crypto.getRandomValues(new Uint8Array(32))`, sem `=`.
- [ ] **Passo 4: Ver passar.** PASS; `npx tsc -p .` sem erros; `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: chave de backup no app e configuração sem o hash"`

### Task 3: Seção Backup em Ajustes (`src/ui/SecaoBackup.tsx`)

**Arquivos:** Criar `src/ui/SecaoBackup.tsx`. Alterar `src/ui/Configuracoes.tsx` (a seção Backup passa a ser `<SecaoBackup />`, com `<BotaoBackup />` dentro). Testes: `tests/ui/SecaoBackup.test.tsx`.

**Interfaces:**
- Usa: `useConfig` (`config.ultimo_backup`, `config.backup_ativo`, `recarregar`), `gerarChaveBackup`, `definirChaveBackup` (Task 2), `diaPorExtenso` (v3), `dataLocal`, `horaLocal`, `BotaoBackup`.

- [ ] **Passo 1: Escrever os testes que falham** (com `src/data/configuracoes` simulado e `gerarChaveBackup` simulado devolvendo `'x'.repeat(43)`):
  - `mostra "Último backup: domingo, 15/11 às 03:02"` com `ultimo_backup = '2026-11-15T06:02:00Z'`.
  - `sem backup mostra "Nenhum backup ainda"`.
  - `sem chave: "Gerar chave de backup" chama definirChaveBackup({}, 'x'.repeat(43))`, mostra a chave num campo só de leitura (`getByLabelText('Chave de backup')` com o valor) e o aviso `Guarde e cole no script de backup. Esta chave não aparece de novo.`; depois, `recarregar` é chamado.
  - `Copiar copia a chave` (`navigator.clipboard.writeText('x'.repeat(43))`).
  - `com chave: mostra "Backup automático ativado." e "Gerar nova chave" pede confirmação`: aparece o texto `Gerar uma nova chave? O backup automático para até você colar a nova no script.`; **Voltar** não chama `definirChaveBackup`; **Gerar nova** chama.
  - `falha de rede mostra "Não foi possível gerar a chave. Confira a internet e tente de novo." e não mostra chave`.
  - `a seção continua com "Baixar backup"`.
  - Em `tests/ui/Configuracoes.test.tsx`, o teste de ordem das seções continua passando (a seção ainda tem o `h3` "Backup").
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/SecaoBackup.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** A chave fica só no estado do componente; ao sair da tela, ela some.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: seção de backup automático em Ajustes"`

### Task 4: Lógica do script (`apps-script/logica.js`)

**Arquivos:** Criar `apps-script/logica.js` e `tests/helpers/appsScript.ts`, com `carregarLogica()`, que lê o arquivo e roda com `vm.runInNewContext`, devolvendo o contexto com as funções globais. Testes: `tests/appsScript/logica.test.ts`.

**Interfaces** (funções globais, sem `import`/`export`; datas com `Intl.DateTimeFormat` e `timeZone`):
- `linhasAgendamentos(dados, fuso) → string[][]`: cabeçalho `['Data','Hora','Cliente','WhatsApp','Serviço','Situação','Origem','Observação']` e uma linha por agendamento, em ordem de `inicio`. Cliente, WhatsApp e serviço vêm por `cliente_id`/`servico_id` de `dados.clientes`/`dados.servicos`. Serviço nulo vira `—`; observação nula vira `''`; situação: Marcado, Confirmado, Cancelado, Concluído, Faltou; origem: `Link` ou `Dono`.
- `linhasClientes(dados, fuso)`: cabeçalho `['Nome','WhatsApp','Cliente desde']`, em ordem de nome (`localeCompare` pt-BR).
- `linhasServicos(dados)`: cabeçalho `['Nome','Duração (min)','Ativo']`, com Ativo `Sim`/`Não`.
- `linhasConfiguracoes(dados)`: `[['Campo','Valor'], ['Nome do negócio', …], ['WhatsApp do negócio', … ou ''], ['Duração de cada horário (min)', …], ['Dias que o link mostra', …], ['Folgas', 'dd/mm/aaaa, …' ou ''], ['Segunda-feira', '09:00–12:00, 14:00–18:00' ou 'fechado'], …, ['Domingo', …]]`.
- `nomesDoBackup(agora: Date, fuso) → { planilha: 'Backup Agenda AAAA-MM-DD', arquivo: 'backup-agenda-AAAA-MM-DD.json' }`.
- `copiasParaApagar(nomes: string[], manter = 12) → string[]`: considera só nomes que casam exatamente com um dos dois padrões, separados por tipo; devolve os mais velhos além dos `manter` mais recentes de cada tipo.
- `executarBackup(deps) → { ok: boolean, apagados?: number, erro?: string }`, com `deps = { exportar(): dados, nomes: {planilha, arquivo}, criarPlanilha(nome, abas), salvarJson(nome, texto), limparAntigas(), concluir(): {apagados}, avisarFalha(mensagem), log(texto) }`. A ordem é exportar → criarPlanilha (abas `Agendamentos`, `Clientes`, `Serviços`, `Configurações`, com as linhas acima) → salvarJson (`JSON.stringify(dados, null, 2)`) → limparAntigas → concluir. Qualquer exceção chama `avisarFalha(e.message)` e devolve `ok: false`.

- [ ] **Passo 1: Escrever os testes que falham** (`F = 'America/Sao_Paulo'`; dados com um cliente João `5511987654321`, um serviço Corte 30 min, dois agendamentos: um `marcado` `link` em `2026-11-18T12:00:00Z` sem serviço, e um `concluido` `dono` em `2026-11-17T17:30:00Z` com Corte e observação "barba"):
  - `linhasAgendamentos` = `[cabeçalho, ['17/11/2026','14:30','João','5511987654321','Corte','Concluído','Dono','barba'], ['18/11/2026','09:00','João','5511987654321','—','Marcado','Link','']]`.
  - `linhasClientes` = `[cabeçalho, ['João','5511987654321','01/11/2026']]` (com `criado_em '2026-11-01T13:00:00Z'`).
  - `linhasServicos` = `[cabeçalho, ['Corte', 30, 'Sim']]`.
  - `linhasConfiguracoes` traz `['Terça-feira','09:00–12:00, 14:00–18:00']`, `['Domingo','fechado']` e `['Folgas','25/12/2026']`.
  - `tabelas vazias geram só os cabeçalhos` (ponto de atenção 2).
  - `nomesDoBackup(2026-11-15T06:02Z)` = `{ planilha: 'Backup Agenda 2026-11-15', arquivo: 'backup-agenda-2026-11-15.json' }`, e às `2026-11-16T02:30Z` (domingo 23:30 local) ainda é `2026-11-15`.
  - `copiasParaApagar`: com 14 planilhas semanais, as 2 mais velhas; com 12, nenhuma; nomes como `Backup Agenda (cópia)`, `minhas notas` e `backup-agenda-final.json` são ignorados (ponto de atenção 3); planilhas e JSONs são contados separadamente.
  - `executarBackup` em ordem: as chamadas registradas são `['exportar','criarPlanilha','salvarJson','limparAntigas','concluir']` e o retorno é `{ ok: true, apagados: 2 }`.
  - `executarBackup com falha na planilha`: não chama `salvarJson` nem `concluir`, chama `avisarFalha('planilha falhou')` e devolve `{ ok: false, erro: 'planilha falhou' }`.
  - `executarBackup com falha só no concluir`: a planilha e o JSON foram salvos e `avisarFalha` foi chamado.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/appsScript/logica.test.ts`. FAIL.
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Ver passar.** PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: lógica do script de backup no Drive"`

### Task 5: Script do Google (`apps-script/Backup.gs`) e documentos

**Arquivos:**
- Criar: `apps-script/Backup.gs`, `apps-script/appsscript.json` (`{"timeZone":"America/Sao_Paulo","runtimeVersion":"V8","exceptionLogging":"STACKDRIVER","oauthScopes":[…drive, spreadsheets, script.external_request, script.send_mail, script.scriptapp, userinfo.email]}`).
- Alterar: `tests/helpers/appsScript.ts` (`carregarScript(falsos)` carrega `logica.js` + `Backup.gs` no mesmo contexto com objetos do Google falsos), `docs/implantacao.md`, `docs/manual-cliente.md`.
- Testes: `tests/appsScript/backupGs.test.ts`.

**Interfaces:**
- Fornece as funções globais do script:
  - `instalar()`;
  - `fazerBackup()`;
  - `chamarSupabase(funcao: string) → objeto` (`POST {SUPABASE_URL}/rest/v1/rpc/{funcao}` com `apikey` e `Authorization: Bearer {anon}`, corpo `{ chave: CHAVE_BACKUP.trim() }` e `muteHttpExceptions: true`). Resposta fora de 2xx lança `HTTP {código}: {até 200 caracteres do corpo}`.
- Falsos mínimos em `tests/helpers/appsScript.ts`: `UrlFetchApp.fetch`, `SpreadsheetApp.create`, `DriveApp` (pasta com `createFile`, `getFiles` e arquivos com `setTrashed`/`moveTo`), `MailApp.sendEmail`, `Session.getEffectiveUser().getEmail()`, `ScriptApp` (`getProjectTriggers`, `deleteTrigger`, `newTrigger().timeBased().onWeekDay().atHour().everyWeeks().create()`), `Logger.log` e `Utilities.formatDate` se for usado.

- [ ] **Passo 1: Escrever os testes que falham:**
  - `fazerBackup cria a planilha com as 4 abas e o JSON na pasta, e chama concluir_backup`: as URLs chamadas, em ordem, terminam em `rpc/exportar_backup` e `rpc/concluir_backup`; o corpo das duas é `{"chave":"<chave>"}`.
  - `chave com espaço ou quebra de linha nas pontas é aparada` (ponto de atenção 1).
  - `Supabase fora do ar (540 com HTML)`: `MailApp.sendEmail` recebe o assunto `Backup da agenda falhou` e um corpo que começa com `O backup da agenda desta semana falhou: HTTP 540:` e tem menos de 400 caracteres; `concluir_backup` não é chamado (ponto de atenção 4).
  - `segundo backup no mesmo dia manda a planilha e o JSON anteriores do mesmo nome para a lixeira` (ponto de atenção 5).
  - `mantém 12: com 13 planilhas antigas na pasta, a mais velha vai para a lixeira`.
  - `instalar apaga gatilhos antigos de fazerBackup, cria um semanal de domingo às 3h e roda o backup`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/appsScript/backupGs.test.ts`. FAIL.
- [ ] **Passo 3: Implementar e documentar.**
  - `Backup.gs` cria a planilha, move para a pasta, preenche as abas (renomeia a primeira, cria as outras e usa `getRange(1,1,linhas,colunas).setValues`) e usa `executarBackup` da Task 4.
  - `implantacao.md`: o passo "Backup automático" da seção 7 da spec, inclusive a observação sobre a pausa do Supabase.
  - `manual-cliente.md`: o texto da seção 7 da spec.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS e `npm run build` ok.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: script do Google para o backup semanal e documentação"`
- [ ] **Passo 6 (manual, com o autor):** aplicar a `0003` no projeto de teste e gerar a chave no app. Instalar o script na conta Google do negócio, rodar `instalar`, conferir a planilha e o JSON em "Backups da Agenda" e "Último backup" no app.
