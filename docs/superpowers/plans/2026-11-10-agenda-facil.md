# Agenda Fácil — Plano de Implementação

> **Para quem for executar:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Os passos usam caixas de seleção (`- [ ]`) para acompanhamento.

**Objetivo:** construir a v1 do PWA de agenda (agenda, horários livres, lembretes, clientes, configurações e backup) para o cliente-piloto, implantável nas contas do próprio cliente.

**Arquitetura:** site estático (Vite + React + TypeScript) falando direto com o Supabase do cliente (Postgres + Auth + RLS). Toda a lógica de negócio fica em módulos puros e testáveis (`src/lib`); a camada de dados (`src/data`) isola o `supabase-js`; as telas (`src/ui`) só orquestram. Configuração por variáveis de ambiente, nada de segredo no repositório.

**Tecnologias:** Vite, React, TypeScript, `react-router-dom`, `@supabase/supabase-js`, `date-fns` + `date-fns-tz`, `vite-plugin-pwa`, Vitest + Testing Library, MSW (simula o Supabase nos testes), PGlite (testes do SQL e da restauração), `pg` (script de restauração).

**Especificação:** `docs/superpowers/specs/2026-11-10-agenda-facil-design.md`

## Restrições gerais

- Fuso fixo `America/Sao_Paulo`; horários sempre em hora local do negócio.
- `passo_min` padrão 30; `antecedencia_min` padrão 60.
- Telefone armazenado só com dígitos, com 55 + DDD.
- Status válidos: `marcado`, `confirmado`, `cancelado`, `concluido`, `faltou`. Só `marcado` e `confirmado` ocupam horário.
- RLS ativado em todas as tabelas; só usuário autenticado lê e escreve.
- Nenhuma chave secreta no repositório; o site usa só `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_NOME_NEGOCIO`. `SUPABASE_DB_URL` (restauração) existe só no ambiente do PC do autor.
- Dados dos clientes finais: apenas nome e telefone.
- Fora de escopo: nota fiscal, pagamentos, bot de WhatsApp, página pública, relatórios, vários profissionais.
- Uso no iPhone via "Adicionar à Tela de Início" (PWA), sem conta de desenvolvedor Apple.
- Lembrete de backup quando `ultimo_backup` tiver mais de 7 dias ou for nulo.
- Testes rodam com `TZ=UTC` (definido no `vite.config.ts`/setup do Vitest), para provar que nada depende do fuso do aparelho.
- Nome do negócio: `VITE_NOME_NEGOCIO` só para a tela de login (antes da sessão o RLS não deixa ler o banco); depois do login vale `configuracoes.nome_negocio`.
- Serviços com `ativo = false` não aparecem em Novo agendamento nem em Horários livres.

## Pontos de atenção na revisão

1. Telefone digitado em formatos variados (`(11) 98765-4321`, `+55 11 98765-4321`, `011987654321`, sem DDD): normaliza ou rejeita com mensagem clara, nunca gera link quebrado. → Tarefa 4.
2. Expediente com almoço (dois intervalos) e serviço maior que o buraco: nenhum horário oferecido no buraco. → Tarefa 3.
3. Agendamento cancelado ou "faltou" libera o horário; agendamento que termina quando outro começa não conflita. → Tarefas 2 e 3.
4. Projeto Supabase pausado (após ~1 semana sem uso) ou sem internet: mensagem clara "Não foi possível conectar. Se o sistema ficou dias sem uso, veja o manual para reativar." em vez de tela branca ou login em loop. → Tarefas 5 e 6.
5. Backup com tabelas vazias; restauração em banco que já tem dados não duplica nem apaga sem confirmação. → Tarefa 12.

---

## Estrutura de arquivos

```
package.json, vite.config.ts, tsconfig.json, index.html, .env.example
public/manifest.webmanifest, public/icon-192.png, public/icon-512.png
supabase/migrations/0001_init.sql, supabase/seed.sql
src/types.ts                         tipos de domínio
src/lib/slots.ts                     horários livres e texto
src/lib/whatsapp.ts                  telefone, link wa.me, modelos
src/lib/backup.ts                    exportar e checar backup
src/data/supabase.ts, erros.ts, clientes.ts, servicos.ts, agendamentos.ts, configuracoes.ts
src/ui/App.tsx, Login.tsx, SemConexao.tsx, Agenda.tsx, NovoAgendamento.tsx, DetalhesAgendamento.tsx, HorariosLivres.tsx,
       Lembretes.tsx, Clientes.tsx, Configuracoes.tsx, BackupBanner.tsx
scripts/restaurar.ts, restore.ts     restauração (roda no PC do autor)
docs/manual-cliente.md, docs/implantacao.md
tests/ (espelha src/), tests/helpers/pg.ts, tests/helpers/msw.ts
```

## Tipos compartilhados (`src/types.ts`, definidos na Tarefa 1)

```ts
export type Status = 'marcado' | 'confirmado' | 'cancelado' | 'concluido' | 'faltou';
export interface Intervalo { inicio: string; fim: string }          // "HH:MM"
export type Expediente = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Intervalo[]>; // 0 = domingo
export interface Config {
  nome_negocio: string; fuso: string; expediente: Expediente; folgas: string[]; // "YYYY-MM-DD"
  passo_min: number; antecedencia_min: number;
  modelo_livres: string; modelo_lembrete: string; ultimo_backup: string | null;
}
export interface Servico { id: string; nome: string; duracao_min: number; ativo: boolean }
export interface Cliente { id: string; nome: string; telefone: string; criado_em: string }
export interface Agendamento {
  id: string; cliente_id: string; servico_id: string;
  inicio: string; fim: string; status: Status; observacao: string | null; // ISO com fuso
}
export interface Slot { data: string; hora: string; inicio: Date }       // "YYYY-MM-DD", "HH:MM"
```

---

## Como testar cada camada

- `src/lib`: funções puras, testadas direto.
- SQL (`supabase/`) e restauração: PGlite em memória com a extensão `btree_gist` (`@electric-sql/pglite/contrib/btree_gist`). Antes da migration, o helper cria os papéis `anon` e `authenticated`.
- `src/data`: `supabase-js` de verdade apontando para `http://teste.local`; as respostas do PostgREST são simuladas com MSW (`msw/node`).
- `src/ui`: `vi.mock` dos módulos de `src/data`; render com Testing Library.

Helpers (criados na tarefa que os usa primeiro):
- `tests/helpers/pg.ts`: `novoBanco(): Promise<PGlite>`. Cria os papéis, aplica `0001_init.sql` e `seed.sql`. (Tarefa 2)
- `tests/helpers/msw.ts`: `servidor` (setupServer) e `dbTeste` (cliente `supabase-js` para `http://teste.local`). (Tarefa 5)

Toda tarefa termina com `npm test` inteiro passando antes do commit.

---

### Tarefa 1: Projeto base e shell do PWA

**Arquivos:**
- Criar: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `.gitignore`, `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `src/types.ts`, `src/ui/App.tsx`, `src/main.tsx`, `tests/setup.ts`
- Testes: `tests/ui/App.test.tsx`

**Interfaces:**
- Fornece: `src/types.ts` (bloco acima); `App` como componente raiz sem props.

- [ ] **Passo 1: Preparar o projeto.** Rodar `git init`, criar o projeto com o template Vite `react-ts` e instalar a stack. No `vite.config.ts`: Vitest com `environment: 'jsdom'`, `setupFiles: ['tests/setup.ts']` e `env: { TZ: 'UTC' }`. Em `package.json`: `"test": "vitest run"`. O `.gitignore` inclui `.env` e `dist/`; o `.env.example` lista as três variáveis `VITE_*`, sem valores.
- [ ] **Passo 2: Escrever o teste que falha.** `App > mostra o nome do negócio vindo de VITE_NOME_NEGOCIO`: `vi.stubEnv('VITE_NOME_NEGOCIO', 'Barbearia Teste')`, render `<App />`, `expect(screen.getByText('Barbearia Teste')).toBeInTheDocument()`.
- [ ] **Passo 3: Ver falhar.** Rodar `npx vitest run tests/ui/App.test.tsx`. Esperado: FAIL (não acha o import de `src/ui/App`).
- [ ] **Passo 4: Implementar** o `App` mínimo e o `src/types.ts`. Configurar o `vite-plugin-pwa` com `registerType: 'autoUpdate'` e manifest `{ name, short_name, lang: 'pt-BR', display: 'standalone', start_url: '/', theme_color, icons: [192, 512] }`.
- [ ] **Passo 5: Ver passar.** Rodar `npx vitest run tests/ui/App.test.tsx`: PASS. Depois `npm run build && grep -o '"display":"standalone"' dist/manifest.webmanifest`: imprime `"display":"standalone"`.
- [ ] **Passo 6: Commit.** `git add -A && git commit -m "chore: projeto base e shell do PWA"`

### Tarefa 2: Esquema do banco, RLS e trava de conflito

**Arquivos:**
- Criar: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `tests/helpers/pg.ts`
- Testes: `tests/db/schema.test.ts`

**Interfaces:**
- Fornece: as tabelas `clientes` (`telefone` **único**), `servicos`, `agendamentos` e `configuracoes` (linha única, `id int primary key default 1 check (id = 1)`), com as colunas exatas da spec, seção 5. Sobreposição gera o erro `23P01`. Também fornece `novoBanco()`.

- [ ] **Passo 1: Escrever os testes que falham** (cada um começa com `const db = await novoBanco()`):
  - `rejeita dois agendamentos marcados que se sobrepõem`: 10:00–11:00 e 10:30–11:30 de 2026-11-17 (-03:00). O segundo insert rejeita com `code === '23P01'`.
  - `aceita agendamentos adjacentes`: 10:00–11:00 e 11:00–12:00 resolvem sem erro.
  - `agendamento cancelado não bloqueia o horário`: um cancelado 10:00–11:00 e um marcado 10:00–11:00 entram os dois.
  - `rejeita telefone duplicado em clientes`: `code === '23505'`.
  - `rejeita status inválido`: `status = 'pendente'` dá `code === '23514'`.
  - `seed cria uma única linha de configuracoes com passo_min 30, antecedencia_min 60 e fuso America/Sao_Paulo`.
  - `anon não lê nada, authenticated lê`: insere um cliente; com `set role anon`, `select` devolve 0 linhas; com `set role authenticated`, devolve 1.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/db`. Esperado: FAIL (o arquivo da migration não existe).
- [ ] **Passo 3: Escrever a migration e o seed.** Colunas: `uuid default gen_random_uuid()` e `timestamptz default now()`. O `check` de status aceita os cinco valores. A trava de conflito é `exclude using gist (tstzrange(inicio, fim, '[)') with &&) where (status in ('marcado','confirmado'))`, mais `check (fim > inicio)`. RLS ligado nas quatro tabelas, com a política `for all to authenticated using (true) with check (true)` e `grant` para `authenticated`. O `seed.sql` insere a linha de `configuracoes` com os padrões das Restrições gerais. Os modelos usam os marcadores `{horarios}`, `{nome}`, `{dia}`, `{hora}` e `{nome_negocio}`.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/db`. Esperado: 7 testes PASS.
- [ ] **Passo 5: Commit.** `git add supabase tests/helpers/pg.ts tests/db && git commit -m "feat: esquema do banco com RLS e trava de conflito"`

### Tarefa 3: Horários livres e texto (`src/lib/slots.ts`)

**Arquivos:**
- Criar: `src/lib/slots.ts`
- Testes: `tests/lib/slots.test.ts`

**Interfaces:**
- Usa: `Config`, `Agendamento` e `Slot` (Tarefa 1).
- Fornece:
  - `freeSlots(args: { config: Config; agendamentos: Agendamento[]; duracaoMin: number; de: string; ate: string; agora: Date }): Slot[]`. `de` e `ate` são `"YYYY-MM-DD"`, inclusivos, em hora local.
  - `formatSlotsMessage(slots: Slot[], modelo: string): string`. Substitui `{horarios}`.
  - `diasDoPeriodo(periodo: 'hoje' | 'amanha' | 'semana', agora: Date, fuso: string): { de: string; ate: string }`. "semana" vai de hoje até hoje + 6 dias.

- [ ] **Passo 1: Escrever os testes que falham.** Config de teste: seg–sex 09:00–12:00 e 14:00–18:00, `passo_min` 30, `antecedencia_min` 60. Terça = `2026-11-17`. `agora` = `fromZonedTime('2026-11-16 20:00', 'America/Sao_Paulo')`, salvo quando dito.
  - `dia sem agendamentos, duração 60`: horas de terça = `09:00 09:30 10:00 10:30 11:00 14:00 14:30 … 17:00` (12 slots).
  - `agendamento marcado 10:00–11:00`: remove 09:30, 10:00 e 10:30; mantém 09:00 e 11:00.
  - `cancelado e faltou não bloqueiam`: mesmo resultado do primeiro teste.
  - `folga remove o dia inteiro`: `folgas: ['2026-11-17']` dá zero slots na terça.
  - `antecedência`: `agora` = terça 08:30, então o primeiro slot é 09:30.
  - `almoço`: duração 90 dá na manhã só `09:00 09:30 10:00 10:30`, sem nenhum slot que cruze 12:00–14:00.
  - `sábado sem intervalos`: zero slots.
  - `slot.inicio é o instante correto`: o slot 09:00 de terça é igual a `new Date('2026-11-17T12:00:00Z')`.
  - `formatSlotsMessage`: ter 14:00 e 15:00, qua 10:00 e 11:30, modelo `"Esta semana tenho: {horarios}"`. Esperado `"Esta semana tenho: ter 14h, 15h; qua 10h, 11h30"`.
  - `formatSlotsMessage com lista vazia`: o resultado contém `"Sem horários livres"`.
  - `diasDoPeriodo('semana', terça 20:00)`: `{ de: '2026-11-17', ate: '2026-11-23' }`. `diasDoPeriodo('amanha', terça 23:30 de São Paulo)`: `de === ate === '2026-11-18'` (já é quarta em UTC; a resposta continua sendo hora local).
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/lib/slots.test.ts`. Esperado: FAIL (o import não resolve).
- [ ] **Passo 3: Implementar.** Para cada dia do período, pulando as `folgas`, gerar candidatos de `passo_min` em `passo_min` dentro de cada intervalo do expediente. Um candidato só vale se a duração inteira couber no mesmo intervalo. Descartar os que sobrepõem agendamento `marcado` ou `confirmado` (intervalo meio-aberto, então encostar no fim de outro não é conflito) e os com `inicio < agora + antecedencia_min`. Converter com `fromZonedTime`/`formatInTimeZone` usando `config.fuso`. Dias abreviados: `dom seg ter qua qui sex sáb`. Hora no formato `14h` ou `11h30`.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/lib/slots.test.ts`. Esperado: 11 testes PASS.
- [ ] **Passo 5: Commit.** `git add src/lib/slots.ts tests/lib/slots.test.ts && git commit -m "feat: cálculo de horários livres e texto de divulgação"`

### Tarefa 4: Telefone, links do WhatsApp e modelos (`src/lib/whatsapp.ts`)

**Arquivos:**
- Criar: `src/lib/whatsapp.ts`
- Testes: `tests/lib/whatsapp.test.ts`

**Interfaces:**
- Fornece:
  - `normalizePhone(raw: string): string | null`. Devolve só dígitos (55 + DDD + número) ou `null` se for inválido.
  - `waLink(telefone: string | null, texto: string): string`. Com `null` gera `https://wa.me/?text=...` (o WhatsApp abre para escolher o contato).
  - `renderModelo(modelo: string, vars: Record<string, string>): string`. Troca `{chave}`; marcador desconhecido fica como está.

- [ ] **Passo 1: Escrever os testes que falham:**
  - `normalizePhone('(11) 98765-4321') === '5511987654321'`. Mesmo resultado para `'+55 11 98765-4321'`, `'011987654321'` e `'11987654321'`.
  - `normalizePhone('(11) 3456-7890') === '551134567890'` (fixo).
  - `normalizePhone('98765-4321') === null` (sem DDD), `normalizePhone('12345') === null` e `normalizePhone('') === null`.
  - `waLink('5511987654321','Olá, tudo bem?') === 'https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F'`.
  - `waLink(null,'ter 14h; qua 10h') === 'https://wa.me/?text=ter%2014h%3B%20qua%2010h'`.
  - `waLink(null,'a\nb').endsWith('?text=a%0Ab')`.
  - `renderModelo('Oi {nome}, amanhã às {hora}', {nome:'Ana',hora:'14h'}) === 'Oi Ana, amanhã às 14h'`. `renderModelo('{x} ok', {}) === '{x} ok'`.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/lib/whatsapp.test.ts`. Esperado: FAIL (o import não resolve).
- [ ] **Passo 3: Implementar.** Regra do telefone: tirar tudo que não for dígito. Se começar com `55` e tiver 12 ou 13 dígitos, aceitar. Se começar com `0`, tirar o zero. Com 10 ou 11 dígitos, prefixar `55`. Qualquer outro caso dá `null`. Texto codificado com `encodeURIComponent`.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/lib/whatsapp.test.ts`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/lib/whatsapp.ts tests/lib/whatsapp.test.ts && git commit -m "feat: telefone, link do WhatsApp e modelos de mensagem"`

### Tarefa 5: Camada de dados

**Arquivos:**
- Criar: `src/data/supabase.ts`, `src/data/erros.ts`, `src/data/clientes.ts`, `src/data/servicos.ts`, `src/data/agendamentos.ts`, `src/data/configuracoes.ts`, `tests/helpers/msw.ts`
- Testes: `tests/data/data.test.ts`

**Interfaces:**
- Usa: os tipos da Tarefa 1 e `diasDoPeriodo`/`fromZonedTime` para os limites do período.
- Fornece (todas recebem `db: SupabaseClient` como primeiro argumento):
  - `supabase` (cliente criado com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, `persistSession: true`)
  - `getConfig(db): Promise<Config>`, `saveConfig(db, parcial: Partial<Config>): Promise<void>`
  - `listServicos(db, { soAtivos }?: { soAtivos?: boolean }): Promise<Servico[]>`, `saveServico(db, s: Omit<Servico,'id'> & { id?: string }): Promise<Servico>`
  - `findOrCreateCliente(db, nome: string, telefone: string): Promise<Cliente>`. Reaproveita o cliente pelo telefone.
  - `listClientes(db, busca?: string): Promise<Cliente[]>`. Busca em nome (ilike) ou telefone.
  - `listAgendamentos(db, de: string, ate: string): Promise<Agendamento[]>`
  - `listAgendamentosDoCliente(db, clienteId: string): Promise<Agendamento[]>`. Do mais recente para o mais antigo (`inicio` decrescente).
  - `criarAgendamento(db, a: Omit<Agendamento,'id'>): Promise<Agendamento>`
  - `editarAgendamento(db, id: string, campos: Partial<Pick<Agendamento,'servico_id'|'inicio'|'fim'|'observacao'>>): Promise<void>`
  - `mudarStatus(db, id: string, status: Status): Promise<void>`
  - Em `erros.ts`: `class ConflitoDeHorarioError extends Error` (para o código `23P01` em criar/editar) e `class SemConexaoError extends Error` (para fetch que falha ou resposta 5xx, o que cobre o projeto pausado).

- [ ] **Passo 1: Escrever os testes que falham** (MSW responde em `http://teste.local/rest/v1/...`):
  - `criarAgendamento traduz 23P01 em ConflitoDeHorarioError`: a resposta é 409 `{code:'23P01'}` e a promessa rejeita com `ConflitoDeHorarioError`.
  - `editarAgendamento traduz 23P01 em ConflitoDeHorarioError`.
  - `findOrCreateCliente reaproveita cliente com o mesmo telefone`: o GET devolve o cliente e nenhum POST é feito.
  - `listAgendamentos usa limites em hora local`: com `('2026-11-17','2026-11-17')`, a query traz `inicio=gte.2026-11-17T03:00:00.000Z` e `inicio=lt.2026-11-18T03:00:00.000Z`.
  - `listAgendamentosDoCliente filtra pelo cliente e ordena decrescente`: a query traz `cliente_id=eq.<id>` e `order=inicio.desc`.
  - `listServicos({soAtivos:true}) filtra ativo=eq.true`.
  - `falha de rede vira SemConexaoError`: `HttpResponse.error()`. `resposta 503 vira SemConexaoError`.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/data`. Esperado: FAIL (o import não resolve).
- [ ] **Passo 3: Implementar.** Um helper interno `executar<T>(promessa)` traduz `error.code === '23P01'`, `TypeError` de fetch e status ≥ 500 nas duas classes de erro. As outras funções passam por ele.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/data`. Esperado: 8 testes PASS.
- [ ] **Passo 5: Commit.** `git add src/data tests/helpers/msw.ts tests/data && git commit -m "feat: camada de dados do Supabase"`

### Tarefa 6: Login, rotas e erro de conexão

**Arquivos:**
- Criar: `src/ui/Login.tsx`, `src/ui/SemConexao.tsx`
- Alterar: `src/ui/App.tsx`
- Testes: `tests/ui/Login.test.tsx`

**Interfaces:**
- Usa: `supabase` e `SemConexaoError` (Tarefa 5).
- Fornece: `App` mostra `Login` quando não há sessão e as telas quando há. Rotas (`react-router-dom`, `HashRouter`): `/` (Agenda), `/livres`, `/lembretes`, `/clientes`, `/config`, com uma barra de navegação inferior. `<SemConexao onTentarDeNovo={() => void} />`.

- [ ] **Passo 1: Escrever os testes que falham** (com `supabase.auth` simulado):
  - `sem sessão mostra o botão "Entrar com Google" e o campo de e-mail para link`. Clicar no botão chama `signInWithOAuth({ provider: 'google' })`. Enviar o e-mail chama `signInWithOtp({ email })` e mostra "Enviamos um link para o seu e-mail".
  - `com sessão mostra a Agenda`.
  - `evento SIGNED_OUT em onAuthStateChange volta para o login`.
  - `SemConexaoError ao carregar mostra "Não foi possível conectar"`, com link para o manual e o botão "Tentar de novo", que repete a carga.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/ui/Login.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar.** `getSession()` na montagem e assinatura de `onAuthStateChange`. A Agenda pode ser um placeholder até a Tarefa 8.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/ui/Login.test.tsx`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/ui tests/ui/Login.test.tsx && git commit -m "feat: login, rotas e aviso de falta de conexão"`

### Tarefa 7: Configurações

**Arquivos:**
- Criar: `src/ui/Configuracoes.tsx`
- Testes: `tests/ui/Configuracoes.test.tsx`

**Interfaces:**
- Usa: `getConfig`, `saveConfig`, `listServicos` e `saveServico` (Tarefa 5).

- [ ] **Passo 1: Escrever os testes que falham** (com `src/data` simulado):
  - `edita expediente de terça com dois intervalos e salva`: `saveConfig` recebe `expediente[2] = [{inicio:'09:00',fim:'12:00'},{inicio:'14:00',fim:'18:00'}]`.
  - `rejeita intervalo com fim antes do início`: mostra "O fim precisa ser depois do início" e não chama `saveConfig`.
  - `adiciona folga`: `folgas` passa a conter `'2026-12-25'`.
  - `adiciona serviço "Corte" com 30 min`: chama `saveServico({nome:'Corte',duracao_min:30,ativo:true})`.
  - `desativar serviço grava ativo=false`.
  - `edita modelo_livres, modelo_lembrete e nome_negocio`: `saveConfig` recebe os três textos novos.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/ui/Configuracoes.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar** a tela em seções: Negócio, Expediente, Folgas, Serviços e Mensagens. A seção Mensagens lista os marcadores disponíveis.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/ui/Configuracoes.test.tsx`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/ui/Configuracoes.tsx tests/ui/Configuracoes.test.tsx && git commit -m "feat: tela de configurações"`

### Tarefa 8: Agenda e novo agendamento

**Arquivos:**
- Criar: `src/ui/Agenda.tsx`, `src/ui/NovoAgendamento.tsx`, `src/ui/DetalhesAgendamento.tsx`
- Alterar: `src/ui/App.tsx` (troca o placeholder)
- Testes: `tests/ui/Agenda.test.tsx`

**Interfaces:**
- Usa: `listAgendamentos`, `criarAgendamento`, `editarAgendamento`, `mudarStatus`, `findOrCreateCliente`, `listClientes`, `listServicos({soAtivos:true})`, `getConfig`, `ConflitoDeHorarioError`, `normalizePhone`, `waLink`, `freeSlots`. Regra: `fim = inicio + duracao_min` do serviço escolhido.

- [ ] **Passo 1: Escrever os testes que falham** (com `src/data` simulado e `agora` fixo em terça 2026-11-17 08:00):
  - `mostra os agendamentos da semana na grade`, com nome do cliente e hora.
  - `alterna entre visão de dia e de semana`.
  - `tocar num horário livre abre o formulário com data e hora preenchidas`.
  - `buscar "Jo" lista o cliente João e selecionar não cria cliente novo`.
  - `salvar com telefone inválido mostra "Telefone inválido" e não chama criarAgendamento`.
  - `ConflitoDeHorarioError mostra "Esse horário já está ocupado."`.
  - `editar o horário chama editarAgendamento com inicio e fim novos`. Conflito na edição mostra a mesma mensagem.
  - `botões Concluir, Faltou e Cancelar chamam mudarStatus com o status certo`. Depois de cancelar, o horário volta a aparecer livre.
  - `botão WhatsApp do agendamento tem href waLink(telefone do cliente, '')`.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/ui/Agenda.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar.** A grade usa `passo_min` e o expediente da config. Os horários livres da grade vêm de `freeSlots` com `duracaoMin = passo_min` e `antecedencia_min = 0`.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/ui/Agenda.test.tsx`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/ui tests/ui/Agenda.test.tsx && git commit -m "feat: agenda e novo agendamento"`

### Tarefa 9: Horários livres

**Arquivos:**
- Criar: `src/ui/HorariosLivres.tsx`
- Testes: `tests/ui/HorariosLivres.test.tsx`

**Interfaces:**
- Usa: `freeSlots`, `formatSlotsMessage`, `diasDoPeriodo`, `listAgendamentos`, `getConfig`, `listServicos({soAtivos:true})`, `waLink`. O botão "Copiar" usa `navigator.clipboard.writeText`.

- [ ] **Passo 1: Escrever os testes que falham:**
  - `escolher "Amanhã" e "Corte" mostra o texto gerado`: o textarea contém `"qua 9h"` (com os dados simulados da terça).
  - `texto é editável antes de copiar`.
  - `Copiar chama navigator.clipboard.writeText com o texto atual` e mostra "Copiado!".
  - `"Abrir WhatsApp" tem href waLink(null, texto atual)`.
  - `sem horários mostra a mensagem com "Sem horários livres"`.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/ui/HorariosLivres.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar.** Seletor de período (Hoje, Amanhã, Semana) e seletor de serviço. O texto é regerado quando um deles muda.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/ui/HorariosLivres.test.tsx`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/ui/HorariosLivres.tsx tests/ui/HorariosLivres.test.tsx && git commit -m "feat: tela de horários livres"`

### Tarefa 10: Lembretes de amanhã

**Arquivos:**
- Criar: `src/ui/Lembretes.tsx`
- Testes: `tests/ui/Lembretes.test.tsx`

**Interfaces:**
- Usa: `diasDoPeriodo('amanha', ...)`, `listAgendamentos`, `getConfig`, `renderModelo`, `waLink`.

- [ ] **Passo 1: Escrever os testes que falham** (`agora` = terça 23:30 de São Paulo):
  - `lista só agendamentos marcados/confirmados de quarta`. Cancelados e os de quinta ficam de fora.
  - `cada item tem href waLink(telefone, renderModelo(modelo_lembrete, {nome, dia:'qua', hora:'10h', nome_negocio}))`.
  - `sem agendamentos mostra "Nenhum atendimento amanhã"`.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/ui/Lembretes.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar.** Um botão por cliente, abrindo o link em nova aba.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/ui/Lembretes.test.tsx`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/ui/Lembretes.tsx tests/ui/Lembretes.test.tsx && git commit -m "feat: lembretes de amanhã"`

### Tarefa 11: Clientes

**Arquivos:**
- Criar: `src/ui/Clientes.tsx`
- Testes: `tests/ui/Clientes.test.tsx`

**Interfaces:**
- Usa: `listClientes` e `listAgendamentosDoCliente` (Tarefa 5).

- [ ] **Passo 1: Escrever os testes que falham:**
  - `digitar na busca chama listClientes com o texto` e mostra o resultado.
  - `abrir um cliente mostra o histórico na ordem que listAgendamentosDoCliente devolve`, com data, serviço e status.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/ui/Clientes.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar** com um debounce de 300 ms na busca.
- [ ] **Passo 4: Ver passar.** Rodar `npx vitest run tests/ui/Clientes.test.tsx`. Esperado: PASS.
- [ ] **Passo 5: Commit.** `git add src/ui/Clientes.tsx tests/ui/Clientes.test.tsx && git commit -m "feat: lista de clientes e histórico"`

### Tarefa 12: Backup, aviso e restauração

**Arquivos:**
- Criar: `src/lib/backup.ts`, `src/ui/BackupBanner.tsx`, `scripts/restore.ts`, `scripts/restaurar.ts`
- Alterar: `src/ui/Configuracoes.tsx` (botão "Baixar backup") e `src/ui/App.tsx` (banner na tela inicial)
- Testes: `tests/lib/backup.test.ts`, `tests/scripts/restaurar.test.ts`, `tests/ui/BackupBanner.test.tsx`

**Interfaces:**
- Usa: as funções `list*`/`getConfig` e `saveConfig` (Tarefa 5) e `novoBanco` (Tarefa 2).
- Fornece:
  - `type BackupFile = { versao: 1; gerado_em: string; clientes: Cliente[]; servicos: Servico[]; agendamentos: Agendamento[]; configuracoes: Config[] }`
  - `exportBackup(db: SupabaseClient): Promise<BackupFile>`
  - `backupIsStale(ultimo: string | null, agora: Date): boolean`. Devolve true se for nulo ou tiver mais de 7 dias.
  - `salvarBackup(arquivo: BackupFile, db: SupabaseClient): Promise<boolean>`. Usa `navigator.share({ files })` quando `navigator.canShare` aceitar arquivos; senão, faz download por `<a download>`. Nome do arquivo: `backup-agenda-YYYY-MM-DD.json`. Só chama `saveConfig({ ultimo_backup })` se salvar deu certo. Devolve se salvou.
  - Em `scripts/restaurar.ts`: `restaurar(q: Consulta, arquivo: BackupFile, opcoes: { confirmarSubstituir: boolean }): Promise<void>`, com `type Consulta = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>`. Roda numa transação: se o banco tiver dados e não houver confirmação, lança `BancoNaoVazioError`. Com confirmação, apaga as tabelas e insere tudo, mantendo os ids.
  - `scripts/restore.ts <arquivo.json> [--confirmar-substituir]`: conecta com o pacote `pg` usando `SUPABASE_DB_URL`, que vem do ambiente e nunca fica no repositório.

- [ ] **Passo 1: Escrever os testes que falham:**
  - `backupIsStale(null, agora) === true`. Com 8 dias, `true`; com 6 dias, `false`.
  - `exportBackup com tabelas vazias devolve versao 1 e quatro listas vazias` (com MSW).
  - `ida e volta`: um `BackupFile` de exemplo (2 clientes, 1 serviço, 3 agendamentos, 1 config) é restaurado com `restaurar` num `novoBanco()` limpo, depois de apagar a linha do seed com confirmação. Os `select` devolvem os mesmos dados.
  - `restaurar em banco com dados sem confirmação`: lança `BancoNaoVazioError` e a contagem de linhas não muda.
  - `banner aparece com ultimo_backup de 8 dias`. Depois que `salvarBackup` devolve true, ele some.
  - `share cancelado (AbortError) não chama saveConfig`.
  - `Configurações tem o botão "Baixar backup"`.
- [ ] **Passo 2: Ver falhar.** Rodar `npx vitest run tests/lib/backup.test.ts tests/scripts tests/ui/BackupBanner.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3: Implementar.** Inserir na ordem `servicos`, `clientes`, `agendamentos`, `configuracoes`; apagar na ordem inversa.
- [ ] **Passo 4: Ver passar.** Rodar o mesmo comando do passo 2. Esperado: PASS. Depois rodar `npm test`: tudo PASS.
- [ ] **Passo 5: Commit.** `git add src scripts tests && git commit -m "feat: backup manual, aviso semanal e restauração"`

### Tarefa 13: Implantação e teste no iPhone

**Arquivos:**
- Criar: `docs/manual-cliente.md`, `docs/implantacao.md`, `README.md`
- Testes: `tests/build.test.ts`

- [ ] **Passo 1: Escrever o teste que falha.** `build gera manifest standalone e service worker e não vaza segredo`: depois de `npm run build`, `dist/manifest.webmanifest` contém `"display":"standalone"`, `dist/sw.js` existe e nenhum arquivo em `dist/` contém `service_role` nem `SUPABASE_DB_URL`.
- [ ] **Passo 2: Ver falhar.** Rodar `npm run build && npx vitest run tests/build.test.ts`. Esperado: FAIL, se faltar alguma coisa. Se passar de primeira, conferir o teste trocando `standalone` por `browser`; ele tem que falhar.
- [ ] **Passo 3: Ajustar** a configuração do PWA até o teste passar.
- [ ] **Passo 4: Escrever os documentos.**
  - `manual-cliente.md` (no máximo uma página): marcar, gerar horários livres, mandar lembretes, fazer backup e reativar o projeto pausado no painel do Supabase.
  - `implantacao.md`: o checklist da spec, seção 10, com a aplicação de `0001_init.sql` e `seed.sql`, as três variáveis de ambiente e a ativação da verificação em duas etapas.
  - `README.md`: o que é, como rodar localmente e como restaurar o backup.
- [ ] **Passo 5: Commit.** `git add docs README.md tests/build.test.ts vite.config.ts && git commit -m "docs: manual, checklist de implantação e README"`
- [ ] **Passo 6 (manual, no projeto de teste):** antes da primeira entrega, confirmar que o plano gratuito do Cloudflare Pages permite uso comercial. Depois publicar, abrir no iPhone, adicionar à Tela de Início, fazer login, marcar, gerar horários livres, fazer backup e restaurar. Anotar se o login continua ativo depois de vários dias sem abrir (ponto aberto 5 da spec). Marcar o repositório como **template** no GitHub.
