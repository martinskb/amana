# Redesign visual do Agenda Fácil

Data: 2026-11-12 · Situação: aprovado em conversa, aguardando revisão desta especificação.

## 1. Objetivo

Dar ao Agenda Fácil uma identidade visual própria e animações expressivas, sem mudar nenhuma regra nem fluxo. O primeiro cliente é uma barbearia; o produto será vendido para qualquer negócio de serviço.

**Inspiração:** o site do Ziggur (fundo escuro quente, serifada elegante nos títulos, destaque couro). É inspiração, não cópia: paleta e fontes no mesmo espírito, com valores próprios.

**Critérios de sucesso**

- Todas as telas (dono, página pública, login, sem conexão) seguem a nova linguagem visual.
- Funciona e fica bom em qualquer aparelho e navegador: celular (Android e iPhone), tablet e computador.
- Todos os textos passam em WCAG AA; componentes interativos têm contraste ≥ 3:1.
- As 321 verificações automáticas atuais continuam passando (textos e papéis acessíveis dos botões não mudam, salvo onde esta especificação diz).
- Nenhuma dependência de biblioteca de animação.

**Fora do escopo:** tema claro, temas por cliente, cor de destaque configurável, mudanças de regra de negócio.

## 2. Decisões tomadas

| Decisão | Escolha |
|---|---|
| Tema | Sempre escuro, igual para todos os clientes |
| Plataforma | App web para qualquer aparelho; o iPhone não é referência |
| Animações | Nível expressivo, mas rápido nas ações frequentes |
| Técnica | CSS + hooks pequenos, sem biblioteca |
| Fontes | Playfair Display + Hanken Grotesk, embutidas via `@fontsource` (recorte latino) |

## 3. Tokens

Definidos como variáveis CSS em `:root`, em `src/ui/estilo.css` (ou `src/ui/tokens.css` importado por ele).

### Cores

| Token | Valor | Uso |
|---|---|---|
| `--fundo` | `#161412` | Fundo da página; fundo dos campos |
| `--sup` | `#211E1B` | Cartões, painéis, barra de navegação |
| `--sup2` | `#2C2824` | Estados de toque, chave desligada |
| `--borda` | `#3B3631` | Só divisórias decorativas |
| `--borda-i` | `#736A60` | Contorno de tudo que é interativo (campos, botões secundários, horário livre) |
| `--texto` | `#EDE6DC` | Corpo |
| `--sutil` | `#A39A8F` | Legendas, "livre", ajudas |
| `--creme` | `#E7D3B8` | Títulos, nome do negócio, etiqueta "pelo link" (contorno) |
| `--couro` | `#B9894F` | Botão principal, seleção, aba ativa, status marcado |
| `--couro-txt` | `#17120C` | Texto sobre couro e sobre perigo cheio |
| `--perigo` | `#F07470` | Cancelar, erros |
| `--sucesso` | `#7CC59A` | Check de sucesso, status confirmado/concluído |

Contrastes medidos: texto/fundo 14,8; sutil/sup 5,98; couro/fundo 5,91; couro-txt/couro 5,99; perigo/sup 5,87; couro-txt/perigo 6,59; borda-i/fundo 3,46; borda-i/sup 3,13.

**Regras:** branco nunca vai sobre `--perigo` (2,82). `--borda` nunca é o único indicador de um elemento interativo.

### Tipografia

- **Playfair Display 600** (e itálico 600): nome do negócio, títulos de tela e de seção, nome do cliente nos painéis, número do cartão "amanhã", confirmação do cliente. Só a partir de 20px.
- **Hanken Grotesk 400/500/600**: todo o resto. Corpo com 16px no mínimo (inclusive nos campos, para o iOS não dar zoom), texto sutil com 14px no mínimo, altura de linha 1,5.
- Horários usam `font-variant-numeric: tabular-nums`.

### Forma e espaço

- Raios: pílula (`999px`) em botões, fichas e etiquetas; 16px em cartões e painéis; 12px em campos.
- Área de toque mínima de 44×44px.
- Foco no teclado: `:focus-visible` com contorno de 2px `--couro` e afastamento de 3px.

## 4. Layout responsivo

| Largura | Navegação | Conteúdo |
|---|---|---|
| < 768px | Cabeçalho fixo com o nome do negócio; barra de abas embaixo com ícone e rótulo; indicador couro deslizante | Coluna única, margem lateral de 16px |
| ≥ 768px | Barra lateral de 220px à esquerda, com o nome do negócio no topo | Centralizado, no máximo 760px |
| ≥ 1100px | Igual | Semana em 7 colunas (até 1180px) |

### Semana em 7 colunas

Cada coluna é um cartão. Agendamento compacto: hora (sutil, 13px) em cima e nome inteiro embaixo, cortado com "…" se não couber; faixa de status à esquerda. Livres seguidos se agrupam em uma linha ("15:00–18:30 livre"), e tocar nela abre o primeiro horário do grupo. Dia sem expediente mostra "Fechado". No celular, a semana continua empilhada, com o mesmo cartão compacto.

## 5. Componentes

- **Botões:** `.pill` (secundário, `--sup` + `--borda-i`), `.pill.pri` (couro), `.pill.perigo` (texto perigo, só contorno), `.pill.perigo-cheio` (perigo + texto escuro), `.pill.zap` (verde escuro, para WhatsApp), `.red` (redondo de 44px para setas).
- **Controle segmentado** Dia/Semana com fundo couro deslizante.
- **Cartão de agendamento:** faixa de 4px colorida pelo status + hora + nome + serviço + selo de status com ícone **e** texto (marcado ⏱, confirmado ✓, concluído ✓, faltou ×). "pelo link" é uma etiqueta com contorno creme.
- **Horário livre:** borda tracejada `--borda-i`, texto sutil, "+" couro à direita.
- **Horário fechado:** listras diagonais sutis, hora riscada.
- **Cartão "Amanhã":** número grande em Playfair couro, texto e botão "Lembrar" com ícone de sino.
- **Chave liga/desliga** no lugar das caixas de marcar ("ativo" dos serviços, "Link ligado"), mantendo o `input type="checkbox"` por baixo (papel acessível `checkbox`, sem `role="switch"`, para não mudar o que leitores de tela e testes encontram).
- **Ícones** SVG embutidos em `src/ui/icones.tsx`: agenda, link, ajustes, WhatsApp, check, x, relógio, sino, setas, mais. Sem biblioteca.
- **Esqueleto de carregamento** com brilho, no lugar do "Carregando…".

## 6. Painéis sobrepostos

Hoje `Agenda.tsx` troca a tela inteira quando um painel abre (retornos antecipados). Passa a renderizar a agenda sempre, com o painel por cima.

- Novo componente `src/ui/Painel.tsx`: recebe `aberto`, `onFechar`, `titulo` e `children`.
  - Celular: folha que sobe de baixo, com alça, fundo escurecido.
  - ≥ 768px: painel centralizado de 480px.
  - Fecha ao tocar no fundo, com Esc e com o Voltar do navegador.
  - Ao abrir, faz `history.pushState`; o `popstate` fecha o painel. Fechar pelo botão faz `history.back()` para não deixar entrada sobrando.
  - Foco preso dentro do painel; o foco volta ao elemento que abriu ao fechar.
  - Rolagem do fundo travada enquanto aberto.
  - Mantém `role="dialog"` e `aria-label`, como hoje.
- Painéis migrados: detalhes, novo/editar, horário livre, fechado, horário extra. Os lembretes de amanhã continuam se abrindo dentro do próprio cartão "Amanhã", com animação de desdobrar.
- **Painel de detalhes:** ação principal em largura total; Concluir, Faltou, Editar e WhatsApp numa grade de 2 colunas; Cancelar agendamento separado no rodapé, com a confirmação já implementada ("Cancelar o horário de X?", "Sim, cancelar" / "Não").

## 7. Telas

- **Login:** centralizado, nome do negócio em Playfair 40px, subtítulo "Entre para ver sua agenda", formulário em cartão.
- **Agenda:** título "Agenda" em Playfair; controles; cartão "Amanhã"; banner de backup no mesmo estilo de cartão, com ícone; grade do dia ou semana.
- **Link:** URL em campo somente leitura, "Mandar no WhatsApp" (zap) e "Copiar link" (vira "Copiado ✓" por 2s), chave "Link ligado", próximos horários livres como pílulas.
- **Ajustes:** seções em cartões com título Playfair (Negócio, Expediente, Folgas, Serviços, Clientes, Backup). Campos de Negócio em 2 colunas a partir de 768px. Intervalos do expediente como etiquetas com ×.
- **Página pública:**
  - Nome do negócio em Playfair 40px e subtítulo.
  - Fichas de dia (dia da semana pequeno + número grande) roláveis na horizontal. No celular, degradê na borda direita; a partir de 768px, setas.
  - Horários em grade de pílulas.
  - O formulário aparece depois de escolher o horário, com uma linha de resumo acima ("Sexta, 13/11 às 14:30") e o botão "Confirmar horário" (texto atual mantido).
- **Sucesso:** check verde em círculo, título *"Pronto, Nome!"* em Playfair itálico e, abaixo, "Seu horário: qua 18/11 às 9h." em cartão; o conjunto fica dentro do `role="status"`. O teste que procura a frase inteira passa a procurar o título e a linha do horário separadamente.
- **Sem conexão, erro e link fechado:** mensagem centralizada em cartão, com o mesmo estilo.

## 8. Animações

Só `transform` e `opacity` (e `stroke-dashoffset` no check). Curva padrão `cubic-bezier(.2,.8,.2,1)`.

| Nível | Duração | Onde |
|---|---|---|
| Rápido | 120–200ms | Toque (escala 0,97), troca de dia (desliza 24px na direção ‹ ou › + fade, sem cascata), segmentado, chaves, indicador de aba |
| Médio | 250–350ms | Painel abre (300ms) e fecha (200ms); troca de aba (fade + 8px); formulário público se desdobra; itens de lista entram e saem |
| Expressivo | 500–900ms | Check de sucesso (círculo, depois o traço, 700ms) seguido do título; contador "Amanhã" (600ms); entrada da página pública em sequência |

- Cascata (20ms por item, no máximo 200ms no total) só na primeira carga de cada tela.
- Erro: o campo treme (3 oscilações, 300ms).
- Hooks em `src/ui/animacao.ts`:
  - `useSaida(aberto, ms)`: mantém o elemento montado até a animação de saída terminar.
  - `useContador(alvo, ms)`: conta até o valor com `requestAnimationFrame`.
  - `usePrefereMenosMovimento()`: lê o `matchMedia`.
- **`prefers-reduced-motion: reduce`:** tudo vira fade de no máximo 150ms; sem deslizar, sem cascata, sem tremor; o contador mostra o valor final; o check aparece pronto.

## 9. Testes

- Os 321 testes atuais devem continuar passando. Se um teste depender da estrutura antiga dos painéis (tela inteira trocada), ele é atualizado sem perder o que verifica.
- Novos testes automáticos:
  - Painel: Esc fecha; clicar no fundo fecha; `popstate` fecha; foco vai para dentro ao abrir e volta ao fechar.
  - Chaves: continuam encontráveis como `checkbox` com o mesmo nome acessível ("Link ligado", "Corte ativo").
  - Semana: agrupamento de livres seguidos ("10:00–10:30 livre"); tocar no grupo abre o primeiro horário.
  - `useContador` e `useSaida` com tempo falso; com menos movimento, o contador começa no valor final.
- Verificação visual: prints T1–T7 em 1280px e 390px, num navegador sem extensões, comparados ao protótipo aprovado.
- Verificação manual em navegador: navegação por teclado (Tab, Esc), Voltar do Android ou do navegador fecha painel, menos movimento ligado.

## 10. Desempenho

- Fontes `@fontsource` só com o recorte latino, `font-display: swap`, cerca de 60 KB no total, incluídas no cache do PWA.
- Nenhuma animação de `width`, `height` ou `top`; desdobramentos usam `grid-template-rows: 0fr → 1fr`.
- `will-change` só durante a animação.

## 11. Ordem de implementação

1. Tokens, fontes e estilos base.
2. Navegação responsiva (abas e barra lateral) e ícones.
3. Componente `Painel` e migração dos painéis da Agenda.
4. Telas: Agenda (dia e semana), Link, Ajustes, Login, página pública, sucesso e estados de erro.
5. Animações e hooks.
6. Polimento: acessibilidade, menos movimento, prints de verificação.

## Protótipo de referência

Protótipo estático e prints usados na aprovação (fora do repositório, descartáveis): `tela.html` e `comparar.html` no rascunho da sessão, prints T1–T7.
