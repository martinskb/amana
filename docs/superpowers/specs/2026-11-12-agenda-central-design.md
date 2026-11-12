# Agenda como tela central

Data: 2026-11-12 · Situação: aprovado em conversa, aguardando revisão desta especificação.
Base: redesign visual (`2026-11-12-redesign-visual-design.md`) e correções de segurança SEC-001/SEC-002 (branch `fix/seguranca-link-publico`).

## 1. Objetivo

A agenda passa a ser o sistema. Hoje o app tem três abas (Agenda, Link, Ajustes); a aba Link tem pouca função (ligar o link, copiar, mandar no WhatsApp) e fica "perdida". No computador, a barra lateral e a coluna de 760px desperdiçam mais da metade de uma tela de 1920px.

**Decisões tomadas na conversa**

| Decisão | Escolha |
|---|---|
| Navegação | Some: sem barra lateral (computador) e sem abas embaixo (celular) |
| Tela principal | Agenda, sem o título "Agenda" (o nome do negócio no cabeçalho cumpre esse papel) |
| Link | Controles no cabeçalho da agenda: chave aberto/fechado e "Copiar link". Sem "Mandar no WhatsApp", sem prévia, sem lista de próximos horários |
| Ajustes | Tela própria, aberta pela engrenagem do cabeçalho, com "‹ Agenda" para voltar; duas colunas no computador |
| Computador (≥ 1280px) | Agenda em duas colunas: grade à esquerda e coluna lateral fixa de resumo e detalhes à direita |
| Uso | Serve tanto a quem deixa a agenda aberta o dia todo quanto a quem só passa para organizar |

**Critérios de sucesso**

- Do celular ao computador, tudo o que o dono faz no dia começa e termina na agenda.
- No computador, clicar num horário mostra detalhes e ações ao lado, sem cobrir a agenda.
- No celular, o comportamento dos painéis (folha que sobe, Voltar, Esc, foco) continua igual ao atual.
- Todos os testes existentes continuam passando, exceto os da aba Link, que migram para o cabeçalho.

**Fora do escopo:** assistente de primeiro login (próximo trabalho), mudanças de regra de negócio, novas cores ou fontes.

## 2. Estrutura e rotas

| Rota | Tela |
|---|---|
| `/#/` | Agenda (cabeçalho + grade; coluna lateral a partir de 1280px) |
| `/#/config` | Ajustes, com "‹ Agenda" no topo |
| `/#/link` e `/#/livres` | Redirecionam para `/#/` (endereços antigos) |
| `/#/lembretes`, `/#/clientes` | Mantêm os redirecionamentos atuais (`/` e `/config`) |
| `/#/agendar` | Página pública, sem mudança |

Saem: `src/ui/Navegacao.tsx` e `src/ui/AbaLink.tsx` (e seus testes, migrados conforme a seção 7). O `header.topo` e o `.marca` da navegação deixam de existir. `TransicaoRota` continua animando a troca entre Agenda e Ajustes.

`mensagemDivulgar` em `src/lib/mensagens.ts` fica sem uso e é removida com seu teste.

## 3. Cabeçalho da agenda

Componente novo `src/ui/CabecalhoAgenda.tsx`, fixo no topo da agenda ao rolar:

```
Barbearia do Zé                     [● Link aberto] [⧉ Copiar link] [⚙]
```

- **Nome do negócio:** Playfair 600, 22px, cor creme; corta com "…" se não couber.
- **Chave do link:** botão pílula com um ponto (verde `--sucesso` com halo quando aberto; cinza `#7B736A` quando fechado) e o texto "Link aberto" / "Link fechado". `aria-pressed` reflete o estado e o nome acessível é "Link de agendamento aberto" / "Link de agendamento fechado". Ao clicar: grava `link_ativo` com `saveConfig`, recarrega a configuração e mostra um aviso curto (`role="status"`, some em 4s):
  - fechou: "Link fechado: quem abrir verá 'Agendamento online fechado no momento.'"
  - abriu: "Link aberto: clientes já podem agendar."
  - erro: volta ao estado anterior e mostra (`role="alert"`) "Não foi possível salvar. Confira a internet e tente de novo."
  - desabilitado enquanto salva.
- **Copiar link:** copia `linkAgendamento()`. Sucesso: o botão mostra "Copiado ✓" por 2s e o aviso "Link copiado!". Falha: aviso "Não deu para copiar. O link é: <link>".
- **⚙ Ajustes:** link para `/#/config` com nome acessível "Ajustes".
- **Celular (< 768px):** a chave e o copiar viram botões redondos de 44px só com ícone (ponto e ícone de copiar); os nomes acessíveis continuam os mesmos.

O "Ligue o link para divulgar" e a lista "Próximos horários livres" da aba Link deixam de existir.

## 4. Agenda no computador (≥ 1280px)

Hook novo `useTelaLarga(): boolean` em `src/ui/animacao.ts` (mesmo padrão de `usePrefereMenosMovimento`), que observa `matchMedia('(min-width: 1280px)')` e devolve `false` sem `matchMedia`.

**Layout:** conteúdo até 1320px centralizado; grade com `minmax(0, 1fr)` e coluna lateral de 400px, com 24px de espaço e `position: sticky; top` logo abaixo do cabeçalho. Na visão Semana, as 7 colunas dos dias ficam dentro da área da grade.

**Como a coluna é montada (para nada se perder ao mudar a largura):** o `Painel` atual ganha a prop `modo: 'sobreposto' | 'lateral'` (padrão `'sobreposto'`). A Agenda renderiza **sempre o mesmo `<Painel>` na mesma posição da árvore**, como filho direto do contêiner de layout, e só troca `modo` conforme `useTelaLarga()`. Assim o React não desmonta o conteúdo quando a largura muda.

- `modo="sobreposto"`: exatamente o comportamento atual (folha ou caixa central, fundo escuro, foco preso, Voltar do navegador, fundo inerte).
- `modo="lateral"`: mesma marcação, sem fundo escuro, sem foco preso, sem `history.pushState` e sem deixar a grade inerte; o CSS o coloca na 2ª coluna do grid, por cima do resumo, e o `section` usa `role="region"` (em vez de `dialog`) com `aria-label` igual ao rótulo do conteúdo e um botão "×" (nome acessível "Fechar"). Esc fecha só quando o foco está dentro dele.

**Resumo** (componente novo `src/ui/ResumoLateral.tsx`, `<aside aria-label="Resumo">`, 2ª coluna do grid, escondido enquanto o painel lateral está aberto):

- **Conteúdo do resumo,** nesta ordem:
  1. **Próximo cliente:** o próximo agendamento de hoje com status marcado ou confirmado e início depois de agora, com hora, nome, serviço, "em N min" (ou "em 1 h 20 min") e um botão de WhatsApp (link `wa.me` sem texto) com nome acessível "WhatsApp de <nome>". Sem próximo hoje: "Nenhum cliente até o fim do dia."
  2. **Cartão Amanhã** (o `CartaoAmanha` atual, sem mudança de comportamento).
  3. **Novos pelo link** (o aviso atual de novos pelo link, com "Entendi"), só quando houver novos.
- **Com seleção:** o `Painel` em `modo="lateral"` mostra o mesmo conteúdo de hoje (`conteudoPainel`), com o rótulo de hoje ("Agendamento", "Horário livre", "Novo agendamento" etc.).
  - O horário selecionado fica com contorno couro de 2px na grade e `aria-current="true"`.
  - Ao selecionar, o foco vai para o título do conteúdo da coluna; ao fechar ("×", Esc ou "Voltar"/"Fechar" internos), o foco volta ao horário que estava selecionado (ou ao botão que abriu, para "+ Novo" e "+ Horário extra"), e a coluna volta ao resumo.
  - Esc fecha a coluna quando o foco está dentro dela. Esc com o foco fora da coluna não faz nada.
  - Não há foco preso, `history.pushState` nem fundo inerte: a grade continua usável ao lado.
  - Depois de salvar, concluir, marcar falta, reabrir, fechar ou remover horário: volta ao resumo (mesmo `depoisDeSalvar` de hoje). Cancelar mantém a tela "Avisar no WhatsApp" até "Fechar".
- **Troca de conteúdo:** fade de 150ms; com menos movimento, sem animação.

**Abaixo de 1280px:** sem coluna lateral. O cartão Amanhã e o aviso de novos ficam acima da grade, como hoje; os detalhes abrem no `Painel` sobreposto, como hoje.

**Mudança de largura com algo aberto:** o estado `painel` da Agenda e o `<Painel>` são os mesmos nos dois modos (só muda `modo`), então o conteúdo passa da coluna para a folha (e vice-versa) sem perder o que foi digitado. Ao passar para `sobreposto` com algo aberto, o painel empurra a entrada no histórico nesse momento; ao passar para `lateral`, consome essa entrada (`history.back()`) como faria ao fechar.

## 5. Ajustes

- Topo: link "‹ Agenda" (para `/#/`) e o título "Ajustes" (o título continua nesta tela).
- Computador (≥ 1280px): duas colunas. Esquerda: Negócio, Horários (expediente e folgas) e o botão "Salvar configurações". Direita: Serviços, Clientes, Backup.
- Abaixo de 1280px: uma coluna, como hoje.
- Sem mudança de comportamento.

## 6. Visual

- Usa os tokens, fontes, botões e animações do redesign; nada novo.
- O `BackupBanner` continua acima da grade (fora da coluna lateral), em todas as larguras.
- Sem a navegação, o `body` não tem mais o recuo da barra lateral nem o espaço das abas; as regras `body:has(.abas)` saem.

## 7. Testes

- **Migrados de `tests/ui/AbaLink.test.tsx` para `tests/ui/CabecalhoAgenda.test.tsx`:** copiar com sucesso e com falha, chave grava `link_ativo` e recarrega, erro ao salvar volta o estado, chave desabilitada enquanto salva. Os testes de "Mandar no WhatsApp", "Ligue o link para divulgar" e "Próximos horários livres" saem com a funcionalidade.
- **Novos:**
  - Cabeçalho: nome do negócio; `aria-pressed` e nome acessível da chave nos dois estados; avisos de abrir e fechar; "Copiado ✓"; engrenagem aponta para `/config`.
  - App: sem `nav` de abas; `/#/link` redireciona para a agenda; a engrenagem leva a Ajustes e "‹ Agenda" volta.
  - `useTelaLarga` com stub de `matchMedia` (igual aos testes de `usePrefereMenosMovimento`).
  - `Painel` em `modo="lateral"`: `role="region"`, sem `aria-modal`, sem `pushState`, sem foco preso, Esc só com o foco dentro; trocar `modo` com o painel aberto não desmonta os filhos (um campo digitado mantém o valor).
  - Agenda na tela larga (stub de `matchMedia` com 1280px): clicar num horário mostra o conteúdo na região com o rótulo do conteúdo, sem `dialog` e sem `history.pushState`; o horário fica com `aria-current`; Esc dentro da coluna volta ao resumo e devolve o foco ao horário; "+ Novo" abre na coluna e o foco volta ao botão ao fechar.
  - Resumo: próximo cliente de hoje (hora, nome, "em N min"); sem próximo, a mensagem; cancelados e já passados não contam.
  - Mudança de largura com o formulário de novo agendamento aberto e um nome digitado: o nome continua lá.
  - Agenda abaixo de 1280px: tudo como hoje (os testes atuais cobrem).
- **Verificação visual:** prints em 1440×900 e 390×844, comparados com os do protótipo aprovado.

## 8. Ordem de implementação

1. `useTelaLarga`, `CabecalhoAgenda` (com os testes migrados da aba Link), rotas sem navegação, remoção de `Navegacao`, `AbaLink` e `mensagemDivulgar`.
2. Ajustes como tela própria com "‹ Agenda" e duas colunas.
3. `ResumoLateral` (próximo cliente, Amanhã, novos) e o layout em duas colunas.
4. `Painel` com `modo="lateral"` e a Agenda usando-o na tela larga: seleção, foco, Esc, troca de largura com algo aberto.
5. Polimento visual e prints.
