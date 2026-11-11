# Implantação para um cliente (checklist)

Tudo fica nas contas do cliente. Ative a **verificação em duas etapas** em cada conta criada (Google, Supabase, GitHub, Cloudflare).

## 1. Conta Google

- [ ] Criar ou confirmar uma conta Google dedicada ao negócio. Ativar a verificação em duas etapas.

## 2. Supabase

- [ ] Criar a conta em supabase.com (entrar com a conta Google do negócio) e um projeto na região São Paulo. Guardar a senha do banco **com o cliente**.
- [ ] Em **SQL Editor**, rodar o conteúdo de `supabase/migrations/0001_init.sql` e depois `supabase/seed.sql`.
- [ ] Em **Authentication → Users → Add user**, criar o usuário do dono com o e-mail da conta Google do negócio.
- [ ] Copiar o **User UID** desse usuário e rodar no SQL Editor:
      `insert into donos (user_id) values ('<User UID>');`
      Sem isso o app mostra "Esta conta não tem acesso a esta agenda."
- [ ] Em **Authentication → Sign In / Providers**, **desligar "Allow new users to sign up"**. Só o dono entra.
- [ ] Em **Authentication → Emails → Magic Link**, trocar o corpo do e-mail para mandar o código: `Seu código de acesso: {{ .Token }}`. O app pede esse código de 6 dígitos (o link do e-mail abriria no Safari, que não divide o login com o app da Tela de Início).
- [ ] Login com Google (opcional; o código por e-mail já basta): ativar o provedor Google com um OAuth Client criado no Google Cloud Console da conta do negócio. Se ativar, testar no app **instalado** no iPhone (passo 6), porque o login sai do app e precisa voltar para ele.
- [ ] Em **Authentication → URL Configuration**, colocar a URL do site (passo 4) em **Site URL** e em **Redirect URLs**.
- [ ] Anotar **Project URL** e a chave **anon / publishable** (Project Settings → API). **Nunca** usar a chave `service_role` no site.

## 3. GitHub

- [ ] Criar a conta do cliente e gerar um repositório a partir do repositório-modelo (**Use this template**).

## 4. Cloudflare Pages

- [ ] Antes da primeira entrega: confirmar nos termos do plano gratuito que o uso comercial é permitido.
- [ ] Criar a conta, **Workers & Pages → Create → Pages → Connect to Git**, escolher o repositório do cliente.
- [ ] Build command `npm run build`, output `dist`, variável `NODE_VERSION` = `22` ou mais nova.
- [ ] Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_NOME_NEGOCIO`.

## 5. Configuração inicial (no app)

- [ ] Entrar com a conta do dono. Em **Ajustes**: nome do negócio, expediente, folgas, serviços com duração, mensagens.

## 6. Teste no iPhone do cliente

- [ ] Abrir o link no Safari → **Adicionar à Tela de Início** → abrir pelo ícone.
- [ ] Fazer login pelo app instalado (código por e-mail e, se ativado, Google), marcar um horário, gerar horários livres e mandar um lembrete.
- [ ] Fazer um backup e **testar a restauração** num projeto de teste:
      `SUPABASE_DB_URL='postgresql://…' npx tsx scripts/restore.ts backup.json`
- [ ] Combinar de abrir o app depois de alguns dias para conferir se o login continua ativo.

## 7. Entrega

- [ ] Entregar o `docs/manual-cliente.md` (uma página).
- [ ] Registrar por escrito a aprovação do escopo (guardar a conversa).
