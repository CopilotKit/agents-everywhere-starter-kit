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
  fail ".env is missing. Run: cp .env.example .env   then choose MODEL_PROVIDER and fill in its API key."
else
  set -a; . ./.env; set +a
fi

# Keep provider/model normalization aligned with agent-core/src/model.ts.
trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}
canonical_provider() {
  local value
  value="$(trim "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in gemini|google-gemini) value=google ;; esac
  printf '%s' "$value"
}

# ── tier 0 ───────────────────────────────────────────────────────────────────
if [ -f .env ]; then
  model="$(trim "${MODEL:-gpt-5.6-sol}")"
  model_id="$model"
  model_provider=""
  case "$model" in
    *[:/]*) candidate_prefix="$(canonical_provider "${model%%[:/]*}")"
             # A bare model's ':free' or ':nitro' suffix is not a provider.
             case "$model" in
               "${model%%[:/]*}/"*) model_provider="$candidate_prefix" ;;
               *) case "$candidate_prefix" in
                    openai|openrouter|anthropic|google) model_provider="$candidate_prefix" ;;
                  esac ;;
             esac
             [ -n "$model_provider" ] && model_id="$(trim "${model#*[:/]}")" ;;
  esac
  [ -z "$model_id" ] && fail "MODEL must include a non-empty model identifier."
  provider="$(canonical_provider "${MODEL_PROVIDER:-}")"
  if [ -z "$provider" ]; then
    if [ -n "${OPENROUTER_API_KEY:-}" ]; then provider=openrouter
    else provider="${model_provider:-openai}"; fi
  fi
  key_name=""
  case "$provider" in
    openai) key_name=OPENAI_API_KEY ;;
    openrouter) key_name=OPENROUTER_API_KEY ;;
    anthropic) key_name=ANTHROPIC_API_KEY ;;
    google) key_name=GOOGLE_API_KEY ;;
    *) fail "Unsupported model provider '$provider'. Set MODEL_PROVIDER to openai, openrouter, anthropic, or google." ;;
  esac
  if [ "$provider" != openrouter ] && [ -n "$model_provider" ] && [ "$model_provider" != "$provider" ]; then
    fail "MODEL provider '$model_provider' does not match MODEL_PROVIDER '$provider'."
  fi
  if [ -n "$key_name" ]; then
    case "${!key_name:-}" in
      "") fail "$key_name is empty. Configure credentials for $provider." ;;
      stub-replace-me) fail "$key_name is still the placeholder. Configure credentials for $provider." ;;
    esac
  fi
  if [ "${1:-}" = --voice ]; then
    case "${OPENAI_API_KEY:-}" in
      ""|stub-replace-me) fail "OPENAI_API_KEY is required separately for OpenAI Realtime voice, even when chat uses $provider." ;;
    esac
  fi
  [ -z "${MODEL:-}" ] && warn "MODEL is unset; falling back to gpt-5.6-sol."

  # ── tier 1: all-or-nothing. Half-configured Channels is the worst state. ──
  if [ -n "${INTELLIGENCE_API_KEY:-}" ] || [ -n "${CHANNEL_CODE:-}" ]; then
    [ -z "${INTELLIGENCE_API_KEY:-}" ] && fail "CHANNEL_CODE is set but INTELLIGENCE_API_KEY is not. Create a project-scoped key under API Keys in the Intelligence sidebar."
    [ -z "${CHANNEL_CODE:-}" ]         && fail "INTELLIGENCE_API_KEY is set but CHANNEL_CODE is not. Copy the Channel Code from Intelligence — exactly."
    # The runtime parses the project id out of the key and fails activation if
    # it cannot. Catch a wrong-format key here instead of at startup.
    if [ -n "${INTELLIGENCE_API_KEY:-}" ]; then
      case "$INTELLIGENCE_API_KEY" in
        cpk-*_*) ;;
        *) warn "INTELLIGENCE_API_KEY does not look like 'cpk-{projectId}_...'. The runtime parses the project id out of it and Channel activation will fail with ChannelConfigError. Copy it from API Keys in the Intelligence project sidebar." ;;
      esac
    fi

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
    warn "Slack is not configured — the agent will not appear there. Run: npm run channel:setup"
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

  if [ -z "${AMBIGUOUS_API_KEY:-}" ]; then
    warn "AMBIGUOUS_API_KEY not set — the agent has no workplace to act in (no mail/tasks/CRM tools)."
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
