#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$script_dir"

while [ "$root" != "/" ] && [ ! -f "$root/docker-compose.yml" ]; do
  root="$(dirname "$root")"
done

if [ ! -f "$root/docker-compose.yml" ]; then
  echo "ERROR: docker-compose.yml not found. Run this script from within the dev-stack repo." >&2
  exit 1
fi

token="${SMOKE_AUTH_TOKEN:-${TWENTY_API_KEY:-}}"
if [ -z "$token" ] && [ -f "$root/.env" ]; then
  token="$(sed -n 's/^TWENTY_API_KEY=//p' "$root/.env" | tail -n 1)"
  token="${token%\"}"
  token="${token#\"}"
fi

if [ -n "$token" ]; then
  export SMOKE_AUTH_TOKEN="$token"
else
  echo "WARN: No SMOKE_AUTH_TOKEN/TWENTY_API_KEY found; requests will likely fail with 401." >&2
fi

cd "$root"

compose_args=(exec -T)
if [ -n "${SMOKE_AUTH_TOKEN:-}" ]; then
  compose_args+=(-e "SMOKE_AUTH_TOKEN=${SMOKE_AUTH_TOKEN}")
fi
if [ -n "${SMOKE_TIMEOUT_MS:-}" ]; then
  compose_args+=(-e "SMOKE_TIMEOUT_MS=${SMOKE_TIMEOUT_MS}")
fi
if [ -n "${SMOKE_GIFTS_BASE:-}" ]; then
  compose_args+=(-e "SMOKE_GIFTS_BASE=${SMOKE_GIFTS_BASE}")
fi
if [ -n "${GATEWAY_BASE:-}" ]; then
  compose_args+=(-e "GATEWAY_BASE=${GATEWAY_BASE}")
fi

docker compose "${compose_args[@]}" fundraising-service npm run smoke:gifts
