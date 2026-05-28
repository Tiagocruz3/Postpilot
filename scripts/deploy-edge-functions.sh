#!/usr/bin/env bash
# Deploy edge functions required by the production app (Activity Log comments, AI Vault, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

read_env_var() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  printf '%s' "${line#*=}" | tr -d '\r'
}

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  token_from_env="$(read_env_var SUPABASE_ACCESS_TOKEN .env)"
  [[ -n "$token_from_env" ]] && export SUPABASE_ACCESS_TOKEN="$token_from_env"
fi

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  ref_from_env="$(read_env_var SUPABASE_PROJECT_REF .env)"
  [[ -n "$ref_from_env" ]] && export SUPABASE_PROJECT_REF="$ref_from_env"
fi

if command -v supabase >/dev/null 2>&1; then
  SUPABASE=(supabase)
else
  SUPABASE=(npx supabase)
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-wjtwyifbndmlpymbtefx}"

FUNCTIONS=(
  post-engagement
  save-ai-library
  generate-image
  generate-video
  generate-compose-copy
  facebook-api
  linkedin-api
  x-api
  instagram-api
  scheduler-tick
)

echo "Deploying ${#FUNCTIONS[@]} edge functions to project ${PROJECT_REF}..."
for fn in "${FUNCTIONS[@]}"; do
  echo "→ $fn"
  "${SUPABASE[@]}" functions deploy "$fn" --project-ref "$PROJECT_REF" --use-api --yes
done

echo "Done. Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
