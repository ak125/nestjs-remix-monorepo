#!/usr/bin/env bash
#
# rotate-log.sh — bound the size of log.md by archiving old entries.
#
# log.md is append-only (see stop-log-session-suggest.sh + the session-log
# skill). Without rotation it grows without limit, which makes the
# start-of-session read (CLAUDE.md → `tail -n 80 log.md`) cheap but the file
# itself unbounded, and any full read expensive. This script keeps the live
# file small while preserving full history in a yearly archive.
#
# Behaviour (deterministic, no LLM, no git):
#   - The PREAMBLE is everything up to and including the first `^---$` line
#     (title, Délimitation, Format, Règles). It is ALWAYS kept verbatim.
#   - Below the preamble is a stream of `## YYYY-MM-DD …` entries.
#   - When total line count exceeds MAX_LINES, the oldest entries are MOVED
#     into log-archive-<YEAR>.md (appended, chronological) until only the
#     last KEEP_ENTRIES remain in log.md.
#   - Idempotent: under threshold → no-op, exit 0, no output.
#
# The archive file is committed (history matters) but NEVER read at session
# start — only `log.md` is, via the bounded `tail`.
#
# Usage:
#   rotate-log.sh [LOG_FILE] [ARCHIVE_FILE]
# Defaults resolve relative to the repo root containing this script.
#
# Env overrides (for tests): LOG_ROTATE_MAX_LINES, LOG_ROTATE_KEEP_ENTRIES.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR%/scripts/claude-hooks}")"

LOG_FILE="${1:-${REPO_ROOT}/log.md}"
YEAR="$(date +%Y)"
ARCHIVE_FILE="${2:-${REPO_ROOT}/log-archive-${YEAR}.md}"

MAX_LINES="${LOG_ROTATE_MAX_LINES:-600}"
KEEP_ENTRIES="${LOG_ROTATE_KEEP_ENTRIES:-60}"

[ -f "$LOG_FILE" ] || exit 0

total_lines="$(wc -l < "$LOG_FILE" | tr -d ' ')"
[ "$total_lines" -le "$MAX_LINES" ] && exit 0

# Line number of the end of the preamble (first standalone `---`).
preamble_end="$(grep -n '^---$' "$LOG_FILE" | head -1 | cut -d: -f1 || true)"
# No preamble separator → bail rather than guess (anti-bricolage: never cut blind).
[ -n "${preamble_end:-}" ] || exit 0

# Entry heading line numbers (date-stamped H2), only those AFTER the preamble.
mapfile -t heading_lines < <(grep -nE '^## [0-9]{4}-[0-9]{2}-[0-9]{2}' "$LOG_FILE" \
  | cut -d: -f1 | awk -v p="$preamble_end" '$1 > p')

entry_count="${#heading_lines[@]}"
# Nothing to archive if we already have <= KEEP_ENTRIES entries.
[ "$entry_count" -le "$KEEP_ENTRIES" ] && exit 0

# First heading we KEEP = the (entry_count - KEEP_ENTRIES)-th from the start
# (0-based index). Everything from the first entry up to just before it moves.
keep_idx=$(( entry_count - KEEP_ENTRIES ))
cutoff_line="${heading_lines[$keep_idx]}"
first_entry_line="${heading_lines[0]}"

# Lines [first_entry_line, cutoff_line-1] are archived; [cutoff_line, EOF] stay.
archived_block="$(sed -n "${first_entry_line},$((cutoff_line - 1))p" "$LOG_FILE")"
[ -z "$archived_block" ] && exit 0

# Write/append the archive (chronological: each rotation moves entries newer
# than whatever is already archived).
if [ ! -f "$ARCHIVE_FILE" ]; then
  {
    printf '# Log archive — %s\n\n' "$YEAR"
    printf '> Entrées de session archivées depuis `log.md` par `rotate-log.sh`.\n'
    printf '> Append-only, JAMAIS lu au démarrage de session. Historique uniquement.\n'
  } > "$ARCHIVE_FILE"
fi
printf '\n%s\n' "$archived_block" >> "$ARCHIVE_FILE"

# Rewrite log.md = preamble + a blank line + the kept (recent) entries.
tmp="$(mktemp)"
{
  sed -n "1,${preamble_end}p" "$LOG_FILE"
  printf '\n'
  sed -n "${cutoff_line},\$p" "$LOG_FILE"
} > "$tmp"
mv "$tmp" "$LOG_FILE"

archived_count=$(( keep_idx ))
printf 'rotate-log: archived %d entr%s to %s (kept last %d)\n' \
  "$archived_count" "$([ "$archived_count" -gt 1 ] && echo ies || echo y)" \
  "$(basename "$ARCHIVE_FILE")" "$KEEP_ENTRIES" >&2
exit 0
