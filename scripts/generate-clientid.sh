#!/usr/bin/env sh
# Generates public/clientid.json from src/solid/clientid.template.json
# for a specific deployment URL.
#
# Usage:
#   sh scripts/generate-clientid.sh <app-url>
#
# Examples:
#   sh scripts/generate-clientid.sh https://me.ryey.icu/solid-planner/
#   sh scripts/generate-clientid.sh https://solid-planner.vercel.app/

set -e

APP_URL="$1"
if [ -z "$APP_URL" ]; then
  echo "Error: app URL argument is required." >&2
  echo "Usage: sh scripts/generate-clientid.sh <app-url>" >&2
  exit 1
fi

# Normalise trailing slash
case "$APP_URL" in
  */) ;;
  *) APP_URL="${APP_URL}/" ;;
esac

CLIENT_ID_URL="${APP_URL}clientid.json"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

sed \
  -e "s|{{CLIENT_ID_URL}}|${CLIENT_ID_URL}|g" \
  -e "s|{{REDIRECT_URI}}|${APP_URL}|g" \
  "$ROOT_DIR/src/solid/clientid.template.json" > "$ROOT_DIR/public/clientid.json"

echo "Generated public/clientid.json for ${APP_URL}"
echo "  client_id:     ${CLIENT_ID_URL}"
echo "  redirect_uris: ${APP_URL}"
