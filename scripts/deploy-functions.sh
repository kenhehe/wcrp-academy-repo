#!/usr/bin/env bash
# Deploy all Supabase Edge Functions
# Run from repo root: bash scripts/deploy-functions.sh

set -euo pipefail

PROJECT_REF="aksymcfofktwbixomvvz"

echo "==> Logging in to Supabase (browser will open)..."
npx supabase login

echo "==> Linking project $PROJECT_REF..."
npx supabase link --project-ref "$PROJECT_REF"

FUNCTIONS=(
  scrape-gewex
  scrape-cordex
  scrape-esmo
  scrape-rifs
  scrape-cmip
  scrape-clic
  scrape-clivar
  sync-academy-wp
)

for fn in "${FUNCTIONS[@]}"; do
  echo "==> Deploying $fn..."
  npx supabase functions deploy "$fn" --no-verify-jwt
done

echo ""
echo "All functions deployed!"
echo "Check: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
