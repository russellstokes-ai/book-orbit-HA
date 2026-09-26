#!/bin/sh
set -eu

log() {
  printf '%s\n' "BookOrbit HA: $*" >&2
}

OPTIONS=/data/options.json
SECRETS=/data/ha-secrets.env
PGDATA=${PGDATA:-/data/postgres/pgdata}
PGSOCKET=/run/postgresql
PG_BIN=/usr/libexec/postgresql18
APP_DATA_PATH=${APP_DATA_PATH:-/data/bookorbit-app}

json_string() {
  key="$1"
  fallback="$2"
  value="$(jq -r --arg key "$key" --arg fallback "$fallback" '.[$key] // $fallback' "$OPTIONS" 2>/dev/null || true)"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    value="$fallback"
  fi
  printf '%s' "$value"
}

json_number() {
  key="$1"
  fallback="$2"
  value="$(jq -r --arg key "$key" --argjson fallback "$fallback" '.[$key] // $fallback' "$OPTIONS" 2>/dev/null || true)"
  case "$value" in
    ''|*[!0-9]*) value="$fallback" ;;
  esac
  printf '%s' "$value"
}

json_bool() {
  key="$1"
  fallback="$2"
  value="$(jq -r --arg key "$key" --argjson fallback "$fallback" '.[$key] // $fallback' "$OPTIONS" 2>/dev/null || true)"
  case "$value" in
    true|false) ;;
    *) value="$fallback" ;;
  esac
  printf '%s' "$value"
}

mkdir -p /data "$APP_DATA_PATH" /data/postgres "$PGSOCKET"
chown postgres:postgres /data/postgres "$PGSOCKET"
chmod 0755 "$PGSOCKET"

if [ ! -f "$SECRETS" ]; then
  umask 077
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 32)"
  PODCAST_KEY="$(openssl rand -hex 32)"
  AUTO_SETUP_TOKEN="$(openssl rand -hex 16)"
  cat > "$SECRETS" <<SECRETS_EOF
POSTGRES_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
PODCAST_ENCRYPTION_KEY=$PODCAST_KEY
AUTO_SETUP_TOKEN=$AUTO_SETUP_TOKEN
SECRETS_EOF
  chmod 0600 "$SECRETS"
  log "Generated persistent BookOrbit database/authentication secrets."
fi

# shellcheck disable=SC1090
. "$SECRETS"

APP_URL="$(json_string app_url 'http://homeassistant.local:3000')"
LIBRARY_BROWSE_ROOT="$(json_string library_browse_root '/media')"
CONFIGURED_SETUP_TOKEN="$(json_string setup_token '')"
PUID="$(json_number puid 0)"
PGID="$(json_number pgid 0)"
NODE_MAX_OLD_SPACE_SIZE="$(json_number node_memory_mb 1024)"
LOG_LEVEL="$(json_string log_level 'info')"
TRUST_PROXY="$(json_bool trust_proxy false)"
LOW_MEMORY_MODE="$(json_bool low_memory_mode true)"
SAFE_SCAN_MB="$(json_number large_file_safe_mb 25)"

if [ -n "$CONFIGURED_SETUP_TOKEN" ]; then
  SETUP_BOOTSTRAP_TOKEN="$CONFIGURED_SETUP_TOKEN"
else
  SETUP_BOOTSTRAP_TOKEN="$AUTO_SETUP_TOKEN"
fi

export APP_URL CLIENT_URL="$APP_URL"
export LIBRARY_BROWSE_ROOT
export PUID PGID NODE_MAX_OLD_SPACE_SIZE LOG_LEVEL TRUST_PROXY
export BOOKORBIT_HA_LOW_MEMORY_MODE="$LOW_MEMORY_MODE"
export BOOKORBIT_HA_SAFE_SCAN_MB="$SAFE_SCAN_MB"
export NODE_OPTIONS="--require=/app/ha-low-memory-hook.cjs ${NODE_OPTIONS:-}"
export POSTGRES_PASSWORD JWT_SECRET PODCAST_ENCRYPTION_KEY SETUP_BOOTSTRAP_TOKEN
export DATABASE_URL="postgres://bookorbit:${POSTGRES_PASSWORD}@127.0.0.1:5432/bookorbit"
export BOOKORBIT_FIX_PERMISSIONS=true

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "Initialising PostgreSQL 18 database..."
  rm -rf "$PGDATA"
  install -d -m 0700 -o postgres -g postgres "$PGDATA"
  PWFILE="$(mktemp)"
  printf '%s\n' "$POSTGRES_PASSWORD" > "$PWFILE"
  chown postgres:postgres "$PWFILE"
  chmod 0600 "$PWFILE"
  su-exec postgres "$PG_BIN/initdb" \
    -D "$PGDATA" \
    --username=bookorbit \
    --pwfile="$PWFILE" \
    --auth-local=trust \
    --auth-host=scram-sha-256 >/dev/null
  rm -f "$PWFILE"
fi

log "Starting PostgreSQL..."
POSTGRES_LOG=/data/postgres/postgresql.log
: > "$POSTGRES_LOG"
chown postgres:postgres "$POSTGRES_LOG"
su-exec postgres "$PG_BIN/pg_ctl" \
  -D "$PGDATA" \
  -l "$POSTGRES_LOG" \
  -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=$PGSOCKET -p 5432" \
  -w -t 60 start >/dev/null

if ! su-exec postgres "$PG_BIN/psql" -h "$PGSOCKET" -U bookorbit -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='bookorbit'" | grep -q 1; then
  log "Creating BookOrbit database..."
  su-exec postgres "$PG_BIN/createdb" -h "$PGSOCKET" -U bookorbit bookorbit
fi

su-exec postgres "$PG_BIN/psql" -h "$PGSOCKET" -U bookorbit -d bookorbit -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;
SQL

log "Waiting for PostgreSQL TCP connections..."
db_ready=false
attempt=1
while [ "$attempt" -le 30 ]; do
  if PGPASSWORD="$POSTGRES_PASSWORD" "$PG_BIN/pg_isready" -h 127.0.0.1 -p 5432 -U bookorbit -d bookorbit >/dev/null 2>&1 &&
     PGPASSWORD="$POSTGRES_PASSWORD" "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -U bookorbit -d bookorbit -tAc "SELECT 1" 2>/dev/null | grep -q 1; then
    db_ready=true
    break
  fi
  sleep 2
  attempt=$((attempt + 1))
done

if [ "$db_ready" != "true" ]; then
  log "PostgreSQL did not become ready for BookOrbit TCP connections."
  log "Last PostgreSQL log lines:"
  tail -n 80 "$POSTGRES_LOG" >&2 || true
  exit 1
fi
log "PostgreSQL is ready."

shutdown() {
  log "Stopping BookOrbit..."
  if [ -n "${APP_PID:-}" ] && kill -0 "$APP_PID" 2>/dev/null; then
    kill -TERM "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  log "Stopping PostgreSQL..."
  su-exec postgres "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
}
trap shutdown INT TERM EXIT

log "Starting BookOrbit 3.1.0 at $APP_URL"
log "Library browser root: $LIBRARY_BROWSE_ROOT"
log "Low-memory scan mode: $LOW_MEMORY_MODE (large-file threshold: ${SAFE_SCAN_MB} MB; Node heap: ${NODE_MAX_OLD_SPACE_SIZE} MB)"
if [ -z "$CONFIGURED_SETUP_TOKEN" ]; then
  log "First-run setup token: $SETUP_BOOTSTRAP_TOKEN"
  log "You only need this token when creating the first BookOrbit administrator account."
fi

cd /app
APP_STATUS=1
APP_ATTEMPT=1
while [ "$APP_ATTEMPT" -le 3 ]; do
  log "BookOrbit startup attempt $APP_ATTEMPT of 3..."
  sh /app/entrypoint.sh &
  APP_PID=$!
  set +e
  wait "$APP_PID"
  APP_STATUS=$?
  set -e

  if [ "$APP_STATUS" -eq 0 ]; then
    break
  fi

  if ! su-exec postgres "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    log "PostgreSQL stopped unexpectedly."
    tail -n 100 "$POSTGRES_LOG" >&2 || true
    break
  fi

  if [ "$APP_ATTEMPT" -lt 3 ]; then
    log "BookOrbit exited with status $APP_STATUS; database is still healthy. Retrying in 3 seconds..."
    sleep 3
  fi
  APP_ATTEMPT=$((APP_ATTEMPT + 1))
done

if [ "$APP_STATUS" -ne 0 ]; then
  log "BookOrbit failed to start after $APP_ATTEMPT attempt(s)."
  log "Last PostgreSQL log lines:"
  tail -n 100 "$POSTGRES_LOG" >&2 || true
fi

trap - INT TERM EXIT
shutdown
exit "$APP_STATUS"
