#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "===== QUALITY GATE ====="

bash ./scripts/dev-stack.sh init

set -a
source .env
set +a

docker compose config >/dev/null
echo "COMPOSE_CONFIG_OK"

docker compose build backend frontend
echo "DOCKER_BUILD_OK"

docker compose up -d

docker compose exec -T postgres \
    pg_isready \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}"

docker compose run --rm migrate
echo "MIGRATIONS_OK"

docker compose exec -T backend sh -lc '
set -e
find src test -type f -name "*.js" -print0 |
while IFS= read -r -d "" file; do
    node --check "$file" >/dev/null
done
'
echo "BACKEND_SYNTAX_OK"

docker compose exec -T backend npm test
echo "BACKEND_TESTS_OK"

docker compose exec -T frontend npm run build
echo "FRONTEND_BUILD_OK"

curl -fsS "http://127.0.0.1:${BACKEND_PORT:-4000}/health" >/dev/null
echo "BACKEND_HEALTH_OK"

curl -fsS "http://127.0.0.1:${FRONTEND_PORT:-5174}" >/dev/null
echo "FRONTEND_HTTP_OK"

echo "MAQUINA_DE_LEADS_QUALITY_GATE_OK"
