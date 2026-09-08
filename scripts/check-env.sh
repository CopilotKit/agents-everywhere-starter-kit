#!/usr/bin/env bash
# Pre-flight. Runs before `npm run dev`. Fails loudly with a numbered list of
# exactly what to fix, because a silent misconfiguration costs a hackathon team
# more than a noisy one.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED=$'\033[31m'; YLW=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
errors=(); warnings=()

fail() { errors+=("$1"); }
warn() { warnings+=("$1"); }

# ── node ─────────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. This kit needs Node 22+ (global WebSocket)."
else
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt 22 ]; then
    fail "Node $(node -v) is too old. Channels needs Node 22+ for global WebSocket. Try: nvm use 22"
  fi
fi

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  fail ".env is missing. Run: cp .env.example .env   then fill in OPENAI_API_KEY."
else
  set -a; . ./.env; set +a
fi

# ── tier 0 ───────────────────────────────────────────────────────────────────
if [ -f .env ]; then
  case "${OPENAI_API_KEY:-}" in
    "")                 fail "OPENAI_API_KEY is empty. Get one: https://platform.openai.com/api-keys" ;;
    stub-replace-me)    fail "OPENAI_API_KEY is still the placeholder. Get one: https://platform.openai.com/api-keys" ;;
    sk-*)               ;;
    *)                  warn "OPENAI_API_KEY does not start with 'sk-'. If you are proxying through a gateway, ignore this." ;;
  esac
  [ -z "${MODEL:-}" ] && warn "MODEL is unset; falling back to gpt-5.4-mini."

  # ── tier 1: all-or-nothing. Half-configured Channels is the worst state. ──
  if [ -n "${INTELLIGENCE_API_KEY:-}" ] || [ -n "${CHANNEL_CODE:-}" ]; then
    [ -z "${INTELLIGENCE_API_KEY:-}" ] && fail "CHANNEL_CODE is set but INTELLIGENCE_API_KEY is not. Create a project-scoped key under API Keys in the Intelligence sidebar."
    [ -z "${CHANNEL_CODE:-}" ]         && fail "INTELLIGENCE_API_KEY is set but CHANNEL_CODE is not. Copy the Channel Code from Intelligence — exactly."
    if [ -n "${CHANNEL_CODE:-}" ]; then
      if ! printf '%s' "$CHANNEL_CODE" | grep -Eq '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'; then
        fail "CHANNEL_CODE '$CHANNEL_CODE' is not a valid Channel Code: lowercase letters and digits separated by single hyphens, starting with a letter."
      fi
      [ ${#CHANNEL_CODE} -lt 3 ] && fail "CHANNEL_CODE '$CHANNEL_CODE' is shorter than 3 characters."
      [ "$CHANNEL_CODE" = "channels" ] && fail "CHANNEL_CODE cannot be the literal 'channels'."
    fi
    if [ -n "${INTELLIGENCE_API_URL:-}" ] && [ -z "${INTELLIGENCE_GATEWAY_WS_URL:-}" ]; then
      fail "INTELLIGENCE_API_URL is set without INTELLIGENCE_GATEWAY_WS_URL. They are separate hosts — override both or neither."
    fi
    if [ -n "${INTELLIGENCE_GATEWAY_WS_URL:-}" ] && [ -z "${INTELLIGENCE_API_URL:-}" ]; then
      fail "INTELLIGENCE_GATEWAY_WS_URL is set without INTELLIGENCE_API_URL. They are separate hosts — override both or neither."
    fi
    case "${SLACK_APP_TOKEN:-}" in
      xapp-*) fail "SLACK_APP_TOKEN is set. Socket Mode belongs only to the direct-adapter path; a managed Channel needs no app-level token. Remove it." ;;
    esac
  else
    warn "Tier 1 not configured — the agent will not appear in Slack. Run: npm run channel:setup"
  fi

  # ── tier 2 ────────────────────────────────────────────────────────────────
  if [ -n "${EXA_API_KEY:-}" ]; then
    case "${EXA_SEARCH_TYPE:-fast}" in
      instant|fast|auto|deep-lite|deep|deep-reasoning) ;;
      *) fail "EXA_SEARCH_TYPE '$EXA_SEARCH_TYPE' is not a valid Exa search type (instant|fast|auto|deep-lite|deep|deep-reasoning)." ;;
    esac
    case "${EXA_SEARCH_TYPE:-fast}" in
      deep|deep-reasoning) warn "EXA_SEARCH_TYPE=$EXA_SEARCH_TYPE takes 4-40s per call. That reads as a hung bot in a chat thread — prefer instant or fast." ;;
    esac
  else
    warn "EXA_API_KEY not set — the web search tool will not be registered."
  fi
fi

# ── deps ─────────────────────────────────────────────────────────────────────
[ -d node_modules ] && [ ! -d node_modules/@copilotkit/channels ] && \
  fail "Dependencies look incomplete (@copilotkit/channels is missing). Run: npm install"
[ ! -d node_modules ] && fail "Dependencies are not installed. Run: npm install"

# ── report ───────────────────────────────────────────────────────────────────
if [ ${#warnings[@]} -gt 0 ]; then
  printf '\n%sHeads up%s\n' "$YLW" "$OFF"
  for i in "${!warnings[@]}"; do printf '  %s·%s %s\n' "$DIM" "$OFF" "${warnings[$i]}"; done
fi

if [ ${#errors[@]} -gt 0 ]; then
  printf '\n%sPre-flight failed — %d thing(s) to fix%s\n\n' "$RED" "${#errors[@]}" "$OFF"
  for i in "${!errors[@]}"; do printf '  %s%d.%s %s\n' "$RED" "$((i+1))" "$OFF" "${errors[$i]}"; done
  printf '\n  %sMore detail: dev-docs/troubleshooting.md%s\n\n' "$DIM" "$OFF"
  exit 1
fi

printf '\n%s✓%s pre-flight clean\n\n' "$GRN" "$OFF"
