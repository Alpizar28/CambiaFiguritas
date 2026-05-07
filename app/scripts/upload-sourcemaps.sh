#!/usr/bin/env bash
# Sube sourcemaps a Sentry usando debug-ID matching (CLI nuevo v0.31+).
# Auth: OAuth en ~/.sentry/cli.db (sentry auth login).
# Org/project: auto-detectado del DSN (EXPO_PUBLIC_SENTRY_DSN en .env).
#
# Corré DESPUÉS de expo export + patch-web-bundle (necesita dist/ con bundle final hash).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi

DIST_DIR="$APP_DIR/dist"
JS_DIR="$DIST_DIR/_expo/static/js/web"

if [ ! -d "$JS_DIR" ]; then
  echo "[sentry-sourcemaps] $JS_DIR no existe. Corré expo export primero."
  exit 1
fi

if ! command -v sentry &> /dev/null; then
  echo "[sentry-sourcemaps] sentry CLI no encontrado. Instalalo con: curl https://cli.sentry.dev/install -fsS | bash"
  exit 1
fi

# Release version: hash del bundle index principal
RELEASE=$(ls "$JS_DIR" | grep -E '^index-[a-f0-9]{32}\.js$' | head -1 | sed 's/^index-//;s/\.js$//')
if [ -z "$RELEASE" ]; then
  echo "[sentry-sourcemaps] No se encontró bundle index-*.js, ¿corriste patch-web-bundle?"
  exit 1
fi

echo "[sentry-sourcemaps] Release: $RELEASE"
echo "[sentry-sourcemaps] Subiendo desde: $JS_DIR"

cd "$APP_DIR"

sentry sourcemap upload \
  --release "$RELEASE" \
  --url-prefix '~/_expo/static/js/web/' \
  "$JS_DIR"

echo "[sentry-sourcemaps] OK. Release $RELEASE subido."
