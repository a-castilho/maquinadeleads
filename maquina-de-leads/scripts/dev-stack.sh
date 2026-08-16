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

postgres_container_id() {
    docker compose ps -a -q postgres 2>/dev/null | head -n 1
}

postgres_container_exists() {
    [ -n "$(postgres_container_id)" ]
}

load_existing_postgres_metadata() {
    local container
    container="$(postgres_container_id)"

    if [ -z "$container" ]; then
        return 1
    fi

    local detected_user=""
    local detected_db=""

    while IFS='=' read -r key value; do
        case "$key" in
            POSTGRES_USER) detected_user="$value" ;;
            POSTGRES_DB) detected_db="$value" ;;
        esac
    done < <(
        docker inspect "$container" \
            --format '{{range .Config.Env}}{{println .}}{{end}}'
    )

    EXISTING_POSTGRES_USER="${detected_user:-leads_user}"
    EXISTING_POSTGRES_DB="${detected_db:-maquina_de_leads}"
    return 0
}

ensure_env() {
    if [ ! -f .env ]; then
        require_command openssl

        POSTGRES_USER="leads_user"
        POSTGRES_PASSWORD="$(openssl rand -hex 24)"
        POSTGRES_DB="maquina_de_leads"

        if load_existing_postgres_metadata; then
            POSTGRES_USER="$EXISTING_POSTGRES_USER"
            POSTGRES_DB="$EXISTING_POSTGRES_DB"
            echo "POSTGRES_EXISTENTE_DETECTADO"
        else
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
}

load_env() {
    set -a
    source .env
    set +a
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

reconcile_postgres_password() {
    if ! postgres_container_exists; then
        return 0
    fi

    wait_postgres

    echo "SINCRONIZANDO_CREDENCIAL_POSTGRES"

    # Usa o socket Unix local do container para não depender da senha antiga.
    # A instrução é enviada pela entrada padrão porque o psql não expande
    # variáveis :'nome' de forma confiável quando elas aparecem em -c.
    # format(%I/%L) protege, respectivamente, identificador e literal SQL.
    if printf '%s\n' \
        "SELECT format('ALTER ROLE %I WITH PASSWORD %L', :'role_name', :'new_password') \\gexec" \
        | docker compose exec -T postgres \
            psql \
            -v ON_ERROR_STOP=1 \
            -U "${POSTGRES_USER}" \
            -d "${POSTGRES_DB}" \
            -v role_name="${POSTGRES_USER}" \
            -v new_password="${POSTGRES_PASSWORD}" \
            >/dev/null; then
        echo "POSTGRES_PASSWORD_SINCRONIZADO"
        return 0
    fi

    cat >&2 <<'ERROR'
ERRO_AO_SINCRONIZAR_POSTGRES

O PostgreSQL está ativo, mas não foi possível atualizar a senha pelo socket
local. Nenhum volume foi removido.

Execute:
  docker compose logs --tail=100 postgres
ERROR
    return 1
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

    [ -f .env ] && echo "OK: .env"

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

    if postgres_container_exists; then
        reconcile_postgres_password
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
        load_env
        docker compose up -d postgres
        reconcile_postgres_password
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

        # Sobe primeiro o banco para permitir a reconciliação de credenciais
        # em volumes preexistentes. Depois o migrate/backend/worker/frontend
        # recebem exatamente a mesma senha do .env.
        docker compose up -d postgres
        reconcile_postgres_password

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
