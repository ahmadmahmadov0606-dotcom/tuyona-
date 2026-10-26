#!/usr/bin/env bash
# Оғози зуд: backend (FastAPI :8000) + frontend (Vite :5173) бо як фармон.
#   ./run.sh
# Бори аввал venv, вобастагиҳо, .env ва маълумоти намунавӣ худкор сохта мешаванд.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Агар порт банд бошад (лоиҳаи дигар), порти холии навбатиро мегирем.
free_port() {
  local p=$1
  while ss -ltn 2>/dev/null | grep -q ":$p "; do p=$((p + 1)); done
  echo "$p"
}
API_PORT=$(free_port 8000)
WEB_PORT=$(free_port 5173)

# --- Backend ---
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  echo "→ Сохтани venv..."
  python3 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements-dev.txt
fi
[ -f .env ] || cp .env.example .env
.venv/bin/python -m app.seed --demo
.venv/bin/python -m app.seed_outfits || echo "→ Либосҳои ороишгоҳ бор нашуданд (интернет?) — баъдтар: python -m app.seed_outfits"
.venv/bin/python -m app.seed_photos || echo "→ Аксҳои эълонҳо бор нашуданд (интернет?) — баъдтар: python -m app.seed_photos"
.venv/bin/python -m app.create_admin admin@tuyona.tj "Маъмур" admin12345 >/dev/null

# --- Frontend ---
cd "$ROOT/frontend"
[ -d node_modules ] || { echo "→ npm install..."; npm install --no-audit --no-fund; }

# --- Оғоз ---
cd "$ROOT/backend"
FRONTEND_URL="http://localhost:$WEB_PORT" .venv/bin/uvicorn app.main:app --reload --reload-dir app --port "$API_PORT" &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT INT TERM
echo "API: http://localhost:$API_PORT/docs   Сайт: http://localhost:$WEB_PORT"
cd "$ROOT/frontend"
API_URL="http://127.0.0.1:$API_PORT" npm run dev -- --port "$WEB_PORT" --strictPort
