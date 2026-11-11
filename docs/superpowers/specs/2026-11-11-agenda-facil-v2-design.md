# Agenda Fácil — Especificação v2 (link de agendamento)

Data: 2026-11-11
Status: aguardando revisão do autor
Base: `docs/superpowers/specs/2026-11-10-agenda-facil-design.md` (v1). Tudo da v1 continua valendo, exceto o que esta especificação muda.

## 1. Objetivo da mudança

Deixar o próprio cliente final marcar o horário por um link, sem o dono responder mensagem por mensagem. O dono divulga o link (status do WhatsApp, bio do Instagram, conversa) e só acompanha a agenda.

Mudanças em relação à v1:
- A "página pública para o cliente final agendar sozinho", que estava fora da v1, entra.
- O login do dono passa a ser **usuário e senha**. Saem o login com Google e o código por e-mail (o e-mail padrão do Supabase não manda código sem SMTP próprio).
- A conta Gmail do negócio serve só para as contas do negócio (Supabase, GitHub, Cloudflare) e para guardar o backup.
- Os horários passam a ser **ofertados pelo dono** em blocos de duração fixa. O serviço vira opcional.

## 2. Login do dono

- Tela com os campos **Usuário** e **Senha** e o botão **Entrar**.
- Por baixo, o usuário `joao` vira o e-mail `joao@dono.agenda` no Supabase Auth (endereço que nunca recebe mensagens). O app faz `signInWithPassword` com esse e-mail.
- O autor cria o usuário no painel do Supabase na implantação (Authentication → Users → Add user, com Auto Confirm), com senha de pelo menos 8 caracteres, e cadastra o UID em `donos`.
- Não existe "esqueci a senha": o autor troca a senha no painel.
- Erro de usuário ou senha: "Usuário ou senha incorretos." Erro de rede: a mesma mensagem de conexão da v1.

## 3. Horários ofertados

Um **horário** é um bloco com início e duração igual a `passo_min`, que na tela se chama "Duração de cada horário" (padrão 30 min).

Os horários ofertados de um dia são:
1. Para cada intervalo do expediente daquele dia da semana (se o dia não estiver em `folgas`), os inícios `inicio, inicio + passo, …` cujo bloco inteiro cabe no intervalo.
2. Mais os **horários extras** daquele dia (tabela `horarios_ajuste`, tipo `extra`), cada um um bloco de `passo_min` a partir do início cadastrado, mesmo fora do expediente ou em folga.
3. Menos os horários que se sobrepõem a um **horário fechado** (tipo `fechado`).

Um horário ofertado está **livre** quando não se sobrepõe a nenhum agendamento `marcado` ou `confirmado` (intervalos meio-abertos: encostar no fim de outro não é conflito).

Na página pública ainda valem:
- só horários com início ≥ agora + `antecedencia_min`;
- só dias de hoje até hoje + `dias_abertos` − 1 (hora local do negócio, `America/Sao_Paulo`).

A agenda do dono usa a mesma regra (sem antecedência mínima, como na v1) e mostra também os horários fechados.

## 4. Dados (migração `supabase/migrations/0002_link_publico.sql`)

Aplicada por cima da `0001`, sem apagar dados.

- `configuracoes` ganha:
  - `dias_abertos integer not null default 14 check (dias_abertos between 1 and 60)`
  - `link_ativo boolean not null default true`
  - `telefone_negocio text` (mesmo formato de `clientes.telefone`, opcional)
  - `modelo_cancelamento text not null default 'Oi {nome}, infelizmente não vou conseguir te atender {dia} às {hora}. Quer marcar outro horário? {link}'`
- Nova tabela `horarios_ajuste`: `id uuid`, `inicio timestamptz not null`, `tipo text not null check (tipo in ('fechado','extra'))`, `criado_em timestamptz`. Um `fechado` cobre o bloco `[inicio, inicio + passo_min)`. Único por (`inicio`, `tipo`).
- `agendamentos`:
  - `servico_id` passa a aceitar nulo;
  - ganha `origem text not null default 'dono' check (origem in ('dono','link'))`.
- Nova tabela `tentativas_publicas`: `id bigint generated always as identity`, `ip text not null`, `criado_em timestamptz not null default now()`, com índice em (`ip`, `criado_em`). Sem nome nem telefone.
- `clientes.telefone`: o check passa a aceitar `^[0-9]{8,15}$` (número internacional), mantendo a regra brasileira no app.
- RLS das tabelas novas: só o dono, como na v1 (`eh_dono()`). `tentativas_publicas` fica sem política nenhuma (só as funções públicas escrevem nela).

## 5. Telefone

- Começa com `+`: número internacional. Guarda só os dígitos (código do país + número), aceito com 8 a 15 dígitos. Exemplo: `+351 912 345 678` → `351912345678`.
- Sem `+`: regra brasileira da v1 (55 + DDD + número; sem DDD é recusado).
- Mensagem de erro: "WhatsApp inválido. Use DDD + número, ou + e o código do país."
- A mesma regra existe no app (TypeScript) e na função pública (SQL).

## 6. Funções públicas

São as únicas coisas que o papel `anon` pode executar. As tabelas continuam fechadas para quem não é o dono.

### `horarios_publicos() returns jsonb`

`security definer`. Devolve:

```json
{
  "nome_negocio": "Barbearia do João",
  "telefone_negocio": "5511987654321",
  "link_ativo": true,
  "horarios": ["2026-11-18T12:00:00Z", "2026-11-18T12:30:00Z"]
}
```

Com `link_ativo = false`, `horarios` vem vazio. Nunca devolve dado de cliente.

### `agendar_publico(nome text, telefone text, inicio timestamptz) returns jsonb`

`security definer`. Ordem das verificações; a primeira que falha devolve `{"ok": false, "erro": "<código>"}`:

1. `link_fechado`: `link_ativo = false`.
2. `dados_invalidos`: nome vazio ou com mais de 80 caracteres (depois de tirar espaços), ou telefone inválido pela regra da seção 5.
3. `limite`: 3 ou mais registros em `tentativas_publicas` do mesmo IP na última hora.
4. `horario_indisponivel`: `inicio` não está entre os horários livres de `horarios_publicos()`.

Se passar: apaga as `tentativas_publicas` com mais de 30 dias, registra a tentativa do IP, reaproveita o cliente pelo telefone (ou cria com o nome informado), grava o agendamento (`status 'marcado'`, `origem 'link'`, `servico_id` nulo, `fim = inicio + passo_min`) e devolve `{"ok": true, "inicio": "<timestamptz>"}`. Se a trava de sobreposição do banco disparar (duas pessoas ao mesmo tempo), devolve `horario_indisponivel`.

**IP do cliente:** vem do lado do servidor, do cabeçalho que o gateway do Supabase entrega à função em `current_setting('request.headers', true)`. Nunca de um valor enviado pela página. Qual cabeçalho é confiável (não forjável pelo cliente) será verificado no projeto real antes da entrega. Sem IP identificável, a tentativa conta no grupo `desconhecido`.

## 7. Página pública

Endereço: o site do app com `/#/agendar`. Não pede login nem instalação.

Fluxo:
1. Título com `nome_negocio`.
2. Fileira com os dias que têm horário livre, no formato "qua 18".
3. Ao tocar num dia, botões com os horários livres ("9h", "10h20").
4. Ao tocar num horário: campos **Nome** e **WhatsApp com DDD**, a linha "Seu nome e WhatsApp são usados só para este agendamento." e o botão **Confirmar horário**.
5. Sucesso: "Pronto, {nome}! Seu horário: {dia} {dd/mm} às {hora}." e o botão **Falar com a barbearia**, que abre `wa.me` do `telefone_negocio` com "Oi! Marquei {dia} {dd/mm} às {hora} pelo link." (o botão só aparece se `telefone_negocio` existir).

Mensagens:
- `horario_indisponivel`: "Esse horário acabou de ser ocupado. Escolha outro." e a lista é recarregada.
- `limite`: "Muitos agendamentos desta rede agora. Tente mais tarde ou chame no WhatsApp."
- `link_fechado`: "Agendamento online fechado no momento."
- sem horários: "Sem horários livres nos próximos dias."
- `dados_invalidos`: a mensagem do campo (nome ou WhatsApp).
- falha de rede ou projeto pausado: "Não foi possível carregar. Tente de novo em instantes." com o botão **Tentar de novo**.

Nos casos de link fechado, sem horários e limite, mostra também **Falar com a barbearia** (se houver `telefone_negocio`).

O cliente não desmarca pela página: desmarca pelo WhatsApp com o dono.

## 8. App do dono

- **Login:** seção 2.
- **Agenda:**
  - Grade com os horários da seção 3.
  - Tocar num horário livre oferece **Marcar cliente** e **Fechar este horário**.
  - Horário fechado aparece como "fechado"; tocar nele oferece **Reabrir**.
  - Botão **+ Horário extra** (data e hora) cria um `extra`.
  - Agendamentos com `origem = 'link'` mostram a etiqueta "pelo link".
  - Marcar na mão: serviço opcional. Sem serviço, ocupa `passo_min`. Com serviço, ocupa a duração dele.
  - No topo, "{n} agendamento(s) novo(s) pelo link" para os agendamentos `origem = 'link'` criados depois da última vez que o dono abriu a Agenda neste aparelho (guardado no `localStorage`). Some ao tocar.
- **Cancelar:** depois de cancelar, aparece **Avisar no WhatsApp**, que abre a conversa do cliente com `modelo_cancelamento` preenchido (`{nome}`, `{dia}`, `{hora}`, `{link}`).
- **Horários livres (texto):** novo marcador `{link}`; o modelo padrão do `seed.sql` passa a terminar com "Marque aqui: {link}". Instalações existentes mantêm o texto delas (o dono acrescenta `{link}` em Ajustes).
- **Ajustes:** "Duração de cada horário", "Quantos dias o link mostra", liga/desliga do link, WhatsApp do negócio, mensagem de cancelamento e o botão **Copiar link de agendamento**. Serviços continuam, como opcionais.
- **Sem notificação** de agendamento novo no celular nesta versão.

## 9. Testes

- **Banco (PGlite):**
  - regra de horários (expediente, almoço, folga, fechado, extra, ocupado, antecedência, virada de dia em São Paulo, `dias_abertos`, link desligado);
  - cada recusa de `agendar_publico`, o limite por IP (com o cabeçalho simulado) e a limpeza de 30 dias;
  - duas reservas no mesmo horário: só uma passa;
  - `anon` executa as duas funções, mas não lê nem escreve nenhuma tabela.
- **Concordância:** o mesmo cenário gera a mesma lista de horários em `horarios_publicos()` (SQL) e na função TypeScript da agenda do dono.
- **Telefone:** casos brasileiros da v1 e internacionais, iguais no TS e no SQL.
- **Telas:** página pública (sucesso, horário tomado, limite, link fechado, sem horários, sem conexão); login por usuário e senha; fechar, reabrir e extra na agenda; aviso de cancelamento; contador de novos pelo link.
- **Manual, no projeto real:** confirmar o cabeçalho de IP e o limite funcionando de verdade; login e link no iPhone.

## 10. Fora desta versão

Notificação de agendamento novo, desmarcar pelo próprio cliente, desafio anti-robô (Turnstile), escolha de serviço pelo cliente, vários profissionais.

## 11. Pontos em aberto

1. Qual cabeçalho do Supabase traz o IP verdadeiro do cliente (verificar no projeto real).
2. Termos do plano gratuito da hospedagem para uso comercial (já pendente na v1).
