# Agenda Fácil v3 — Plano de Implementação

> **Para quem for executar:** use superpowers:subagent-driven-development ou superpowers:executing-plans. Os passos usam caixas de seleção (`- [ ]`). Os títulos são "### Task N" porque os scripts de execução procuram esse formato.

**Objetivo:** app do dono com 3 abas (Agenda, Link, Ajustes), o link de agendamento em destaque e mensagens de WhatsApp prontas, sem edição de modelos.

**Arquitetura:** as mensagens viram funções puras em `src/lib/mensagens.ts`. As telas novas (aba Link e cartão Amanhã) reaproveitam a camada de dados e a regra de horários da v2. As telas antigas (Horários livres, Lembretes) só são apagadas na última task, depois que os testes delas migraram. Nenhuma mudança no banco.

**Tecnologias:** as mesmas da v2.

**Especificação:** `docs/superpowers/specs/2026-11-11-agenda-facil-v3-design.md`, por cima da v1 e da v2.

## Restrições gerais

- Valem as Restrições gerais dos planos v1 e v2.
- Os textos das mensagens são exatamente os da tabela da seção 3 da spec, sem o nome do negócio.
- Dia por extenso e em minúsculas (`domingo`, `segunda-feira`, …, `sábado`), `dd/mm` com dois dígitos e hora como `horaCurta` (`9h`, `9h30`).
- Abas, nesta ordem: **Agenda** (`/`), **Link** (`/link`), **Ajustes** (`/config`). Redirecionamentos: `/livres` → `/link`, `/lembretes` → `/`, `/clientes` → `/config`; qualquer outro → `/`.
- O app não lê nem grava mais `modelo_livres`, `modelo_lembrete` e `modelo_cancelamento`.
- Decisão do plano: "Confirmar no WhatsApp" grava a confirmação e **depois** mostra o botão (link) "Abrir WhatsApp" com a mensagem. O Safari do iPhone bloqueia abrir uma janela depois de esperar a rede, então abrir sozinho não funcionaria. A spec, na seção 6, já pede "só depois mostra o link".

## Pontos de atenção na revisão

1. Dois toques em "Confirmar no WhatsApp": uma gravação só; o botão fica desabilitado enquanto grava. → Task 4.
2. Emoji das mensagens (✅ 👋 📅) e nome com acento: o link `wa.me` sai codificado certo (`%E2%9C%85` para ✅) e o nome não é alterado. → Task 1.
3. Amanhã sem atendimento (folga, só cancelados): "Amanhã: nenhum cliente", sem botão. → Task 3.
4. Link desligado e o dono toca em "Mandar no WhatsApp": aparece o aviso de link fechado, para ele não divulgar um link que não funciona. → Task 2.
5. Salvar Ajustes depois de mexer na chave do link (na aba Link) não pode religar nem desligar o link sem querer: o salvamento de Ajustes não manda `link_ativo`. → Task 5.

---

## Estrutura de arquivos

```
src/lib/mensagens.ts          criar: diaPorExtenso e as 4 mensagens
src/ui/AbaLink.tsx            criar: aba Link
src/ui/CartaoAmanha.tsx       criar: cartão Amanhã (substitui Lembretes)
src/ui/Agenda.tsx             alterar: mostra o CartaoAmanha
src/ui/DetalhesAgendamento.tsx alterar: Confirmar no WhatsApp; Cancelar com texto fixo
src/ui/NovoAgendamento.tsx    alterar: painel "Agendamento marcado"
src/ui/Configuracoes.tsx      alterar: sem Mensagens, sem chave do link, com Clientes
src/ui/Clientes.tsx           alterar: título vira h3 (seção dentro de Ajustes)
src/ui/App.tsx                alterar: 3 abas e redirecionamentos
src/ui/HorariosLivres.tsx, src/ui/Lembretes.tsx   apagar (Task 6)
docs/manual-cliente.md        alterar
```

---

### Task 1: Mensagens prontas (`src/lib/mensagens.ts`)

**Arquivos:** Criar `src/lib/mensagens.ts`. Testes: `tests/lib/mensagens.test.ts`.

**Interfaces:**
- Usa: `dataLocal`, `horaLocal`, `horaCurta`, `diaDaSemana` (`src/lib/slots.ts`).
- Fornece:
  - `diaPorExtenso(data: string): string` (`'2026-11-18'` → `'quarta-feira'`).
  - `interface DadosMensagem { nome: string; inicio: string; fuso: string }` (`inicio` em ISO).
  - `mensagemConfirmar(d: DadosMensagem): string`
  - `mensagemLembrar(d: DadosMensagem): string`
  - `mensagemCancelar(d: DadosMensagem, link: string): string`
  - `mensagemDivulgar(link: string): string`

- [ ] **Passo 1: Escrever os testes que falham** (`F = 'America/Sao_Paulo'`, `L = 'https://b.pages.dev/#/agendar'`):
  - `diaPorExtenso` para `2026-11-15..21` = `['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']`.
  - `mensagemConfirmar({ nome: 'João', inicio: '2026-11-18T12:00:00Z', fuso: F })` = `'Olá, João! ✅ Seu horário está confirmado: quarta-feira (18/11) às 9h. Até lá!'`.
  - `mensagemLembrar({ nome: 'João', inicio: '2026-11-18T12:00:00Z', fuso: F })` = `'Olá, João! 👋 Passando para lembrar do seu horário amanhã, quarta-feira (18/11), às 9h. Até lá!'`.
  - `mensagemCancelar({ nome: 'João', inicio: '2026-11-22T17:30:00Z', fuso: F }, L)` = `'Olá, João. Infelizmente não vou conseguir te atender domingo (22/11) às 14h30. Me desculpe! Para marcar outro horário: https://b.pages.dev/#/agendar'`.
  - `sábado de outro mês`: `mensagemConfirmar({ nome: 'Zé', inicio: '2026-12-05T12:00:00Z', fuso: F })` contém `'sábado (05/12) às 9h'`.
  - `mensagemDivulgar(L)` = `'📅 Agenda aberta! Escolha seu horário aqui: https://b.pages.dev/#/agendar'`.
  - `nome com acento e emoji é preservado e o link codifica o emoji`: `waLink('5511987654321', mensagemConfirmar({ nome: 'José 💈', … }))` contém `encodeURIComponent('José 💈')` e `'%E2%9C%85'`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/lib/mensagens.test.ts`. Esperado: FAIL (o import não resolve).
- [ ] **Passo 3: Implementar.** Data e hora com `dataLocal`/`horaLocal` no `fuso`; os textos são os da spec, caractere por caractere.
- [ ] **Passo 4: Ver passar.** Mesmo comando: PASS.
- [ ] **Passo 5: Commit.** `git add src/lib/mensagens.ts tests/lib/mensagens.test.ts && git commit -m "feat: mensagens de WhatsApp prontas"`

### Task 2: Aba Link (`src/ui/AbaLink.tsx`)

**Arquivos:** Criar `src/ui/AbaLink.tsx`. Testes: `tests/ui/AbaLink.test.tsx` (com `src/data/*` simulado e `agora` = terça 2026-11-17 08:00 de São Paulo).

**Interfaces:**
- Usa: `useConfig` (`config`, `recarregar`); `saveConfig`; `listAgendamentos`; `listAjustes`; `freeSlots`, `diasDoLink`, `formatSlotsMessage`; `linkAgendamento`; `waLink`; `mensagemDivulgar` (Task 1); `useAoVoltar`.
- Fornece: `export default function AbaLink()`.

- [ ] **Passo 1: Escrever os testes que falham:**
  - `mostra o título "Seu link de agendamento" e o endereço por inteiro` (`screen.getByText(linkAgendamento())`).
  - `Copiar link chama navigator.clipboard.writeText(linkAgendamento()) e mostra "Link copiado!"`.
  - `Mandar no WhatsApp tem href waLink(null, mensagemDivulgar(linkAgendamento()))`.
  - `desligar a chave "Link ligado" chama saveConfig({}, { link_ativo: false }) e recarregar()`.
  - `com o link desligado: mostra "O link está fechado: quem abrir verá 'Agendamento online fechado no momento.'" e não mostra o resumo`.
  - `o resumo "Próximos horários livres:" mostra até 8 horários`: com agendamentos e ajustes simulados vazios, o texto é `formatSlotsMessage(primeiros 8 de freeSlots(...), '{horarios}')`, ou seja `'ter 9h, 9h30, 10h, 10h30, 11h, 11h30, 14h, 14h30'`; `listAgendamentos` e `listAjustes` chamados com `('2026-11-17', '2026-11-30')`.
  - `o resumo usa os horários fechados`: com um fechado às 09:00 de terça, o resumo começa com `'ter 9h30'`.
  - `ao voltar para o app, recarrega o resumo` (evento `visibilitychange`, `listAgendamentos` chamado de novo).
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/AbaLink.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** A chave grava na hora (`saveConfig` e depois `recarregar`); em caso de erro, mostra "Não foi possível salvar. Confira a internet e tente de novo." e volta a chave ao estado anterior.
- [ ] **Passo 4: Ver passar.** PASS. `npx tsc -p .` sem erros.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: aba Link com o link em destaque"`

### Task 3: Cartão Amanhã na Agenda (`src/ui/CartaoAmanha.tsx`)

**Arquivos:** Criar `src/ui/CartaoAmanha.tsx`. Alterar `src/ui/Agenda.tsx` (renderiza `<CartaoAmanha />` logo depois do aviso de novos). Testes: `tests/ui/CartaoAmanha.test.tsx`, que migra os casos de `tests/ui/Lembretes.test.tsx`.

**Interfaces:**
- Usa: `listAgendamentos`, `diasDoPeriodo('amanha', …)`, `mensagemLembrar` (Task 1), `waLink`, `horaLocal`, `useAoVoltar`.
- Fornece: `export default function CartaoAmanha()`.

- [ ] **Passo 1: Escrever os testes que falham** (`agora` = terça 23:30 de São Paulo, como no teste de Lembretes; um agendamento marcado, um cancelado e um confirmado na quarta):
  - `busca amanhã em hora local`: `listAgendamentos` chamado com `({}, '2026-11-18', '2026-11-18')`.
  - `conta só marcados e confirmados`: mostra `'Amanhã: 2 clientes'`.
  - `um só usa o singular`: `'Amanhã: 1 cliente'`.
  - `sem ninguém mostra "Amanhã: nenhum cliente" e nenhum botão Lembrar` (lista vazia, e também só cancelados).
  - `Lembrar abre a lista com um link por cliente`: o link `'Lembrar João'` tem `href = waLink('5511987654321', mensagemLembrar({ nome: 'João', inicio, fuso }))`; o cancelado não aparece; **Voltar** fecha a lista.
  - `ao voltar para o app no dia seguinte, usa o novo "amanhã"` (migrado do teste de Lembretes).
  - Em `tests/ui/Agenda.test.tsx`: `a Agenda mostra o cartão Amanhã` (com `listAgendamentos` simulado, o texto `/Amanhã:/` aparece).
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/CartaoAmanha.test.tsx tests/ui/Agenda.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Ver passar.** PASS. `npm test` inteiro PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: cartão Amanhã com lembretes na Agenda"`

### Task 4: Confirmar e cancelar com mensagem pronta

**Arquivos:** Alterar `src/ui/DetalhesAgendamento.tsx` e `src/ui/NovoAgendamento.tsx`. Testes: `tests/ui/Agenda.test.tsx`.

**Interfaces:**
- Usa: `mensagemConfirmar`, `mensagemCancelar` (Task 1), `linkAgendamento`, `waLink`, `mudarStatus`.

- [ ] **Passo 1: Escrever os testes que falham** (João, terça 10:00 = `2026-11-17T13:00:00Z`):
  - `num marcado, o botão é "Confirmar no WhatsApp"` (não existe mais "Confirmar"). Tocar chama `mudarStatus({}, 'a1', 'confirmado')` e **depois** aparece o link **"Abrir WhatsApp"** com `href = waLink('5511987654321', mensagemConfirmar({ nome: 'João', inicio: '2026-11-17T13:00:00Z', fuso }))`.
  - `se mudarStatus falhar, mostra o erro e não aparece "Abrir WhatsApp"`.
  - `dois toques em "Confirmar no WhatsApp" gravam uma vez só` (com `mudarStatus` pendente, o botão fica desabilitado).
  - `num confirmado, não há "Confirmar no WhatsApp"`.
  - `depois de cancelar, "Avisar no WhatsApp" usa mensagemCancelar(..., linkAgendamento())`; o teste da v2 que usava `renderModelo(modelo_cancelamento…)` é trocado por este.
  - `depois de marcar um cliente na mão, aparece "Agendamento marcado" com "Mandar confirmação no WhatsApp"` (`href` com `mensagemConfirmar` e o telefone do cliente); **Fechar** volta para a grade e recarrega. Vale tanto para cliente existente quanto para cliente novo (`findOrCreateCliente`).
  - `editar um agendamento não mostra o painel "Agendamento marcado"`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Agenda.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** Em `NovoAgendamento`, depois do sucesso de `criarAgendamento`, o formulário vira o painel "Agendamento marcado", com o nome e o telefone do cliente escolhido ou criado. **Fechar** chama `onSalvo()`.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: confirmar e cancelar com mensagem pronta no WhatsApp"`

### Task 5: Ajustes enxutos com Clientes

**Arquivos:** Alterar `src/ui/Configuracoes.tsx` e `src/ui/Clientes.tsx` (o título `h2` "Clientes" vira `h3`). Testes: `tests/ui/Configuracoes.test.tsx`.

**Interfaces:**
- Usa: `Clientes` (componente da v1, renderizado como seção).

- [ ] **Passo 1: Escrever os testes que falham:**
  - `não tem a seção Mensagens nem os campos de modelo` (`queryByLabelText('Mensagem de horários livres' | 'Mensagem de lembrete' | 'Mensagem de cancelamento')` nulos).
  - `não tem a chave "Link de agendamento ligado" nem "Copiar link de agendamento"`.
  - `salvar não manda link_ativo nem modelo_*`: as chaves de `saveConfig.mock.calls[0][1]` são exatamente `nome_negocio, telefone_negocio, passo_min, dias_abertos, expediente, folgas`.
  - `as seções aparecem na ordem Negócio, Horários, Serviços, Clientes, Backup` (ordem dos `h3`).
  - `a seção Clientes busca e abre o histórico` (com `src/data/clientes` e `listAgendamentosDoCliente` simulados: digitar "Jo" chama `listClientes({}, 'Jo')`).
  - Os testes da v2 que usavam os campos removidos (modelos, chave do link, copiar link) saem deste arquivo; os equivalentes estão em `AbaLink.test.tsx` (Task 2).
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Configuracoes.test.tsx tests/ui/Clientes.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar.** A seção Horários junta duração, dias do link, expediente e folgas. Não há mais estado para os modelos nem para a chave do link.
- [ ] **Passo 4: Ver passar.** PASS. `npm test` PASS.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: Ajustes enxutos com a seção Clientes"`

### Task 6: Três abas, redirecionamentos e limpeza

**Arquivos:**
- Alterar: `src/ui/App.tsx`, `docs/manual-cliente.md`.
- Apagar: `src/ui/HorariosLivres.tsx`, `src/ui/Lembretes.tsx`, `tests/ui/HorariosLivres.test.tsx`, `tests/ui/Lembretes.test.tsx`. Os casos deles já foram migrados nas Tasks 2 e 3; conferir isso antes de apagar.
- Testes: `tests/ui/Login.test.tsx`.

- [ ] **Passo 1: Escrever os testes que falham** (com sessão, `Agenda` e `AbaLink` simuladas como títulos):
  - `a barra tem exatamente as abas Agenda, Link e Ajustes`: os links de navegação, em ordem, são `['Agenda', 'Link', 'Ajustes']`.
  - `#/livres abre a aba Link`, `#/lembretes abre a Agenda`, `#/clientes abre Ajustes`, `#/qualquer-coisa abre a Agenda`.
- [ ] **Passo 2: Ver falhar.** `npx vitest run tests/ui/Login.test.tsx`. FAIL.
- [ ] **Passo 3: Implementar e apagar.** Rotas `/`, `/link`, `/config` e os `<Navigate replace>` dos redirecionamentos. Apagar os quatro arquivos. Ver que nenhum import aponta para eles (`grep -rn "HorariosLivres\|Lembretes'" src tests` vazio). Atualizar o manual: 3 abas, aba Link, mensagens prontas, cartão Amanhã; sem "Livres", "Lembretes" nem "Mensagens".
- [ ] **Passo 4: Ver passar.** `npx vitest run tests/ui/Login.test.tsx` PASS; `npx tsc -p .` sem erros; `npm test` inteiro PASS; `npm run build` sem erros.
- [ ] **Passo 5: Commit.** `git add -A && git commit -m "feat: três abas (Agenda, Link, Ajustes)"`
