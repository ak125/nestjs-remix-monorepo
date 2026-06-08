#!/usr/bin/env bash
#
# check-memory-size.sh — ALERT-ONLY guard on MEMORY.md (Layer 0) size.
#
# Sister script of rotate-log.sh, but ALERT-ONLY: it NEVER mutates MEMORY.md.
# Re-compaction requires judgment (trim verbose hooks → linked atomic file, with
# ZERO pointer loss); auto-trimming would risk dropping pointers, so this guard
# only SURFACES the drift and leaves the fix to a human/agent.
#
# Why this exists: MEMORY.md (auto-loaded Layer 0) silently regrew 19.4KB → 24.8KB
# and crossed the ~24.4KB truncation line — making part of the pointer index
# invisible without any signal. This converts that silent regrowth into a visible
# SessionStart warning (PULL→PUSH). Ref: memory project_memory_context_architecture
# (P0 compaction target ≤20KiB, P4 observe).
#
# Behaviour (deterministic, no LLM, no git, idempotent):
#   - Under threshold  → no output, exit 0 (silent no-op).
#   - Over threshold   → ONE warning line to stdout, exit 0 (never blocks).
#   - Missing file / any error → exit 0 (fail-open, like the other SessionStart hook).
#
# Usage:
#   check-memory-size.sh [MEMORY_FILE] [SOFT_LIMIT_BYTES]
# Defaults: MEMORY_FILE derived from $HOME + canonical project path; 20480 (20 KiB).
# The caller (sessionstart-workspace-context.sh) passes the resolved path so this
# stays worktree-agnostic and free of hardcoded user/infra paths.

set -uo pipefail

# Rollback rapide (cohérent avec les autres hooks).
[ "${CLAUDE_HOOKS_DISABLE:-0}" = "1" ] && exit 0

MEM="${1:-${HOME}/.claude/projects/-opt-automecanik-app/memory/MEMORY.md}"
SOFT="${2:-20480}"   # 20 KiB — cible P0 (sous le seuil de troncature observé ~24,4KB)

[ -f "$MEM" ] || exit 0
BYTES=$(wc -c < "$MEM" 2>/dev/null || echo 0)
[ "$BYTES" -gt "$SOFT" ] 2>/dev/null || exit 0

printf '⚠️ MEMORY.md = %s o > %s (20 KiB, cible P0) — re-compacter Layer 0 (trim hooks → fichier lié, 0 pointeur perdu). Réf project_memory_context_architecture P0/P4.\n' "$BYTES" "$SOFT"
exit 0
