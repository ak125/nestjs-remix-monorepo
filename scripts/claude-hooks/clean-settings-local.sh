#!/usr/bin/env bash
# Nettoyage automatique de .claude/settings.local.json
# Remplace les permissions Bash spécifiques par des wildcards génériques
# Usage: bash scripts/claude-hooks/clean-settings-local.sh
# Cron:  0 3 * * 0 bash /opt/automecanik/app/scripts/claude-hooks/clean-settings-local.sh

set -euo pipefail

SETTINGS_FILE="/opt/automecanik/app/.claude/settings.local.json"
BACKUP_FILE="${SETTINGS_FILE}.bak"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "settings.local.json not found — nothing to clean"
  exit 0
fi

# Check size — skip if already small
LINE_COUNT=$(wc -l < "$SETTINGS_FILE")
if [ "$LINE_COUNT" -lt 100 ]; then
  echo "settings.local.json is already clean ($LINE_COUNT lines)"
  exit 0
fi

echo "=== Before: $(wc -l < "$SETTINGS_FILE") lines / $(wc -c < "$SETTINGS_FILE") bytes ==="

# Backup
cp "$SETTINGS_FILE" "$BACKUP_FILE"
echo "Backup saved to ${BACKUP_FILE}"

# Extract all non-Bash permissions (MCP, WebFetch, etc.) — keep as-is
NON_BASH_PERMS=$(jq -r '.permissions.allow[]? // empty' "$SETTINGS_FILE" | grep -v '^Bash(' || true)

# Extract unique Bash command prefixes (first word after "Bash(")
# e.g. "Bash(curl -s http://...)" → "curl"
# e.g. "Bash(git add foo.ts)" → "git"
BASH_PREFIXES=$(jq -r '.permissions.allow[]? // empty' "$SETTINGS_FILE" \
  | grep '^Bash(' \
  | sed 's/^Bash(\([a-zA-Z0-9_-]*\).*/\1/' \
  | sort -u)

# Build the new allow array
ALLOW_ENTRIES=()

# Add Bash wildcards (deduplicated prefixes)
while IFS= read -r prefix; do
  [ -z "$prefix" ] && continue
  ALLOW_ENTRIES+=("Bash(${prefix}:*)")
done <<< "$BASH_PREFIXES"

# Add non-Bash permissions
while IFS= read -r perm; do
  [ -z "$perm" ] && continue
  ALLOW_ENTRIES+=("$perm")
done <<< "$NON_BASH_PERMS"

# Build JSON
JSON_ARRAY=$(printf '%s\n' "${ALLOW_ENTRIES[@]}" | jq -R . | jq -s .)

# Write new settings
jq -n --argjson allow "$JSON_ARRAY" '{"permissions": {"allow": $allow}}' > "$SETTINGS_FILE"

echo "=== After:  $(wc -l < "$SETTINGS_FILE") lines / $(wc -c < "$SETTINGS_FILE") bytes ==="
echo "Cleaned! Reduced from $LINE_COUNT lines to $(wc -l < "$SETTINGS_FILE") lines"
echo "Backup at: ${BACKUP_FILE}"
