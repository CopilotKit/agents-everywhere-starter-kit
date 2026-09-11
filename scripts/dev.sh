#!/usr/bin/env bash
# Picks a retained starter surface, so `npm run dev` always starts something
# useful instead of crashing on a missing CHANNEL_CODE.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] && { set -a; . ./.env; set +a; }

if [ -n "${CHANNEL_CODE:-}" ] && [ -n "${INTELLIGENCE_API_KEY:-}" ]; then
  exec npm run dev --workspace channel
fi

printf '\033[2m  CHANNEL_CODE/INTELLIGENCE_API_KEY are not configured, so starting the web template.\n'
printf '  To put the agent in Slack: npm run channel:setup\033[0m\n'
exec npm run dev:web
