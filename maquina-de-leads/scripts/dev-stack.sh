#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ACTION="${1:-up}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "ERRO: comando obrigatório ausente: $1" >&2
        exit 1
    fi
}

is_existing_project_postgres() {
    local container="postgres"

    if ! docker inspect "$container" >/dev/null 2>&1; then
        return 1
    fi

    while IFS= read -r mount_name; do
        if [ "$mount_name" = "maquina-de-leads_postgres_data" ]; then
            return 0
        fi
    done < <(
        docker inspect "$container" \
            --format '{{range .Mounts}}{{println .Name}}{{end}}'
    )

    return 1
}

load_existing_postgres_credentials() {
    local container="postgres"

    if ! is_existing_project_postgres; then
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
    done < <(
        docker inspect "$container" \
            --format '{{range .Config.Env}}{{println .}}{{end}}'
    )

    if [ -z "$POSTGRES_PASSWORD" ]; then
        return 1
    fi

    POSTGRES_USER="${POSTGRES_USER:-leads_user}"
    POSTGRES_DB="${POSTGRES_DB:-maquina_de_leads}"

    return 0
}

validate_existing_env() {
    local configured_user configured_password configured_db
    local running_user running_password running_db

    if [ ! -f .env ] || ! is_existing_project_postgres; then
        return 0
    fi

    set -a
    source .env
    set +a

    configured_user="${POSTGRES_USER:-}"
    configured_password="${POSTGRES_PASSWORD:-}"
    configured_db="${POSTGRES_DB:-}"

    if ! load_existing_postgres_credentials; then
        echo "ERRO: não foi possível ler credenciais do PostgreSQL existente." >&2
        exit 1
    fi

    running_user="$POSTGRES_USER"
    running_password="$POSTGRES_PASSWORD"
    running_db="$POSTGRES_DB"

    if [ "$configured_user" != "$running_user" ] || \
       [ "$configured_password" != "$running_password" ] || \
       [ "$configured_db" != "$running_db" ]; then

        cat >&2 <<'ERROR'
ERRO_ENV_POSTGRES_DIVERGENTE

O .env atual não corresponde ao PostgreSQL que utiliza o volume
maquina-de-leads_postgres_data.

Nenhum dado foi alterado.
Corrija o .env antes de continuar.
ERROR

        exit 1
    fi

    echo "ENV_POSTGRES_VALIDADO"
}

ensure_env() {
    if [ ! -f .env ]; then

        require_command openssl

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
# Máquina de Leads - ambiente local
# Não versionar.

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

    validate_existing_env
}

load_env() {
    set -a
    source .env
    set +a
}

wait_http() {
    local url="$1"
    local label="$2"
    local attempts="${3:-60}"

    require_command curl

    for ((i=1; i<=attempts; i++)); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            echo "OK: $label"
            return 0
        fi

        sleep 2
    done

    echo "ERRO: timeout aguardando $label em $url" >&2
    return 1
}

wait_postgres() {
    local attempts="${1:-30}"

    for ((i=1; i<=attempts; i++)); do
        if docker compose exec -T postgres \
            pg_isready \
            -U "${POSTGRES_USER}" \
            -d "${POSTGRES_DB}" \
            >/dev/null 2>&1; then

            echo "OK: postgres"
            return 0
        fi

        sleep 2
    done

    echo "ERRO: PostgreSQL não ficou disponível." >&2
    return 1
}

doctor() {
    ensure_env
    load_env

    echo "===== DEV DOCTOR ====="

    require_command docker
    require_command curl
    require_command openssl

    docker compose version >/dev/null

    echo "OK: docker compose"
    echo "OK: curl"
    echo "OK: openssl"

    docker compose config >/dev/null

    echo "OK: compose config"

    if [ -f .env ]; then
        echo "OK: .env"
    fi

    if [ -n "${POSTGRES_PASSWORD:-}" ]; then
        echo "OK: POSTGRES_PASSWORD"
    else
        echo "ERRO: POSTGRES_PASSWORD ausente"
        exit 1
    fi

    if [ -n "${JWT_SECRET:-}" ]; then
        echo "OK: JWT_SECRET"
    else
        echo "ERRO: JWT_SECRET ausente"
        exit 1
    fi

    echo "DEV_DOCTOR_OK"
}

smoke() {
    ensure_env
    load_env

    echo
    echo "===== CONTAINERS ====="
    docker compose ps

    echo
    echo "===== POSTGRES ====="
    wait_postgres

    echo
    echo "===== BACKEND ====="
    wait_http \
        "http://127.0.0.1:${BACKEND_PORT:-4000}/health" \
        "backend"

    echo
    echo "===== FRONTEND ====="
    wait_http \
        "http://127.0.0.1:${FRONTEND_PORT:-5174}" \
        "frontend"

    echo
    echo "DEV_STACK_OK"
}

case "$ACTION" in
    init)
        ensure_env
        ;;

    doctor)
        doctor
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
        echo "COMPOSE_CONFIG_OK"

        docker compose up -d --build

        smoke
        ;;

    smoke)
        smoke
        ;;

    status)
        ensure_env
        load_env
        docker compose ps
        ;;

    restart)
        ensure_env
        load_env
        docker compose restart
        smoke
        ;;

    down)
        ensure_env
        load_env
        docker compose down
        echo "STACK_PARADA_VOLUMES_PRESERVADOS"
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
bash dev doctor
bash dev config
bash dev up
bash dev smoke
bash dev status
bash dev restart
bash dev logs
bash dev quality
bash dev down
HELP
        exit 2
        ;;
esac
