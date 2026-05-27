#!/usr/bin/env bash
# Deploy edge functions required by the production app (Activity Log comments, AI Vault, etc.)
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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

echo "Deploying ${#FUNCTIONS[@]} edge functions to linked Supabase project..."
for fn in "${FUNCTIONS[@]}"; do
  echo "→ $fn"
  supabase functions deploy "$fn"
done

echo "Done. Verify OPTIONS preflight, e.g.:"
echo "  curl -sI -X OPTIONS \"\$SUPABASE_URL/functions/v1/post-engagement\" -H \"Origin: https://www.adguru.app\""
