#!/usr/bin/env bash
# Picks the surface you have actually configured, so `npm run dev` always does
# something useful instead of crashing on a missing CHANNEL_CODE.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] && { set -a; . ./.env; set +a; }

if [ -n "${CHANNEL_CODE:-}" ] && [ -n "${INTELLIGENCE_API_KEY:-}" ]; then
  exec npm run dev --workspace channel-slack
fi

printf '\033[2m  Tier 1 is not configured, so starting the local surface instead.\n'
printf '  To put the agent in Slack: npm run channel:setup\033[0m\n'
exec npm run dev --workspace local-chat
