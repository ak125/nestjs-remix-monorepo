#!/usr/bin/env bash
# INC-2026-007 — Check CI : interdire UPDATE __vehicle_page_cache SET stale=... direct
#
# Tout script qui invalide doit utiliser mark_stale_with_followup_rebuild()
# (cf. backend/supabase/migrations/20260425_mark_stale_with_followup_rebuild.sql).
#
# Exit 0 si propre, 1 si violation détectée.

set -euo pipefail

SCAN_DIRS=(
  "backend/supabase/migrations"
  "scripts/seo"
  "scripts/db"
)

EXEMPT_FILES=(
  "backend/supabase/migrations/20260425_mark_stale_with_followup_rebuild.sql"
  "backend/supabase/migrations/20260425_oneshot_backfill_stale_vehicle_cache.sql"
)

VIOLATIONS=0
TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT

for dir in "${SCAN_DIRS[@]}"; do
  if [[ ! -d "$dir" ]]; then
    continue
  fi
  # Cherche pattern : UPDATE ... __vehicle_page_cache ... SET stale
  grep -rEln "UPDATE[[:space:]]+(public\.)?__vehicle_page_cache[[:space:]]+SET[[:space:]]+stale" "$dir" 2>/dev/null > "$TMPFILE" || true

  while IFS= read -r match_file; do
    [[ -z "$match_file" ]] && continue

    # Skip exempt files
    skip=0
    for exempt in "${EXEMPT_FILES[@]}"; do
      if [[ "$match_file" == "$exempt" ]] || [[ "$match_file" == */"$exempt" ]]; then
        skip=1
        break
      fi
    done
    [[ $skip -eq 1 ]] && continue

    echo "❌ INC-2026-007 violation: $match_file uses UPDATE __vehicle_page_cache SET stale directly"
    echo "   → use SELECT mark_stale_with_followup_rebuild(ARRAY[...], 'reason') instead"
    VIOLATIONS=$((VIOLATIONS + 1))
  done < "$TMPFILE"
done

if [[ $VIOLATIONS -gt 0 ]]; then
  echo ""
  echo "FAIL: $VIOLATIONS violation(s) detected. Use mark_stale_with_followup_rebuild() canon."
  exit 1
fi

echo "✅ INC-2026-007 check passed: no direct UPDATE __vehicle_page_cache SET stale found"
exit 0
