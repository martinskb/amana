# Implantação para um cliente (checklist)

Tudo fica nas contas do cliente. Ative a **verificação em duas etapas** em cada conta criada (Google, Supabase, GitHub, Cloudflare).

## 1. Conta Google

- [ ] Criar ou confirmar uma conta Google dedicada ao negócio. Ativar a verificação em duas etapas.

## 2. Supabase

- [ ] Criar a conta em supabase.com (entrar com a conta Google do negócio) e um projeto na região São Paulo. Guardar a senha do banco **com o cliente**.
- [ ] Em **SQL Editor**, rodar, nesta ordem, `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_link_publico.sql`, `supabase/migrations/0003_backup_drive.sql`, `supabase/migrations/0004_link_seguranca.sql`, `supabase/migrations/0005_servico_no_link.sql`, `supabase/migrations/0006_pessoas.sql`, `supabase/migrations/0007_link_equipe.sql`, `supabase/migrations/0008_backup_sem_link.sql`, `supabase/migrations/0009_limpeza.sql` e `supabase/seed.sql`. (Projeto que já existia: rodar só as migrações que faltam, em ordem. A 0006 vai **antes** de publicar a versão do app com pessoas; veja "Atualizar para a versão com pessoas" abaixo.)
- [ ] Em **Authentication → Users → Add user → Create new user**, criar o dono com o e-mail `<usuario>@dono.agenda` (por exemplo `joao@dono.agenda`), uma senha de **8 ou mais caracteres** e **Auto Confirm User** marcado. No app, o dono entra com o usuário (`joao`) e a senha. Esse e-mail nunca recebe mensagens: se o dono esquecer a senha, troque aqui no painel.
- [ ] Copiar o **User UID** desse usuário e rodar no SQL Editor:
      `insert into donos (user_id) values ('<User UID>');`
      Sem isso o app mostra "Esta conta não tem acesso a esta agenda."
- [ ] Em **Authentication → Sign In / Providers**, **desligar "Allow new users to sign up"**. Só o dono entra.
- [ ] Não precisa de SMTP, modelo de e-mail nem login com Google: o login é por usuário e senha.
- [ ] Anotar **Project URL** e a chave **anon / publishable** (Project Settings → API). **Nunca** usar a chave `service_role` no site.

## 3. GitHub

- [ ] Criar a conta do cliente e gerar um repositório a partir do repositório-modelo (**Use this template**).

## 4. Cloudflare Pages

- [ ] Antes da primeira entrega: confirmar nos termos do plano gratuito que o uso comercial é permitido.
- [ ] Criar a conta, **Workers & Pages → Create → Pages → Connect to Git**, escolher o repositório do cliente.
- [ ] Build command `npm run build`, output `dist`, variável `NODE_VERSION` = `22` ou mais nova.
- [ ] Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_NOME_NEGOCIO`.

## 5. Configuração inicial (no app)

- [ ] Entrar com o usuário e a senha do dono. Em **Ajustes**: nome do negócio, **WhatsApp do negócio**, expediente, folgas, **duração de cada horário**, **quantos dias o link mostra**, mensagens (livres com `{link}`, lembrete e cancelamento).
- [ ] Em **Ajustes → Serviços**, cadastrar os serviços com a duração de cada um (o link pede o serviço quando há algum ativo).
- [ ] No topo da Agenda, tocar em **Copiar link** e mandar para o dono divulgar.

## 5b. Backup automático (Google Drive)

- [ ] No app, em **Ajustes → Backup**, tocar em **Gerar chave de backup** e copiar a chave (ela aparece uma vez só).
- [ ] Em **script.google.com**, entrando com a **conta Google do negócio**, criar um projeto chamado "Backup da Agenda".
- [ ] Copiar para o projeto os arquivos da pasta `apps-script/` do repositório:
  - `logica.js`, num arquivo de script;
  - `Backup.gs`, noutro arquivo de script;
  - o conteúdo de `appsscript.json`, depois de ligar "Mostrar o arquivo de manifesto 'appsscript.json'" nas Configurações do projeto.
- [ ] No topo do `Backup.gs`, preencher `SUPABASE_URL` e `SUPABASE_ANON_KEY` (a chave pública; **nunca** a `service_role`).
- [ ] Em **Configurações do projeto → Propriedades do script**, adicionar a propriedade `CHAVE_BACKUP` com a chave do app. Ela não vai no código.
- [ ] Escolher a função **instalar** e tocar em **Executar**. Autorizar com a conta do negócio. Se aparecer "O Google não verificou este app", tocar em "Avançado" → "Acessar Backup da Agenda": o script é do próprio negócio.
- [ ] Conferir no Drive a pasta **Backups da Agenda** com a planilha `Backup Agenda AAAA-MM-DD` e o arquivo `backup-agenda-AAAA-MM-DD.json`, e no app, em Ajustes, **Último backup** com a data de agora.
- [ ] Se um dia gerar uma chave nova no app, trocar o valor da propriedade `CHAVE_BACKUP` (a antiga para de funcionar na hora).
- [ ] Ao autorizar, o Google pede acesso ao Drive inteiro: o `DriveApp` do Apps Script não funciona com o acesso restrito (`drive.file`). O script só mexe na pasta "Backups da Agenda"; use de preferência uma conta Google só do negócio.
- Observação: o acesso semanal do script ao Supabase pode ajudar a evitar a pausa do plano gratuito, mas isso não é garantido. Continua valendo o passo de reativação do manual.

## 5c. Atualizar para a versão com pessoas (projeto que já estava no ar)

- [ ] No **SQL Editor**, rodar `supabase/migrations/0006_pessoas.sql`. Ela cria a "Pessoa 1", sem nome, que faz todos os serviços e fica com todos os agendamentos e horários extras que já existem.
- [ ] Só depois publicar o site novo (merge na `main`). Com uma pessoa só, a agenda e o link ficam iguais aos de antes.
- [ ] No projeto do Apps Script, trocar o conteúdo de `logica.js` pelo da pasta `apps-script/` do repositório. O backup passa a ter a aba **Pessoas** e a coluna **Pessoa** nos agendamentos. Não precisa rodar `instalar` de novo.
- [ ] Conferir em Ajustes o capítulo **Pessoas** com a "Pessoa 1". Se o negócio tiver mais gente, cadastrar cada uma e marcar os serviços que ela faz.

## 5d. Atualizar para a versão com o link da equipe

- [ ] No **SQL Editor**, rodar `supabase/migrations/0007_link_equipe.sql` **antes** de publicar o app (o painel da pessoa lê as colunas novas).
- [ ] Publicar o site. Nada muda para quem não gerar link.
- [ ] Conferir: em Ajustes → Pessoas → uma pessoa → **Criar link**, abrir o link numa aba anônima e ver os clientes dela de hoje e de amanhã.
- [ ] Rodar também `supabase/migrations/0008_backup_sem_link.sql` (pode ser a qualquer hora): o backup do Drive deixa de levar o código dos links. Backup não restaura links; depois de restaurar, crie de novo em Ajustes.

## 5e. Limpeza automática

- [ ] No **SQL Editor**, rodar `supabase/migrations/0009_limpeza.sql`.
- [ ] Em **Database → Extensions**, ligar a extensão `pg_cron`.
- [ ] No **SQL Editor**, rodar `supabase/cron/limpeza.sql`.
- [ ] Conferir o agendamento rodando:
      `select jobname, schedule, command from cron.job;`
- [ ] **Atenção:** só ligue o `pg_cron` e agende a limpeza **depois** que o site novo estiver no ar (o site antigo não espera agendamentos com cliente apagado e quebra).

## 6. Teste no iPhone do cliente

- [ ] **Limite por IP no projeto real** (uma vez por projeto). Com um horário livre do link, chame a função mandando IPs forjados:
      ```bash
      curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/agendar_publico" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" -H "X-Forwarded-For: 6.6.6.6" -H "X-Real-IP: 6.6.6.6" \
        -d '{"nome":"Teste IP","telefone":"11900000000","inicio":"<um horário livre em ISO>"}'
      ```
      No SQL Editor, `select ip from tentativas_publicas order by id desc limit 1;` precisa mostrar o **IP real** da sua conexão, não `6.6.6.6`. (Mandar `CF-Connecting-IP` forjado faz a Cloudflare recusar o pedido com "error code: 1000", o esperado.) Repita mais 3 vezes em horários diferentes: a quarta resposta tem que ser `"erro": "limite"`. Depois apague os agendamentos, o cliente "Teste IP" e as tentativas. Verificado no projeto de teste em 2026-11-11.
- [ ] Abrir o **link de agendamento** no celular de outra pessoa (sem login) e marcar um horário de teste; conferir que ele aparece na agenda como "pelo link".
- [ ] Abrir o link no Safari → **Adicionar à Tela de Início** → abrir pelo ícone.
- [ ] Fazer login pelo app instalado com usuário e senha, marcar um horário, gerar horários livres e mandar um lembrete.
- [ ] Fazer um backup e **testar a restauração** num projeto de teste:
      `SUPABASE_DB_URL='postgresql://…' SUPABASE_CA_CERT=prod-ca-2021.crt npx tsx scripts/restore.ts backup.json`
      (o certificado da CA se baixa em Project Settings → Database → SSL Configuration)
- [ ] Combinar de abrir o app depois de alguns dias para conferir se o login continua ativo.

## 7. Entrega

- [ ] Entregar o `docs/manual-cliente.md` (uma página).
- [ ] Registrar por escrito a aprovação do escopo (guardar a conversa).
