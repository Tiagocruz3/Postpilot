#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill in values."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${PROD_APP_URL:=https://www.adguru.app}"

supabase secrets set \
  APP_URL="${PROD_APP_URL}" \
  META_APP_ID="${META_APP_ID:-}" \
  META_APP_SECRET="${META_APP_SECRET:-}" \
  LINKEDIN_CLIENT_ID="${LINKEDIN_CLIENT_ID:-}" \
  LINKEDIN_CLIENT_SECRET="${LINKEDIN_CLIENT_SECRET:-}" \
  X_CLIENT_ID="${X_CLIENT_ID:-}" \
  X_CLIENT_SECRET="${X_CLIENT_SECRET:-}" \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
  INTEGRATION_ENCRYPTION_KEY="${INTEGRATION_ENCRYPTION_KEY:-}" \
  OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
  OPENROUTER_CONTENT_MODEL="${OPENROUTER_CONTENT_MODEL:-google/gemini-2.5-pro}" \
  OPENROUTER_IMAGE_MODEL="${OPENROUTER_IMAGE_MODEL:-google/gemini-2.5-flash-image-preview}" \
  LOVABLE_API_KEY="${LOVABLE_API_KEY:-}" \
  LOVABLE_AI_URL="${LOVABLE_AI_URL:-https://ai.lovable.dev/v1}" \
  FAL_API_KEY="${FAL_API_KEY:-}" \
  FAL_VIDEO_MODEL="${FAL_VIDEO_MODEL:-fal-ai/kling-video/v2.1/master/text-to-video}"

echo "Supabase edge function secrets updated (platform-owner credentials)."
