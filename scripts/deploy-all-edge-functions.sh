#!/usr/bin/env bash
# Deploy every edge function in supabase/functions/ to the linked Supabase project.
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
  if [[ -n "$token_from_env" ]]; then
    export SUPABASE_ACCESS_TOKEN="$token_from_env"
  fi
fi

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  ref_from_env="$(read_env_var SUPABASE_PROJECT_REF .env)"
  if [[ -n "$ref_from_env" ]]; then
    export SUPABASE_PROJECT_REF="$ref_from_env"
  fi
fi

if command -v supabase >/dev/null 2>&1; then
  SUPABASE=(supabase)
else
  SUPABASE=(npx supabase)
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-wjtwyifbndmlpymbtefx}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Supabase access token required."
  echo ""
  echo "Add to .env (one line, no quotes around the token unless needed):"
  echo "  SUPABASE_ACCESS_TOKEN=sbp_..."
  echo ""
  echo "Or log in:"
  echo "  npx supabase login"
  echo "  npm run supabase:deploy:all"
  exit 1
fi

echo "Deploying all edge functions to project ${PROJECT_REF}..."
"${SUPABASE[@]}" functions deploy --project-ref "$PROJECT_REF" --use-api --yes

echo ""
echo "Done. Deployed functions:"
for dir in "$ROOT"/supabase/functions/*/; do
  name="$(basename "$dir")"
  [[ "$name" == "_shared" ]] && continue
  [[ -f "$dir/index.ts" ]] && echo "  - $name"
done
