# Agenda Fácil — Especificação: backup automático no Google Drive

Data: 2026-11-11
Status: aguardando revisão do autor
Base: v1, v2 e v3 (`docs/superpowers/specs/`). Tudo continua valendo, exceto o que esta especificação muda.

## 1. Objetivo

Fazer, toda semana e sem ninguém tocar em nada, uma cópia dos dados da agenda numa planilha no Google Drive da conta do negócio, para o dono não perder os dados. Depois de cada cópia bem-sucedida, o banco apaga os agendamentos muito antigos.

Restrições:
- Tudo fica nas contas do cliente. O autor não hospeda nada.
- Sem projeto no Google Cloud e sem chave mestra (`service_role`) fora do Supabase.
- O backup manual em arquivo e o script de restauração da v1 continuam funcionando.

## 2. Visão geral

Um **Google Apps Script** na conta Google do negócio roda todo domingo às 3h (horário de São Paulo). Ele:
1. lê os dados no Supabase por uma função protegida por uma **chave de backup**;
2. cria uma planilha e um arquivo JSON na pasta "Backups da Agenda";
3. apaga as cópias com mais de 12 semanas;
4. avisa o banco que deu certo, e o banco então marca a data do backup e apaga os agendamentos que terminaram há mais de 1 ano.

## 3. Chave de backup

- É gerada no aparelho do dono: 32 bytes de `crypto.getRandomValues`, em base64url (43 caracteres, sem `=`).
- O banco guarda só `encode(sha256(convert_to(chave, 'UTF8')), 'hex')`, na coluna nova `configuracoes.backup_chave_hash text` (nula = backup automático não ativado).
- Gerar outra chave substitui o hash: a anterior para de funcionar na hora.
- A chave aparece uma única vez na tela, e o app não a guarda.

## 4. Banco (migração `supabase/migrations/0003_backup_drive.sql`)

- `alter table configuracoes add column backup_chave_hash text`.
- **`definir_chave_backup(chave text) returns void`**: `security definer`, `search_path = public`. Só funciona para o dono logado (`eh_dono()`); senão, erro `42501`. Exige chave com pelo menos 32 caracteres e grava o hash.
- **`exportar_backup(chave text) returns jsonb`**: `security definer`, `search_path = public`.
  - Com hash nulo ou chave errada: erro `42501`, mensagem `chave de backup inválida`.
  - Com a chave certa, devolve `{ versao: 1, gerado_em, clientes, servicos, agendamentos, configuracoes, horarios_ajuste }`, o mesmo formato do `BackupFile` da v1/v2. Em `configuracoes`, sem a coluna `backup_chave_hash`.
- **`concluir_backup(chave text) returns jsonb`**: `security definer`, `search_path = public`. Com a chave certa:
  1. `update configuracoes set ultimo_backup = now()`;
  2. `delete from agendamentos where fim < now() - interval '1 year'`;
  3. devolve `{ "apagados": <quantidade> }`.

  Nunca apaga clientes, serviços, horários ajustados nem configurações.
- `exportar_backup` e `concluir_backup` têm execute para `anon` e `authenticated`; `definir_chave_backup` só para `authenticated`. Uma função auxiliar interna de conferência da chave, se existir, fica sem execute para `anon` e `authenticated`.
- O backup manual (`exportBackup` do app) também não leva `backup_chave_hash`, e o script de restauração não o grava (a lista de colunas da v2 já não inclui).

## 5. Script do Google (`apps-script/`)

Arquivos:
- `apps-script/logica.js`: funções puras, sem nada do Google, testadas com o Vitest.
- `apps-script/Backup.gs`: a parte que fala com o Supabase, o Drive, as Planilhas e o e-mail.
- `apps-script/appsscript.json`: `"timeZone": "America/Sao_Paulo"`, V8.

No Apps Script, os dois `.js`/`.gs` viram arquivos do mesmo projeto. O `logica.js` não usa `import`/`export`; o teste o carrega com `node:vm`.

### 5.1 Configuração

No topo do `Backup.gs` ficam três constantes, preenchidas na instalação: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `CHAVE_BACKUP`.

### 5.2 `instalar()`

1. Cria (ou reaproveita) a pasta "Backups da Agenda" na raiz do Drive.
2. Remove os gatilhos antigos de `fazerBackup` e cria um gatilho semanal: domingo, 3h.
3. Roda `fazerBackup()` uma vez.

### 5.3 `fazerBackup()`

1. Chama `exportar_backup` via REST (`POST {URL}/rest/v1/rpc/exportar_backup` com `apikey`).
2. Cria a planilha "Backup Agenda AAAA-MM-DD" (data local da execução) na pasta, com as abas e colunas:
   - **Agendamentos**: Data (dd/mm/aaaa), Hora (HH:MM), Cliente, WhatsApp, Serviço, Situação, Origem, Observação. Ordem de início. Datas e horas em São Paulo. Situação em português (Marcado, Confirmado, Cancelado, Concluído, Faltou). Origem "Link" ou "Dono". Serviço vazio vira "—".
   - **Clientes**: Nome, WhatsApp, Cliente desde (dd/mm/aaaa). Ordem de nome.
   - **Serviços**: Nome, Duração (min), Ativo (Sim/Não).
   - **Configurações**: duas colunas (Campo, Valor), com Nome do negócio, WhatsApp do negócio, Duração de cada horário (min), Dias que o link mostra, Folgas (separadas por vírgula) e uma linha por dia com o expediente ("Terça-feira: 09:00–12:00, 14:00–18:00", ou "fechado").
3. Salva `backup-agenda-AAAA-MM-DD.json` (o JSON devolvido, formatado) na mesma pasta.
4. Na pasta, mantém as 12 planilhas e os 12 JSONs mais recentes pela data do nome, e manda os mais velhos para a lixeira.
5. Chama `concluir_backup` e anota o número de apagados no log.

Se qualquer passo de 1 a 4 falhar, `concluir_backup` **não** é chamado, e sai um e-mail para a conta do script (`Session.getEffectiveUser().getEmail()`):
- assunto: `Backup da agenda falhou`;
- corpo: `O backup da agenda desta semana falhou: {mensagem do erro}. Abra o app e use Ajustes → Baixar backup enquanto isso.`

Se só o passo 5 falhar, a cópia existe, mas a data não avança e nada é apagado; o e-mail sai do mesmo jeito.

## 6. App (Ajustes → Backup)

- **"Último backup: {dia por extenso}, {dd/mm} às {HH:MM}"**, a partir de `config.ultimo_backup` em São Paulo, ou **"Nenhum backup ainda"**.
- **Backup automático no Google Drive**:
  - Sem chave (`backup_chave_hash` nulo, que o app recebe como `backup_ativo: boolean`): o botão **"Gerar chave de backup"**.
  - Com chave: o texto "Backup automático ativado." e o botão **"Gerar nova chave"**, que antes pergunta "Gerar uma nova chave? O backup automático para até você colar a nova no script.", com **Gerar nova** e **Voltar**.
  - Depois de gerar: a chave aparece num campo só de leitura, com **Copiar** e o aviso "Guarde e cole no script de backup. Esta chave não aparece de novo." Falha de rede: "Não foi possível gerar a chave. Confira a internet e tente de novo."
- O app não lê o hash. `getConfig` passa a devolver `backup_ativo` (`backup_chave_hash is not null`) e nunca o hash. O `select` de configurações deixa de ser `*` e lista as colunas.
- **Baixar backup** (manual) e o aviso amarelo da Agenda continuam como estão.

## 7. Documentos

- `docs/implantacao.md`, passo novo "Backup automático":
  1. aplicar a `0003`;
  2. no app, gerar a chave;
  3. em script.google.com, com a conta do negócio, criar o projeto, colar `logica.js`, `Backup.gs` e `appsscript.json` e preencher as três constantes;
  4. rodar `instalar` e autorizar;
  5. conferir a planilha, o JSON e "Último backup" no app.
- `docs/manual-cliente.md`: "O backup é automático todo domingo, numa pasta do seu Google Drive chamada 'Backups da Agenda'. Se falhar, chega um e-mail. Você ainda pode baixar um backup na hora em Ajustes."
- Observação no checklist: o acesso semanal do script pode ajudar a evitar a pausa do Supabase, mas isso não é garantido; continua valendo o passo de reativação do manual.

## 8. Testes

- **Banco:**
  - `exportar_backup` com a chave certa devolve as sete chaves e os dados, sem `backup_chave_hash`;
  - chave errada, ou hash nulo, dá `42501`;
  - `concluir_backup` marca `ultimo_backup`, apaga um agendamento que terminou há 366 dias, mantém um de 364 dias e os futuros, nunca apaga o cliente e devolve `apagados`;
  - `definir_chave_backup` só funciona para o dono logado (estranho e anon recebem `42501`) e recusa chave curta;
  - uma chave nova invalida a antiga;
  - anon chama `exportar_backup` sem chave e não recebe dados.
- **Lógica do script (`logica.js`):**
  - linhas de Agendamentos com data e hora de São Paulo, situação e origem em português, e "—" sem serviço;
  - linhas de Clientes, Serviços e Configurações;
  - nome da planilha e do arquivo a partir da data local;
  - escolha das cópias a apagar: com 14 planilhas, as 2 mais velhas; com 12 ou menos, nenhuma; arquivos fora do padrão de nome são ignorados;
  - a ordem segura: um orquestrador `executarBackup(deps)`, testado com funções falsas, não chama `concluir` quando a planilha falha e chama `avisarFalha` com a mensagem.
- **App:** a data do último backup e "Nenhum backup ainda"; gerar a chave (chama `definir_chave_backup` com 43 caracteres, mostra uma vez, copia); a confirmação ao trocar; o erro de rede; `getConfig` sem o hash.
- **Manual (no projeto de teste):** instalar o script, rodar `fazerBackup`, ver a planilha e o JSON na pasta e "Último backup" atualizado no app.

## 9. Fora desta versão

Restaurar direto da planilha (a restauração continua pelo JSON e pelo script), escolher dia e hora do backup no app, backup em outras nuvens.
