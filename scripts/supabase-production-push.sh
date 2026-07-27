#!/usr/bin/env bash
# Push local migrations to linked Supabase production project.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-lzwmnxvirbocupqciqnp}"
CLI="npx supabase"

echo "==> Supabase CLI"
$CLI --version

if ! $CLI projects list &>/dev/null; then
  echo ""
  echo "Not logged in. Run:  npx supabase login"
  echo "Or set SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens"
  exit 1
fi

echo ""
echo "==> Linking project ref: $PROJECT_REF"
$CLI link --project-ref "$PROJECT_REF"

echo ""
echo "==> Dry run"
$CLI db push --dry-run

echo ""
read -r -p "Apply migrations to production? [y/N] " confirm
if [[ "$(echo "$confirm" | tr '[:upper:]' '[:lower:]')" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "==> Pushing schema"
$CLI db push

echo ""
echo "==> Migration status"
$CLI migration list

echo ""
echo "Done. Verify tables in Supabase Dashboard → Table Editor."
