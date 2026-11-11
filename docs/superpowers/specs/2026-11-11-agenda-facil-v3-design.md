# Agenda Fácil — Especificação v3 (app do dono mais simples)

Data: 2026-11-11
Status: aguardando revisão do autor
Base: v1 (`2026-11-10-agenda-facil-design.md`) e v2 (`2026-11-11-agenda-facil-v2-design.md`). Tudo continua valendo, exceto o que esta especificação muda.

## 1. Objetivo

Deixar o app do dono mais simples, com o link de agendamento em destaque:
- só **3 abas**: Agenda, Link e Ajustes;
- o **link** fica fácil de achar e de divulgar;
- o dono **não edita mensagens**: elas são prontas e padronizadas.

Fora desta versão: backup automático no Google Drive (próximo ciclo) e o design visual.

## 2. Abas

A barra inferior tem exatamente três abas: **Agenda** (`/`), **Link** (`/link`) e **Ajustes** (`/config`).

Os endereços antigos redirecionam: `/livres` → `/link`, `/lembretes` → `/`, `/clientes` → `/config`. Qualquer outro endereço desconhecido vai para `/`.

### 2.1 Agenda

De cima para baixo:
1. O aviso "N agendamento(s) novo(s) pelo link" (v2, sem mudança).
2. O cartão **Amanhã**:
   - Mostra "Amanhã: N cliente(s)", contando só os agendamentos `marcado` e `confirmado` de amanhã em hora local.
   - Sem agendamentos, mostra "Amanhã: nenhum cliente" e nenhum botão.
   - O botão **Lembrar** abre a lista de amanhã: um item por cliente, com hora e nome, e um botão **WhatsApp** com a mensagem "Lembrar" (seção 3). O botão **Voltar** fecha a lista.
3. A grade do dia ou da semana, com marcar, fechar, reabrir e horário extra (v2, sem mudança).

### 2.2 Link

1. O título "Seu link de agendamento" e o endereço escrito por inteiro (`linkAgendamento()`).
2. O botão **Mandar no WhatsApp**: abre `waLink(null, mensagem "Divulgar")`, para o dono escolher entre o status ou uma conversa.
3. O botão **Copiar link**: copia o endereço e mostra "Link copiado!". Se o navegador recusar, mostra "Não deu para copiar. O link é: {link}".
4. A chave **"Link ligado"**: grava `link_ativo` na hora em que muda. Desligada, mostra "O link está fechado: quem abrir verá 'Agendamento online fechado no momento.'"
5. O resumo "Próximos horários livres:" com até 8 horários, no formato da v1 (`formatSlotsMessage` com o modelo `{horarios}`). Usa a mesma regra do link público (`freeSlots` com os ajustes, de `diasDoLink(agora)`), para mostrar o que o cliente vai ver. Com o link desligado, o resumo não aparece.

### 2.3 Ajustes

Seções, nesta ordem:
1. **Negócio**: nome e WhatsApp do negócio.
2. **Horários**: duração de cada horário, quantos dias o link mostra, expediente e folgas.
3. **Serviços** (v1/v2, sem mudança).
4. **Clientes**: a busca e o histórico da antiga aba Clientes, sem mudança de comportamento.
5. **Backup** (sem mudança).

A seção Mensagens sai, junto com os campos de modelo. A chave do link sai daqui e vai para a aba Link. O botão **Salvar configurações** salva as seções 1 e 2.

## 3. Mensagens prontas

O dono não edita nenhum texto. Formatos:
- **dia** por extenso e em minúsculas: domingo, segunda-feira, terça-feira, quarta-feira, quinta-feira, sexta-feira, sábado;
- **dd/mm** com dois dígitos;
- **hora** no formato da v1: `9h`, `9h30`, `14h`.

| Nome | Texto exato |
|---|---|
| Confirmar | `Olá, {nome}! ✅ Seu horário está confirmado: {dia} ({dd/mm}) às {hora}. Até lá!` |
| Lembrar | `Olá, {nome}! 👋 Passando para lembrar do seu horário amanhã, {dia} ({dd/mm}), às {hora}. Até lá!` |
| Cancelar | `Olá, {nome}. Infelizmente não vou conseguir te atender {dia} ({dd/mm}) às {hora}. Me desculpe! Para marcar outro horário: {link}` |
| Divulgar | `📅 Agenda aberta! Escolha seu horário aqui: {link}` |

`{nome}` é o nome do cliente como está no cadastro. `{link}` é `linkAgendamento()`.

## 4. Onde as mensagens aparecem

- **Confirmar:**
  - Nos detalhes de um agendamento `marcado`, o botão **Confirmar** é trocado por **Confirmar no WhatsApp**. Ele muda a situação para `confirmado` e, se der certo, abre o WhatsApp do cliente com a mensagem. Se a mudança falhar, mostra o erro da v1 e não abre nada.
  - Logo depois que o dono marca um cliente na mão, aparece um painel "Agendamento marcado" com o botão **Mandar confirmação no WhatsApp**, que abre a mensagem sem mudar a situação, e o botão **Fechar**.
- **Lembrar:** a lista do cartão Amanhã (seção 2.1).
- **Cancelar:** o botão **Avisar no WhatsApp**, depois de cancelar (v2), agora com o texto fixo.
- **Divulgar:** a aba Link.

## 5. Dados

Nenhuma mudança no banco. As colunas `modelo_livres`, `modelo_lembrete` e `modelo_cancelamento` continuam existindo e indo para o backup, mas o app não as lê nem grava mais.

## 6. Testes

- **Mensagens:** as quatro, com os valores exatos da seção 3. Inclui um domingo, um sábado, uma hora quebrada (`9h30`) e uma data de outro mês, conferindo `dd/mm`.
- **Agenda:**
  - o cartão Amanhã conta só `marcado`/`confirmado` de amanhã em hora local (23:30 de São Paulo já é o dia seguinte em UTC);
  - a lista tem um link de WhatsApp por cliente com a mensagem Lembrar;
  - "Confirmar no WhatsApp" chama `mudarStatus(..., 'confirmado')` e só depois mostra o link com a mensagem; com falha, não mostra;
  - depois de marcar na mão, aparece "Mandar confirmação no WhatsApp" com a mensagem certa.
- **Link:**
  - o endereço aparece por inteiro;
  - Copiar chama `navigator.clipboard.writeText(link)`;
  - Mandar no WhatsApp usa `waLink(null, mensagem Divulgar)`;
  - a chave grava `link_ativo` com `saveConfig` e recarrega a configuração;
  - o resumo traz os mesmos horários de `freeSlots` com os ajustes e some com o link desligado.
- **Navegação:** só três abas; `/livres`, `/lembretes` e `/clientes` levam às abas novas.
- **Ajustes:** não tem mais a seção Mensagens nem a chave do link; Clientes funciona dentro de Ajustes (busca e histórico).
- Os testes das telas que somem (Horários livres, Lembretes, Clientes) são migrados para as telas novas, não apagados.
