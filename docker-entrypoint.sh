#!/bin/sh
set -eu

# Fail fast on missing critical env (mirrors server/plugins/env-check.ts)
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[konga] DATABASE_URL is required" >&2
  exit 1
fi
if [ -z "${NUXT_SESSION_PASSWORD:-}" ] || [ "${#NUXT_SESSION_PASSWORD}" -lt 32 ]; then
  echo "[konga] NUXT_SESSION_PASSWORD must be at least 32 characters" >&2
  exit 1
fi
if [ -z "${NODE_CREDENTIALS_KEY:-}" ] || [ "${#NODE_CREDENTIALS_KEY}" -lt 32 ]; then
  echo "[konga] NODE_CREDENTIALS_KEY must be at least 32 characters" >&2
  exit 1
fi

# Prefer local prisma binary over npx (avoids unexpected network installs)
if [ -x ./node_modules/.bin/prisma ]; then
  ./node_modules/.bin/prisma db push --skip-generate
else
  npx prisma db push --skip-generate
fi

exec node .output/server/index.mjs
