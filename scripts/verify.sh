#!/usr/bin/env bash
# Everything that can be proven without a credential.
#
# Deliberately not a smoke test: it typechecks the root workspaces, runs the component
# and safety tests, and drives the MCP server over the real protocol. What it
# cannot do is prove the Slack round trip — that needs your own Intelligence
# project, and it says so at the end rather than implying otherwise.
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; D=$'\033[2m'; O=$'\033[0m'
step() { printf '\n%s▸ %s%s\n' "$B" "$1" "$O"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$O" "$1"; }
bad()  { printf '  %s✗%s %s\n' "$R" "$O" "$1"; FAILED=1; }
FAILED=0

step "Typecheck — all workspaces"
if npm run typecheck; then ok "all workspace typechecks"; else bad "typecheck"; fi

step "Tests — all workspaces and offline regressions"
if npm test; then ok "all tests passed"; else bad "tests (see command output above)"; fi

step "MCP server — real stdio protocol round trip"
if node scripts/verify-mcp.mjs; then ok "MCP stdio protocol"; else bad "MCP stdio protocol"; fi

step "Not proven here"
printf '  %s·%s MCP HTTP transport — this check exercises stdio only\n' "$Y" "$O"
printf '  %s·%s Slack round trip — needs your own Intelligence project + Channel\n' "$Y" "$O"
printf '  %s·%s Mobile — separate install, typecheck, and device run not verified\n' "$Y" "$O"
printf '  %s·%s Trigger.dev waitpoints — needs a Trigger project\n' "$Y" "$O"

if [ "$FAILED" = "0" ]; then
  printf '\n%s%s✓ everything verifiable passed%s\n\n' "$B" "$G" "$O"
else
  printf '\n%s%s✗ something failed above%s\n\n' "$B" "$R" "$O"; exit 1
fi
