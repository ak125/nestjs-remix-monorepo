#!/usr/bin/env bash
# check-repo-freshness.sh — garde de fraîcheur d'un checkout git.
#
# But : empêcher un agent (ou un opérateur) de CONCLURE sur du code / du canon PÉRIMÉ.
# Détecte le RETARD (commits d'origin/main absents du HEAD local), PAS la divergence :
# travailler sur une branche feature / worktree est légitime (convention du repo) ; lire un
# `_scripts/` ou un canon N commits derrière origin/main ne l'est pas.
#
# Incident déclencheur (2026-07-02) : le checkout wiki `/opt/automecanik/automecanik-wiki`
# était 31 commits derrière origin/main → analyse conduite sur un vieux `build_exports_seo.py`
# et de vieilles fiches → 2 conclusions fausses. Ce garde aurait signalé le retard AVANT l'analyse.
#
# Usage :
#   scripts/ops/check-repo-freshness.sh [REPO_PATH] [UPSTREAM_REF]
#   REPO_PATH    : chemin du dépôt à vérifier (défaut : répertoire courant).
#   UPSTREAM_REF : référence amont de fraîcheur (défaut : origin/main).
#
# Mode (env FRESHNESS_MODE) :
#   warn   (défaut) : rapporte le retard, exit 0 (advisory — ne bloque pas).
#   strict          : exit 1 si le checkout est en retard (pour hook / CI opt-in).
#
# Exit codes : 0 = frais (ou retard en mode warn) · 1 = retard en mode strict ·
#              2 = erreur (pas un dépôt git, amont introuvable).
set -euo pipefail

REPO="${1:-.}"
UPSTREAM="${2:-origin/main}"
MODE="${FRESHNESS_MODE:-warn}"

fail() { echo "check-repo-freshness: $*" >&2; exit 2; }

git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "'$REPO' n'est pas un dépôt git."

REMOTE="${UPSTREAM%%/*}"   # ex. origin
# fetch best-effort : si offline, on continue mais on le signale (fraîcheur = inconnue).
if ! git -C "$REPO" fetch --quiet "$REMOTE" 2>/dev/null; then
  echo "⚠️  check-repo-freshness: fetch '$REMOTE' a échoué (offline ?) — fraîcheur NON vérifiée pour '$REPO'." >&2
  [ "$MODE" = "strict" ] && exit 1
  exit 0
fi

git -C "$REPO" rev-parse --verify --quiet "$UPSTREAM" >/dev/null \
  || fail "référence amont '$UPSTREAM' introuvable après fetch."

BRANCH="$(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
BEHIND="$(git -C "$REPO" rev-list --count "HEAD..$UPSTREAM")"
AHEAD="$(git -C "$REPO" rev-list --count "$UPSTREAM..HEAD")"

if [ "$BEHIND" -eq 0 ]; then
  echo "✅ FRESH: '$REPO' ($BRANCH) est à jour avec $UPSTREAM (ahead=$AHEAD)."
  exit 0
fi

echo "⚠️  STALE_CHECKOUT: '$REPO' ($BRANCH) est $BEHIND commit(s) DERRIÈRE $UPSTREAM (ahead=$AHEAD)." >&2
echo "    Le code/_scripts/canon lus ici peuvent être périmés. Avant de conclure :" >&2
echo "    - lire l'état réel via 'git show $UPSTREAM:<chemin>', ou" >&2
echo "    - mettre le checkout à jour (sans écraser un travail feature en cours)." >&2

[ "$MODE" = "strict" ] && exit 1
exit 0
