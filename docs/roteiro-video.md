# Roteiro do vídeo de apresentação da Amana

**Formato:** vertical 9:16 (Reels, Status do WhatsApp, TikTok), cerca de 2 min. A gravação é toda no celular; o computador aparece numa cena só.
**Para quem é:** dono de barbearia, salão ou estúdio que hoje marca tudo pelo WhatsApp.
**A ideia:** a Amana é a chuva da tarde em Belém, o alívio de quem vive afogado em mensagens. O vídeo começa no aperto e termina na chuva.

---

## Antes de gravar

**Dados de demonstração.** Já estão no banco. São 3 pessoas (Zé, Rafa e Bia), 14 clientes com nomes de Belém e uns 25 agendamentos entre hoje e os próximos 5 dias. Alguns entraram "pelo link".
- Gravar em outro dia: rode `scripts/demo/demo-popular.sql` no SQL Editor de novo, que ele remonta tudo em volta do dia novo.
- Depois do vídeo: rode `scripts/demo/demo-limpar.sql`. Ele apaga só a demo; o que você já tinha fica intacto.
- Melhor horário para gravar: entre 15h e 16h. Assim a manhã aparece como "concluído", tem um "faltou", e a linha do "agora" fica no meio do dia.

**Celular.**
- Instale a Amana na tela inicial (Ajustes → Tela inicial → "Adicionar à Tela de Início"), para gravar com cara de aplicativo, sem a barra do navegador.
- Coloque em modo não perturbe, deixe o brilho no máximo e a bateria acima de 50% (aparece na gravação).
- Para as cenas do cliente, use um segundo celular ou uma aba anônima com o link público.

**Identidade visual na edição.**

| Elemento | Uso no vídeo |
|---|---|
| Fundo `#121012` (quase preto, levemente roxo) | Fundo de todas as cartelas e transições. Nada de branco. |
| Roxo açaí `#B272DE` | Destaques, palavra-chave de cada cartela, a gota. Uma cor de destaque só. |
| Texto `#F3EEE9` e títulos `#EFE3F6` | Letreiros. |
| **Bricolage Grotesque**, peso 800, letras juntas (−0,04em) | Títulos e cartelas. É a fonte do logo e do app. |
| *Caveat* (à mão), em roxo, levemente inclinada (−2° a −3°) | Só nos momentos de respiro, como o app faz ("aproveita a chuva", a tela de "marcado!"). No máximo 3 vezes no vídeo. |
| Logo "amana" com a gota no lugar do ponto | Abertura e fechamento. |
| Chuva (riscos finos caindo, como no topo do link do cliente) | Transições entre blocos e o fundo do fechamento. |

**Som.** Abre com notificações de WhatsApp empilhando e termina com chuva de verdade (gravação de chuva de Belém, se conseguir), com um lo-fi calmo por baixo da narração.

---

## Cenas

### 1. O aperto (0:00–0:10)
- **Imagem:** close de um celular com o WhatsApp lotado: "tem horário amanhã?", "consegue 15h?", "posso trocar pra sexta?". As mensagens sobem rápido. Pode ser encenado num celular qualquer, sem mostrar nenhum número real.
- **Som:** os "plim" do WhatsApp se acumulando.
- **Narração:** "Se o seu dia é responder 'tem horário?' no WhatsApp…"
- **Cartela:** fundo `#121012`, em Bricolage 800: "tem horário?" repetido, cada vez maior.

### 2. A chuva (0:10–0:18)
- **Imagem:** a tela escurece para `#121012`, a chuva cai, a gota roxa pinga e forma o logo **amana**.
- **Som:** os "plim" param e entra o barulho de chuva.
- **Narração:** "…deixa a Amana cuidar disso. Amana quer dizer chuva em tupi: aquela chuva da tarde que alivia o dia."
- **Cartela (Caveat, roxo):** "respira."

### 3. A agenda do dia (0:18–0:35), no celular
- **Gravar:** abrir a Amana pelo ícone da tela inicial e cair direto na agenda de hoje.
- **Mostrar:**
  - os clientes do dia em linha do tempo;
  - a linha do **agora**;
  - os de manhã marcados como "concluído" e o que "faltou";
  - o **próximo cliente** em destaque.
- **Ação:** rolar devagar, tocar num cliente e abrir o detalhe (serviço, horário, quem atende). Fechar.
- **Narração:** "Abriu, tá tudo ali: quem vem, a que horas, o que vai fazer. E quem já passou."
- **Letreiro:** "seu dia, num olhar"

### 4. Cada um com a sua agenda (0:35–0:47)
- **Gravar:** tocar no filtro de pessoas e alternar entre **Zé**, **Rafa** e **Bia**. Mostrar os horários livres de cada um ("livre · Rafa · Bia").
- **Ação:** passar para a **semana** com a chave "dia | semana".
- **Narração:** "Tem equipe? Cada profissional com seus horários, seus serviços, suas folgas."
- **Letreiro:** "Zé · Rafa · Bia"

### 5. O cliente marca sozinho (0:47–1:10), segundo celular ou aba anônima
- **Gravar:** abrir o link público do negócio. A chuva cai no topo.
- **Ação, devagar:**
  1. escolher o serviço ("Corte + barba"), com o ✓ aparecendo;
  2. escolher **com quem** (Rafa ou "Sem preferência");
  3. escolher o dia e o horário;
  4. digitar nome e WhatsApp;
  5. confirmar.
- **Momento de respiro:** a tela de sucesso, com o texto à mão. Segure 2 segundos.
- **Narração:** "Você manda o link uma vez. O cliente escolhe o serviço, com quem, o dia e o horário, e pronto. Sem conversa, sem horário marcado duas vezes."
- **Letreiro:** "o link faz o atendimento"
- **Rodapé visível:** "agendado com amana". Enquadre para aparecer.

### 6. Chegou pelo link (1:10–1:20), de volta no celular do dono
- **Gravar:** voltar à agenda. O agendamento novo aparece com o aviso **"Pelo link"** / novos na agenda.
- **Narração:** "E cai direto na sua agenda. Você só fica sabendo."

### 7. WhatsApp sem digitar (1:20–1:35)
- **Gravar:**
  - **lembrete:** no cartão **Amanhã**, tocar em **Lembrar**. O WhatsApp abre com a mensagem pronta ("Oi Marcos! Passando para lembrar do seu horário amanhã…"). Mostre só a mensagem montada; não envie para número real.
  - **horários livres:** copiar a lista de livres e mostrar ela pronta para colar no Status.
- **Narração:** "Lembrete pro cliente de amanhã? Um toque. Postar os horários livres no Status? Já vem escrito."
- **Letreiro:** "um toque, mensagem pronta"

### 8. A equipe vê a própria agenda (1:35–1:45)
- **Gravar:** Ajustes → Pessoas → Rafa → **Criar link** → **Copiar link**. Abrir o link: a página da Rafa com "hoje" e "amanhã".
- **Narração:** "Cada profissional ganha um link só dele, com os clientes de hoje e amanhã. Sem senha, sem mexer em nada. E você corta quando quiser."

### 9. No computador também (1:45–1:53), única cena horizontal
- **Gravar:** a mesma agenda aberta no computador (tela cheia, 1280 px ou mais), com o menu lateral e o resumo do dia ao lado. Pode ser gravação da tela ou o celular filmando o monitor no balcão.
- **Edição:** a tela do PC entra encaixada num quadro no meio do vídeo vertical, com bordas `#121012`.
- **Narração:** "No balcão, abre no computador: mesma agenda, tudo sincronizado."
- **Letreiro:** "celular e computador"

### 10. Tranquilidade (1:53–2:03)
- **Gravar, cortes rápidos de 1 s cada:**
  - Ajustes (expediente com manhã e tarde, serviços, folgas);
  - o backup automático no Google Drive;
  - a agenda continuando a abrir sem internet ("Sem conexão" mostrando a última agenda).
- **Narração:** "Você ajusta expediente, serviços e folgas. Tem backup toda semana no seu Google Drive. E, se a internet cair, a agenda continua ali."

### 11. Fechamento (2:03–2:12)
- **Imagem:** fundo `#121012`, a chuva caindo, o logo **amana** com a gota roxa no centro.
- **Cartela (Caveat, roxo):** "aproveita a chuva". É a mesma frase do dia livre no app.
- **Linha final (Bricolage):** "Amana · agenda para quem atende" e o seu contato (WhatsApp ou @).
- **Som:** só chuva, diminuindo até o silêncio.

---

## Narração completa, para gravar de uma vez

> Se o seu dia é responder "tem horário?" no WhatsApp… deixa a Amana cuidar disso. Amana quer dizer chuva em tupi: aquela chuva da tarde que alivia o dia.
>
> Abriu, tá tudo ali: quem vem, a que horas, o que vai fazer. E quem já passou.
>
> Tem equipe? Cada profissional com seus horários, seus serviços, suas folgas.
>
> Você manda o link uma vez. O cliente escolhe o serviço, com quem, o dia e o horário, e pronto. Sem conversa, sem horário marcado duas vezes. E cai direto na sua agenda.
>
> Lembrete pro cliente de amanhã? Um toque. Postar os horários livres no Status? Já vem escrito.
>
> Cada profissional ganha um link só dele, com os clientes de hoje e amanhã. E você corta quando quiser.
>
> No balcão, abre no computador: mesma agenda, tudo sincronizado.
>
> Backup toda semana no seu Drive, e funciona até sem internet.
>
> Amana. Aproveita a chuva.

(Uns 170 palavras, ou cerca de 1 min 40 s em ritmo calmo. O resto do tempo é respiro e música.)

---

## Cuidados

- **Nada de dado real na tela.** Use só os clientes da demo, que têm telefones fictícios terminados em 99999-00xx. Não envie WhatsApp para eles; mostre só a mensagem montada.
- **Não mostre o SQL Editor nem a URL do Supabase** no vídeo. O link do cliente pode aparecer.
- **Não feche o link da Rafa** depois da cena 8 se ainda for regravar. O "Trocar link" mata o anterior.
- **Depois de gravar:** rode `scripts/demo/demo-limpar.sql`. O link criado na cena 8 some junto com a Rafa.
