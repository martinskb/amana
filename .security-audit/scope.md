# Security audit scope: Agenda Fácil

- **Audited by:** Claude Code (Claude Opus 5.5), a pedido do dono do projeto · **Date:** 2026-11-12 · **Commit:** 5b15bcc (branch feat/redesign-visual)
- **Purpose and users:** agenda para pequenos negócios de serviço (primeiro cliente: barbearia). O dono gerencia a agenda num PWA; clientes finais marcam horário sozinhos por um link público, sem login.
- **Stack:** React 19 + Vite 8 (PWA, vite-plugin-pwa) · Supabase (Postgres, Auth, RLS, funções RPC) · Cloudflare Pages (site estático) · Google Apps Script (backup no Drive) · script local de restauração (Node/tsx + pg).
- **Exposure:** ainda não está no ar para clientes reais (só testes). Quando estiver: internet, com página pública sem login.
- **Data handled:** dados pessoais de clientes finais (nome e WhatsApp), histórico de atendimentos; credencial do dono (Supabase Auth). Sem pagamento, saúde ou dados de crianças.
- **Countries and sectors:** Brasil (LGPD) · serviços (barbearia/beleza).
- **Authorisation confirmed by:** dono do projeto (stated), 2026-11-12.
- **In scope:** src/, supabase/, apps-script/, scripts/, configuração de build (vite.config.ts, package.json, index.html, public/), git history, bundle de produção (dist/). · **Out of scope:** node_modules (só via scanners de dependência), configuração viva do painel do Supabase e do Google (não acessada).
- **Repository:** privado (github.com/martinskb/agenda-facil). Register committed: sim (exceto raw/).
- **Connectors and consent:** nenhum conector usado. Rede: npm audit (árvore de dependências → registro npm) e OSV-Scanner (nomes e versões → osv.dev), aprovados. Semgrep com --metrics=off. Nenhum código enviado.
- **Gate:** padrão (sem Critical/High abertos; todo Medium corrigido ou risco aceito; aprovador: Product Owner).
- **Coverage:** Full (segredos: Gitleaks; código: Semgrep; dependências: OSV-Scanner + npm audit). Sem arquivos de infraestrutura nem CI no repositório.

## Attack surface map

- **Entry points:** página pública `/#/agendar` → RPCs `horarios_publicos()` e `agendar_publico(nome, telefone, inicio)` (anon). App do dono `/#/`, `/#/link`, `/#/config` → API REST do Supabase (PostgREST) com JWT do dono. RPCs do backup `exportar_backup(chave)` e `concluir_backup(chave)` (anon, protegidas por chave de 32 bytes) chamadas pelo Apps Script em agendamento diário. RPC `definir_chave_backup(chave)` (authenticated, checa eh_dono()). Script local `scripts/restore.ts` com SUPABASE_DB_URL.
- **Authentication:** Supabase Auth por e-mail/senha (usuário vira `<usuario>@dono.agenda`); sessão do supabase-js no localStorage. Cadastro público deve estar desligado (painel).
- **Authorisation:** RLS em clientes, servicos, agendamentos, configuracoes, horarios_ajuste com `eh_dono()` (tabela donos, sem política = inacessível pela API). tentativas_publicas sem acesso pela API. Funções internas com execute revogado.
- **Data stores and external calls:** Postgres do Supabase; Apps Script → API do Supabase (UrlFetchApp) e Google Drive/Sheets; links wa.me montados com encodeURIComponent.
- **AI features:** nenhuma.
- **Infrastructure and CI:** nenhum Dockerfile, IaC ou workflow de CI no repositório. Cloudflare Pages configurado fora do repo; sem public/_headers.
- **Size:** 118 arquivos versionados; ~7,8 mil linhas em TS/TSX/JS/SQL/GS.

## Hotspots

1. `agendar_publico` / `agendar_publico_em` (escrita anônima no banco, limite de abuso, identidade do cliente)
2. `horarios_publicos` (o que vaza para anônimos)
3. RLS e `eh_dono()` em todas as tabelas
4. RPCs de backup com chave (`exportar_backup`, `concluir_backup`, `definir_chave_backup`) e onde a chave fica
5. Segredos: .env, bundle de produção, histórico git, Apps Script
6. `scripts/restore.ts` (credencial do banco, TLS)
