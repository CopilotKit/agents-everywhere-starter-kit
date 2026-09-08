#!/usr/bin/env bash
# Everything that can be proven without a credential.
#
# Deliberately not a smoke test: it typechecks every surface, runs the component
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

step "Pre-flight"
if bash scripts/check-env.sh >/dev/null 2>&1; then ok "environment"; else bad "environment (run: npm run check-env)"; fi

step "Typecheck — 6 packages"
if npm run typecheck >/dev/null 2>&1; then ok "agent-core · channel-slack · local-chat · web · mcp · durable"; else bad "typecheck"; fi

step "Tests — components and safety properties"
TEST_OUT=$(npm test 2>&1)
PASS=$(printf '%s' "$TEST_OUT" | grep -oE '^# pass [0-9]+' | head -1 | grep -oE '[0-9]+')
FAIL=$(printf '%s' "$TEST_OUT" | grep -oE '^# fail [0-9]+' | head -1 | grep -oE '[0-9]+')
if [ "${FAIL:-1}" = "0" ]; then ok "${PASS:-?} passing, 0 failing"; else bad "${FAIL:-?} failing"; fi

step "MCP server — real protocol round trip"
MCP_PORT=3299
( cd apps/mcp && MCP_PORT=$MCP_PORT node --import tsx src/server.ts >/tmp/verify-mcp.log 2>&1 & echo $! > /tmp/verify-mcp.pid )
for _ in $(seq 1 40); do curl -sf "http://localhost:$MCP_PORT/health" >/dev/null 2>&1 && break; sleep 0.25; done

call() {
  curl -s -X POST "http://localhost:$MCP_PORT/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"
}
grep_ok() { printf '%s' "$1" | grep -q "$2"; }

INIT=$(call '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"verify","version":"0"}}}')
grep_ok "$INIT" '"protocolVersion"' && ok "initialize" || bad "initialize"

LIST=$(call '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
grep_ok "$LIST" 'incident_card' && ok "tools/list exposes incident_card" || bad "tools/list"
grep_ok "$LIST" 'openai/outputTemplate' && ok "ChatGPT UI metadata intact" || bad "ChatGPT UI metadata"

CALL=$(call '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"incident_card","arguments":{"headline":"Checkout latency above 4s","summary":"~12% of checkouts, EU"}}}')
grep_ok "$CALL" '"structuredContent"' && ok "tools/call returns structuredContent" || bad "tools/call"

READ=$(call '{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"ui://widget/incident-card.html"}}')
grep_ok "$READ" 'window.openai' && ok "widget resource serves the openai bridge" || bad "resources/read"

kill "$(cat /tmp/verify-mcp.pid)" 2>/dev/null; rm -f /tmp/verify-mcp.pid

step "Not proven here"
printf '  %s·%s Slack round trip — needs your own Intelligence project + Channel\n' "$Y" "$O"
printf '  %s·%s Mobile on a device — installs and typechecks, never launched\n' "$Y" "$O"
printf '  %s·%s Trigger.dev waitpoints — needs a Trigger project\n' "$Y" "$O"

if [ "$FAILED" = "0" ]; then
  printf '\n%s%s✓ everything verifiable passed%s\n\n' "$B" "$G" "$O"
else
  printf '\n%s%s✗ something failed above%s\n\n' "$B" "$R" "$O"; exit 1
fi
