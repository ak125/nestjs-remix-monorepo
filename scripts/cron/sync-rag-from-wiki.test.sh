#!/usr/bin/env bash
# Test de sync-rag-from-wiki.sh sur des dépôts FIXTURE jetables (jamais les clones réels).
#
# Cas couverts : passage sans changement, export nouveau poussé avec le marqueur D22, clone wiki
# hors main (warn), fichiers du miroir absents des exports (error, rapport borné, miroir intact),
# verrou RAG déjà tenu (passage sauté), clone rag hors main (error). Chaque cas vérifie l'état
# enregistré pour le hook SessionStart (cron_report).
#
# Usage : bash sync-rag-from-wiki.test.sh
#         SYNC_RAG_SCRIPT=/chemin/autre-version.sh bash sync-rag-from-wiki.test.sh
# Dépendances : git, flock, jq, python3.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${SYNC_RAG_SCRIPT:-$HERE/sync-rag-from-wiki.sh}"
command -v jq >/dev/null 2>&1 || { echo "ÉCHEC — jq absent : test impossible"; exit 2; }
FIX="$(mktemp -d "${TMPDIR:-/tmp}/sync-rag-test.XXXXXX")"
FAIL=0
trap 'rm -rf "$FIX"' EXIT

check() { # check <description> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi
}

# --- Isolation : aucune config git globale/système, aucun clone, log, verrou ni état réels ---
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR XDG_STATE_HOME CRON_REPORT_MAX_AGE_S
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export AUTOMECANIK_WIKI_PATH="$FIX/wiki" AUTOMECANIK_RAG_PATH="$FIX/rag" APP_PATH="$FIX/app"
export SYNC_RAG_LOG_DIR="$FIX/logs" RAG_GLOBAL_LOCK="$FIX/rag-global.lock" CRON_STATE_DIR="$FIX/state"
STATE="$FIX/state/sync-rag-from-wiki.json"

repo() { # repo <nom> : dépôt de travail sur main + origine nue
  git init -q --bare -b main "$FIX/$1.git"
  git init -q -b main "$FIX/$1"
  git -C "$FIX/$1" remote add origin "$FIX/$1.git"
}
commit_push() { git -C "$1" add -A && git -C "$1" commit -qm "$2" && git -C "$1" push -q -u origin main 2>/dev/null; }
run() { bash "$SCRIPT" >"$FIX/out.txt" 2>&1; echo $?; }
field() { jq -r ".$1" "$STATE" 2>/dev/null; }

mkdir -p "$FIX/app/scripts/rag-sync"
git init -q "$FIX/app"
cp "$HERE/../rag-sync/sync-wiki-exports-to-rag.py" "$FIX/app/scripts/rag-sync/"
repo wiki
mkdir -p "$FIX/wiki/exports/rag/gammes"
echo 'export validé' >"$FIX/wiki/exports/rag/gammes/oil.md"
commit_push "$FIX/wiki" init
repo rag
mkdir -p "$FIX/rag/knowledge/gammes"
cp "$FIX/wiki/exports/rag/gammes/oil.md" "$FIX/rag/knowledge/gammes/"
commit_push "$FIX/rag" init

echo "1. passage sans changement"
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "aucun changement (wiki @ $(git -C "$FIX/wiki" rev-parse --short HEAD))" "$(field summary)"
check "silence toléré déclaré" 10800 "$(field max_age_s)"

echo "2. export nouveau"
echo 'nouvel export' >"$FIX/wiki/exports/rag/gammes/brake.md"
commit_push "$FIX/wiki" brake
WSHA="$(git -C "$FIX/wiki" rev-parse --short HEAD)"
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "miroir synchronisé @ $WSHA" "$(field summary)"
check "commit poussé avec le marqueur D22" "synced-from-wiki: $WSHA" "$(git -C "$FIX/rag.git" log -1 --format=%s main)"
check "fichier poussé" "nouvel export" "$(git -C "$FIX/rag.git" show main:knowledge/gammes/brake.md)"
check "manifeste jamais commité" absent "$(git -C "$FIX/rag.git" cat-file -e main:knowledge/.last-sync.json 2>/dev/null && echo présent || echo absent)"

echo "3. clone wiki hors main"
git -C "$FIX/wiki" checkout -q -b feature
check "code retour" 0 "$(run)"
check "statut" warn "$(field status)"
check "résumé" "aucun changement (wiki @ $WSHA) ; clone wiki sur feature et non main : pull sauté, miroir alimenté hors main" "$(field summary)"
git -C "$FIX/wiki" checkout -q main

echo "4. fichiers du miroir absents des exports"
mkdir -p "$FIX/rag/knowledge/legacy"
for i in $(seq -w 1 30); do echo 'corpus historique' >"$FIX/rag/knowledge/legacy/l$i.md"; done
check "code retour" 1 "$(run)"
check "statut" error "$(field status)"
check "résumé" "échec à l'étape [3/4] sync (code 1), voir $FIX/logs/sync-rag-from-wiki.log" "$(field summary)"
check "fichiers nommés dans le log" 20 "$(grep -c '^UNRECONCILED ' "$FIX/out.txt")"
check "décompte complet" 1 "$(grep -c '^sync-from-wiki: 30 mirror files absent from WIKI exports (20 listed, set sha256 ' "$FIX/out.txt")"
check "miroir intact" 30 "$(find "$FIX/rag/knowledge/legacy" -name '*.md' | wc -l)"
check "série en échec" 1 "$(field streak)"
rm -rf "$FIX/rag/knowledge/legacy"

echo "5. verrou RAG déjà tenu"
exec 9>"$RAG_GLOBAL_LOCK"
flock 9
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "passage sauté : autre opération RAG en cours" "$(field summary)"
exec 9>&-

echo "6. clone rag hors main"
git -C "$FIX/rag" checkout -q -b other
check "code retour" 3 "$(run)"
check "statut" error "$(field status)"
check "résumé" "échec à l'étape [2/4] pull rag (code 3), voir $FIX/logs/sync-rag-from-wiki.log" "$(field summary)"
git -C "$FIX/rag" checkout -q main

if [[ $FAIL -eq 0 ]]; then echo "OK — tous les cas passent"; else echo "ÉCHEC — voir ci-dessus"; fi
exit "$FAIL"
