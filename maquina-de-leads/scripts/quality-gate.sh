#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=================================================="
echo " MÁQUINA DE LEADS — QUALITY GATE"
echo "=================================================="

echo
echo "[1] Doctor"
bash ./scripts/dev-stack.sh doctor

set -a
source .env
set +a

echo
echo "[2] Docker Compose"
docker compose config >/dev/null
echo "COMPOSE_CONFIG_OK"

echo
echo "[3] Build"
docker compose build backend frontend
echo "DOCKER_BUILD_OK"

echo
echo "[4] Stack"
docker compose up -d

echo
echo "[5] Smoke inicial"
bash ./scripts/dev-stack.sh smoke

echo
echo "[6] Migration"
docker compose run --rm migrate
echo "MIGRATIONS_OK"

echo
echo "[7] Backend syntax"
docker compose exec -T backend sh -lc '
set -e

find src -type f -name "*.js" -print0 |
while IFS= read -r -d "" file; do
    node --check "$file" >/dev/null
done
'

echo "BACKEND_SYNTAX_OK"

echo
echo "[8] Frontend build"
docker compose exec -T frontend npm run build
echo "FRONTEND_BUILD_OK"

echo
echo "[9] Smoke final"
bash ./scripts/dev-stack.sh smoke

echo
echo "=================================================="
echo " MAQUINA_DE_LEADS_QUALITY_GATE_OK"
echo "=================================================="
