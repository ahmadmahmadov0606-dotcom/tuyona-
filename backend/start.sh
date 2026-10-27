#!/bin/sh
# Оғози контейнер: база, маълумоти намунавӣ, маъмур, баъд сервер.
set -e
if [ "${SEED_DEMO:-1}" = "1" ]; then
  python -m app.seed --demo
  # Аксҳо аз интернет (Wikimedia Commons) — дар замина, то сайт зуд кушода шавад
  (python -m app.seed_outfits && python -m app.seed_photos) || echo "→ Аксҳо бор нашуданд — баъдтар: docker compose exec app python -m app.seed_photos" &
else
  python -m app.seed
fi
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  python -m app.create_admin "$ADMIN_EMAIL" "Маъмур" "$ADMIN_PASSWORD" >/dev/null && echo "→ Маъмур: $ADMIN_EMAIL"
fi
# Контейнер танҳо аз nginx-и худи сервер дастрас аст (порт ба 127.0.0.1 баста) — ба X-Forwarded-For бовар мекунем,
# то маҳдудиятҳои барнома (воридшавӣ, AI) IP-и воқеии корбарро бинанд, на IP-и Docker
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips='*'
