#!/usr/bin/env bash
# Prints das telas públicas (página de agendamento e login) em 1280×800 e 390×844, num Chromium
# headless com perfil temporário e sem extensões (extensões como Night Eye alteram as cores), com
# "reduzir movimento" ligado: os prints também mostram que nada fica invisível nesse modo.
# As telas do dono precisam de login: confira-as no navegador (ver docs/superpowers/plans/2026-11-12-redesign-visual.md, Task 8).
#
# Uso: scripts/prints.sh <pasta-de-saída>   (NAVEGADOR=brave|chromium|google-chrome, padrão brave)
set -euo pipefail

SAIDA=${1:?uso: scripts/prints.sh <pasta-de-saída>}
NAVEGADOR=${NAVEGADOR:-brave}
PORTA=${PORTA:-5182}
mkdir -p "$SAIDA"
PERFIL=$(mktemp -d)
BUILD=$(mktemp -d)

# build de produção servido pelo vite preview: o servidor de desenvolvimento mantém uma conexão de
# recarregamento aberta e o navegador headless fica esperando para sempre
npx vite build --outDir "$BUILD" --emptyOutDir --logLevel error
npx vite preview --outDir "$BUILD" --port "$PORTA" --strictPort >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null; rm -rf "${PERFIL:?}" "${BUILD:?}"' EXIT

for _ in $(seq 1 50); do
  curl -sf "http://localhost:$PORTA/" >/dev/null && break
  sleep 0.2
done

capturar() { # nome rota largura altura
  local arquivo="$SAIDA/$1-$3.png"
  for tentativa in 1 2 3; do # com perfil novo, a 1ª execução do navegador às vezes sai sem gerar o print
    # movimento reduzido forçado: o brilho infinito do esqueleto impediria o tempo virtual de terminar
    timeout 40 "$NAVEGADOR" --headless=new --disable-gpu --hide-scrollbars --no-first-run --disable-extensions \
      --force-prefers-reduced-motion --user-data-dir="$PERFIL" --window-size="$3,$4" --virtual-time-budget=8000 \
      --screenshot="$arquivo" "http://localhost:$PORTA/$2" >/dev/null 2>&1 || true
    [ -s "$arquivo" ] && { echo "$arquivo"; return 0; }
  done
  echo "falhou: $arquivo" >&2
  return 1
}

for tam in "1280 800" "390 844"; do
  # shellcheck disable=SC2086
  capturar publico '#/agendar' $tam
  # shellcheck disable=SC2086
  capturar login '' $tam
done
