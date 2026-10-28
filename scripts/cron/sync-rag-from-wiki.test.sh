#!/usr/bin/env bash
# Test de sync-rag-from-wiki.sh sur des dépôts FIXTURE jetables (jamais les clones réels).
#
# Cas couverts : passage sans changement, export nouveau poussé avec le marqueur D22, clone wiki
# hors main (instantané de origin/main, clone intact), fichiers du miroir absents des exports et
# de la baseline héritée (error, rapport borné, miroir intact), baseline héritée (ok, compte
# rapporté, fichiers ignorés par git hors compte), baseline à resserrer (warn), retrait par
# tombstone lu à origin/main du clone raw (fichier épinglé retiré, contenu modifié préservé, warn),
# registre de tombstones illisible (error, miroir intact), verrou RAG déjà tenu (passage sauté),
# clone rag hors main (error). Chaque cas vérifie l'état enregistré pour le hook SessionStart
# (cron_report).
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
export AUTOMECANIK_WIKI_PATH="$FIX/wiki" AUTOMECANIK_RAG_PATH="$FIX/rag" AUTOMECANIK_RAW_PATH="$FIX/raw" APP_PATH="$FIX/app"
export SYNC_RAG_LOG_DIR="$FIX/logs" RAG_GLOBAL_LOCK="$FIX/rag-global.lock" CRON_STATE_DIR="$FIX/state"
export TMPDIR="$FIX/tmp"
mkdir -p "$TMPDIR"
STATE="$FIX/state/sync-rag-from-wiki.json"
BASELINE="$FIX/app/audit/baselines/rag-mirror-legacy-baseline.json"

repo() { # repo <nom> : dépôt de travail sur main + origine nue
  git init -q --bare -b main "$FIX/$1.git"
  git init -q -b main "$FIX/$1"
  git -C "$FIX/$1" remote add origin "$FIX/$1.git"
}
commit_push() { git -C "$1" add -A && git -C "$1" commit -qm "$2" && git -C "$1" push -q -u origin main 2>/dev/null; }
run() { bash "$SCRIPT" >"$FIX/out.txt" 2>&1; echo $?; }
field() { jq -r ".$1" "$STATE" 2>/dev/null; }
baseline() { # baseline <chemin>... : baseline héritée de la fixture (triée)
  printf '%s\n' "$@" | sed '/^$/d' | LC_ALL=C sort | jq -R . | jq -s '{rule: "fixture", total: length, files: .}' >"$BASELINE"
}
tomb() { # tomb <chemin sous knowledge/> <sha256> : tombstone rag-mirror
  jq -cn --arg p "$1" --arg s "$2" \
    '{id: ("rag-mirror:" + $p + "@" + $s[0:12]), scope: "rag-mirror", original_path: ("knowledge/" + $p), sha256: $s}'
}
registry() { # registry <tombstone>... : registre du clone raw (non commité)
  printf '%s\n' "$@" | jq -s '{_schema_version: "1.1.0", tombstones: .}' >"$FIX/raw/manifests/tombstones.json"
}

mkdir -p "$FIX/app/scripts/rag-sync"
git init -q "$FIX/app"
cp "$HERE/../rag-sync/sync-wiki-exports-to-rag.py" "$FIX/app/scripts/rag-sync/"
mkdir -p "$(dirname "$BASELINE")"
baseline
repo wiki
mkdir -p "$FIX/wiki/exports/rag/gammes"
echo 'export validé' >"$FIX/wiki/exports/rag/gammes/oil.md"
commit_push "$FIX/wiki" init
repo rag
mkdir -p "$FIX/rag/knowledge/gammes"
cp "$FIX/wiki/exports/rag/gammes/oil.md" "$FIX/rag/knowledge/gammes/"
printf 'knowledge/.last-sync.json\nknowledge/_raw/\n' >"$FIX/rag/.gitignore"
commit_push "$FIX/rag" init
repo raw
mkdir -p "$FIX/raw/manifests"
echo '{"_schema_version": "1.0.0", "tombstones": []}' >"$FIX/raw/manifests/tombstones.json"
commit_push "$FIX/raw" init

echo "1. passage sans changement"
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "aucun changement (wiki @ $(git -C "$FIX/wiki" rev-parse --short HEAD)) ; hérités hors exports : 0 (baseline 0)" "$(field summary)"
check "silence toléré déclaré" 10800 "$(field max_age_s)"

echo "2. export nouveau"
echo 'nouvel export' >"$FIX/wiki/exports/rag/gammes/brake.md"
commit_push "$FIX/wiki" brake
WSHA="$(git -C "$FIX/wiki" rev-parse --short HEAD)"
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "miroir synchronisé @ $WSHA ; hérités hors exports : 0 (baseline 0)" "$(field summary)"
check "commit poussé avec le marqueur D22" "synced-from-wiki: $WSHA" "$(git -C "$FIX/rag.git" log -1 --format=%s main)"
check "fichier poussé" "nouvel export" "$(git -C "$FIX/rag.git" show main:knowledge/gammes/brake.md)"
check "manifeste jamais commité" absent "$(git -C "$FIX/rag.git" cat-file -e main:knowledge/.last-sync.json 2>/dev/null && echo présent || echo absent)"

echo "3. clone wiki hors main : instantané de origin/main, clone intact"
git -C "$FIX/wiki" checkout -q -b feature
echo 'non validé' >"$FIX/wiki/exports/rag/gammes/draft.md"
git -C "$FIX/wiki" add -A && git -C "$FIX/wiki" commit -qm draft
echo 'brouillon local' >"$FIX/wiki/exports/rag/gammes/local.md"
FEATURE_HEAD="$(git -C "$FIX/wiki" rev-parse HEAD)"
git clone -q "$FIX/wiki.git" "$FIX/wiki-other"
echo 'export fusionné' >"$FIX/wiki-other/exports/rag/gammes/filter.md"
commit_push "$FIX/wiki-other" filter
MSHA="$(git -C "$FIX/wiki-other" rev-parse --short HEAD)"
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "miroir synchronisé @ $MSHA ; hérités hors exports : 0 (baseline 0)" "$(field summary)"
check "commit poussé depuis origin/main" "synced-from-wiki: $MSHA" "$(git -C "$FIX/rag.git" log -1 --format=%s main)"
check "export de main poussé" "export fusionné" "$(git -C "$FIX/rag.git" show main:knowledge/gammes/filter.md)"
check "branche du clone non lue" "absent absent" "$(for f in draft local; do [ -e "$FIX/rag/knowledge/gammes/$f.md" ] && echo -n présent || echo -n absent; [ "$f" = draft ] && echo -n ' '; done)"
check "clone wiki intact" "feature $FEATURE_HEAD brouillon local" \
  "$(git -C "$FIX/wiki" symbolic-ref --short HEAD) $(git -C "$FIX/wiki" rev-parse HEAD) $(cat "$FIX/wiki/exports/rag/gammes/local.md")"
check "instantané supprimé" 0 "$(find "$TMPDIR" -maxdepth 1 -name 'sync-rag-wiki.*' | wc -l)"
rm "$FIX/wiki/exports/rag/gammes/local.md"
git -C "$FIX/wiki" checkout -q main

echo "4. fichiers du miroir absents des exports"
mkdir -p "$FIX/rag/knowledge/legacy"
for i in $(seq -w 1 30); do echo 'corpus historique' >"$FIX/rag/knowledge/legacy/l$i.md"; done
check "code retour" 1 "$(run)"
check "statut" error "$(field status)"
check "résumé" "échec à l'étape [3/4] sync (code 1), voir $FIX/logs/sync-rag-from-wiki.log" "$(field summary)"
check "fichiers nommés dans le log" 20 "$(grep -c '^UNRECONCILED ' "$FIX/out.txt")"
check "décompte complet" 1 "$(grep -c '^sync-from-wiki: 30 mirror files absent from WIKI exports and legacy baseline (20 listed, set sha256 ' "$FIX/out.txt")"
check "miroir intact" 30 "$(find "$FIX/rag/knowledge/legacy" -name '*.md' | wc -l)"
check "série en échec" 1 "$(field streak)"

echo "4b. corpus hérité publié, inscrit à la baseline ; fichiers ignorés par git"
commit_push "$FIX/rag" legacy
RSHA="$(git -C "$FIX/rag.git" rev-parse main)"
baseline $(cd "$FIX/rag/knowledge" && find legacy -name '*.md')
mkdir -p "$FIX/rag/knowledge/_raw/web"
echo 'page brute' >"$FIX/rag/knowledge/_raw/web/page.md"
check "code retour" 0 "$(run)"
check "statut" ok "$(field status)"
check "résumé" "aucun changement (wiki @ $MSHA) ; hérités hors exports : 30 (baseline 30)" "$(field summary)"
check "aucun commit rag" "$RSHA" "$(git -C "$FIX/rag.git" rev-parse main)"
check "compte au manifeste" "30 30" "$(jq -r '.legacy_unreconciled | "\(.count) \(.baseline_total)"' "$FIX/rag/knowledge/.last-sync.json")"
check "provenance au manifeste" "automecanik-wiki@$(git -C "$FIX/wiki.git" rev-parse main)" "$(jq -r .source_ref "$FIX/rag/knowledge/.last-sync.json")"

echo "4c. entrée de baseline obsolète"
baseline $(cd "$FIX/rag/knowledge" && find legacy -name '*.md') legacy/retiré.md
check "code retour" 0 "$(run)"
check "statut" warn "$(field status)"
check "résumé" "aucun changement (wiki @ $MSHA) ; hérités hors exports : 30 (baseline 31) ; baseline héritée à resserrer : 1 entrée(s) obsolète(s)" "$(field summary)"
check "entrée nommée dans le log" 1 "$(grep -c '^STALE-BASELINE legacy/retiré.md ' "$FIX/out.txt")"

echo "4d. retrait par tombstone (registre raw à origin/main)"
LEGACY_SHA="$(sha256sum "$FIX/rag/knowledge/legacy/l01.md" | cut -d' ' -f1)"
registry "$(tomb legacy/l01.md "$LEGACY_SHA")" "$(tomb legacy/l02.md "$(printf autre | sha256sum | cut -d' ' -f1)")"
commit_push "$FIX/raw" tombstones
RAWSHA="$(git -C "$FIX/raw.git" rev-parse --short main)"
registry "$(tomb legacy/l01.md "$LEGACY_SHA")" "$(tomb legacy/l03.md "$LEGACY_SHA")"  # arbre de travail, non poussé
check "code retour" 0 "$(run)"
check "statut" warn "$(field status)"
check "résumé" "miroir synchronisé @ $MSHA ; hérités hors exports : 29 (baseline 31) ; retirés par tombstone : 1 (raw @ $RAWSHA) ; baseline héritée à resserrer : 2 entrée(s) obsolète(s) ; fichier(s) tombstoné(s) modifié(s) depuis leur tombstone, préservé(s) : 1" "$(field summary)"
check "commit poussé avec le marqueur D22" "synced-from-wiki: $MSHA" "$(git -C "$FIX/rag.git" log -1 --format=%s main)"
check "provenance du retrait" 1 "$(git -C "$FIX/rag.git" log -1 --format=%b main | grep -c "^Withdrawals: automecanik-raw@$RAWSHA manifests/tombstones.json (ADR-031 §D21), 1 file(s)$")"
check "seul le fichier épinglé est retiré" "D	knowledge/legacy/l01.md" "$(git -C "$FIX/rag.git" show --format= --name-status main)"
check "contenu différent préservé" 1 "$(grep -c '^TOMBSTONE-MISMATCH legacy/l02.md ' "$FIX/out.txt")"
check "arbre de travail raw non lu, clone intact" "présent $LEGACY_SHA" \
  "$([ -e "$FIX/rag/knowledge/legacy/l03.md" ] && echo -n présent || echo -n absent) $(jq -r '.tombstones[1].sha256' "$FIX/raw/manifests/tombstones.json")"
check "registre temporaire supprimé" 0 "$(find "$TMPDIR" -maxdepth 1 -name 'sync-rag-tombstones.*' | wc -l)"
git -C "$FIX/raw" checkout -q -- manifests/tombstones.json
baseline $(cd "$FIX/rag/knowledge" && find legacy -name '*.md')

echo "4e. registre de tombstones illisible"
echo 'pas du json' >"$FIX/raw/manifests/tombstones.json"
commit_push "$FIX/raw" cassé
RSHA="$(git -C "$FIX/rag.git" rev-parse main)"
check "code retour" 1 "$(run)"
check "statut" error "$(field status)"
check "résumé" "échec à l'étape [3/4] sync (code 1), voir $FIX/logs/sync-rag-from-wiki.log" "$(field summary)"
check "aucun commit rag" "$RSHA" "$(git -C "$FIX/rag.git" rev-parse main)"
check "miroir intact" 29 "$(find "$FIX/rag/knowledge/legacy" -name '*.md' | wc -l)"
git -C "$FIX/raw" revert --no-edit HEAD >/dev/null && git -C "$FIX/raw" push -q origin main 2>/dev/null
check "registre réparé" 0 "$(run)"

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
