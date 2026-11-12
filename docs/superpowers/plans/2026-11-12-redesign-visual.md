# Redesign visual – Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o novo visual escuro (couro/creme, Playfair + Hanken Grotesk), layout responsivo, painéis sobrepostos e animações expressivas a todas as telas, sem mudar regras de negócio.

**Architecture:** Tokens CSS em `src/ui/tokens.css` e estilos em `src/ui/estilo.css` (reescrito). Três peças novas e isoladas: `src/ui/icones.tsx` (SVGs), `src/ui/animacao.ts` (hooks) e `src/ui/Painel.tsx` (sobreposição com Voltar, Esc e foco preso). Uma função pura nova, `agruparLivres`, em `src/ui/semana.ts`. As telas existentes trocam só a marcação e as classes.

**Tech Stack:** React 19, React Router 7 (HashRouter), Vite 8 + vite-plugin-pwa, Vitest 5 + Testing Library + jsdom, `@fontsource/playfair-display` e `@fontsource/hanken-grotesk`.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-visual-design.md`

## Global Constraints

- Cores: `--fundo #161412`, `--sup #211E1B`, `--sup2 #2C2824`, `--borda #3B3631`, `--borda-i #736A60`, `--texto #EDE6DC`, `--sutil #A39A8F`, `--creme #E7D3B8`, `--couro #B9894F`, `--couro-txt #17120C`, `--perigo #F07470`, `--sucesso #7CC59A`.
- Branco nunca sobre `--perigo`; `--borda` nunca é o único indicador de elemento interativo (use `--borda-i`).
- Playfair Display 600 (e itálico) só a partir de 20px; todo o resto Hanken Grotesk 400/500/600; corpo e campos ≥ 16px; sutil ≥ 14px; altura de linha 1,5; horários com `tabular-nums`.
- Raios: pílula `999px` (botões, fichas, etiquetas), 16px (cartões, painéis), 12px (campos). Área de toque ≥ 44×44px. `:focus-visible` com contorno 2px `--couro`, afastamento 3px.
- Quebras de layout: < 768px abas embaixo; ≥ 768px barra lateral de 220px e conteúdo de até 760px; ≥ 1100px semana em 7 colunas (até 1180px).
- Animações só com `transform`, `opacity` e `stroke-dashoffset`; curva `cubic-bezier(.2,.8,.2,1)`; rápido 120–200ms, médio 250–350ms, expressivo 500–900ms; cascata de 20ms por item, no máximo 200ms no total, só na primeira carga.
- `prefers-reduced-motion: reduce`: só fade de no máximo 150ms, sem deslizar, cascata ou tremor; contador mostra o valor final; o check aparece pronto.
- Nenhuma biblioteca de animação nova. Únicas dependências novas: `@fontsource/playfair-display` e `@fontsource/hanken-grotesk` (só o recorte latino).
- Textos visíveis e nomes acessíveis atuais não mudam, exceto onde uma tarefa diz.
- Todos os testes existentes continuam passando (`npm test`), e a checagem de tipos também (`npx tsc -b`).

## Review Focus

1. **Voltar do navegador com painel aberto** (Android, gesto de voltar, botão do navegador): deve fechar só o painel, sem sair da agenda nem trocar de aba. Coberto na Task 3.
2. **Fechar um painel pelo botão e depois apertar Voltar:** não pode reabrir o painel nem ficar uma entrada "fantasma" no histórico que exija dois Voltar. Coberto na Task 3.
3. **Nome de cliente longo** ("Maria Aparecida dos Santos Oliveira") na semana em 7 colunas e na folha de detalhes: corta com "…" sem empurrar a coluna nem estourar a largura. Coberto na Task 5.
4. **Dia sem nenhum horário livre e dia todo livre** na semana: o agrupamento não pode gerar grupo vazio nem perder o último horário. Coberto na Task 5.
5. **"Reduzir movimento" ligado:** o contador mostra o número final de imediato e nenhum conteúdo fica invisível esperando uma animação que não roda. Coberto nas Tasks 2 e 8.

---

### Task 1: Tokens, fontes e base

**Files:**
- Create: `src/ui/tokens.css`
- Modify: `src/ui/estilo.css` (reescrita completa), `src/main.tsx`, `vite.config.ts`, `package.json`
- Test: `tests/build.test.ts`

**Interfaces:**
- Produces: as variáveis CSS das Global Constraints e as classes base usadas por todas as tarefas: `.pill`, `.pill.pri`, `.pill.perigo`, `.pill.perigo-cheio`, `.pill.zap`, `.red`, `.cartao`, `.campo` (aplicada via seletor de `input, select, textarea`), `.sutil`, `.linha`, `.rotulo`, `.tit` (Playfair 28px). Mapeamento das classes antigas: `button.primario` passa a ter o mesmo visual de `.pill.pri`, `a.botao` o de `.pill.zap`, e `button.perigo` o de `.pill.perigo`, para as telas não migradas continuarem coerentes até as próximas tarefas.

- [ ] **Step 1: Escrever os testes que falham** em `tests/build.test.ts`:
  - `it('manifest usa as cores do tema escuro')`: `manifest.background_color === '#161412'` e `manifest.theme_color === '#161412'`.
  - `it('embute as fontes latinas no build e no cache do PWA')`: `arquivos(saida)` contém algum `.woff2` cujo nome tem `playfair-display-latin` e outro com `hanken-grotesk-latin`; nenhum `.woff2` com `cyrillic`, `greek` ou `vietnamese`; e `sw.js` contém a string `.woff2`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/build.test.ts`. Esperado: os 2 testes novos falham.
- [ ] **Step 3: Implementar.**
  - `npm i @fontsource/playfair-display @fontsource/hanken-grotesk`.
  - Em `src/main.tsx`, importar só os arquivos latinos: `@fontsource/playfair-display/latin-600.css`, `.../latin-600-italic.css`, `@fontsource/hanken-grotesk/latin-400.css`, `latin-500.css`, `latin-600.css`, e depois `./ui/tokens.css`, antes de `./ui/estilo.css`.
  - Em `vite.config.ts`: `background_color` e `theme_color` passam a `'#161412'`; `workbox: { globPatterns: ['**/*.{js,css,html,png,woff2}'] }`.
  - `index.html`: `<meta name="theme-color" content="#161412">` e `apple-mobile-web-app-status-bar-style` em `black-translucent`.
  - Reescrever `estilo.css` com os tokens: `body` sobre `--fundo`; botões, campos e foco conforme as Global Constraints. Os seletores de tela continuam existindo e são refeitos nas tarefas seguintes.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`. Esperado: tudo passa.
- [ ] **Step 5: Commit** — `feat(visual): tokens do tema escuro, fontes embutidas e estilos base`.

### Task 2: Ícones, hooks de animação e navegação responsiva

**Files:**
- Create: `src/ui/icones.tsx`, `src/ui/animacao.ts`
- Modify: `src/ui/App.tsx` (cabeçalho e `nav.abas`), `src/ui/estilo.css`
- Test: `tests/ui/animacao.test.tsx` (novo), `tests/ui/App.test.tsx`

**Interfaces:**
- Produces:
  - `icones.tsx`: componentes `IconeAgenda`, `IconeLink`, `IconeAjustes`, `IconeWhatsApp`, `IconeCheck`, `IconeX`, `IconeRelogio`, `IconeSino`, `IconeEsquerda`, `IconeDireita`, `IconeMais`, todos `(props: { tamanho?: number }) => JSX.Element`, com `aria-hidden="true"` e `stroke="currentColor"`, tamanho padrão 20.
  - `animacao.ts`:
    - `usePrefereMenosMovimento(): boolean`: lê `matchMedia('(prefers-reduced-motion: reduce)')`, ouve mudanças e devolve `false` se `matchMedia` não existir.
    - `useSaida(aberto: boolean, ms: number): { montado: boolean; saindo: boolean }`.
    - `useContador(alvo: number, ms = 600): number`: com menos movimento, devolve `alvo` direto.

- [ ] **Step 1: Escrever os testes que falham** em `tests/ui/animacao.test.tsx`, com `renderHook` e `vi.useFakeTimers()`. Para `matchMedia`, criar um stub controlável no próprio arquivo.
  - `useSaida`:
    - `aberto=true` dá `{ montado: true, saindo: false }`.
    - Ao mudar para `false`, dá `{ montado: true, saindo: true }`; depois de `ms`, dá `{ montado: false }`.
    - Se reabrir antes de `ms`, volta a `{ montado: true, saindo: false }` e não desmonta.
  - `useContador(3, 600)`:
    - Começa em 0 e termina em 3 depois de 600ms (avançar timers e rAF).
    - Com o stub de menos movimento ligado, já começa em 3.
    - Se `alvo` mudar de 3 para 5, termina em 5.
  - `usePrefereMenosMovimento`: devolve `false` sem `matchMedia`; reflete o stub e atualiza ao disparar o evento `change`.

  Em `tests/ui/App.test.tsx`, novo teste: os links de navegação continuam encontráveis por `getByRole('link', { name: 'Agenda' })`, e o mesmo para Link e Ajustes, e cada um contém um `svg[aria-hidden="true"]`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/animacao.test.tsx tests/ui/App.test.tsx`.
- [ ] **Step 3: Implementar** os hooks e os ícones. Na navegação:
  - Cada `NavLink` recebe o ícone mais um `<span>` com o rótulo.
  - O nome do negócio fica em `<span className="marca">` dentro do `nav`, visível só a partir de 768px.
  - O `header.topo` fica visível só abaixo de 768px.
  - Indicador couro na aba ativa.
  - CSS das quebras conforme as Global Constraints, com `nav.abas` fixo embaixo ou lateral de 220px e `main` com margem de 220px a partir de 768px.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit** — `feat(visual): ícones, hooks de animação e navegação responsiva`.

### Task 3: Componente Painel

**Files:**
- Create: `src/ui/Painel.tsx`
- Modify: `src/ui/estilo.css`
- Test: `tests/ui/Painel.test.tsx` (novo)

**Interfaces:**
- Consumes: `useSaida`, `usePrefereMenosMovimento` (Task 2).
- Produces: `Painel(props: { aberto: boolean; onFechar: () => void; rotulo: string; children: ReactNode }): JSX.Element | null`.
  - Renderiza `<div className="fundo-escuro">` mais `<section role="dialog" aria-modal="true" aria-label={rotulo} className="painel">`. Rodar via portal em `document.body` não é necessário.
  - Classe `saindo` durante a saída.

- [ ] **Step 1: Escrever os testes que falham:**
  - `fecha com Esc`: com `aberto`, `userEvent.keyboard('{Escape}')` chama `onFechar` uma vez.
  - `fecha ao clicar no fundo e não ao clicar dentro`: clique em `.fundo-escuro` chama `onFechar`; clique num botão filho não chama.
  - `Voltar do navegador fecha`: ao abrir, `history.length` aumenta 1; `window.dispatchEvent(new PopStateEvent('popstate'))` chama `onFechar`.
  - `fechar pelo botão não deixa entrada sobrando`: abrir (`history.length` = n+1), o pai muda `aberto` para `false` sem popstate, e `history.back` (espionado com `vi.spyOn(history, 'back')`) é chamado uma vez. Logo depois, um `popstate` não chama `onFechar` de novo.
  - `foco entra e volta`: um botão "abrir" fora do painel tem foco; ao abrir, o primeiro elemento focável do painel recebe foco; Tab no último volta ao primeiro, e Shift+Tab no primeiro vai ao último; ao fechar, o foco volta ao botão "abrir".
  - `trava a rolagem do fundo`: aberto, `document.body.style.overflow === 'hidden'`; fechado, volta ao valor anterior.
  - `não renderiza fechado`: com `aberto=false` desde o início, `queryByRole('dialog')` é null.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Painel.test.tsx`.
- [ ] **Step 3: Implementar `Painel`.**
  - Ao abrir: `history.pushState({ painel: true }, '')`, um `popstate` que chama `onFechar`, e uma flag de que o estado foi empurrado.
  - Ao fechar sem popstate: `history.back()`, ignorando o `popstate` que esse `back` vai gerar.
  - Esc e foco preso num `keydown` dentro do componente.
  - CSS: folha subindo de baixo abaixo de 768px (alça, raio de 22px no topo, `max-height: 90vh` com rolagem interna); painel centralizado de 480px a partir de 768px; entrada de 300ms e saída de 200ms; com menos movimento, só fade de 150ms.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit** — `feat(visual): painel sobreposto com Voltar, Esc e foco preso`.

### Task 4: Agenda com painéis sobrepostos e painel de detalhes em grade

**Files:**
- Modify: `src/ui/Agenda.tsx`, `src/ui/DetalhesAgendamento.tsx`, `src/ui/NovoAgendamento.tsx` (só o elemento raiz), `src/ui/estilo.css`
- Test: `tests/ui/Agenda.test.tsx`

**Interfaces:**
- Consumes: `Painel` (Task 3), ícones (Task 2).
- Produces:
  - `Agenda` sempre renderiza a grade. O estado `painel` decide o conteúdo de um único `<Painel>`, com `rotulo` igual aos `aria-label` atuais: "Agendamento", "Horário livre", "Horário fechado", "Horário extra", e o de `NovoAgendamento`.
  - `DetalhesAgendamento` e `NovoAgendamento` deixam de renderizar o próprio `<section role="dialog">` e passam a renderizar só o conteúdo, porque o `Painel` é o diálogo.

- [ ] **Step 1: Escrever os testes que falham** em `tests/ui/Agenda.test.tsx`:
  - `com um painel aberto, a grade continua na tela`: abrir os detalhes de João e verificar que `getByRole('dialog', { name: 'Agendamento' })` existe e que o botão `Marcar ter 17/11 às 09:00` continua no documento.
  - `Esc fecha o painel de horário livre`: abrir `Marcar ter 17/11 às 09:00`, Esc, e `queryByRole('dialog')` passa a ser null.
  - `ações dos detalhes ficam agrupadas`: dentro do diálogo, `Concluir`, `Faltou`, `Editar` e o link `WhatsApp` estão num elemento com `.acoes`, e `Cancelar agendamento` está fora dele.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Agenda.test.tsx`.
- [ ] **Step 3: Implementar.**
  - Trocar os retornos antecipados de `Agenda` por um `<Painel aberto={painel !== null} onFechar={() => setPainel(null)} rotulo=…>` no fim do JSX.
  - Os botões "Voltar" e "Fechar" internos chamam o mesmo `onFechar`.
  - Detalhes:
    - Nome do cliente em `<h3>` (Playfair 24px) e linha sutil com data, hora, serviço e duração.
    - Selo de status (ver Task 5).
    - `div.acoes` em grade de 2 colunas: a primeira ação disponível ocupa a largura toda (`Confirmar no WhatsApp` quando marcado), seguida de Concluir, Faltou, Editar e WhatsApp (`.pill.zap` com `IconeWhatsApp`).
    - Abaixo, a linha de Cancelar e Fechar, ou o bloco `.confirmar-cancelar` já existente, com `Sim, cancelar` em `.pill.perigo-cheio`.
- [ ] **Step 4: Rodar a suíte:** `npm test && npx tsc -b`. Esperado: tudo passa. Teste antigo que dependa da grade sumir com o painel aberto é ajustado para procurar dentro de `getByRole('dialog')`, sem perder o que verifica.
- [ ] **Step 5: Commit** — `feat(visual): painéis da agenda sobrepostos à grade`.

### Task 5: Grade do dia e da semana, cartão Amanhã e banners

**Files:**
- Create: `src/ui/semana.ts`
- Modify: `src/ui/Agenda.tsx`, `src/ui/CartaoAmanha.tsx`, `src/ui/BackupBanner.tsx`, `src/ui/estilo.css`
- Test: `tests/ui/semana.test.ts` (novo), `tests/ui/Agenda.test.tsx`, `tests/ui/CartaoAmanha.test.tsx`

**Interfaces:**
- Consumes: `useContador` (Task 2), ícones (Task 2). O tipo `Item` já existe em `Agenda.tsx` e passa a ser exportado de `semana.ts`.
- Produces:
  - `semana.ts`:
    - `type Item = { tipo: 'agendamento'; hora: string; agendamento: AgendamentoCompleto } | { tipo: 'livre'; hora: string } | { tipo: 'fechado'; hora: string; ajusteId: string }`.
    - `type ItemSemana = Exclude<Item, { tipo: 'livre' }> | { tipo: 'livres'; de: string; ate: string }`.
    - `agruparLivres(itens: Item[]): ItemSemana[]`: une livres consecutivos na lista ordenada; um livre isolado vira `{ de: h, ate: h }`.
  - Selo de status: componente local `SeloStatus({ status }: { status: Status })`, com texto e ícone: marcado/`IconeRelogio`, confirmado/`IconeCheck`, concluído/`IconeCheck`, faltou/`IconeX`.

- [ ] **Step 1: Escrever os testes que falham.** Em `tests/ui/semana.test.ts`:
  - `une livres seguidos`: `[L 10:00, L 10:30, A 11:00, L 14:00]` resulta em `[{livres 10:00–10:30}, A 11:00, {livres 14:00–14:00}]`.
  - `dia todo livre vira um grupo só`: 16 livres de 09:00 a 18:30 resultam em `[{ tipo: 'livres', de: '09:00', ate: '18:30' }]`.
  - `sem livres não cria grupo` e `lista vazia devolve vazia`.
  - `fechado interrompe o grupo`: `[L 10:00, F 10:30, L 11:00]` resulta em 3 itens.

  Em `tests/ui/Agenda.test.tsx`:
  - `na semana, livres seguidos aparecem agrupados e abrem o primeiro horário`: modo Semana, ver o botão `Marcar ter 17/11 entre 09:00 e 09:30` (rótulo do grupo: `Marcar {dia} {dd/mm} entre {de} e {ate}`, ou o rótulo atual `Marcar … às {de}` quando `de === ate`); ao clicar, abre o painel "Horário livre" com o título `ter 17/11 às 09:00`.
  - `agendamento mostra o selo de status com texto`: o botão `/10:00 João/` contém o texto `marcado`.

  Em `tests/ui/CartaoAmanha.test.tsx`: `com menos movimento, o número aparece direto` (stub de `matchMedia` ligado; o texto "2" e "clientes amanhã" aparecem sem avançar timers). O nome acessível atual do título continua igual: manter "Amanhã: 2 clientes" como texto do `<strong>`, com o número grande decorativo `aria-hidden`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/semana.test.ts tests/ui/Agenda.test.tsx tests/ui/CartaoAmanha.test.tsx`.
- [ ] **Step 3: Implementar.**
  - Cartões da grade:
    - Agendamento: faixa de 4px pela cor do status, hora em 17px/600, nome, serviço sutil, selo à direita e etiqueta "pelo link" com contorno creme.
    - Livre: tracejado `--borda-i`, com `IconeMais` couro.
    - Fechado: listras diagonais sutis e hora riscada.
  - Semana a partir de 1100px: `.semana` em grade de 7 colunas, cada dia num cartão; agendamento compacto (hora sutil de 13px em cima, nome em baixo com `text-overflow: ellipsis` e `min-width: 0`); grupos de livres via `agruparLivres`. Abaixo de 1100px, a mesma marcação empilhada.
  - Controles: `.seg` com fundo couro deslizante; setas `.red` com `IconeEsquerda` e `IconeDireita`, mantendo o `aria-label` "Anterior" e "Próximo"; `+ Novo` em `.pill.pri`.
  - Troca de dia: guardar a direção (`-1 | 1`) no clique das setas e aplicar a classe `entra-esq` ou `entra-dir` na grade (keyed por `inicio`), com 200ms. A cascata (`.cascata > li` com `animation-delay: calc(var(--i) * 20ms)`, limitada a 10 itens) só na primeira carga, guardada num `useRef`.
  - CartaoAmanha: número grande Playfair couro via `useContador(n)`, lista de lembretes desdobrando (`grid-template-rows: 0fr` → `1fr`) e botão `Lembrar` com `IconeSino`.
  - BackupBanner e aviso de novos: `.cartao` com ícone.
- [ ] **Step 4: Rodar a suíte:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit** — `feat(visual): grade com selo de status, semana agrupada e cartão Amanhã`.

### Task 6: Página pública e sucesso

**Files:**
- Modify: `src/ui/publico/Agendar.tsx`, `src/ui/estilo.css`
- Test: `tests/ui/Agendar.test.tsx`

**Interfaces:**
- Consumes: ícones e `usePrefereMenosMovimento` (Task 2).
- Produces: nada usado por outras tarefas.

- [ ] **Step 1: Ajustar e escrever os testes que falham:**
  - Trocar a linha 76 (`findByText('Pronto, Ana! Seu horário: qua 18/11 às 9h.')`) por duas verificações dentro de `findByRole('status')`: `getByRole('heading', { name: 'Pronto, Ana!' })` e `getByText('Seu horário: qua 18/11 às 9h.')`.
  - `fichas de dia mostram dia da semana e número`: o botão do dia `qua 18` tem nome acessível `qua 18` (texto em dois `span`s, sem mudar o nome).
  - `resumo do horário aparece acima do formulário`: depois de escolher dia e hora, aparece o texto `Quarta, 18/11 às 9h`.
  - `setas rolam as fichas`: os botões `Dias anteriores` e `Mais dias` existem; um clique chama `scrollBy` (espionado em `HTMLElement.prototype.scrollBy`).
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Agendar.test.tsx`.
- [ ] **Step 3: Implementar.**
  - Título Playfair de 40px.
  - Subtítulo: "Escolha o dia e o horário do seu atendimento." Os testes não verificam esse texto. Hoje é "Escolha o dia e o horário:"; conferir antes com `grep` e manter o antigo se algum teste usar.
  - `.dias` com rolagem horizontal, `scroll-snap` e degradê na borda (abaixo de 768px). As setas `.red` ficam ocultas abaixo de 768px e rolam 3 fichas.
  - `.horarios` em grade `repeat(auto-fill, minmax(84px, 1fr))`.
  - O formulário entra desdobrando.
  - Sucesso: SVG de check (círculo e traço com `stroke-dasharray` / `stroke-dashoffset`, 700ms), `<h2>` em Playfair itálico com "Pronto, {nome}!", e `<p>` "Seu horário: {d} {ddmm} às {hora}." num cartão. Tudo dentro do `role="status"`.
  - Estados de erro e link fechado em `.cartao` centralizado.
- [ ] **Step 4: Rodar a suíte:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit** — `feat(visual): página pública com fichas, pílulas e sucesso animado`.

### Task 7: Login, Link, Ajustes e estados de conexão

**Files:**
- Modify: `src/ui/Login.tsx`, `src/ui/AbaLink.tsx`, `src/ui/Configuracoes.tsx`, `src/ui/Clientes.tsx`, `src/ui/SecaoBackup.tsx`, `src/ui/SemConexao.tsx`, `src/ui/App.tsx` (estados de carregando e erro), `src/ui/estilo.css`
- Test: `tests/ui/Login.test.tsx`, `tests/ui/AbaLink.test.tsx`, `tests/ui/Configuracoes.test.tsx`, `tests/ui/App.test.tsx`

**Interfaces:**
- Consumes: ícones (Task 2), `.cartao`, `.pill`, `.tit` (Task 1).
- Produces: a classe `.chave` (interruptor visual sobre `input[type=checkbox]`) e o componente `Esqueleto({ linhas }: { linhas: number })`, que é usado também pela Agenda no lugar do "Carregando…" da grade.

- [ ] **Step 1: Escrever os testes que falham:**
  - Login: `mostra o subtítulo` (`getByText('Entre para ver sua agenda')`).
  - AbaLink: `a chave continua sendo um checkbox com o nome Link ligado`: `getByRole('checkbox', { name: 'Link ligado' })` tem a classe `chave`.
  - Configuracoes: `cada seção é um cartão com título`: existem os headings `Negócio`, `Expediente`, `Folgas`, `Serviços`, `Clientes` e `Backup`. Conferir antes os títulos atuais com `grep -n "<h" src/ui/Configuracoes.tsx` e acrescentar só os que faltam.
  - App: `enquanto carrega mostra o esqueleto` (`getByRole('status', { name: 'Carregando' })`). Antes, conferir com `grep -rn "Carregando" tests` se algum teste procura o texto "Carregando…"; se procurar, o esqueleto mantém esse texto como rótulo oculto.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Login.test.tsx tests/ui/AbaLink.test.tsx tests/ui/Configuracoes.test.tsx tests/ui/App.test.tsx`.
- [ ] **Step 3: Implementar.**
  - Login: centralizado, com o nome em Playfair de 40px, o subtítulo e o formulário em `.cartao`.
  - Link:
    - URL em campo somente leitura.
    - "Mandar no WhatsApp" em `.pill.zap`.
    - "Copiar link" mostra "Copiado ✓" por 2s depois do aviso atual de sucesso; o aviso de erro existente fica igual.
    - Chave `.chave`.
    - Próximos horários como pílulas.
  - Ajustes:
    - Cada seção em `section.cartao` com `<h3>` Playfair de 21px.
    - Campos de Negócio em 2 colunas a partir de 768px.
    - Intervalos como etiquetas pílula com o botão × (mantendo o `aria-label` "Remover intervalo N da {dia}").
    - "ativo" dos serviços como `.chave`.
  - SemConexao e erros do App em `.cartao` centralizado.
  - `Esqueleto`: blocos `--sup` com brilho; `role="status"` e `aria-label="Carregando"`.
- [ ] **Step 4: Rodar a suíte:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit** — `feat(visual): login, link, ajustes e estados de conexão no novo visual`.

### Task 8: Animações finais, menos movimento e verificação visual

**Files:**
- Modify: `src/ui/estilo.css`, `src/ui/App.tsx` (transição de aba)
- Create: `scripts/prints.sh` (gera os prints em navegador headless sem extensões)
- Test: `tests/ui/App.test.tsx`

**Interfaces:**
- Consumes: tudo das tarefas anteriores.

- [ ] **Step 1: Escrever o teste que falha:** `troca de aba aplica a classe de entrada no conteúdo`. Ao clicar em `Link`, o elemento `main` (ou o contêiner da rota) recebe a classe `entra` e o atributo `key` muda, verificado pela classe presente depois da troca.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/App.test.tsx`.
- [ ] **Step 3: Implementar.**
  - Transição de aba: contêiner das rotas com `key={location.pathname}` e a classe `entra`, que aplica fade + 8px em 200ms.
  - Toque: `button:active, .pill:active { transform: scale(.97) }` em 120ms.
  - Tremor do erro: classe `.treme`, aplicada ao `[role=alert]` de formulário.
  - Itens de lista em Ajustes (serviços, folgas, intervalos): os novos entram com `@keyframes entra-item` (fade + `scale(.96)` → 1, 250ms). A saída usa `useSaida` no item removido só onde a remoção é local (intervalos); onde a lista é recarregada do servidor, apenas a entrada anima.
  - Indicador de aba deslizando.
  - Bloco final `@media (prefers-reduced-motion: reduce)` conforme as Global Constraints, garantindo que nenhum elemento fique com `opacity: 0` (`animation: none; opacity: 1; transform: none` nos alvos de cascata e entrada; o `stroke-dashoffset` do check em 0).
  - `scripts/prints.sh`: sobe `npm run dev` em segundo plano e roda um navegador Chromium headless (`$NAVEGADOR`, padrão `brave`) com `--user-data-dir` temporário e `--disable-extensions`. Gera prints de T1 a T7 em 1280×800 e 390×844 numa pasta passada como argumento.
- [ ] **Step 4: Rodar a suíte:** `npm test && npx tsc -b && npm run build`. Esperado: tudo passa.
- [ ] **Step 5: Verificação visual e manual.**
  - Rodar `scripts/prints.sh <pasta>` e comparar com os prints aprovados (T1–T7).
  - No navegador real, com a Night Eye desligada para `localhost`:
    - Tab percorre tudo com o anel couro visível.
    - Esc fecha os painéis.
    - O Voltar do navegador fecha o painel sem sair da agenda.
    - Com "reduzir movimento" ligado no sistema, nada desliza e nada fica invisível.
- [ ] **Step 6: Commit** — `feat(visual): animações de transição, menos movimento e script de prints`.
