#!/usr/bin/env bash
# sync-canon.sh - Synchronise .spec/00-canon/ vers vault (mode safe, manual)
# Ne detruit jamais le vault, cree des .conflict.* en cas de conflit
set -euo pipefail

MONOREPO_PATH="${MONOREPO_PATH:-$(pwd)}"
VAULT_PATH="${VAULT_PATH:-$MONOREPO_PATH/.local/governance-vault}"
CANON_PATH="$MONOREPO_PATH/.spec/00-canon"

SYNC_DIR="$VAULT_PATH/99-meta"
SYNC_LOG="$SYNC_DIR/sync-log.md"
LAST_SYNC="$SYNC_DIR/last-sync-timestamp"

# Create sync directory if not exists
mkdir -p "$SYNC_DIR"

# Initialize last sync timestamp if not exists
if [ ! -f "$LAST_SYNC" ]; then
  echo "1970-01-01T00:00:00Z" > "$LAST_SYNC"
fi

LAST="$(cat "$LAST_SYNC")"

# Check if canon path exists
if [ ! -d "$CANON_PATH" ]; then
  echo "⚠️ Canon path not found: $CANON_PATH"
  exit 0
fi

# Find changed files since last sync
mapfile -t CHANGED < <(find "$CANON_PATH" -type f -name "*.md" -newermt "$LAST" 2>/dev/null | sort)

if [ "${#CHANGED[@]}" -eq 0 ]; then
  echo "✅ No canon changes since $LAST"
  exit 0
fi

echo "🔄 Canon changes detected: ${#CHANGED[@]}"

# Routing rules (simple & predictable)
route_dest() {
  local src="$1"
  local name
  name="$(basename "$src")"
  case "$name" in
    *adr*|ADR-*)
      echo "$VAULT_PATH/02-decisions/adr"
      ;;
    *rule*|R[0-9]*|*canon*)
      echo "$VAULT_PATH/03-rules/technical"
      ;;
    *architecture*|*overview*|*map*|repo-map*)
      echo "$VAULT_PATH/06-knowledge"
      ;;
    *governance*|*policy*)
      echo "$VAULT_PATH/03-rules/governance"
      ;;
    *ai-cos*|*golden*|*ia-rule*)
      echo "$VAULT_PATH/03-rules/ai-cos"
      ;;
    *)
      echo "$VAULT_PATH/06-knowledge"
      ;;
  esac
}

CONFLICTS=0
SYNCED=0

# Initialize sync log if not exists
if [ ! -f "$SYNC_LOG" ]; then
  {
    echo "# Sync Log"
    echo ""
    echo "Log de synchronisation canon → vault"
    echo ""
    echo "---"
  } > "$SYNC_LOG"
fi

for f in "${CHANGED[@]}"; do
  dest_dir="$(route_dest "$f")"
  mkdir -p "$dest_dir"

  dest="$dest_dir/$(basename "$f")"

  # Manual conflict policy: if dest exists and differs, create .conflict copy
  if [ -f "$dest" ] && ! cmp -s "$f" "$dest"; then
    CONFLICTS=$((CONFLICTS+1))
    conflict="$dest.conflict.$(date +%s)"
    cp "$f" "$conflict"

    {
      echo ""
      echo "## $(date -Iseconds) CONFLICT"
      echo "- src: \`$f\`"
      echo "- dest: \`$dest\`"
      echo "- conflict_copy: \`$conflict\`"
    } >> "$SYNC_LOG"

    echo "⚠️ Conflict: wrote $conflict"
    continue
  fi

  cp "$f" "$dest"
  SYNCED=$((SYNCED+1))

  {
    echo ""
    echo "## $(date -Iseconds) SYNC"
    echo "- src: \`$f\`"
    echo "- dest: \`$dest\`"
  } >> "$SYNC_LOG"

  rel_dest=$(realpath --relative-to="$VAULT_PATH" "$dest" 2>/dev/null || echo "$dest")
  echo "✅ Synced: $(basename "$f") → $rel_dest"
done

# Update last sync timestamp
date -Iseconds > "$LAST_SYNC"

echo ""
echo "📊 Summary: $SYNCED synced, $CONFLICTS conflict(s)"

if [ "$CONFLICTS" -gt 0 ]; then
  echo "❌ Sync completed with $CONFLICTS conflict(s). Resolve manually."
  exit 2
fi

echo "✅ Sync completed successfully."
