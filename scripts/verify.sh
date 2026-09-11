#!/usr/bin/env bash
# Everything that can be proven without a credential.
#
# Deliberately not a live smoke test: it typechecks the retained root
# workspaces and runs the offline regressions. What it cannot do is prove the
# Slack round trip, a live Ambiguous workspace write, or a mobile device run —
# those need your own accounts or platform-specific setup, and it says so at the
# end rather than implying otherwise.
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; O=$'\033[0m'
step() { printf '\n%s▸ %s%s\n' "$B" "$1" "$O"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$O" "$1"; }
bad()  { printf '  %s✗%s %s\n' "$R" "$O" "$1"; FAILED=1; }
FAILED=0

step "Typecheck — retained root workspaces"
if npm run typecheck; then ok "retained workspace typechecks"; else bad "typecheck"; fi

step "Tests — retained workspaces and offline regressions"
if npm test; then ok "all offline tests passed"; else bad "tests (see command output above)"; fi

step "Not proven here"
printf '  %s·%s Slack round trip — needs your own Intelligence project + Channel\n' "$Y" "$O"
printf '  %s·%s Ambiguous live write/read — needs your own workspace and approval\n' "$Y" "$O"
printf '  %s·%s Mobile — separate install, typecheck, bundle, and device run under apps/mobile\n' "$Y" "$O"

if [ "$FAILED" = "0" ]; then
  printf '\n%s%s✓ everything verifiable passed%s\n\n' "$B" "$G" "$O"
else
  printf '\n%s%s✗ something failed above%s\n\n' "$B" "$R" "$O"; exit 1
fi
