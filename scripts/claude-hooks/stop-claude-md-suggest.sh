#!/usr/bin/env bash
#
# stop-claude-md-suggest.sh — sous-script Stop hook, propose mise à jour
# de CLAUDE.md / MEMORY.md / .claude/rules quand la session a montré des
# signaux de correction itérative.
#
# Pattern Anthropic ("How Claude Code works in large codebases"):
#   "A stop hook can reflect on what happened during a session and propose
#    CLAUDE.md updates while the context is fresh"
#
# Signal disponible (le Stop hook n'a PAS accès aux messages user) :
#   - Subjects des N derniers commits sur la branche feature
#   - Si ≥ 2/N sont "fix:", "revert:", "correction:" → émet stderr suggestion
#
# Action proposée : suggestion seulement, JAMAIS d'auto-edit. L'humain décide.
#
# Désactivation : CLAUDE_HOOKS_DISABLE=1

set -u

if [ "${CLAUDE_HOOKS_DISABLE:-0}" = "1" ]; then
  exit 0
fi

REPO_ROOT="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null || echo /opt/automecanik/app)"
cd "$REPO_ROOT" 2>/dev/null || exit 0

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Skip on protected branches / no branch
case "$current_branch" in
  main|master|HEAD|"") exit 0 ;;
esac

# Compter les commits "fix:" / "revert:" / "correction:" parmi les 5 derniers
# de la branche feature (commits ahead of origin/main).
N=5
SUBJECTS=$(git log origin/main..HEAD --pretty=%s 2>/dev/null | head -n "$N")

if [ -z "$SUBJECTS" ]; then
  exit 0
fi

CORRECTIONS=$(printf '%s\n' "$SUBJECTS" | grep -cE '^(fix|revert|correction|hotfix)(\(|:)' || true)

# Marker pour éviter de spammer le même conseil à chaque Stop sur le même HEAD
MARKER_DIR="${REPO_ROOT}/.claude/.session-log-state"
mkdir -p "$MARKER_DIR" 2>/dev/null
SUGGEST_MARKER="${MARKER_DIR}/last-claude-md-suggest-head"
last_head="$(cat "$SUGGEST_MARKER" 2>/dev/null || echo '')"
current_head="$(git rev-parse HEAD 2>/dev/null || echo '')"

if [ "$last_head" = "$current_head" ]; then
  exit 0
fi

# Seuil : ≥ 2 corrections sur les 5 derniers commits → suggestion
if [ "$CORRECTIONS" -ge 2 ]; then
  cat >&2 <<EOF

[stop-claude-md-suggest] La branche '$current_branch' a $CORRECTIONS commits
de correction parmi les $N derniers. Cela peut signaler un pattern non
documenté qui mérite une mémoire MEMORY ou une règle .claude/rules/*.md.

Suggéré (action humaine, pas auto-edit) :
  1. Examiner les subjects fix/revert :
$(printf '%s\n' "$SUBJECTS" | grep -E '^(fix|revert|correction|hotfix)(\(|:)' | sed 's/^/       /')
  2. Si convention récurrente : ajouter une mémoire à
     /home/deploy/.claude/projects/-opt-automecanik-app/memory/ (type feedback)
     ou une règle dans .claude/rules/<topic>.md
  3. Sinon : skip — pas de capture nécessaire.

EOF
  printf '%s\n' "$current_head" > "$SUGGEST_MARKER"
fi

exit 0
