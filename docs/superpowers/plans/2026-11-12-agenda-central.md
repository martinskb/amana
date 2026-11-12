# Agenda central – Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a agenda a tela central (sem navegação), com o link no cabeçalho, Ajustes como tela própria e, a partir de 1280px, a agenda em duas colunas com resumo e detalhes ao lado.

**Architecture:** `CabecalhoAgenda` absorve o que restou da aba Link. As rotas ficam só Agenda e Ajustes. O `Painel` ganha `modo: 'sobreposto' | 'lateral'` e continua sempre na mesma posição da árvore da Agenda, para a troca de largura não desmontar o conteúdo. `useTelaLarga()` decide o modo. `ResumoLateral` reúne próximo cliente, Amanhã e novos pelo link.

**Tech Stack:** React 19, React Router 7 (HashRouter), Vitest 5 + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-agenda-central-design.md`

## Global Constraints

- Tela larga = `matchMedia('(min-width: 1280px)')`. Abaixo disso, a Agenda se comporta exatamente como hoje.
- Rotas: `/` Agenda, `/config` Ajustes; `/link` e `/livres` → `/`; `/lembretes` → `/`; `/clientes` → `/config`; `#/agendar` continua público. Qualquer rota do dono sem sessão mostra o login.
- Textos exatos: "Link aberto" / "Link fechado"; nomes acessíveis "Link de agendamento aberto" / "Link de agendamento fechado", "Copiar link", "Ajustes", "Fechar", "WhatsApp de <nome>"; avisos "Link fechado: quem abrir verá 'Agendamento online fechado no momento.'", "Link aberto: clientes já podem agendar.", "Não foi possível salvar. Confira a internet e tente de novo.", "Link copiado!", "Não deu para copiar. O link é: <link>", botão "Copiado ✓" por 2s; aviso de status some em 4s; "Nenhum cliente até o fim do dia."; volta "‹ Agenda".
- Sem título "Agenda" na tela da agenda; "Ajustes" mantém o título.
- Coluna lateral de 400px, conteúdo até 1320px, 24px de espaço; cabeçalho fixo ao rolar; no celular (< 768px), chave e copiar viram botões redondos de 44px só com ícone.
- Usa os tokens, fontes e animações existentes; troca de conteúdo da coluna com fade de 150ms (sem animação com menos movimento).
- Nenhuma dependência nova. `npm test` e `npx tsc -b` verdes ao fim de cada tarefa.

## Review Focus

1. **Esc enquanto digita num campo do painel lateral:** quem aperta Esc para fechar a lista de sugestões do campo "Cliente" não espera perder o formulário. No modo lateral, Esc com o foco num `input`, `textarea` ou `select` não fecha. Teste na Task 4.
2. **Mudar a largura com o painel aberto e depois apertar Voltar no celular:** não pode haver entrada sobrando nem faltando no histórico. Passar para sobreposto empurra uma entrada; passar para lateral consome com `history.back()`. Teste na Task 4.
3. **Rota do dono sem sessão** (`#/config`, `#/`, `#/link`): mostra o login, nunca Ajustes ou Agenda. Teste na Task 2.
4. **Próximo cliente com agendamento em andamento, cancelado ou de amanhã:** só conta um de hoje, marcado ou confirmado, com início depois de agora. Teste na Task 3.
5. **Chave do link sem internet:** volta ao estado anterior e avisa; não fica "aberto" na tela com o banco fechado. Teste na Task 1 (migrado).

---

### Task 1: `useTelaLarga` e `CabecalhoAgenda`

**Files:**
- Modify: `src/ui/animacao.ts`
- Create: `src/ui/CabecalhoAgenda.tsx`
- Modify: `src/ui/icones.tsx` (`IconeCopiar`, `IconeEngrenagem`), `src/ui/estilo.css`
- Test: `tests/ui/animacao.test.tsx`, `tests/ui/CabecalhoAgenda.test.tsx` (novo)

**Interfaces:**
- Produces:
  - `useTelaLarga(): boolean`, com o mesmo padrão de `usePrefereMenosMovimento`.
  - `CabecalhoAgenda(): JSX.Element`: lê `config` e `recarregar` de `useConfig()`, usa `saveConfig` de `src/data/configuracoes` e `linkAgendamento()` de `src/lib/link`, e renderiza `<header className="cab">` com o nome, a chave (`<button aria-pressed>`), Copiar link e `<Link to="/config" aria-label="Ajustes">`.
  - `IconeCopiar` e `IconeEngrenagem` com a mesma assinatura dos outros ícones.

- [ ] **Step 1: Escrever os testes que falham.**
  - Em `animacao.test.tsx`: `useTelaLarga` é false sem `matchMedia`, reflete o stub de `(min-width: 1280px)` e acompanha o evento `change`.
  - Em `CabecalhoAgenda.test.tsx`, com os mocks de `AbaLink.test.tsx` (só `saveConfig`) e `renderComConfig`:
    - mostra `CONFIG_TESTE.nome_negocio`;
    - com `link_ativo: true`, o botão "Link de agendamento aberto" tem `aria-pressed="true"` e o texto "Link aberto";
    - clicar chama `saveConfig({}, { link_ativo: false })` e `recarregar`, e mostra o aviso de fechado;
    - partindo de `link_ativo: false`, clicar grava `true` e mostra o aviso de aberto;
    - a chave fica `disabled` enquanto o `saveConfig` está pendente;
    - falha ao salvar volta `aria-pressed` ao valor anterior e mostra o alerta de erro;
    - "Copiar link" chama `writeText(linkAgendamento())`, mostra "Link copiado!" e o botão passa a "Copiado ✓";
    - falha no `writeText` mostra "Não deu para copiar. O link é: …";
    - o link "Ajustes" tem `href` terminando em `/config`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/animacao.test.tsx tests/ui/CabecalhoAgenda.test.tsx`.
- [ ] **Step 3: Implementar.** O estado `ligado` começa em `config.link_ativo` e é sincronizado quando `config` muda. O aviso de status usa `setTimeout` de 4s, cancelado ao desmontar. CSS do `.cab`: sticky, nome em Playfair de 22px com corte por "…", pílula `.chip` com `.ponto` verde ou cinza. Abaixo de 768px, `.chip` vira círculo de 44px e o texto fica só para leitor de tela.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit:** `feat(agenda): cabeçalho com chave e cópia do link`.

### Task 2: Rotas sem navegação e Ajustes como tela própria

**Files:**
- Modify: `src/ui/App.tsx`, `src/ui/Agenda.tsx` (cabeçalho no topo, sem `<h2>Agenda</h2>`), `src/ui/Configuracoes.tsx`, `src/ui/estilo.css`, `src/lib/mensagens.ts`
- Delete: `src/ui/Navegacao.tsx`, `src/ui/AbaLink.tsx`, `tests/ui/Navegacao.test.tsx`, `tests/ui/AbaLink.test.tsx`
- Test: `tests/ui/Login.test.tsx` (renderiza o App com sessão falsa), `tests/ui/TransicaoRota.test.tsx`, `tests/ui/Configuracoes.test.tsx`, `tests/lib/mensagens.test.ts`

**Interfaces:**
- Consumes: `CabecalhoAgenda` (Task 1).
- Produces: a Agenda começa com `<CabecalhoAgenda />`, e `Configuracoes` começa com `<Link to="/">‹ Agenda</Link>`. Nos Ajustes, as seções Serviços, Clientes e Backup ficam dentro de `<div className="config-direita">`, e o `<form>` fica à esquerda.

- [ ] **Step 1: Escrever os testes que falham.** Em `Login.test.tsx`, usando o `auth` falso e o `getConfig` mockado já existentes:
  - `it.each(['#/config', '#/', '#/link', '#/qualquer'])('%s sem sessão mostra o login')`: `findByLabelText('Usuário')` existe e não há heading "Ajustes".
  - `com sessão, não há abas de navegação`: depois de carregar, `queryByRole('navigation')` é null.
  - `#/link com sessão leva à agenda`: aparece o botão "Copiar link" e o hash vira `#/`.
  - `a engrenagem abre Ajustes e "‹ Agenda" volta`.

  No `TransicaoRota.test.tsx`, trocar `Navegacao` por dois `<Link>` simples, mantendo a mesma asserção. Em `Configuracoes.test.tsx`: `o link "‹ Agenda" aponta para a agenda` (href terminando em `#/` ou `/`). Em `mensagens.test.ts`: remover o caso de `mensagemDivulgar`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Login.test.tsx tests/ui/TransicaoRota.test.tsx tests/ui/Configuracoes.test.tsx`.
- [ ] **Step 3: Implementar.**
  - App: tirar o `header.topo` e a `<Navegacao>`; a rota `/link` passa a ser `<Navigate to="/" replace />`.
  - Agenda: começa com `<CabecalhoAgenda />` e sem o `<h2>`. O `<BackupBanner />` sai da rota `/` do App e vai para dentro da Agenda, logo abaixo do cabeçalho, para não ficar acima dele.
  - Teste extra em `Login.test.tsx`: `com backup atrasado, o banner aparece depois do cabeçalho` (a posição do banner no DOM vem depois do botão "Copiar link").
  - Remover `mensagemDivulgar` e os arquivos listados em "Delete".
  - CSS: tirar as regras `body:has(.abas)` e `.abas`. A partir de 1280px, `.config` vira um grid de 2 colunas (form à esquerda, `.config-direita` à direita) com `max-width: 1320px`.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`. Esperado: nenhum teste antigo falha além dos removidos.
- [ ] **Step 5: Commit:** `feat(agenda): agenda como tela central, sem navegação; ajustes com volta`.

### Task 3: Resumo lateral e layout em duas colunas

**Files:**
- Create: `src/ui/ResumoLateral.tsx`, `src/lib/proximo.ts`
- Modify: `src/ui/Agenda.tsx`, `src/ui/estilo.css`
- Test: `tests/lib/proximo.test.ts` (novo), `tests/ui/Agenda.test.tsx`

**Interfaces:**
- Consumes: `useTelaLarga` (Task 1).
- Produces:
  - `proximoCliente(ags: AgendamentoCompleto[], agora: Date, fuso: string): AgendamentoCompleto | null`: o primeiro, por início, que seja de hoje (data local), marcado ou confirmado, e com início depois de `agora`.
  - `faltaPara(inicio: string, agora: Date): string`: "em 40 min", "em 1 h 20 min" ou "em 1 h".
  - `ResumoLateral(props: { agendamentos: AgendamentoCompleto[]; novos: ReactNode })`: renderiza `<aside aria-label="Resumo" className="resumo-lateral">` com o próximo cliente, `<CartaoAmanha />` e `novos`.
  - Na Agenda, o aviso de novos pelo link vira um elemento reaproveitado nos dois lugares.

- [ ] **Step 1: Escrever os testes que falham.**
  - `proximo.test.ts`:
    - escolhe o primeiro futuro de hoje;
    - ignora cancelado, concluído, faltou, os que já começaram e os de amanhã;
    - devolve null se não houver nenhum;
    - `faltaPara`: 40 min → "em 40 min", 80 min → "em 1 h 20 min", 60 min → "em 1 h".
  - `Agenda.test.tsx`, com um stub de `matchMedia` para 1280px em `beforeEach` (`const larga = () => vi.stubGlobal('matchMedia', …)`):
    - `na tela larga, o resumo mostra o próximo cliente com o WhatsApp`: o `complementary` "Resumo" contém "10:00", "João" e "em 2 h", e o link "WhatsApp de João". Usar `vi.setSystemTime` em 08:00 local de terça; o João está às 10:00.
    - `sem próximo hoje, mostra a mensagem`.
    - `na tela larga, o cartão Amanhã fica no resumo e não acima da grade`.
    - `abaixo de 1280px não há resumo lateral`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/lib/proximo.test.ts tests/ui/Agenda.test.tsx`.
- [ ] **Step 3: Implementar.** Na Agenda, a área principal vira `<div className="agenda-layout">`, com a grade à esquerda e, na tela larga, o `<ResumoLateral>` à direita. Fora da tela larga, o `CartaoAmanha` e os novos continuam acima da grade. CSS da `.agenda-layout` a partir de 1280px: `grid-template-columns: minmax(0, 1fr) 400px; gap: 24px`, com a coluna sticky.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit:** `feat(agenda): resumo lateral com próximo cliente na tela larga`.

### Task 4: `Painel` com `modo="lateral"`

**Files:**
- Modify: `src/ui/Painel.tsx`, `src/ui/estilo.css`
- Test: `tests/ui/Painel.test.tsx`

**Interfaces:**
- Produces: `Painel(props: { aberto; onFechar; rotulo; children; modo?: 'sobreposto' | 'lateral' })`, com padrão `'sobreposto'`. A marcação é a mesma nos dois modos (`div.painel-camada > div.fundo-escuro + section.painel`), com a classe `lateral` na camada. No lateral: `role="region"` sem `aria-modal`, botão "Fechar" (×) no topo, sem `pushState`, sem foco preso e sem travar a rolagem. Ao abrir, o foco vai para o primeiro focável. Esc fecha só se o foco estiver dentro do painel e não estiver num `input`, `textarea` ou `select`.

- [ ] **Step 1: Escrever os testes que falham** (`describe('modo lateral')`):
  - `é uma região, não um diálogo`: `getByRole('region', { name: 'Teste' })` existe, sem `dialog` e sem `aria-modal`.
  - `não mexe no histórico nem trava a rolagem`: espiã de `pushState` não é chamada, e `body.style.overflow` não vira 'hidden'.
  - `o × chama onFechar`.
  - `Esc com o foco dentro fecha; Esc com o foco fora não fecha`.
  - `Esc com o foco num campo de texto do painel não fecha`.
  - `trocar de sobreposto para lateral com o painel aberto mantém o valor digitado e chama history.back uma vez`: um `<input>` filho com valor digitado; `rerender` com `modo="lateral"`; o valor continua; a espiã de `back` foi chamada 1 vez.
  - `trocar de lateral para sobreposto com o painel aberto empurra uma entrada`: a espiã de `pushState` foi chamada 1 vez, e o `role` vira `dialog`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Painel.test.tsx`.
- [ ] **Step 3: Implementar.** O efeito de modal (`pushState`, `popstate`, `overflow`, foco preso) passa a depender de `[aberto, modo]` e roda só com `aberto && modo === 'sobreposto'`. Na troca de sobreposto para lateral, a limpeza do efeito já faz o `history.back()` existente. O foco só volta ao elemento de antes quando o painel fecha de fato (`aberto` vira false), não na troca de modo. CSS de `.painel-camada.lateral`: `position: static`, sem `.fundo-escuro`, `.painel` como cartão normal, fade de 150ms.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit:** `feat(painel): modo lateral sem comportamento de janela modal`.

### Task 5: Agenda usa o painel lateral na tela larga

**Files:**
- Modify: `src/ui/Agenda.tsx`, `src/ui/estilo.css`
- Test: `tests/ui/Agenda.test.tsx`

**Interfaces:**
- Consumes: `useTelaLarga` (Task 1), `Painel` com `modo` (Task 4), `ResumoLateral` (Task 3).
- Produces: o `<Painel>` fica sempre como filho direto de `.agenda-layout`, na mesma posição, com `modo={larga ? 'lateral' : 'sobreposto'}`. O `ResumoLateral` fica oculto enquanto o painel lateral está aberto. O `inert`/`aria-hidden` da grade só vale no sobreposto. O item selecionado recebe `aria-current="true"` e a classe `selecionado`.

- [ ] **Step 1: Escrever os testes que falham** (tela larga com o stub de 1280px):
  - `clicar num agendamento mostra os detalhes na região, sem diálogo`: `getByRole('region', { name: 'Agendamento' })` existe, `queryByRole('dialog')` é null, a espiã de `pushState` não é chamada, e o botão `/10:00 João/` tem `aria-current="true"`.
  - `a grade continua usável com o painel lateral aberto`: o botão `Marcar ter 17/11 às 09:00` é encontrado sem `hidden: true`, e clicar troca o conteúdo para "Horário livre".
  - `Fechar (×) volta ao resumo e devolve o foco ao horário`.
  - `"+ Novo" abre na região e, ao fechar, o foco volta ao botão "+ Novo"`.
  - `mudar a largura com o novo agendamento aberto mantém o nome digitado`: digitar "Jo" no campo "Cliente", trocar o stub para estreito e disparar `change`, e o campo continua com "Jo" dentro de um `dialog`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run tests/ui/Agenda.test.tsx`.
- [ ] **Step 3: Implementar** conforme as Interfaces. Guardar, num `useRef`, o elemento que abriu o painel, para devolver o foco ao fechar (o `Painel` já devolve no sobreposto; no lateral, a Agenda faz isso no `onFechar`). CSS: `.selecionado` com `outline: 2px solid var(--couro); outline-offset: 2px`.
- [ ] **Step 4: Rodar e ver passar:** `npm test && npx tsc -b`.
- [ ] **Step 5: Commit:** `feat(agenda): detalhes na coluna lateral na tela larga`.

### Task 6: Polimento e verificação visual

**Files:**
- Modify: `src/ui/estilo.css` (ajustes finos); `scripts/prints.sh` (a captura do login segue igual)
- Test: verificação manual

- [ ] **Step 1:** `npm test && npx tsc -b && npm run build`. Esperado: tudo verde.
- [ ] **Step 2:** No Chrome logado (com a Night Eye desligada para `localhost`), em 1440×900 e com a janela estreita (≤ 767px):
  - cabeçalho;
  - chave do link liga e desliga, com os avisos;
  - copiar;
  - engrenagem e "‹ Agenda";
  - coluna lateral: resumo, seleção, ×, Esc e troca de largura com algo aberto;
  - Voltar do navegador no celular.

  Comparar com os prints aprovados (`agenda4`, `agenda4m`, `ajustes4`).
- [ ] **Step 3: Commit** dos ajustes finos, se houver: `style(agenda): polimento do layout de computador`.
