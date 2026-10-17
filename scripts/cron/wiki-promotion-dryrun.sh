#!/usr/bin/env bash
# ==============================================================================
# wiki-promotion-dryrun.sh — décision de promotion WIKI rejouée chaque jour, sans écrire
#
# Rejoue le décideur canonique de promotion du WIKI (`_scripts/promote.py --all
# --dry-run`, un seul décideur pour dry-run et apply) sur `origin/main` du WIKI ET du
# RAW, récupérés au début du run, provenance cross-repo (raw_ref) réellement évaluée.
#
# Pourquoi un cron DEV et pas GitHub Actions : décision owner du 2026-07-04 (WIKI
# 9c17a88, « enforce governed activation without cross-repo secrets ») — aucun
# credential cross-repo en CI ; une opération cross-repo tourne hors CI, avec les 2
# dépôts présents et frais. Cette machine lit déjà le RAW (privé) : aucun jeton à créer.
# Même choix que sync-rag-from-wiki.sh.
#
# Ce que le script fait :
#   1. `git fetch origin main` sur les 2 clones (seules les refs distantes bougent ;
#      working tree, branche et index des clones ne sont jamais touchés) ;
#   2. exporte `origin/main` du WIKI et `manifests/` du RAW dans un répertoire jetable ;
#   3. matérialise les seules archives RAW que le résolveur CANONIQUE du WIKI
#      (`quality-gates.source_archive_paths`) désigne pour les sources `active` — la
#      résolution n'est pas réimplémentée ici ;
#   4. lance `promote.py --all --dry-run --format json --raw-root <export RAW>` ;
#   5. écrit le rapport et l'état du job (`cron_report`, alerte au SessionStart).
#
# Ce qu'il ne fait jamais : `--apply` (promouvoir = acte owner), écrire dans un clone,
# lire un working tree de clone (périmé ou sur une autre branche), télécharger un objet
# LFS. Un pointeur LFS parmi les archives à vérifier arrête le run : l'empreinte d'un
# pointeur rendrait un faux `raw_archive_sha_drift`, verdict contenu sur une cause infra.
#
# Statut (cron_report) :
#   ok    décision rendue pour chaque proposition, provenance évaluée, 0 éligible
#   warn  ≥ 1 proposition ÉLIGIBLE : la promotion est possible, c'est un acte owner
#   error entrée illisible, fetch/export en échec, pointeur LFS, promote.py en échec ou
#         sortie invalide, et toute cause INFRA rapportée par le décideur :
#         PROVENANCE_GATE_UNAVAILABLE, EVALUATION_ERROR, UNKNOWN_FAIL_CLOSED. Un RAW
#         absent ne passe jamais pour une liste de propositions bloquées.
#   Code de sortie : 1 si error, 0 sinon.
#
# Rapport : $REPORT_DIR/latest.json et <UTC>-<wiki7>-<raw7>.json (30 jours), enveloppe
#   { generated_at, wiki_sha, raw_sha, mode, metrics, promote } — `promote` = sortie
#   brute du décideur, chemins des propositions relatifs au WIKI.
#
# Cadence : quotidienne (crontab DEV de l'utilisateur deploy, installée par l'owner).
#
# Env (optionnels) :
#   AUTOMECANIK_WIKI_PATH       clone WIKI (défaut /opt/automecanik/automecanik-wiki)
#   AUTOMECANIK_RAW_PATH        clone RAW  (défaut /opt/automecanik/automecanik-raw) —
#                               retiré de l'environnement de promote.py, qui le
#                               préférerait à --raw-root
#   WIKI_PROMOTION_REPORT_DIR   défaut ${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/wiki-promotion
#   PYTHON                      défaut python3 (deps : celles du job promotion-gates du WIKI)
# ==============================================================================
set -euo pipefail

source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || \
  source /opt/automecanik/app/scripts/cron/lib-supabase-report.sh 2>/dev/null || true
if ! command -v cron_report >/dev/null 2>&1; then
  cron_report() { echo "[cron_report] ⚠️ lib-supabase-report.sh introuvable — état de '$1' NON enregistré ($2)" >&2; }
fi

JOB="wiki-promotion-dryrun"
export CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-180000}" # 50 h : cadence quotidienne + marge
WIKI_REPO="${AUTOMECANIK_WIKI_PATH:-/opt/automecanik/automecanik-wiki}"
RAW_REPO="${AUTOMECANIK_RAW_PATH:-/opt/automecanik/automecanik-raw}"
REPORT_DIR="${WIKI_PROMOTION_REPORT_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/wiki-promotion}"
PYTHON="${PYTHON:-python3}"
RETENTION_DAYS=30
LFS_POINTER_HEADER="version https://git-lfs.github.com/spec/v1"

START=$(date +%s)
WORK=""
ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }
log() { echo "[$(ts)] $*"; }
cleanup() { if [ -n "$WORK" ]; then rm -rf "$WORK"; fi; }
trap cleanup EXIT

finish() { # finish <ok|warn|error> <metrics-json> <résumé>
  cron_report "$JOB" "$1" "$(( $(date +%s) - START ))" "$2" "$3"
  log "RESULT status=$1 — $3"
  if [ "$1" = error ]; then exit 1; fi
  exit 0
}
fail() { # fail <étape> <détail>
  local metrics='{}'
  if command -v jq >/dev/null 2>&1; then metrics=$(jq -nc --arg stage "$1" '{stage: $stage}'); fi
  finish error "$metrics" "$1 : $2"
}

command -v jq >/dev/null 2>&1 || fail preflight "jq absent"

exec 9>"${TMPDIR:-/tmp}/${JOB}.lock"
if ! flock -n 9; then
  log "run précédent encore actif — ce tick ne fait rien (CRON_REPORT_MAX_AGE_S signale un run bloqué)"
  exit 0
fi

log "=== ${JOB} start ==="

# --- 1. Clones présents, puis refs distantes fraîches ---
for repo in "$WIKI_REPO" "$RAW_REPO"; do
  git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || fail preflight "$repo n'est pas un dépôt git"
done
git -C "$WIKI_REPO" fetch -q origin main || fail fetch "WIKI ($WIKI_REPO)"
git -C "$RAW_REPO" fetch -q origin main || fail fetch "RAW ($RAW_REPO)"
WIKI_SHA=$(git -C "$WIKI_REPO" rev-parse --verify -q 'origin/main^{commit}') || fail fetch "origin/main WIKI introuvable"
RAW_SHA=$(git -C "$RAW_REPO" rev-parse --verify -q 'origin/main^{commit}') || fail fetch "origin/main RAW introuvable"
log "WIKI origin/main ${WIKI_SHA:0:7} · RAW origin/main ${RAW_SHA:0:7}"

# --- 2. Exports jetables (jamais le working tree d'un clone) ---
WORK=$(mktemp -d "${TMPDIR:-/tmp}/${JOB}.XXXXXX")
mkdir "$WORK/wiki" "$WORK/raw"
git -C "$WIKI_REPO" archive "$WIKI_SHA" | tar -x -C "$WORK/wiki" || fail export "WIKI ${WIKI_SHA:0:7}"
git -C "$RAW_REPO" archive "$RAW_SHA" manifests | tar -x -C "$WORK/raw" || fail export "RAW manifests ${RAW_SHA:0:7}"

# --- 3. Archives RAW désignées par le résolveur canonique du WIKI ---
# Les échecs de résolution (`raw_archive_unresolved`, chemin invalide) ne sont PAS
# traités ici : le gate de provenance les rapporte lui-même comme verdict de contenu.
RESOLVED="$WORK/archives.list"
if ! env -u AUTOMECANIK_RAW_PATH "$PYTHON" - "$WORK/wiki" "$WORK/raw" > "$RESOLVED" <<'PY'
import importlib.util
import sys
from pathlib import Path

wiki, raw = Path(sys.argv[1]), Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("_quality_gates", wiki / "_scripts" / "quality-gates.py")
qg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qg)
# Mêmes affectations que promotion_decision._run_real_evaluators.
qg.SOURCE_CATALOG = wiki / "_meta" / "source-catalog.yaml"
qg.RAW_INVENTORY = raw / "manifests" / "source-inventory.csv"
paths, _failures = qg.source_archive_paths(qg.load_source_catalog())
root = qg.RAW_INVENTORY.parent.parent.resolve()
for path in sorted(set(paths.values())):
    sys.stdout.write(f"{path.relative_to(root)}\0")
PY
then
  fail resolve "quality-gates.source_archive_paths en échec"
fi
mapfile -d '' ARCHIVES < "$RESOLVED"

PRESENT=()
for path in "${ARCHIVES[@]}"; do
  # Absente de l'arbre RAW : laissée absente, le gate rapporte `raw_archive_missing`.
  if git -C "$RAW_REPO" cat-file -e "${RAW_SHA}:${path}" 2>/dev/null; then PRESENT+=("$path"); fi
done
if [ "${#PRESENT[@]}" -gt 0 ]; then
  git -C "$RAW_REPO" archive "$RAW_SHA" -- "${PRESENT[@]}" | tar -x -C "$WORK/raw" \
    || fail export "archives RAW (${#PRESENT[@]})"
fi
LFS=()
for path in "${PRESENT[@]}"; do
  if [ -f "$WORK/raw/$path" ] && [ "$(head -n 1 -- "$WORK/raw/$path")" = "$LFS_POINTER_HEADER" ]; then
    LFS+=("$path")
  fi
done
if [ "${#LFS[@]}" -gt 0 ]; then
  fail lfs "pointeur(s) LFS parmi les archives à vérifier, matérialisation non prise en charge : ${LFS[*]}"
fi
log "archives RAW : ${#ARCHIVES[@]} résolue(s), ${#PRESENT[@]} présente(s) dans l'arbre"

# --- 4. Décideur canonique, dry-run ---
set +e
(cd "$WORK" && env -u AUTOMECANIK_RAW_PATH "$PYTHON" "$WORK/wiki/_scripts/promote.py" \
  --wiki-root "$WORK/wiki" --raw-root "$WORK/raw" --all --dry-run --format json) \
  > "$WORK/promote.json" 2> "$WORK/promote.err"
rc=$?
set -e
if [ "$rc" -ne 0 ]; then
  fail promote "promote.py exit ${rc} : $(tail -n 3 "$WORK/promote.err" | tr '\n' ' ')"
fi
jq -e '(.report | type == "array") and (.apply == false)' "$WORK/promote.json" >/dev/null 2>&1 \
  || fail promote "sortie JSON invalide, sans report[] ou avec apply != false"

METRICS=$(jq -c --arg wiki "$WIKI_SHA" --arg raw "$RAW_SHA" \
  --argjson resolved "${#ARCHIVES[@]}" --argjson present "${#PRESENT[@]}" '
  [.report[] | (.blocking_reasons // [])[] | .code] as $codes
  | def count($code): [$codes[] | select(. == $code)] | length;
  { wiki_sha: $wiki, raw_sha: $raw,
    raw_archives_resolved: $resolved, raw_archives_present: $present,
    proposals: (.report | length),
    eligible: (.eligible // 0), blocked: (.blocked // 0),
    unknown_fail_closed: (.unknown_fail_closed // 0),
    skipped: ([.report[] | select(.promotion_status == "SKIP")] | length),
    provenance_unavailable: count("PROVENANCE_GATE_UNAVAILABLE"),
    evaluation_errors: count("EVALUATION_ERROR"),
    blocking_codes: ($codes | group_by(.) | map({key: .[0], value: length}) | from_entries) }' \
  "$WORK/promote.json") || fail promote "agrégation du rapport impossible"

# --- 5. Rapport (écrit avant le verdict : un run en erreur reste diagnosticable) ---
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$REPORT_DIR/${STAMP}-${WIKI_SHA:0:7}-${RAW_SHA:0:7}.json"
mkdir -p "$REPORT_DIR" || fail report "$REPORT_DIR non inscriptible"
jq --arg at "$STAMP" --arg wiki "$WIKI_SHA" --arg raw "$RAW_SHA" --argjson metrics "$METRICS" \
  --arg prefix "$WORK/wiki/" '
  { generated_at: $at, wiki_sha: $wiki, raw_sha: $raw, mode: "dry-run", metrics: $metrics,
    promote: (.report |= map(.file |= (if type == "string" then ltrimstr($prefix) else . end))) }' \
  "$WORK/promote.json" > "$OUT.tmp" && mv -f "$OUT.tmp" "$OUT" \
  && cp "$OUT" "$REPORT_DIR/.latest.json.tmp" && mv -f "$REPORT_DIR/.latest.json.tmp" "$REPORT_DIR/latest.json" \
  || fail report "écriture de $OUT échouée"
find "$REPORT_DIR" -maxdepth 1 -type f -name '*Z-*-*.json' -mtime +"$RETENTION_DAYS" -delete
log "rapport : $OUT"

m() { jq -r ".$1" <<<"$METRICS"; }
SUMMARY="$(m proposals) proposition(s) · $(m eligible) éligible(s) · $(m blocked) bloquée(s) · WIKI ${WIKI_SHA:0:7} · RAW ${RAW_SHA:0:7}"
if [ "$(m provenance_unavailable)" -gt 0 ] || [ "$(m evaluation_errors)" -gt 0 ] || [ "$(m unknown_fail_closed)" -gt 0 ]; then
  finish error "$METRICS" "décision INFRA indisponible (provenance $(m provenance_unavailable), erreurs $(m evaluation_errors), fail-closed $(m unknown_fail_closed)) — ${SUMMARY}"
fi
if [ "$(m eligible)" -gt 0 ]; then
  finish warn "$METRICS" "promotion possible, acte owner — ${SUMMARY} — détail $REPORT_DIR/latest.json"
fi
finish ok "$METRICS" "$SUMMARY"
