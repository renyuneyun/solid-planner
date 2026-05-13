#!/usr/bin/env sh
# Generates a Solid OIDC Client ID Document.
#
# Deployment mode — generates public/clientid.json for a single deployment:
#   sh scripts/generate-clientid.sh <app-url>
#   sh scripts/generate-clientid.sh https://me.ryey.icu/solid-planner/
#   sh scripts/generate-clientid.sh https://solid-planner.vercel.app/
#
# Hosted mode — generates an uploadable file covering all known deployments
# (including localhost), using an externally hosted URL as the client_id:
#   sh scripts/generate-clientid.sh --hosted <client-id-url>
#   sh scripts/generate-clientid.sh --hosted https://example.com/solid-planner-clientid.json

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ "$1" = "--hosted" ]; then
  CLIENT_ID_URL="$2"
  if [ -z "$CLIENT_ID_URL" ]; then
    echo "Error: client_id URL argument is required." >&2
    echo "Usage: sh scripts/generate-clientid.sh --hosted <client-id-url>" >&2
    exit 1
  fi

  OUT="$ROOT_DIR/clientid-hosted.json"
  sed \
    -e "s|{{CLIENT_ID_URL}}|${CLIENT_ID_URL}|g" \
    "$ROOT_DIR/src/solid/clientid-hosted.template.json" > "$OUT"

  echo "Generated clientid-hosted.json — upload this file to: ${CLIENT_ID_URL}"
else
  APP_URL="$1"
  if [ -z "$APP_URL" ]; then
    echo "Error: app URL argument is required." >&2
    echo "Usage: sh scripts/generate-clientid.sh <app-url>" >&2
    echo "       sh scripts/generate-clientid.sh --hosted <client-id-url>" >&2
    exit 1
  fi

  # Normalise trailing slash
  case "$APP_URL" in
    */) ;;
    *) APP_URL="${APP_URL}/" ;;
  esac

  CLIENT_ID_URL="${APP_URL}clientid.json"

  sed \
    -e "s|{{CLIENT_ID_URL}}|${CLIENT_ID_URL}|g" \
    -e "s|{{REDIRECT_URI}}|${APP_URL}|g" \
    "$ROOT_DIR/src/solid/clientid.template.json" > "$ROOT_DIR/public/clientid.json"

  echo "Generated public/clientid.json for ${APP_URL}"
  echo "  client_id:     ${CLIENT_ID_URL}"
  echo "  redirect_uris: ${APP_URL}"
fi
