#!/usr/bin/env bash
# SessionStart hook — émet contexte workspace + TOP PRIORITIES + KNOWN INCIDENTS
#
# Pattern Anthropic ("How Claude Code works in large codebases"):
#   "A start hook can load team-specific context dynamically so every
#    developer gets the right setup for their module"
#
# Émet via stdout un manifest compact ≤ 500 tokens lu comme additional
# context au début de chaque session. Borné par assertion `wc -c < 2000`.
#
# Détection workspace : walk-up `package.json` (pas `case $PWD` hardcodé).
#
# Désactivation rapide : `CLAUDE_HOOKS_DISABLE=1` court-circuite sans diff git.

set -euo pipefail

# Rollback rapide
if [ "${CLAUDE_HOOKS_DISABLE:-0}" = "1" ]; then
  exit 0
fi

CWD="${PWD:-/opt/automecanik/app}"
# REPO_ROOT = top-level du git repo courant (worktree-aware).
# Fallback path canon si on est hors git.
if REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null); then
  :
else
  REPO_ROOT="/opt/automecanik/app"
fi
# Anchor de comparaison : le path attendu de la racine canonique (worktrees vivent sous
# .claude/worktrees/ et leur toplevel = leur propre path). On normalise pour matcher.
REPO_ROOT_CANON="/opt/automecanik/app"

# Walk-up : trouver le premier package.json (workspace ou racine)
find_workspace_root() {
  local dir="$1"
  while [ "$dir" != "/" ] && [ "$dir" != "$REPO_ROOT/.." ]; do
    if [ -f "$dir/package.json" ]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  echo "$REPO_ROOT"
}

WORKSPACE_DIR=$(find_workspace_root "$CWD")
WORKSPACE_NAME=$(basename "$WORKSPACE_DIR")

# Comparaison sur le SUFFIX (relatif au REPO_ROOT) pour être worktree-aware.
# WORKSPACE_REL = path après le toplevel du repo (vide si racine).
WORKSPACE_REL="${WORKSPACE_DIR#$REPO_ROOT}"
WORKSPACE_REL="${WORKSPACE_REL#/}"

case "$WORKSPACE_REL" in
  "")
    WORKSPACE_LABEL="monorepo-root (dev session)"
    SKILLS_HINT="8 skills DEV (code-review, db-migration, frontend-design, governance-vault-ops, responsive-audit, session-log, ui-ux-pro-max, vehicle-ops) + 2 nouveaux (runtime-truth-audit, web-vitals-audit)"
    ;;
  "workspaces/seo-batch")
    WORKSPACE_LABEL="workspaces/seo-batch (SEO campaigns)"
    SKILLS_HINT="39 agents R0-R8 + 16 skills SEO (content-gen, kw-classify, v5-guardian, ...)"
    ;;
  "workspaces/marketing")
    WORKSPACE_LABEL="workspaces/marketing (G1 brand voice + AEC)"
    SKILLS_HINT="3 agents marketing (LEAD/LOCAL/RETENTION) + canon brand voice"
    ;;
  "workspaces/wiki")
    WORKSPACE_LABEL="workspaces/wiki (documentation sas ADR-033)"
    SKILLS_HINT="skill wiki-proposal-writer + canon ADR-033"
    ;;
  *)
    WORKSPACE_LABEL="$WORKSPACE_NAME (custom workspace or worktree)"
    SKILLS_HINT="Worktree de dev — skills hérités du monorepo-root"
    ;;
esac

# Lecture top-priorities.md (machine-readable) — chercher dans le toplevel courant
# (worktree-aware) puis fallback canon.
TOP_FILE="$REPO_ROOT/.claude/top-priorities.md"
if [ ! -f "$TOP_FILE" ] && [ -f "$REPO_ROOT_CANON/.claude/top-priorities.md" ]; then
  TOP_FILE="$REPO_ROOT_CANON/.claude/top-priorities.md"
fi

extract_section() {
  local section="$1"
  if [ ! -f "$TOP_FILE" ]; then
    echo "(top-priorities.md absent)"
    return
  fi
  awk -v s="## ${section}" '
    $0 == s { flag=1; next }
    /^## / { flag=0 }
    flag && /^- / { print }
  ' "$TOP_FILE"
}

# Assemblage compact
{
  echo "## Workspace en cours"
  echo "$WORKSPACE_LABEL"
  echo ""
  echo "Surface : $SKILLS_HINT"
  echo ""
  echo "## TOP priorities (do these)"
  extract_section "TOP"
  echo ""
  echo "## DO NOT start (paused by doctrine)"
  extract_section "DO_NOT_START"
  echo ""
  echo "## Active incidents (transient — be careful)"
  extract_section "ACTIVE_INCIDENTS"
  echo ""
  echo "## Structural constraints (permanent gotchas)"
  extract_section "STRUCTURAL_CONSTRAINTS"
  echo ""
  echo "_Source : .claude/top-priorities.md — mise à jour max 1×/sem_"
} > /tmp/sessionstart-output.txt

# Garde-taille MEMORY.md (Layer 0) — alerte ALERT-ONLY si re-gonflement >20KiB.
# Émise hors du manifest borné (ligne courte, rare, jamais bloquante). Sœur de
# rotate-log.sh. Réf project_memory_context_architecture (P0 ≤20KiB / P4 observe).
MEM_FILE="${HOME}/.claude/projects/$(printf '%s' "$REPO_ROOT_CANON" | tr '/' '-')/memory/MEMORY.md"
bash "$REPO_ROOT/scripts/claude-hooks/check-memory-size.sh" "$MEM_FILE" 2>/dev/null || true

# Borne taille : sortie ≤ 2000 bytes (~500 tokens). Si dépasse → fail silencieux (exit 0)
# avec message stderr ; ne JAMAIS bloquer la session sur ce défaut.
SIZE=$(wc -c < /tmp/sessionstart-output.txt)
if [ "$SIZE" -gt 2000 ]; then
  echo "WARN: SessionStart output $SIZE > 2000 bytes — manifest dépasse la borne" >&2
  echo "→ vérifier les bornes top-priorities.md (TOP≤5, DO_NOT_START≤7, ...)" >&2
  # On émet quand même mais tronqué pour ne pas saturer le contexte
  head -c 2000 /tmp/sessionstart-output.txt
  exit 0
fi

cat /tmp/sessionstart-output.txt
exit 0
