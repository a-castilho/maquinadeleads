#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ACTION="${1:-up}"

load_existing_postgres_credentials() {
    local container="postgres"
    local mount_match="false"

    if ! docker inspect "$container" >/dev/null 2>&1; then
        return 1
    fi

    while IFS= read -r mount_name; do
        if [ "$mount_name" = "maquina-de-leads_postgres_data" ]; then
            mount_match="true"
            break
        fi
    done < <(docker inspect "$container" --format '{{range .Mounts}}{{println .Name}}{{end}}')

    if [ "$mount_match" != "true" ]; then
        return 1
    fi

    POSTGRES_USER=""
    POSTGRES_PASSWORD=""
    POSTGRES_DB=""

    while IFS='=' read -r key value; do
        case "$key" in
            POSTGRES_USER) POSTGRES_USER="$value" ;;
            POSTGRES_PASSWORD) POSTGRES_PASSWORD="$value" ;;
            POSTGRES_DB) POSTGRES_DB="$value" ;;
        esac
    done < <(docker inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}')

    if [ -z "$POSTGRES_PASSWORD" ]; then
        return 1
    fi

    POSTGRES_USER="${POSTGRES_USER:-leads_user}"
    POSTGRES_DB="${POSTGRES_DB:-maquina_de_leads}"
    return 0
}

ensure_env() {
    if [ ! -f .env ]; then
        if load_existing_postgres_credentials; then
            echo "POSTGRES_EXISTENTE_DETECTADO"
        else
            POSTGRES_USER="leads_user"
            POSTGRES_PASSWORD="$(openssl rand -hex 24)"
            POSTGRES_DB="maquina_de_leads"
            echo "POSTGRES_NOVO_CONFIGURADO"
        fi

        JWT_SECRET="$(openssl rand -hex 48)"

        cat > .env <<ENVEOF
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_PORT=5432

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

BACKEND_PORT=4000
FRONTEND_PORT=5174

ROBO_PYTHON_URL=
DISCOVERY_HTTP_TIMEOUT_MS=10000
JOB_POLL_INTERVAL_MS=2000
JOB_STALE_MINUTES=15
ENVEOF

        chmod 600 .env
        echo "ENV_LOCAL_CRIADO"
    fi
}

load_env() {
    set -a
    source .env
    set +a
}

case "$ACTION" in
    init)
        ensure_env
        ;;

    config)
        ensure_env
        load_env
        docker compose config >/dev/null
        echo "COMPOSE_CONFIG_OK"
        ;;

    up)
        ensure_env
        load_env
        docker compose config >/dev/null
        docker compose up -d --build
        docker compose ps
        ;;

    status)
        ensure_env
        load_env
        docker compose ps
        ;;

    down)
        ensure_env
        load_env
        docker compose down
        ;;

    logs)
        ensure_env
        load_env
        docker compose logs --tail=150 -f
        ;;

    quality)
        ensure_env
        exec bash ./scripts/quality-gate.sh
        ;;

    *)
        cat <<'HELP'
Uso:

bash dev init
bash dev config
bash dev up
bash dev status
bash dev logs
bash dev down
bash dev quality
HELP
        exit 2
        ;;
esac
