# Agenda Fácil v2 — Plano de Implementação

> **Para quem for executar:** use superpowers:subagent-driven-development ou superpowers:executing-plans. Os passos usam caixas de seleção (`- [ ]`). Os títulos são "### Task N" porque os scripts de execução procuram esse formato.

**Objetivo:** link público de agendamento (o cliente marca sozinho com nome e WhatsApp), horários ofertados pelo dono (expediente + extras − fechados) e login do dono por usuário e senha, sobre a v1 que já funciona.

**Arquitetura:** a página pública só fala com o banco por duas funções `security definer` (`horarios_publicos`, `agendar_publico`), que recalculam e validam tudo no servidor; as tabelas continuam fechadas para quem não é o dono. A regra de horários existe em TypeScript (agenda do dono) e em SQL (link), amarradas por um teste de concordância. As mudanças de banco vão em `0002`, aplicada por cima da `0001`.

**Tecnologias:** as mesmas da v1 (Vite, React, TypeScript, supabase-js, date-fns-tz, Vitest, Testing Library, MSW, PGlite).

**Especificação:** `docs/superpowers/specs/2026-11-11-agenda-facil-v2-design.md`. Ela vale por cima da v1: `docs/superpowers/specs/2026-11-10-agenda-facil-design.md`.

## Restrições gerais

- Valem as Restrições gerais do plano v1 (`docs/superpowers/plans/2026-11-10-agenda-facil.md`): fuso `America/Sao_Paulo`, testes com `TZ=UTC`, RLS só para o dono, nenhum segredo no site.
- Horário = bloco de `passo_min` minutos (rótulo na tela: "Duração de cada horário").
- O papel `anon` executa **só** `horarios_publicos()` e `agendar_publico(text, text, timestamptz)`. Todas as outras funções novas têm `revoke execute … from public, anon, authenticated` (o Supabase concede execute a `anon` por padrão em funções novas).
- Limite: 3 agendamentos pelo link por IP por hora. `tentativas_publicas` com mais de 30 dias são apagadas a cada agendamento.
- O IP sai de `current_setting('request.headers', true)`, nunca de um parâmetro enviado pela página.
- Telefone: com `+`, internacional (só dígitos, 8 a 15); sem `+`, regra brasileira da v1. A mesma regra em TS (`normalizePhone`) e SQL (`normalizar_telefone`).
- Usuário do dono → e-mail `<usuario>@dono.agenda` (se tiver `@`, usa como está).
- Endereço do link: `${location.origin}${location.pathname}#/agendar`.
- Os textos da página pública são exatamente os da seção 7 da spec.

## Pontos de atenção na revisão

1. Cliente toca duas vezes em "Confirmar horário": um só agendamento; o botão fica desabilitado enquanto envia, e a segunda resposta não apaga a tela de sucesso. → Task 8.
2. Cliente que volta com o mesmo número e outro nome: reaproveita o cadastro, sem sobrescrever o nome nem duplicar o cliente. → Task 5.
3. Nome só com espaços, com 81 caracteres, ou com acento/emoji; WhatsApp internacional sem `+`: recusa com `dados_invalidos` ou aceita com o nome preservado, nunca erro 500. → Task 5.
4. Dono muda a duração de 30 para 40 min com agendamentos já existentes: horários que encostam ou se sobrepõem aos agendamentos antigos não são ofertados, e nada quebra. → Tasks 3 e 4.
5. Horário extra no mesmo início de um horário do expediente: aparece uma vez só, no link e na agenda. → Tasks 3 e 4.

---

## Estrutura de arquivos

```
supabase/migrations/0002_link_publico.sql   colunas, tabelas e funções novas
supabase/seed.sql                           modelo de livres com {link} (instalação nova)
src/types.ts                                Config, Agendamento, HorarioAjuste, ResultadoPublico
src/lib/whatsapp.ts                         normalizePhone com internacional
src/lib/slots.ts                            gerarHorarios, freeSlots com ajustes
src/lib/link.ts                             linkAgendamento()
src/data/ajustes.ts                         horários fechados e extras
src/data/publico.ts                         chamadas às funções públicas
src/ui/Login.tsx                            usuário e senha
src/ui/publico/Agendar.tsx                  página pública
src/ui/Agenda.tsx, NovoAgendamento.tsx, DetalhesAgendamento.tsx, Configuracoes.tsx, HorariosLivres.tsx, App.tsx
docs/implantacao.md, docs/manual-cliente.md, README.md
tests/db/publico.test.ts, tests/db/concordancia.test.ts, tests/ui/Agendar.test.tsx (+ testes existentes)
```

## Tipos (`src/types.ts`, alterados na Task 1)

```ts
export type Origem = 'dono' | 'link';
export interface Config { /* v1 + */ dias_abertos: number; link_ativo: boolean; telefone_negocio: string | null; modelo_cancelamento: string }
export interface Agendamento { /* v1, com */ servico_id: string | null; origem: Origem }
export interface AgendamentoCompleto extends Agendamento { cliente: Pick<Cliente,'nome'|'telefone'>; servico: Pick<Servico,'nome'> | null; criado_em: string }
export interface HorarioAjuste { id: string; inicio: string; tipo: 'fechado' | 'extra' }
export type ErroPublico = 'link_fechado' | 'dados_invalidos' | 'limite' | 'horario_indisponivel';
export type ResultadoPublico = { ok: true; inicio: string } | { ok: false; erro: ErroPublico };
export interface HorariosPublicos { nome_negocio: string; telefone_negocio: string | null; link_ativo: boolean; horarios: string[] }
```

---

### Task 1: Migração 0002 (colunas e tabelas) e tipos

**Arquivos:**
- Criar: `supabase/migrations/0002_link_publico.sql` (só a parte de dados nesta task; as funções entram nas Tasks 4 e 5)
- Alterar: `tests/helpers/pg.ts` (aplicar a `0002` depois da `0001` e antes do seed; imitar o privilégio padrão do Supabase para funções: `alter default privileges in schema public grant execute on functions to anon, authenticated`), `supabase/seed.sql`, `src/types.ts`, `src/data/agendamentos.ts` (`CAMPOS` inclui `origem`; `COMPLETO` inclui `criado_em`), `tests/helpers/config.ts`, e as telas que leem `servico.nome` (Agenda, Lembretes, Clientes): mostram "—" quando `servico` é nulo.
- Testes: `tests/db/schema.test.ts`

**Interfaces:**
- Fornece: os tipos do bloco acima; as colunas e tabelas da seção 4 da spec.

- [ ] **Passo 1: Escrever os testes que falham** em `tests/db/schema.test.ts`:
  - `configuracoes tem os padrões da v2`: `dias_abertos = 14`, `link_ativo = true`, `telefone_negocio` nulo, `modelo_cancelamento` igual ao texto da seção 4 da spec.
  - `agendamento sem serviço e com origem link é aceito`; `origem 'site'` dá `23514`.
  - `horarios_ajuste aceita fechado e extra e recusa outro tipo` (`23514`) e `recusa o mesmo (inicio, tipo) duas vezes` (`23505`).
  - `telefone internacional 351912345678 é aceito`; `1234567` (7 dígitos) dá `23514`.
  - `estranho não lê horarios_ajuste`, e `nem o dono lê tentativas_publicas` (0 linhas para o dono, `42501` ou 0 linhas para anon).
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/db`. Esperado: FAIL (colunas e tabelas não existem).
- [ ] **Passo 3: Implementar** a parte de dados da `0002` (seção 4 da spec, com `alter table … add column …`, `alter column servico_id drop not null`, troca do check de telefone, `eh_dono()` nas políticas de `horarios_ajuste`, `revoke all on tentativas_publicas from anon, authenticated`). No seed, `modelo_livres` passa a terminar com `\nMarque aqui: {link}`. Atualizar os tipos e `CONFIG_TESTE` (`dias_abertos: 14`, `link_ativo: true`, `telefone_negocio: '5511900001111'`, `modelo_cancelamento` da spec).
- [ ] **Passo 4: Ver passar.** `npx vitest run tests/db` PASS; `npx tsc -p .` sem erros; `npm test` inteiro PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: migração 0002 com horários ajustados, origem e tentativas"`

### Task 2: Telefone internacional (TypeScript)

**Arquivos:** Alterar `src/lib/whatsapp.ts`. Testes: `tests/lib/whatsapp.test.ts`.

**Interfaces:**
- Fornece: `normalizePhone(raw: string): string | null` com a regra da seção 5 da spec.
- Fornece: a constante exportada `CASOS_TELEFONE: [entrada: string, esperado: string | null][]` em `tests/lib/casosTelefone.ts`, reaproveitada na Task 5.

- [ ] **Passo 1: Escrever os testes que falham.** Criar `CASOS_TELEFONE` com os casos da v1 mais `['+351 912 345 678', '351912345678']`, `['+1 (415) 555-0100', '14155550100']`, `['+55 11 98765-4321', '5511987654321']`, `['+123', null]`, `['+1234567890123456', null]`, `['351912345678', null]` (sem `+`, não é número brasileiro válido). O teste faz `it.each(CASOS_TELEFONE)`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/lib/whatsapp.test.ts`. Esperado: FAIL nos casos com `+` não-55.
- [ ] **Passo 3: Implementar.** Se o texto aparado começa com `+`: dígitos, aceito com 8 a 15. Senão, a regra da v1. A mensagem de erro nas telas passa a ser "WhatsApp inválido. Use DDD + número, ou + e o código do país."
- [ ] **Passo 4: Ver passar.** Mesmo comando: PASS. `npm test` inteiro PASS (o texto em `tests/ui/Agenda.test.tsx` muda junto).
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: WhatsApp internacional com +"`

### Task 3: Regra de horários ofertados (TypeScript)

**Arquivos:** Alterar `src/lib/slots.ts`. Testes: `tests/lib/slots.test.ts`.

**Interfaces:**
- Usa: `Config`, `Agendamento`, `HorarioAjuste`, `Slot` (Task 1).
- Fornece:
  - `gerarHorarios(args: { config: Config; ajustes: HorarioAjuste[]; de: string; ate: string }): (Slot & { fechado: boolean })[]`: horários ofertados (expediente sem folgas + extras), ordenados e sem duplicata de início; `fechado` quando se sobrepõe a um ajuste `fechado`.
  - `freeSlots(args: { config: Config; agendamentos: Agendamento[]; ajustes: HorarioAjuste[]; de: string; ate: string; agora: Date }): Slot[]`: `gerarHorarios` sem os fechados, sem sobreposição com `marcado`/`confirmado` (bloco de `passo_min`) e com `inicio ≥ agora + antecedencia_min`. **Sai o parâmetro `duracaoMin`.**
  - `diasDoLink(agora: Date, config: Config): { de: string; ate: string }`: de hoje até hoje + `dias_abertos` − 1.

- [ ] **Passo 1: Escrever os testes que falham** (config da v1: seg–sex 09–12 e 14–18, passo 30, antecedência 60, terça `2026-11-17`; `agora` = segunda 20:00):
  - Os testes da v1 continuam, com `duracaoMin` removido. O caso "almoço com 90 min" sai; entra `passo 90: manhã só 09:00 e 10:30`.
  - `extra às 19:00 de terça entra na lista` e `extra num dia de folga entra`.
  - `extra às 10:00 (igual a um do expediente) aparece uma vez só`.
  - `fechado às 10:00 tira 10:00 e marca fechado: true em gerarHorarios`.
  - `passo 40 com agendamento antigo 10:00–10:30`: o ofertado 09:40 (bloco 09:40–10:20) não sai, e 10:20 também não (sobreposição até 10:30); 09:00 e 11:00 saem.
  - `diasDoLink(terça 20:00, dias_abertos 14)` = `{ de: '2026-11-17', ate: '2026-11-30' }`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/lib/slots.test.ts`. Esperado: FAIL.
- [ ] **Passo 3: Implementar.** Um extra é o início local daquele `inicio` (`dataLocal`/`horaLocal`) no dia dele. Atualizar os chamadores de `freeSlots` (Agenda e HorariosLivres) para passar `ajustes: []` por enquanto, que as Tasks 10 e 12 trocam.
- [ ] **Passo 4: Ver passar.** Mesmo comando: PASS. `npx tsc -p .` e `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: horários ofertados com extras e fechados"`

### Task 4: Função `horarios_publicos` (SQL) e concordância com o TS

**Arquivos:**
- Alterar: `supabase/migrations/0002_link_publico.sql`
- Testes: `tests/db/publico.test.ts`, `tests/db/concordancia.test.ts`

**Interfaces:**
- Fornece:
  - `horarios_livres_em(agora timestamptz) returns setof timestamptz`, interna (sem execute para `anon`/`authenticated`). Mesma regra de `freeSlots`, para hoje até hoje + `dias_abertos` − 1 no `fuso` da config; vazia quando `link_ativo = false`.
  - `horarios_publicos() returns jsonb`, para `anon` e `authenticated`: o JSON da seção 6 da spec, com `horarios = horarios_livres_em(now())` em ISO.

- [ ] **Passo 1: Escrever os testes que falham.** O helper `inserirCenario(db)` monta os mesmos expediente, extra, fechado e agendamentos (`marcado`, `cancelado`) dos testes da Task 3.
  - `horarios_livres_em(terça 08:30) começa em 09:30 e não traz o fechado nem o ocupado`.
  - `com link_ativo = false, horarios_publicos traz horarios = []`.
  - `horarios_publicos não traz nenhuma chave de cliente`: as chaves são exatamente `nome_negocio, telefone_negocio, link_ativo, horarios`.
  - `anon executa horarios_publicos, mas não horarios_livres_em (42501)`.
  - `passo 40 com agendamento antigo` e `extra duplicado` (pontos de atenção 4 e 5).
  - Concordância: para 3 valores de `agora` (segunda 20:00, terça 08:30, terça 23:50), `horarios_livres_em(agora)` = `freeSlots(...)` do TS no mesmo cenário, com `de/ate` de `diasDoLink`, comparando `inicio.toISOString()`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/db/publico.test.ts tests/db/concordancia.test.ts`. Esperado: FAIL (função não existe).
- [ ] **Passo 3: Implementar** em plpgsql ou sql: dias com `generate_series`, intervalos com `jsonb_array_elements(expediente -> extract(dow)::text)`, `(dia + hora) at time zone fuso` para virar `timestamptz`, `union` com os extras, depois os filtros com `tstzrange(h, h + passo, '[)') && …`, distinct e order by.
- [ ] **Passo 4: Ver passar.** Mesmo comando: PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: função pública de horários livres"`

### Task 5: Função `agendar_publico` (SQL) com limite por IP

**Arquivos:**
- Alterar: `supabase/migrations/0002_link_publico.sql`
- Testes: `tests/db/publico.test.ts`

**Interfaces:**
- Usa: `horarios_livres_em` (Task 4); `CASOS_TELEFONE` (Task 2).
- Fornece:
  - `normalizar_telefone(t text) returns text`, interna.
  - `ip_cliente() returns text`, interna: lê `current_setting('request.headers', true)::jsonb`, primeiro `cf-connecting-ip`, depois `x-real-ip`; sem nenhum dos dois, `'desconhecido'`. (Não usa o primeiro item de `x-forwarded-for`, que o cliente pode forjar. A Task 13 confirma isso no projeto real.)
  - `agendar_publico_em(nome text, telefone text, inicio timestamptz, agora timestamptz, ip text) returns jsonb`, interna, com a ordem de verificação da seção 6 da spec.
  - `agendar_publico(nome text, telefone text, inicio timestamptz) returns jsonb`, para `anon` e `authenticated`: chama `agendar_publico_em(…, now(), ip_cliente())`.

- [ ] **Passo 1: Escrever os testes que falham.** No mesmo cenário da Task 4, com `agora` = segunda 20:00 e `ip = '1.1.1.1'`:
  - `sucesso devolve ok e inicio, cria cliente e agendamento com origem link, status marcado, servico nulo e fim = inicio + passo`.
  - `link desligado → link_fechado`.
  - `nome '   ' → dados_invalidos`, `nome com 81 caracteres → dados_invalidos`, `nome 'José 💈' é gravado igual`.
  - `it.each(CASOS_TELEFONE)`: `normalizar_telefone(entrada)` = esperado (nulo vira null).
  - `quarto agendamento do mesmo IP na mesma hora → limite`; `outro IP passa`; `depois de 61 minutos passa de novo`.
  - `horário fora da lista (03:00) → horario_indisponivel`; `horário já ocupado → horario_indisponivel`.
  - `mesmo número com outro nome reaproveita o cliente e mantém o nome antigo` (ponto de atenção 2).
  - `duas chamadas no mesmo horário: a segunda → horario_indisponivel e só existe 1 agendamento` (ponto de atenção 1, no banco).
  - `tentativas com mais de 30 dias são apagadas a cada sucesso`.
  - `ip_cliente lê cf-connecting-ip`: `set request.headers = '{"cf-connecting-ip":"9.9.9.9","x-forwarded-for":"6.6.6.6"}'` → `9.9.9.9`; sem cabeçalho → `desconhecido`.
  - `anon executa agendar_publico, mas não agendar_publico_em nem normalizar_telefone (42501), e continua sem ler clientes`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/db/publico.test.ts`. Esperado: FAIL.
- [ ] **Passo 3: Implementar** em plpgsql. A sobreposição (`23P01`) é capturada com `exception when exclusion_violation` e devolve `horario_indisponivel`. O cliente vem de `insert … on conflict (telefone) do nothing` seguido de `select`.
- [ ] **Passo 4: Ver passar.** Mesmo comando: PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: agendamento público com validação e limite por IP"`

### Task 6: Camada de dados (público e ajustes)

**Arquivos:** Criar `src/data/publico.ts`, `src/data/ajustes.ts`. Testes: `tests/data/publico.test.ts`.

**Interfaces:**
- Usa: `executar`, `SemConexaoError` (v1).
- Fornece:
  - `getHorariosPublicos(db): Promise<HorariosPublicos>` (`rpc('horarios_publicos')`).
  - `agendarPublico(db, nome: string, telefone: string, inicio: string): Promise<ResultadoPublico>` (`rpc('agendar_publico', { nome, telefone, inicio })`).
  - `listAjustes(db, de: string, ate: string): Promise<HorarioAjuste[]>`, com os mesmos limites locais de `listAgendamentos`.
  - `fecharHorario(db, inicio: string): Promise<void>`, `criarExtra(db, inicio: string): Promise<void>`, `removerAjuste(db, id: string): Promise<void>`.

- [ ] **Passo 1: Escrever os testes que falham** (MSW em `${REST}/rpc/...` e `${REST}/horarios_ajuste`):
  - `agendarPublico envia { nome, telefone, inicio } e devolve o JSON`.
  - `getHorariosPublicos com 503 → SemConexaoError`.
  - `fecharHorario envia { inicio, tipo: 'fechado' }`, `criarExtra envia { inicio, tipo: 'extra' }`.
  - `listAjustes usa gte/lt em hora local`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/data/publico.test.ts`. FAIL.
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: dados do link público e dos horários ajustados"`

### Task 7: Login por usuário e senha

**Arquivos:** Alterar `src/ui/Login.tsx`, `tests/helpers/auth.ts` (adicionar `signInWithPassword`), `tests/ui/Login.test.tsx`.

**Interfaces:**
- Fornece: `emailDoUsuario(usuario: string): string` em `src/ui/Login.tsx` (exportada): `trim().toLowerCase()`; se não tem `@`, acrescenta `@dono.agenda`.

- [ ] **Passo 1: Escrever os testes que falham** (os testes de código por e-mail e de Google saem):
  - `emailDoUsuario(' Joao ') === 'joao@dono.agenda'`, `emailDoUsuario('a@b.com') === 'a@b.com'`.
  - `entrar chama signInWithPassword({ email: 'joao@dono.agenda', password: 'segredo123' })`.
  - `credencial errada (status 400) mostra "Usuário ou senha incorretos."`.
  - `erro de rede mostra a mensagem de conexão`.
  - `não há botão "Entrar com Google"`.
  - Os testes de sessão da v1 (com sessão, SIGNED_OUT, sem conexão, sem acesso) continuam.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Login.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** Campos "Usuário" (`autoComplete="username"`, `autoCapitalize="none"`) e "Senha" (`type="password"`, `autoComplete="current-password"`), botão **Entrar**.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: login do dono por usuário e senha"`

### Task 8: Página pública `/#/agendar`

**Arquivos:** Criar `src/ui/publico/Agendar.tsx`, `src/lib/link.ts`. Alterar `src/ui/App.tsx`: com `location.hash` começando em `#/agendar`, renderiza `<Agendar />` sem pedir sessão. Testes: `tests/ui/Agendar.test.tsx`, `tests/lib/link.test.ts`.

**Interfaces:**
- Usa: `getHorariosPublicos`, `agendarPublico` (Task 6), `normalizePhone`, `waLink`, `abreviaDia`, `dataLocal`, `horaLocal`, `horaCurta`, `FUSO`.
- Fornece: `linkAgendamento(loc: Pick<Location, 'origin' | 'pathname'> = window.location): string`.

- [ ] **Passo 1: Escrever os testes que falham** (data simulada; `agora` = terça 08:00; horários qua 18/11 12:00Z e 12:30Z, qui 19/11 13:00Z):
  - `linkAgendamento({ origin: 'https://b.pages.dev', pathname: '/' }) === 'https://b.pages.dev/#/agendar'`.
  - `App com #/agendar e sem sessão mostra a página pública, não o login`.
  - `mostra o nome do negócio e os dias "qua 18" e "qui 19"; tocar em "qua 18" mostra "9h" e "9h30"`.
  - `escolher 9h, preencher Nome "Ana" e WhatsApp "(11) 98765-4321" e confirmar` chama `agendarPublico({}, 'Ana', '5511987654321', '2026-11-18T12:00:00Z')` e mostra "Pronto, Ana! Seu horário: qua 18/11 às 9h." com o link "Falar com a barbearia" = `waLink('5511900001111', 'Oi! Marquei qua 18/11 às 9h pelo link.')`.
  - `WhatsApp inválido mostra a mensagem e não chama agendarPublico`.
  - `botão Confirmar fica desabilitado enquanto envia; dois toques = uma chamada` (ponto de atenção 1).
  - `horario_indisponivel` mostra "Esse horário acabou de ser ocupado. Escolha outro." e recarrega (`getHorariosPublicos` chamado 2 vezes).
  - `limite`, `link_fechado` (o `link_ativo` false na carga também) e `sem horários` mostram os textos exatos da seção 7 e o botão "Falar com a barbearia".
  - `sem telefone_negocio, o botão "Falar com a barbearia" não aparece`.
  - `SemConexaoError mostra "Não foi possível carregar. Tente de novo em instantes." e "Tentar de novo" recarrega`.
  - `a página mostra "Seu nome e WhatsApp são usados só para este agendamento."`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Agendar.test.tsx tests/lib/link.test.ts`. FAIL.
- [ ] **Passo 3: Implementar.** Dias agrupados por `dataLocal(…, FUSO)`; nada de `ConfigContext` (a página não tem sessão).
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: página pública de agendamento"`

### Task 9: Agenda: fechar, reabrir e horário extra

**Arquivos:** Alterar `src/ui/Agenda.tsx`. Testes: `tests/ui/Agenda.test.tsx`.

**Interfaces:**
- Usa: `gerarHorarios`, `freeSlots` (Task 3); `listAjustes`, `fecharHorario`, `criarExtra`, `removerAjuste` (Task 6).

- [ ] **Passo 1: Escrever os testes que falham** (data simulada, como na v1, e mais `listAjustes`):
  - `tocar num horário livre oferece "Marcar cliente" e "Fechar este horário"`; "Marcar cliente" abre o formulário como na v1.
  - `Fechar este horário chama fecharHorario({}, '2026-11-17T12:00:00.000Z')` e recarrega.
  - `um fechado aparece como "09:00 fechado"; tocar oferece "Reabrir"`, que chama `removerAjuste({}, id)`.
  - `+ Horário extra com data 2026-11-17 e hora 19:00 chama criarExtra({}, '2026-11-17T22:00:00.000Z')`, e o extra aparece livre na grade.
  - Os testes da v1 da Agenda continuam passando, ajustados para o toque extra em "Marcar cliente".
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Agenda.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** A grade passa a usar `gerarHorarios` (para mostrar os fechados) e `freeSlots` com `{ ...config, antecedencia_min: 0 }` e os ajustes.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: fechar, reabrir e abrir horário extra na agenda"`

### Task 10: Agenda: serviço opcional, etiqueta "pelo link" e novos pelo link

**Arquivos:** Alterar `src/ui/Agenda.tsx`, `src/ui/NovoAgendamento.tsx`. Testes: `tests/ui/Agenda.test.tsx`.

**Interfaces:**
- Fornece: a chave `localStorage` `agenda:ultimaVisita` (ISO do último toque no aviso), lida e escrita só pela Agenda, com try/catch.

- [ ] **Passo 1: Escrever os testes que falham:**
  - `o formulário tem a opção "Sem serviço" (padrão); salvar sem serviço grava servico_id null e fim = inicio + 30 min`.
  - `com o serviço "Corte e barba" (60 min) grava fim = inicio + 60 min`.
  - `agendamento com origem link mostra a etiqueta "pelo link"`.
  - `2 agendamentos pelo link criados depois de agenda:ultimaVisita mostram "2 agendamentos novos pelo link"`; tocar grava a visita e o aviso some; `1` mostra "1 agendamento novo pelo link".
  - `localStorage indisponível (getItem lança erro) não quebra a Agenda`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Agenda.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** Sem `agenda:ultimaVisita`, grava "agora" na primeira abertura, sem mostrar aviso, para não mostrar o histórico inteiro como novo.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: serviço opcional e aviso de agendamentos novos pelo link"`

### Task 11: Cancelar com aviso no WhatsApp

**Arquivos:** Alterar `src/ui/DetalhesAgendamento.tsx`, `src/ui/Agenda.tsx`. Testes: `tests/ui/Agenda.test.tsx`.

**Interfaces:**
- Usa: `renderModelo`, `waLink`, `linkAgendamento`, `config.modelo_cancelamento`.

- [ ] **Passo 1: Escrever o teste que falha:** `depois de "Cancelar agendamento", aparece "Avisar no WhatsApp"`, com `href = waLink('5511987654321', renderModelo(modelo_cancelamento, { nome: 'João', dia: 'ter', hora: '10h', link: linkAgendamento() }))`. O botão **Fechar** volta para a grade.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Agenda.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** Depois de cancelar, os detalhes continuam abertos com o status "Cancelado" e esse botão; a grade é recarregada ao fechar.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: aviso de cancelamento pelo WhatsApp"`

### Task 12: Ajustes e texto de horários livres com o link

**Arquivos:** Alterar `src/ui/Configuracoes.tsx`, `src/ui/HorariosLivres.tsx`. Testes: `tests/ui/Configuracoes.test.tsx`, `tests/ui/HorariosLivres.test.tsx`.

**Interfaces:**
- Usa: `saveConfig`, `linkAgendamento`, `normalizePhone`, `freeSlots`, `listAjustes`.

- [ ] **Passo 1: Escrever os testes que falham:**
  - Configurações: `salvar grava passo_min 40, dias_abertos 21, link_ativo false, telefone_negocio normalizado e modelo_cancelamento`; `telefone do negócio inválido mostra a mensagem do WhatsApp e não salva`; `"Copiar link de agendamento" copia linkAgendamento()`; `dias_abertos fora de 1–60 é recusado`.
  - Horários livres: `não há mais seletor de serviço`; `o texto usa freeSlots com os ajustes`; `{link} no modelo vira linkAgendamento()`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Configuracoes.test.tsx tests/ui/HorariosLivres.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** Rótulos: "Duração de cada horário (min)", "Quantos dias o link mostra", "Link de agendamento ligado", "WhatsApp do negócio", "Mensagem de cancelamento" (marcadores `{nome}`, `{dia}`, `{hora}`, `{link}`). Em Horários livres, `formatSlotsMessage` recebe o modelo já com `{link}` trocado por `renderModelo`.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: ajustes do link e texto de horários livres com o link"`

### Task 13: Documentos, build e verificação no projeto real

**Arquivos:** Alterar `docs/implantacao.md`, `docs/manual-cliente.md`, `README.md`. Testes: `tests/build.test.ts`.

- [ ] **Passo 1: Escrever o teste que falha:** `tests/build.test.ts` passa a conferir também que nenhum arquivo em `dist/` contém `signInWithOtp` (o login por código saiu).
- [ ] **Passo 2: Ver falhar e passar.** `npx vitest run tests/build.test.ts`: falha só se o código antigo ainda estiver no pacote; se passar de primeira, conferir trocando por uma string que existe no pacote.
- [ ] **Passo 3: Documentos.**
  - `implantacao.md`: aplicar `0002`; criar o dono como `<usuario>@dono.agenda` com Auto Confirm e senha de 8 ou mais caracteres; tirar o passo do template de e-mail, do Google e do SMTP; preencher WhatsApp do negócio; testar o link no celular de outra pessoa.
  - `manual-cliente.md`: entrar com usuário e senha; o link (copiar e divulgar); fechar e abrir horário; cancelar e avisar.
  - `README.md`: a página pública.
- [ ] **Passo 4: Commit.** `git add -A && git commit -m "docs: implantação e manual da v2"`
- [ ] **Passo 5 (manual, no projeto de teste, com o autor):** aplicar a `0002` no SQL Editor. Chamar `agendar_publico` pela API mandando os cabeçalhos `X-Forwarded-For: 6.6.6.6` e `CF-Connecting-IP: 6.6.6.6`, e conferir em `tentativas_publicas` (pelo SQL Editor) qual IP foi gravado: precisa ser o IP real da máquina, não o forjado. Se `ip_cliente()` gravar o forjado, trocar o cabeçalho lido, com um teste novo, antes de seguir. Depois, o 4º agendamento na mesma hora → `limite`. Por fim, login com usuário e senha, e o link aberto no iPhone.
