# Agenda Fácil (nome provisório) — Especificação v1

Data: 2026-11-10
Status: aguardando revisão do autor

## 1. Objetivo

Vender uma solução simples de agenda para pequenos negócios de serviço (começando por um barbeiro/cabeleireiro), implantada nas contas do próprio cliente, de modo que o autor **não hospede nem pague por nada** depois da entrega. A meta de negócio do autor é chegar a pelo menos um salário mínimo por mês trabalhando de casa.

Princípios:
- Baixo risco jurídico: sem nota fiscal, sem pagamentos, dados mínimos.
- O cliente é dono dos dados e das contas.
- Mesmo código para todos os clientes; só a configuração muda.
- Funciona no iPhone, sem conta de desenvolvedor Apple (PWA).

## 2. Cliente-piloto e problema observado

- Cliente-piloto: um barbeiro/cabeleireiro masculino (corte de cabelo e barba) que atende no salão da mãe dele, onde o autor já é cliente. O profissional atende e agenda tudo pelo iPhone, sem computador.
- Foco deliberado em **um único cliente**: a v1 é construída e validada só para ele. Vender para outros salões fica para depois, se o piloto funcionar.
- Fluxo atual: ele avisa nos status do WhatsApp que a agenda está aberta; clientes mandam mensagem pedindo horário; ele responde manualmente com os dias e horários livres.
- Dor: demora para responder e trabalho manual repetido a cada pedido.
- Premissas ainda a validar (ver seção 13): que ele usa só iPhone; como ele controla a agenda hoje (caderno, memória, outro app).

## 3. Escopo da v1

Dentro:
1. Agenda da semana (grade de horários).
2. Marcar, editar, cancelar e concluir agendamentos.
3. Botão "Horários livres": gera texto pronto para colar no status ou na resposta do WhatsApp.
4. Lembretes de amanhã: lista de clientes com horário amanhã e botão que abre o WhatsApp com a mensagem pronta.
5. Cadastro automático de clientes (nome e telefone) ao marcar.
6. Configurações: expediente por dia da semana, folgas, serviços e duração, modelos de mensagem.
7. Backup manual com botão "Baixar backup" e lembrete semanal.

Fora (v1):
- Página pública para o cliente final agendar sozinho (extra pago futuro).
- Bot de WhatsApp (automação não oficial viola os termos do WhatsApp e arrisca banir o número do cliente).
- Nota fiscal, pagamentos, relatórios, preços por serviço, múltiplos profissionais, prontuário ou dados de saúde.

## 4. Telas e funções

1. **Login**: entrada do dono por conta Google ou link por e-mail (um único usuário).
2. **Agenda**: visão do dia e da semana; toque em horário livre abre "Novo agendamento"; toque em agendamento abre detalhes (mudar status, cancelar, abrir WhatsApp do cliente).
3. **Novo agendamento**: cliente (busca ou novo), serviço, data e hora, observação. Bloqueia horário que conflite com outro ativo.
4. **Horários livres**: escolher período (hoje, amanhã, semana) e serviço; mostra o texto gerado, editável, com botões "Copiar" e "Abrir WhatsApp".
5. **Lembretes de amanhã**: lista com um botão por cliente que abre `wa.me` com a mensagem preenchida.
6. **Clientes**: lista com busca; histórico simples de atendimentos.
7. **Configurações**: expediente, folgas, serviços, modelos de mensagem, nome do negócio, botão "Baixar backup".

Aviso na tela inicial quando o último backup tiver mais de 7 dias.

## 5. Dados (Supabase, projeto do cliente)

Tabelas:

- `clientes`: `id`, `nome`, `telefone` (somente dígitos, com 55 + DDD), `criado_em`.
- `servicos`: `id`, `nome`, `duracao_min`, `ativo`.
- `agendamentos`: `id`, `cliente_id`, `servico_id`, `inicio` (timestamptz), `fim` (timestamptz), `status` (`marcado`, `confirmado`, `cancelado`, `concluido`, `faltou`), `observacao`, `criado_em`.
  - Restrição de banco que impede sobreposição entre agendamentos ativos (`marcado`, `confirmado`), para evitar horário duplicado mesmo com erro de tela.
- `configuracoes` (uma linha): `nome_negocio`, `fuso` (padrão `America/Sao_Paulo`), `expediente` (por dia da semana, lista de intervalos), `folgas` (lista de datas), `passo_min` (grade de horários, padrão 30), `antecedencia_min` (padrão 60), `modelo_livres`, `modelo_lembrete`, `ultimo_backup`.

Dados coletados dos clientes finais: apenas nome e telefone (minimização de dados, LGPD).

## 6. Lógica de horários livres

Para cada dia do período pedido:
1. Pegar os intervalos de expediente do dia da semana; pular dias em `folgas`.
2. Subtrair agendamentos ativos.
3. Gerar horários em passos de `passo_min` que caibam a duração do serviço escolhido.
4. Descartar horários que já passaram ou que estejam a menos de `antecedencia_min` de agora.
5. Agrupar por dia e formatar com o modelo, por exemplo: "Esta semana tenho: ter 14h, 15h; qua 10h, 11h30".

Fuso sempre explícito (`America/Sao_Paulo`). Funcionar em hora local do negócio, nunca em UTC cru.

## 7. Arquitetura e implantação

- **Front-end**: PWA (manifest + ícone), aberto no Safari e adicionado à Tela de Início. Biblioteca de cliente: `supabase-js`. Framework a decidir no plano de implementação (preferência por algo leve, como Vite com React ou Svelte; Flutter Web é pesado para PWA).
- **Backend**: Supabase na conta do cliente (Postgres, Auth, regras de segurança por linha).
- **Hospedagem do site**: conta do cliente em Cloudflare Pages ou Vercel (verificar os termos do plano gratuito para uso comercial antes de escolher), ligada ao repositório do cliente.
- **Repositório**: um repositório-modelo do autor; para cada cliente cria-se uma cópia na conta GitHub dele, e o autor entra como colaborador apenas quando houver suporte contratado.
- **Configuração por variáveis de ambiente**: URL e chave pública do Supabase, nome do negócio. Nenhuma chave secreta no repositório.
- **Esquema do banco** versionado em arquivos SQL no repositório-modelo, aplicados uma vez no projeto do cliente.

## 8. Segurança e privacidade

- Row Level Security ativado em todas as tabelas; somente o usuário autenticado (dono) lê e escreve.
- Autenticação com verificação em duas etapas ativada nas contas do cliente (Google, GitHub, Supabase, hospedagem).
- Apenas nome e telefone dos clientes finais; nada de dado sensível.
- Credenciais ficam com o cliente. O autor não guarda senhas dele.

## 9. Backup e restauração

- Sem hospedagem do autor e sem backup automático no plano gratuito do Supabase: o backup é feito pelo próprio sistema.
- Botão "Baixar backup": exporta as quatro tabelas em um arquivo (JSON) e salva no iCloud ou Drive pelo menu de compartilhamento do iPhone.
- Lembrete na tela inicial se `ultimo_backup` > 7 dias.
- Restauração: script documentado do repositório-modelo; testar a restauração completa antes de cada entrega.
- Observação sobre pausa: projetos gratuitos do Supabase pausam após cerca de uma semana sem uso. O manual explica como reativar no painel (1 clique); uso diário evita a pausa.

## 10. Fluxo de implantação por cliente

1. Cliente cria ou confirma uma conta Google dedicada ao negócio.
2. Criar conta Supabase e projeto (login com Google); aplicar o esquema SQL e a configuração inicial.
3. Criar conta GitHub; copiar o repositório-modelo.
4. Criar conta Cloudflare Pages ou Vercel; conectar à cópia do repositório; definir as variáveis de ambiente.
5. Cadastrar o dono como usuário; ativar verificação em duas etapas.
6. Configurar expediente, serviços e modelos de mensagem.
7. No iPhone do cliente: abrir o link, adicionar à Tela de Início, testar login, agendar, gerar horários livres e fazer um backup com restauração.
8. Entregar o manual de uma página.

## 11. Modelo comercial e contrato

- Cobrança: implantação única; suporte e atualizações como mensalidade opcional. Valores a definir após validar com o primeiro cliente (referência inicial: implantação em torno de R$ 400 a R$ 700 e suporte de R$ 50 a R$ 100 por mês).
- Pontos do contrato (revisar com advogado ou modelo confiável):
  - Descrição do que o sistema faz e do que não faz (sem nota fiscal, sem pagamentos).
  - Implantação única, sem garantia de funcionamento contínuo, pois serviços e contas são do cliente e dos fornecedores.
  - Limitação de responsabilidade ao valor pago.
  - Cliente responsável por manter as contas ativas, pelos backups e pela segurança das senhas.
  - Código continua sendo do autor; cliente recebe licença de uso.
  - Aprovação do escopo registrada por escrito (guardar a conversa).
- Contato inicial por mensagem (Instagram ou WhatsApp), com apresentação do autor por texto quando houver interesse.

## 12. Testes

- Cálculo de horários livres: expediente, folgas, conflitos, duração do serviço, antecedência mínima, fuso.
- Conflito de agendamento: tentativa de sobreposição rejeitada pelo banco.
- Geração dos links de WhatsApp (formatação do telefone e codificação do texto).
- Exportação e restauração de backup, ponta a ponta.
- Teste real no iPhone: instalação na Tela de Início, persistência do login depois de dias sem abrir.

## 13. Pontos em aberto

1. Confirmar que o profissional usa só iPhone e como ele controla a agenda hoje.
2. Escolher o framework do front-end e a hospedagem (Cloudflare Pages ou Vercel), conforme os termos do plano gratuito.
3. Definir o nome definitivo do produto.
4. Validar preços com o cliente-piloto.
5. Verificar se o login permanece ativo no PWA do iPhone depois de vários dias sem uso.
6. Como o salão é da mãe dele, confirmar quem é o cliente (quem decide e quem paga) e em nome de quem ficam o contrato e as contas.
