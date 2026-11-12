# Security findings: Agenda Fácil

Last run R1 · commit 5b15bcc · 2026-11-12 · Gate: FAILED (pendente de security-verify) · Coverage: Full

|            | Critical | High | Medium | Low | Info |
|------------|----------|------|--------|-----|------|
| Open       | 0 | 0 | 0 | 4 | 2 |
| Fixed, awaiting verify | 0 | 0 | 2 | 0 | 0 |

SEC-001 e SEC-002 estão corrigidos (commit fcad057) e aguardam a security-verify para fechar o gate.

## Open
### SEC-003 · Low · Script de restauração desliga a verificação TLS na conexão com o banco
- **Where:** scripts/restore.ts:23 (main)
- **Category:** A04:2025 · CWE-295 · Confidence: Confirmed
- **Found by:** semgrep:problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification, AI review
- **What's wrong:** new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } }) com SUPABASE_DB_URL, que contém a senha do postgres.
- **Impact:** Em rede hostil (Wi-Fi público), um intermediário pode se passar pelo servidor do Supabase e capturar a senha do banco e o backup enviado. Rebaixado de Medium para Low: ferramenta local, usada raramente pelo implantador.
- **How to fix:** Usar o certificado da CA do Supabase (Project Settings > Database > SSL certificate) com ssl: { ca: readFileSync(...) } ou sslmode=verify-full.
- **Owner:** — · **Ticket:** — · **First seen:** R1

### SEC-004 · Low · Sem cabeçalhos de segurança no site (CSP, anti-iframe, nosniff)
- **Where:** public/_headers (headers)
- **Category:** A02:2025 · CWE-1021 · Confidence: Confirmed
- **Found by:** AI review
- **What's wrong:** Não existe public/_headers (Cloudflare Pages) nem meta CSP no index.html. O app do dono pode ser carregado em iframe de outro site e não há CSP limitando scripts.
- **Impact:** Clickjacking sobre o app do dono e nenhuma segunda barreira se um dia entrar um XSS. Hoje não há sink de XSS no código (React escapa tudo; nenhum innerHTML).
- **How to fix:** Criar public/_headers com Content-Security-Policy (default-src 'self'; connect-src 'self' https://<projeto>.supabase.co; frame-ancestors 'none'), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin.
- **Owner:** — · **Ticket:** — · **First seen:** R1

### SEC-005 · Low · Dependências de build com avisos conhecidos (via vite-plugin-pwa)
- **Where:** package-lock.json (vite-plugin-pwa)
- **Category:** A03:2025 · CWE-1395 · Confidence: Confirmed
- **Found by:** npm-audit, osv-scanner:GHSA-gcqx-w48m-w2h4, osv-scanner:GHSA-3g3m-2fjr-6pw4, osv-scanner:GHSA-g3hv-75wg-m249
- **What's wrong:** vite-plugin-pwa (direto, dev) -> workbox-build -> glob 11.1.0 (moderate GHSA-3g3m-2fjr-6pw4), minimatch 10.2.6 (moderate GHSA-g3hv-75wg-m249), @rollup/plugin-node-resolve -> deepmerge 4.3.1 (low GHSA-gcqx-w48m-w2h4).
- **Impact:** Só rodam no build (não vão para o navegador). Rebaixado de Medium para Low por ser ferramenta de desenvolvimento.
- **How to fix:** Atualizar vite-plugin-pwa/workbox-build quando sair versão que puxe glob/minimatch/deepmerge corrigidos; enquanto isso, npm audit fix sem --force se resolver sem quebra.
- **Owner:** — · **Ticket:** — · **First seen:** R1

### SEC-006 · Low · Confirmar que o cadastro público do Supabase Auth está desligado
- **Where:** docs/implantacao.md:15 (auth.allow_signup)
- **Category:** A07:2025 · CWE-284 · Confidence: Needs check
- **Found by:** AI review
- **What's wrong:** O checklist de implantação manda desligar 'Allow new users to sign up', mas isso é configuração do painel e não dá para confirmar pelo código. Se estiver ligado, qualquer um cria conta com a chave pública.
- **Impact:** Conta criada por estranho não lê nem escreve nada (RLS exige eh_dono()), mas ocupa a base de usuários e abre espaço para abuso de e-mail/cota.
- **How to fix:** Conferir em Authentication > Sign In / Providers que o cadastro está desligado neste projeto e em cada cliente novo.
- **Owner:** — · **Ticket:** — · **First seen:** R1

### SEC-007 · Info · Script de backup: chave no código e acesso total ao Drive
- **Where:** apps-script/Backup.gs:15 (CHAVE_BACKUP), apps-script/appsscript.json:6 (oauthScopes.drive)
- **Category:** A02:2025 · CWE-250 · Confidence: Confirmed
- **Found by:** AI review
- **What's wrong:** CHAVE_BACKUP é colada como constante no código do Apps Script (no repositório só há o placeholder). O escopo pedido é https://www.googleapis.com/auth/drive (todo o Drive).
- **Impact:** Quem tiver acesso de edição ao script vê a chave, que exporta todos os clientes. O escopo amplo dá ao script acesso a todos os arquivos do Drive do negócio.
- **How to fix:** Guardar a chave em PropertiesService.getScriptProperties() e trocar o escopo por https://www.googleapis.com/auth/drive.file (o script só mexe nos arquivos que ele mesmo cria).
- **Owner:** — · **Ticket:** — · **First seen:** R1

### SEC-008 · Info · .gitignore cobre só '.env', não '.env.local' e variantes
- **Where:** .gitignore:3 (.env)
- **Category:** A02:2025 · CWE-538 · Confidence: Confirmed
- **Found by:** AI review
- **What's wrong:** A regra é a linha exata '.env'. O Vite também lê .env.local, .env.production etc., que entrariam no git com um git add -A.
- **Impact:** Risco de versionar por engano um arquivo de ambiente. Hoje nenhum foi versionado (histórico limpo no Gitleaks).
- **How to fix:** Trocar por '.env' e '.env.*' com exceção '!.env.example'.
- **Owner:** — · **Ticket:** — · **First seen:** R1

## Fixed, awaiting verification

### SEC-001 · Medium · Link público marca horário em nome de cliente já cadastrado só com o telefone
- **Where:** supabase/migrations/0002_link_publico.sql:198 (agendar_publico_em)
- **Category:** A06:2025 · CWE-639 · Confidence: Confirmed
- **Found by:** AI review
- **What's wrong:** agendar_publico_em faz insert em clientes com 'on conflict (telefone) do nothing' e reaproveita o cliente existente; o nome digitado é ignorado. Não há prova de que quem agenda é o dono do número.
- **Impact:** Qualquer pessoa na internet que saiba o WhatsApp de um cliente pode criar agendamentos atribuídos a ele (aparecem com o nome real na agenda do dono), para trote ou para tomar horários. Não vaza dados: a resposta não devolve o nome.
- **How to fix:** Marcar o agendamento do link como 'a confirmar' quando o telefone já existir com outro nome (ou sempre que vier do link) e mostrar ao dono o nome digitado; alternativa: confirmação por WhatsApp antes de valer.
- **Root cause:** agendar_publico_em reaproveita o cliente pelo telefone (on conflict do nothing) e descarta o nome digitado, sem nenhuma prova de posse do número nem sinal para o dono.
- **Fix:** Migração 0004: agendamentos.nome_informado guarda o nome digitado; a agenda mostra 'digitou: X' e um aviso nos detalhes quando não bate com o cadastro (ignora maiúsculas, espaços e acentos). Testes: tests/db/publico.test.ts (nome guardado), tests/ui/Agenda.test.tsx (alerta e ausência de alarme falso), tests/scripts/restaurar.test.ts (coluna preservada). Residual: sem confirmação por WhatsApp, a posse do número continua não verificada; o dono passa a ver a divergência. (commit fcad057)
- **Owner:** kaio · **Ticket:** — · **First seen:** R1
- **Compliance:** LGPD: dado pessoal (nome e WhatsApp) associado a ação que a pessoa não fez

### SEC-002 · Medium · Limite de 3 agendamentos por hora por IP não impede encher a agenda pelo link
- **Where:** supabase/migrations/0002_link_publico.sql:189 (agendar_publico_em)
- **Category:** A06:2025 · CWE-770 · Confidence: Likely
- **Found by:** AI review
- **What's wrong:** O único limite é por IP (3 por hora, IPv6 agrupado por /64), contado só para agendamentos bem-sucedidos. Quem trocar de IP (proxies residenciais, rede móvel) agenda sem limite; não há limite global por dia nem por telefone.
- **Impact:** Um atacante com vários IPs pode ocupar todos os horários livres dos próximos 14 dias com nomes e números falsos ou de terceiros, travando o agendamento online do negócio até o dono cancelar um por um.
- **How to fix:** Somar limites que não dependem do IP: por telefone (ex.: no máximo 2 agendamentos futuros ativos pelo link), um teto global de agendamentos pelo link por hora/dia, e um aviso ao dono quando o teto for atingido.
- **Root cause:** O único freio do link público era por IP (3/hora, só sucessos); quem troca de IP e inventa números agenda sem limite.
- **Fix:** Migração 0004: além do limite por IP, no máximo 2 horários futuros ativos pelo link por WhatsApp e teto geral de 10 agendamentos pelo link por hora, sob uma trava consultiva única; os três respondem 'limite' com mensagem neutra. Testes: tests/db/publico.test.ts (limite por WhatsApp, cliente recorrente passa, teto geral, trava). Residual: um ataque pode consumir o teto geral (10/h) e bloquear o link por até 1 hora; ocupa no máximo 10 horários por hora em vez da agenda inteira. (commit fcad057)
- **Owner:** kaio · **Ticket:** — · **First seen:** R1

## Accepted risks (with expiry dates)

(nenhum)

## False positives

(nenhum)

## Verified (closed)

(nenhum)

## Triage dismissals (for human review)

- **gitleaks:generic-api-key** em `.env:2`: VITE_SUPABASE_ANON_KEY é uma chave sb_publishable_ (pública por design); .env nunca foi versionado (git log vazio) e está no .gitignore
- **ai-review:bundle grep 'sb_secret'** em `dist/assets/index-*.js`: Texto do supabase-js (startsWith('sb_secret_')), não uma chave; nenhum valor com formato de chave secreta no bundle
- **ai-review:connection-string** em `README.md:32, scripts/restore.ts:4`: Exemplos com placeholder (senha 'SENHA', host db.XXXX), não credenciais
