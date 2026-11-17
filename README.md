# Amana

*Amana* quer dizer "chuva" em tupi. Em Belém, a chuva da tarde é o alívio depois do mormaço; a Amana é o alívio de quem passa o dia respondendo "tem horário?" no WhatsApp.

Agenda online para pequenos negócios de serviço, como barbearias, salões e estúdios, feita para quem organiza tudo pelo celular, atendendo sozinho ou com uma equipe pequena.

O dono instala a agenda na tela de início do celular, como um aplicativo. O cliente recebe um link, escolhe o serviço, o dia e o horário e marca sozinho, sem baixar nada nem criar conta. Do outro lado, o dono vê o horário aparecer na agenda e conversa com o cliente pelo WhatsApp com mensagens já prontas.

## O que ela faz

**Para o dono**
- Agenda do dia e da semana, com os horários livres à mostra.
- Marcar, confirmar, concluir, editar e cancelar atendimentos, com mensagens de WhatsApp prontas para cada caso.
- Lembrete dos clientes de amanhã com um toque.
- Expediente por dia da semana (manhã e tarde, por exemplo), folgas, horários fechados e horários extras.
- Serviços com duração própria: um "Corte + barba" de 60 minutos ocupa uma hora inteira na agenda.
- Várias pessoas atendendo: cada uma com os serviços que faz, folgas próprias e agenda própria, com filtro por pessoa. Com uma pessoa só, nada disso aparece.
- Lista de clientes com busca e histórico.
- Backup automático toda semana no Google Drive, e backup manual quando quiser.

**Para o cliente, pelo link de agendamento**
- Escolhe o serviço, o dia e um horário em que esse serviço cabe por inteiro.
- Quando mais de uma pessoa faz o serviço, escolhe com quem, ou "Sem preferência".
- Informa só o nome e o WhatsApp.
- Nunca vê dados de outros clientes, só os horários livres.

## Como funciona por dentro

| Parte | Ferramenta |
|---|---|
| Aplicativo | React + TypeScript, empacotado com Vite e instalável como PWA |
| Banco, login e regras de acesso | Supabase (Postgres com RLS) |
| Hospedagem do site | Cloudflare, que publica cada mudança na `main` |
| Backup automático | Google Apps Script no Drive do próprio negócio |

Cada negócio tem tudo nas próprias contas (Google, Supabase, GitHub e Cloudflare). Não existe servidor central nem dado de um cliente misturado com o de outro.

As regras importantes ficam no banco, não só no aplicativo. A página pública não lê nenhuma tabela: ela só chama duas funções, `horarios_publicos()` e `agendar_publico()`. É no banco que se confere de novo se o horário está livre, se o serviço está ativo e se o pedido respeita os limites contra abuso (por IP, por WhatsApp e no total por hora). Assim, dois clientes nunca ficam com o mesmo horário, mesmo marcando ao mesmo tempo.

## Rodar no computador

Precisa de Node 22 ou mais novo.

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_NOME_NEGOCIO
npm run dev            # abre o app em modo de desenvolvimento
npm test               # roda todos os testes
npm run build          # gera o site em dist/
```

Para conferir o visual de todas as telas com dados de exemplo (sem Supabase de verdade), `node scripts/prints/tirar-prints.mjs <pasta>` sobe um Supabase falso e o app e tira prints a 360, 390 e 1280 px num Chromium headless (`NAVEGADOR=` escolhe o navegador; `PORTA_FALSO`, `PORTA_APP` e `PORTA_CDP` mudam as portas).

Os testes de banco usam o PGlite, um Postgres que roda dentro do próprio processo, com as mesmas migrações da produção. Não é preciso ter um Supabase para rodá-los.

## Organização do código

```
src/
  lib/        regras sem dependência de tela: horários livres, telefone, WhatsApp, backup
  data/       acesso ao Supabase
  ui/         telas do dono
  ui/publico/ página de agendamento do cliente
supabase/
  migrations/ esquema do banco, em ordem (0001, 0002, …)
  seed.sql    configuração inicial
apps-script/  backup automático no Google Drive
scripts/      restauração de backup
tests/        testes de regras, dados, banco e telas
docs/         guia de implantação e manual do cliente
```

## Mudanças no banco

Cada mudança no banco vira um arquivo novo em `supabase/migrations/`, numerado em sequência. Arquivos que já foram aplicados não são editados.

Para atualizar um projeto que já está no ar, rode no **SQL Editor** do Supabase só as migrações que ainda faltam, em ordem. Quando uma migração muda o que a página pública recebe ou envia, publique o site primeiro e aplique a migração depois. Assim, quem estiver com a página aberta não é pego no meio da troca.

A exceção é a `0006_pessoas.sql`: o app novo já lê as pessoas, então aplique a 0006 **antes** de publicar esta versão. O app e a página antigos continuam funcionando com o banco novo (os agendamentos sem pessoa vão para a primeira pessoa livre).

## Implantação e uso

- [Guia de implantação](docs/implantacao.md): passo a passo para colocar a agenda no ar para um novo negócio.
- [Manual do cliente](docs/manual-cliente.md): guia curto para o dono do negócio usar no dia a dia.

## Restaurar um backup

O backup é um arquivo JSON com clientes, serviços, pessoas (e quem faz cada serviço), agendamentos, configurações e horários fechados ou extras. Backups antigos, de antes das pessoas, também restauram: o script cria a pessoa única, como a migração 0006. Para colocá-lo de volta no banco:

```bash
SUPABASE_DB_URL='postgresql://postgres:SENHA@db.XXXX.supabase.co:5432/postgres' \
SUPABASE_CA_CERT=prod-ca-2021.crt \
  npx tsx scripts/restore.ts backup-agenda-AAAA-MM-DD.json
```

`SUPABASE_CA_CERT` é o certificado do Supabase (Project Settings → Database → SSL Configuration). Com ele, a conexão confere que está mesmo falando com o seu banco.

Se o banco já tiver dados, o script para e pede `--confirmar-substituir`. Essa opção apaga tudo antes de restaurar, então use só quando tiver certeza.
