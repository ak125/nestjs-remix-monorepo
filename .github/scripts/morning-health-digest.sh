#!/usr/bin/env bash
# Morning health digest — ONE standing issue, body replaced once a day (mandat AM and
# its complement, decisions 67, 68 and 72 of 2026-11-16). Each signal carries its
# colour, value, source, read time (UTC), the date of the data it shows and a
# confidence level. A source that cannot be read is written « indisponible », never
# zero; a source that has no producer yet is written « non branché ».
#
#   bash .github/scripts/morning-health-digest.sh
#        legacy contract: full report, writes the body and emits `title` + `body_path`
#        outputs (the unpatched workflow then creates a dated issue). No mail, no gate.
#   bash .github/scripts/morning-health-digest.sh --publish [--force]
#        scheduled every 15 min. Each run checks the URGENT signals (simulated purchase
#        path, critical security alerts, price guard-rail) and mails a new incident
#        once. The DAILY report (standing issue updated, short mail if a gesture of the
#        owner is expected) runs once per Paris day, at or after the configured hour
#        (7 h by default), or at once with --force (workflow_dispatch) or when the
#        standing issue does not exist yet.
#
# Called by .github/workflows/morning-health-digest.yml. Requires gh (GH_TOKEN), jq,
# curl, python3 (+ yaml, as scripts/ops/pilote-file.sh) and REPO=<owner/name>.
# Optional inputs, all documented in docs/plans/2026-11-16-mandat-am-patches/README.md:
#   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  database signals (else « indisponible »)
#   REPORT_CONFIG        JSON file, schema report-config.v1: hour, thresholds, labels,
#                        signal→department map, AU source. Hook for the department
#                        contracts (mandat AR); absent → the script defaults, declared.
#   PARCOURS_ACHAT_JSON  file, schema parcours-achat.v1 (mandat AU)
#   GARDE_PRIX_JSON      file, schema garde-prix.v1 (producer scripts/ops/garde-prix-read.ts)
#   GMAIL_* , ALERT_EMAIL_TO, EMAIL_FROM  mail channel (report-mail.py); else declared
#                        « indisponible » in the issue and the run log.
#   THRESHOLD_ISSUES_MODE  off | dry-run | write (mandate BZ, default dry-run): issues of
#                        the registry thresholds, scripts/governance/registry-thresholds.sh;
#                        its indicators need tsx + node_modules, else « non mesuré ».
#
# PUBLIC REPOSITORY: this body lands verbatim in a public issue and the run log is
# public. Only aggregates go out: rule names, counts, URL paths without query string,
# day totals, PR and issue titles (already public). Never a row, an order id, an
# e-mail, an IP, a security alert's rule or path, or a KPI value of a department.
# No credential is ever echoed.
set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${REPO:?missing}"

MODE=""; FORCE=0
for a in "$@"; do
  case "$a" in
    --publish) MODE=--publish ;;
    --force) FORCE=1 ;;
    *) echo "argument inconnu : $a" >&2; exit 64 ;;
  esac
done
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
TITLE="Rapport du matin — santé de la plateforme (morning-health-digest)"
GH_URL="${GITHUB_SERVER_URL:-https://github.com}"
RUN_URL="$GH_URL/${GITHUB_REPOSITORY:-$REPO}/actions/runs/${GITHUB_RUN_ID:-?}"
NOW_UTC=$(date -u +%FT%TZ)
TODAY=$(date -u +%F)
YESTERDAY=$(date -u -d 'yesterday' +%F)
PARIS_DAY=$(TZ=Europe/Paris date +%F)
PARIS_H=$((10#$(TZ=Europe/Paris date +%H)))
SIG=$(mktemp)   # one JSON object per signal
DET=$(mktemp)   # detail sections
URG=$(mktemp)   # one JSON object per active urgent incident
OUT=$(mktemp)   # final body

is_int() { case "${1:-}" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }
iso() { date -u -d "$1" +%FT%TZ 2>/dev/null || true; }   # any date → 2026-11-16T05:00:00Z, empty if unreadable

# signal <id> <libellé> <couleur> <valeur> <source> <confiance> <donnée>
# couleur ∈ vert | orange | rouge | indisponible | info (no governed threshold)
#           | nonbranche (no producer yet: listed, never counted in the global colour)
# donnée  = date of the data shown: ISO-8601 UTC, YYYY-MM-DD, "direct" (live read) or "".
signal() {
  jq -cn --arg id "$1" --arg l "$2" --arg c "$3" --arg v "$4" --arg s "$5" --arg q "$6" --arg f "${7:-}" \
    --arg t "$(date -u +%FT%TZ)" '{id:$id, l:$l, c:$c, v:$v, s:$s, q:$q, t:$t, f:$f}' >> "$SIG"
}
detail() { printf '%s\n' "$@" >> "$DET"; }
# urgent <clé> <libellé public> <lien> [détail du mail] — an incident active right now
# (mailed once, see below). The public label goes in the issue (public repo); the
# detail and the link go in the mail only.
urgent() { jq -cn --arg k "$1" --arg l "$2" --arg u "$3" --arg d "${4:-$2}" '{k:$k, l:$l, u:$u, d:$d}' >> "$URG"; }
URG_UNREAD=""   # key prefixes whose source was unreadable this run: their incidents are carried over

Q_QUAL="qualifié"
Q_COH="cohérent en interne"
Q_REQ="à requalifier"
Q_NON="non qualifié"

# ======================================================================
# Configuration — hook for the department contracts (mandat AR, decision 72)
# ======================================================================
# No department-contract configuration existed on main at 2026-11-16 07:38 UTC. The
# script reads REPORT_CONFIG if given (schema report-config.v1, keys in the README);
# every missing key falls back to the default written here, and the report says so.
CFG='{}'
CFG_NOTE="configuration des contrats de département (mandat AR) absente : seuils et heure par défaut du script"
if [ -n "${REPORT_CONFIG:-}" ]; then
  if [ -f "$REPORT_CONFIG" ] && jq -e 'type == "object" and .schema == "report-config.v1"' "$REPORT_CONFIG" >/dev/null 2>&1; then
    CFG=$(jq -c . "$REPORT_CONFIG")
    CFG_NOTE="configuration lue : \`${REPORT_CONFIG#"$ROOT"/}\` (report-config.v1) ; clé absente → valeur par défaut du script"
  else
    CFG_NOTE="REPORT_CONFIG illisible ou hors schéma report-config.v1 : seuils et heure par défaut du script"
    echo "::warning::$CFG_NOTE"
  fi
fi
cfg_int() { local v; v=$(jq -r "($1) // empty" <<< "$CFG" 2>/dev/null || true); if is_int "$v"; then echo "$v"; else echo "$2"; fi; }
cfg_str() { local v; v=$(jq -r "($1) // empty | strings" <<< "$CFG" 2>/dev/null || true); echo "${v:-$2}"; }

HOUR=$(cfg_int '.rapport.heure_paris' 7);            [ "$HOUR" -le 23 ] || HOUR=7
FRESH_MAX_J=$(cfg_int '.fraicheur.max_jours' 3)
SITEMAP_GREEN_H=$(cfg_int '.seuils.sitemap_vert_max_h' 26)
SITEMAP_ORANGE_H=$(cfg_int '.seuils.sitemap_orange_max_h' 30)
REGISTRY_MAX_H=$(cfg_int '.seuils.registre_max_h' 26)
PA_MIN_PCT=$(cfg_int '.parcours_achat.disponibilite_min_pct' '')   # no default: no governed threshold
LABEL_WAIT=$(cfg_str '.labels.attente' 'attend-marwane')
LABEL_ARB=$(cfg_str '.labels.desaccord' 'needs-human')
MIG_PATH=$(cfg_str '.migrations.chemin' 'backend/supabase/migrations/')
# Signal → department (business_number). PROPOSAL to be arbitrated with mandat AR.
DEPT_MAP_DEFAULT='{"tunnel":13,"unpaid":13,"parcours":13,"err5xx":21,"smoke":21,"ci":21,"prfail":21,"merged":21,"sitemap":7,"oidc":7,"gsc":7,"audit":2,"registry":2,"ledger":22,"secu":19,"prix":16,"owner":1}'
# A configured table overrides the default key by key: a partial table cannot drop a signal.
DEPT_MAP_CFG=$(jq -c '.departements.signaux // empty | objects | with_entries(select(.value | type == "number"))' <<< "$CFG" 2>/dev/null || true)
if [ -n "$DEPT_MAP_CFG" ] && [ "$DEPT_MAP_CFG" != "{}" ]; then
  DEPT_MAP=$(jq -cn --argjson d "$DEPT_MAP_DEFAULT" --argjson c "$DEPT_MAP_CFG" '$d + $c')
  DEPT_MAP_NOTE="Table signal → département lue dans la configuration ($(jq 'length' <<< "$DEPT_MAP_CFG") clé(s)), complétée par la table par défaut du script"
else
  DEPT_MAP=$DEPT_MAP_DEFAULT
  DEPT_MAP_NOTE="Table signal → département par défaut du script, **proposition à arbitrer (mandat AR)**"
fi

# ======================================================================
# Standing issue, its markers and the daily gate (--publish only)
# ======================================================================
ISSUE=""; PREV_BODY=""; DAILY=1; DAILY_WHY="mode historique"
if [ "$MODE" = "--publish" ]; then
  # shellcheck source=report-issue-publish.sh
  . "$HERE/report-issue-publish.sh"
  ISSUE=$(report_issue_find "$TITLE")
  if [ -n "$ISSUE" ]; then
    # An unreadable body would reset the dedup state and re-send every mail: stop.
    PREV_BODY=$(gh issue view "$ISSUE" --repo "$REPO" --json body --jq '.body') \
      || { echo "::error::lecture du corps de l'issue #$ISSUE en échec : passage abandonné"; exit 1; }
  fi
  META_PREV=$(printf '%s' "$PREV_BODY" | report_marker_extract "report-meta:v1")
  URG_PREV=$(printf '%s' "$PREV_BODY" | report_marker_extract "urgent-state:v1")
  LAST_DAY=$(jq -r '.jour_paris // ""' <<< "$META_PREV")
  if [ "$FORCE" = 1 ]; then DAILY_WHY="déclenchement manuel"
  elif [ -z "$ISSUE" ]; then DAILY_WHY="issue absente, créée à ce passage"
  elif [ "$PARIS_H" -ge "$HOUR" ] && [ "$LAST_DAY" != "$PARIS_DAY" ]; then DAILY_WHY="rapport quotidien de ${HOUR} h (heure de Paris)"
  else DAILY=0
  fi
else
  META_PREV='{}'; URG_PREV='{}'
fi

# ---- Database access (read only, PostgREST) ----
DB_WHY=""
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  DB_WHY="SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non transmis au job"
fi
# pg_get <table?query> <outfile> [range] → body in outfile, exact total on stdout; non-zero on failure
pg_get() {
  local hdr code
  hdr=$(mktemp)
  code=$(curl -sS --max-time 20 -o "$2" -D "$hdr" -w '%{http_code}' \
    "${SUPABASE_URL}/rest/v1/$1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H 'Prefer: count=exact' -H "Range: ${3:-0-999}" 2>/dev/null) || code=000
  case "$code" in 200|206) ;; *) rm -f "$hdr"; return 1 ;; esac
  awk 'tolower($0) ~ /^content-range:/ { n=$0; sub(/.*\//,"",n); gsub(/[^0-9]/,"",n); print n }' "$hdr"
  rm -f "$hdr"
}

# ======================================================================
# URGENT signals — checked on every run (decision 67)
# ======================================================================

# ---- Simulated purchase path (mandat AU) ----
# Input: PARCOURS_ACHAT_JSON, or the artifact of the last completed run of the AU
# workflow (parcours_achat.workflow + .artefact of the configuration; defaults: the
# producer delivered by mandat AU, .github/workflows/purchase-path-probe.yml).
# Alert after 2 consecutive failures (decision 67): last_run.consecutive_failures,
# written by scripts/ops/purchase-path-probe.sh report; a single failure is orange.
# Schema parcours-achat.v1: generated_at, window_hours, availability_pct, runs_total,
# runs_ok, steps[{name, p50_ms, p95_ms, last_ms, ok}], last_run{at, ok, failed_step}.
PA_SRC="parcours d'achat simulé (mandat AU), format parcours-achat.v1"
PA_FILE="${PARCOURS_ACHAT_JSON:-}"
PA_WF=$(cfg_str '.parcours_achat.workflow' 'purchase-path-probe.yml')
PA_ART=$(cfg_str '.parcours_achat.artefact' 'purchase-path-probe-result')
PA_WHY=""
if [ -z "$PA_FILE" ] && [ -n "$PA_WF" ] && [ -n "$PA_ART" ]; then
  PA_DIR=$(mktemp -d)
  # main only, as purchase-path-probe.sh reads its own runs: a run dispatched on
  # another branch must not answer for the probe.
  PA_RUN=$(gh run list --workflow="$PA_WF" --repo "$REPO" --branch main --status completed --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)
  PA_FILE="$PA_DIR/$(cfg_str '.parcours_achat.fichier' 'parcours-achat.json')"
  if [ -z "$PA_RUN" ]; then
    PA_WHY="aucun run terminé de $PA_WF trouvé (ou liste des runs illisible)"
  elif ! gh run download "$PA_RUN" --repo "$REPO" --name "$PA_ART" --dir "$PA_DIR" >/dev/null 2>&1; then
    PA_WHY="artefact $PA_ART du dernier run de $PA_WF illisible"
  fi
fi
PA_VALID='.schema == "parcours-achat.v1" and (.generated_at | type == "string")
  and (.availability_pct | type == "number") and (.runs_total | type == "number") and (.runs_ok | type == "number")
  and (.steps | type == "array") and all(.steps[]; (.name | type == "string") and (.ok | type == "boolean"))
  and (.last_run | type == "object") and (.last_run.ok | type == "boolean")'
if [ -z "$PA_FILE" ]; then
  signal parcours "Parcours d'achat simulé" nonbranche "non branché : aucune entrée (PARCOURS_ACHAT_JSON, ou parcours_achat.workflow et .artefact de la configuration) ; producteur attendu du mandat AU" "$PA_SRC" "$Q_NON" ""
elif [ -n "$PA_WHY" ] || [ ! -f "$PA_FILE" ]; then
  [ -n "$PA_WHY" ] || PA_WHY="fichier d'entrée absent"
  signal parcours "Parcours d'achat simulé" indisponible "$PA_WHY" "$PA_SRC" "$Q_NON" ""
  URG_UNREAD="$URG_UNREAD parcours"
elif ! jq -e "$PA_VALID" "$PA_FILE" >/dev/null 2>&1; then
  signal parcours "Parcours d'achat simulé" indisponible "format invalide (attendu parcours-achat.v1)" "$PA_SRC" "$Q_NON" ""
  URG_UNREAD="$URG_UNREAD parcours"
else
  PA=$(jq -c '{w: (.window_hours // 24), pct: .availability_pct, ok: .runs_ok, n: .runs_total,
               last_ok: .last_run.ok, last_at: (.last_run.at // ""),
               cf: ((.last_run.consecutive_failures | numbers | floor) // null),
               failed: ((.last_run.failed_step // "?") | tostring | gsub("[`|\n\r<>]"; "") | .[0:60]),
               gen: .generated_at}' "$PA_FILE")
  PA_GEN=$(iso "$(jq -r .gen <<< "$PA")")
  PA_V="disponibilité $(jq -r '"\(.w) h : \(.pct) % (\(.ok)/\(.n) passages réussis)"' <<< "$PA")"
  PA_CF=$(jq -r '.cf // empty' <<< "$PA")
  if [ "$(jq -r .last_ok <<< "$PA")" = "false" ] && is_int "$PA_CF" && [ "$PA_CF" -lt 2 ]; then
    signal parcours "Parcours d'achat simulé" orange "1er échec : étape « $(jq -r .failed <<< "$PA") » au dernier passage ($(jq -r .last_at <<< "$PA")), alerte au 2e échec consécutif (décision 67) ; $PA_V" "$PA_SRC" "$Q_NON" "$PA_GEN"
  elif [ "$(jq -r .last_ok <<< "$PA")" = "false" ]; then
    PA_V="EN PANNE : étape « $(jq -r .failed <<< "$PA") » en échec au dernier passage ($(jq -r .last_at <<< "$PA"))${PA_CF:+, $PA_CF échecs consécutifs} ; $PA_V"
    signal parcours "Parcours d'achat simulé" rouge "$PA_V" "$PA_SRC" "$Q_NON" "$PA_GEN"
    urgent parcours "Parcours d'achat en panne (étape $(jq -r .failed <<< "$PA"))" "$RUN_URL"
  elif [ -n "$PA_MIN_PCT" ] && jq -e --argjson m "$PA_MIN_PCT" '.pct < $m' <<< "$PA" >/dev/null; then
    signal parcours "Parcours d'achat simulé" orange "$PA_V ; sous le seuil configuré de $PA_MIN_PCT %" "$PA_SRC" "$Q_NON" "$PA_GEN"
  else
    signal parcours "Parcours d'achat simulé" vert "$PA_V ; dernier passage réussi" "$PA_SRC" "$Q_NON" "$PA_GEN"
  fi
  PA_W=$(jq -r .w <<< "$PA")
  PA_ROWS=$(jq -r '.steps[] | "| \(.name | gsub("[`|\n\r<>]"; "") | .[0:60]) | \(.last_ms // "—") | \(.p50_ms // "—") | \(.p95_ms // "—") | \(if .ok then "réussi" else "**en échec**" end) |"' "$PA_FILE")
  detail "### Parcours d'achat simulé, temps par étape (fenêtre de $PA_W h)" "" \
    "| Étape | Dernier passage (ms) | p50 (ms) | p95 (ms) | État |" "|---|---|---|---|---|" \
    "$PA_ROWS" ""
fi

# ---- Critical security alerts (Dependabot, code scanning) ----
# Counts only in the public body; rule, package and path go to the private mail link.
SECU_SRC="API GitHub : alertes ouvertes de sévérité critique (Dependabot, code scanning)"
secu_read() { # <kind> <endpoint> → sets SECU_<kind>_N (count) or SECU_<kind>_WHY
  local err out
  err=$(mktemp)
  if out=$(gh api "repos/$REPO/$2?state=open&severity=critical&per_page=100" --jq '[.[].number] | map(tostring) | join(" ")' 2>"$err"); then
    printf -v "SECU_${1}_LIST" '%s' "$out"
    printf -v "SECU_${1}_WHY" '%s' ""
  else
    local why="lecture en échec"
    grep -qi 'disabled' "$err" && why="désactivées sur le dépôt"
    grep -q 'HTTP 403' "$err" && ! grep -qi 'disabled' "$err" && why="accès refusé (permission security-events: read du job ?)"
    grep -q 'HTTP 404' "$err" && why="aucune analyse"
    printf -v "SECU_${1}_WHY" '%s' "$why"
    printf -v "SECU_${1}_LIST" '%s' ""
  fi
  rm -f "$err"
}
secu_read DEP dependabot/alerts
secu_read CS code-scanning/alerts
SECU_PARTS=(); SECU_N=0; SECU_READ=0
for K in DEP CS; do
  WHY_VAR="SECU_${K}_WHY"; LIST_VAR="SECU_${K}_LIST"
  case "$K" in DEP) NAME="Dependabot"; PATHK="dependabot" ;; CS) NAME="code scanning"; PATHK="code-scanning" ;; esac
  if [ -n "${!WHY_VAR}" ]; then
    SECU_PARTS+=("$NAME : indisponible (${!WHY_VAR})")
    URG_UNREAD="$URG_UNREAD secu:$PATHK:"
  else
    SECU_READ=$((SECU_READ + 1))
    N=$(wc -w <<< "${!LIST_VAR}")
    SECU_N=$((SECU_N + N))
    SECU_PARTS+=("$NAME : $N")
    for A in ${!LIST_VAR}; do
      urgent "secu:$PATHK:$A" "Alerte de sécurité critique ($NAME)" "$GH_URL/$REPO/security/$PATHK/$A" "Alerte de sécurité critique ($NAME n° $A)"
    done
  fi
done
SECU_V=$(printf '%s ; ' "${SECU_PARTS[@]}"); SECU_V=${SECU_V% ; }
if [ "$SECU_N" -gt 0 ]; then
  signal secu "Alertes de sécurité critiques" rouge "$SECU_N ouverte(s) — $SECU_V (détail réservé aux mainteneurs, onglet Security)" "$SECU_SRC" "$Q_QUAL" direct
elif [ "$SECU_READ" -eq 2 ]; then
  signal secu "Alertes de sécurité critiques" vert "0 ouverte — $SECU_V" "$SECU_SRC" "$Q_QUAL" direct
else
  signal secu "Alertes de sécurité critiques" indisponible "$SECU_V" "$SECU_SRC" "$Q_QUAL" direct
fi

# ---- Price guard-rail triggered ----
# Producer: scripts/ops/garde-prix-read.ts (mandat EI), run by the workflow in its
# daily window: invariants:<supplier> (import rows refused by the guard-rail),
# arret51:<supplier> (decision-51 halt waiting for the owner), perte:pm<brand>
# (sellable rows below the purchase price). Input GARDE_PRIX_JSON, schema garde-prix.v1
# {schema, generated_at, declenchements: [{cle, at}]}; each `cle` is one incident.
PRIX_SRC="déclenchements du garde-fou des prix, format garde-prix.v1"
if [ -z "${GARDE_PRIX_JSON:-}" ]; then
  signal prix "Garde-fou des prix" nonbranche "non branché : entrée GARDE_PRIX_JSON vide (producteur scripts/ops/garde-prix-read.ts, lancé par le workflow)" "$PRIX_SRC" "$Q_NON" ""
elif ! jq -e '.schema == "garde-prix.v1" and (.generated_at | type == "string") and (.declenchements | type == "array") and all(.declenchements[]; .cle | type == "string")' "$GARDE_PRIX_JSON" >/dev/null 2>&1; then
  signal prix "Garde-fou des prix" indisponible "entrée absente ou format invalide (attendu garde-prix.v1)" "$PRIX_SRC" "$Q_NON" ""
  URG_UNREAD="$URG_UNREAD prix:"
else
  GP_GEN=$(iso "$(jq -r .generated_at "$GARDE_PRIX_JSON")")
  GP_KEYS=$(jq -r '.declenchements[].cle | gsub("[^A-Za-z0-9_.:-]"; "_") | .[0:64]' "$GARDE_PRIX_JSON" | sort -u)
  GP_N=$(grep -c . <<< "$GP_KEYS" || true)
  if [ "$GP_N" -gt 0 ]; then
    signal prix "Garde-fou des prix" rouge "$GP_N déclenchement(s) en cours" "$PRIX_SRC" "$Q_NON" "$GP_GEN"
    # The producer's key may name a product: the public issue only keeps a fingerprint.
    while read -r K; do
      urgent "prix:$(printf '%s' "$K" | sha256sum | cut -c1-12)" "Garde-fou des prix déclenché" "$RUN_URL" "Garde-fou des prix déclenché ($K)"
    done <<< "$GP_KEYS"
  else
    signal prix "Garde-fou des prix" vert "aucun déclenchement" "$PRIX_SRC" "$Q_NON" "$GP_GEN"
  fi
fi

# ---- Urgent state: one mail per incident ----
# urgent-state:v1 = {clé: {depuis, mail}} kept in the issue body. A key absent this run
# is dropped (incident over), so a recurrence mails again; a key whose source was
# unreadable is carried over untouched; a mail that failed is retried on the next run.
URG_NOW=$(jq -cs 'map({(.k): {l: .l, u: .u, d: .d}}) | add // {}' "$URG")
URG_MAIL_LINE=""
URG_NEXT=$(jq -cn --argjson p "$URG_PREV" --argjson n "$URG_NOW" --arg now "$NOW_UTC" --arg unread "$URG_UNREAD" '
  ($unread | split(" ") | map(select(length > 0))) as $u
  | ($n | with_entries(.value = {depuis: ($p[.key].depuis // $now), mail: ($p[.key].mail // "à envoyer")}))
    + ($p | with_entries(select(.key as $k | $u | any(. as $x | $k | startswith($x)))))')
URG_TO_MAIL=$(jq -c --argjson n "$URG_NOW" '[to_entries[] | select(.value.mail != "envoyé" and $n[.key] != null) | .key]' <<< "$URG_NEXT")
if [ "$MODE" = "--publish" ] && [ "$URG_TO_MAIL" != "[]" ]; then
  MAIL_BODY=$(mktemp)
  {
    echo "Urgence AutoMecanik, lecture du $NOW_UTC (UTC) :"
    echo ""
    jq -r --argjson n "$URG_NOW" '.[] | "- \($n[.].d) : \($n[.].u)"' <<< "$URG_TO_MAIL"
    echo ""
    echo "Rapport : ${ISSUE:+$GH_URL/$REPO/issues/$ISSUE}${ISSUE:-$GH_URL/$REPO/issues?q=is%3Aissue+is%3Aopen+morning-health-digest+in%3Atitle}"
    echo "Un seul mail par incident ; le suivant partira à la prochaine occurrence."
  } > "$MAIL_BODY"
  set +e
  URG_MAIL_LINE=$(REPORT_MAIL_SUBJECT="[URGENCE] AutoMecanik — $(jq -r --argjson n "$URG_NOW" 'map($n[.].d) | join(" ; ") | .[0:150]' <<< "$URG_TO_MAIL")" \
    python3 "$HERE/report-mail.py" "$MAIL_BODY" 2>/dev/null | tail -n1)
  set -e
  case "$URG_MAIL_LINE" in OK) ST="envoyé" ;; INDISPONIBLE:*) ST="canal indisponible" ;; *) ST="échec" ;; esac
  [ "$ST" = "envoyé" ] || echo "::warning::mail d'urgence non envoyé : ${URG_MAIL_LINE:-aucune sortie}"
  URG_NEXT=$(jq -c --argjson k "$URG_TO_MAIL" --arg st "$ST" 'reduce $k[] as $x (.; .[$x].mail = $st)' <<< "$URG_NEXT")
  rm -f "$MAIL_BODY"
fi

if [ "$DAILY" = 0 ]; then
  # Between two daily reports only the urgent marker moves, and only when it changed.
  if [ "$(jq -cS . <<< "$URG_NEXT")" != "$(jq -cS . <<< "$URG_PREV")" ]; then
    report_marker_set "$ISSUE" "urgent-state:v1" "$URG_NEXT"
  fi
  echo "Passage d'urgence seul (rapport du jour déjà publié ou avant ${HOUR} h, heure de Paris) ; incidents actifs : $(jq 'length' <<< "$URG_NOW") ; mail : ${URG_MAIL_LINE:-aucun}"
  exit 0
fi

# ======================================================================
# Business and runtime signals (mandat AM)
# ======================================================================

# ---- Payment tunnel — the very reading of the PROD cron ----
# scripts/monitoring/check-payment-tunnel.sh in CHECK_ONLY mode: same RPC, same
# counts, same thresholds (CREATION, SUSTAINED, BURST), no e-mail, no dedup file.
TUNNEL_SCRIPT="$ROOT/scripts/monitoring/check-payment-tunnel.sh"
TUNNEL_SRC="check-payment-tunnel.sh en mode CHECK_ONLY (RPC check_payment_tunnel_health, order_idempotency, ___xtr_order)"
if [ -n "$DB_WHY" ]; then
  signal tunnel "Tunnel de paiement" indisponible "$DB_WHY" "$TUNNEL_SRC" "$Q_COH" ""
elif ! grep -q 'CHECK_ONLY_RESULT' "$TUNNEL_SCRIPT" 2>/dev/null; then
  signal tunnel "Tunnel de paiement" indisponible "mode CHECK_ONLY absent du script (patch non appliqué)" "$TUNNEL_SRC" "$Q_COH" ""
else
  set +e
  T_OUT=$(CHECK_ONLY=1 bash "$TUNNEL_SCRIPT" 2>/dev/null)
  T_RC=$?
  set -e
  T_LINE=$(grep '^CHECK_ONLY_RESULT ' <<< "$T_OUT" | tail -n1 || true)
  t_get() { grep -o " $1=[^ ]*" <<< "$T_LINE" | head -n1 | cut -d= -f2-; }
  T_RULE=$(t_get rule); T_SILENCE=$(t_get silence_days)
  T_SINCE="dernier paiement : $( is_int "$T_SILENCE" && echo "il y a ${T_SILENCE} j" || echo "date inconnue" )"
  # The script turns a failed count into -1 and then stays silent: for this report a
  # rule that could not be evaluated is not « vert ».
  T_FAILED=""
  for k in oc_completed oc_failed unpaid_since_last silence_days; do
    is_int "$(t_get "$k")" || T_FAILED="$T_FAILED $k"
  done
  if [ "$T_RC" = "0" ] && [ -n "$T_LINE" ] && [ -n "$T_FAILED" ]; then
    signal tunnel "Tunnel de paiement" indisponible "lecture partielle : aucune règle déclenchée, mais comptage illisible pour${T_FAILED}" "$TUNNEL_SRC" "$Q_COH" direct
  elif [ "$T_RC" = "0" ] && [ -n "$T_LINE" ]; then
    signal tunnel "Tunnel de paiement" vert "aucune règle déclenchée (CREATION, SUSTAINED, BURST) ; $T_SINCE" "$TUNNEL_SRC" "$Q_COH" direct
  elif [ "$T_RC" = "3" ] && [ -n "$T_LINE" ]; then
    signal tunnel "Tunnel de paiement" rouge "règle ${T_RULE:-?} déclenchée ; $T_SINCE ; runbook .spec/runbooks/payments-tunnel-debug.md" "$TUNNEL_SRC" "$Q_COH" direct
  else
    signal tunnel "Tunnel de paiement" indisponible "lecture en échec (code $T_RC)" "$TUNNEL_SRC" "$Q_COH" ""
  fi
fi

# ---- Orders still unpaid more than 24 h after creation (count only) ----
# Window J-30 → J-1: the table holds every unpaid order since 2020; the all-time total
# says nothing about this morning. `ord_date` is ISO-8601 TEXT, compared
# lexicographically, as in check-payment-tunnel.sh.
UNPAID_SRC="___xtr_order, ord_is_pay=0, ord_date entre J-30 et J-1"
if [ -n "$DB_WHY" ]; then
  signal unpaid "Commandes non payées > 24 h" indisponible "$DB_WHY" "$UNPAID_SRC" "$Q_NON" ""
else
  D1=$(date -u -d '24 hours ago' +%FT%T)
  D30=$(date -u -d '30 days ago' +%FT%T)
  N_UNPAID=$(pg_get "___xtr_order?select=ord_id&ord_is_pay=eq.0&and=(ord_date.lt.${D1},ord_date.gte.${D30})" /dev/null 0-0 || true)
  if is_int "$N_UNPAID"; then
    signal unpaid "Commandes non payées > 24 h" info "$N_UNPAID (créées entre J-30 et J-1, toujours non payées)" "$UNPAID_SRC" "$Q_NON" direct
  else
    signal unpaid "Commandes non payées > 24 h" indisponible "lecture PostgREST en échec" "$UNPAID_SRC" "$Q_NON" ""
  fi
fi

# ---- PROD 5xx over 24 h by path, internal (agent `node`) vs external ----
# Same 5xx criteria and same noise exclusions as the RPC check_error_logs_5xx_threshold
# (PREV-2), plus err_env=production. The RPC itself mixes environments and agents.
ERR_SRC="__error_logs, err_env=production, 24 h, critères de check_error_logs_5xx_threshold"
if [ -n "$DB_WHY" ]; then
  signal err5xx "Erreurs 5xx PROD (24 h)" indisponible "$DB_WHY" "$ERR_SRC" "$Q_REQ" ""
else
  SINCE=$(date -u -d '24 hours ago' +%FT%TZ)
  CODES='ServiceUnavailableException,InternalServerErrorException,OperationFailedException,GatewayTimeoutException,BadGatewayException,NotImplementedException'
  F_ERR=$(mktemp)
  N_ERR=$(pg_get "__error_logs?select=err_url,err_user_agent,err_status,err_code&err_env=eq.production&err_created_at=gte.${SINCE}&or=(err_status.gte.500,err_code.in.(${CODES}))" "$F_ERR" 0-4999 || true)
  if is_int "$N_ERR" && jq -e 'type == "array"' "$F_ERR" >/dev/null 2>&1; then
    AGG=$(jq -c '
      map({path: ((.err_url // "") | split("?")[0] | gsub("[`|\n\r]"; "") | .[0:100]),
           cls: (if .err_user_agent == "node" then "interne" else "externe" end),
           st: (((.err_status // 0) | tostring) as $s | if $s == "0" then (.err_code // "?") else $s end)})
      | map(select((.path | startswith("/.well-known/") or startswith("/robots.txt") or startswith("/favicon.ico")) | not))
      | {rows: length,
         ext: (map(select(.cls == "externe")) | length),
         int: (map(select(.cls == "interne")) | length),
         top: (group_by([.cls, .path])
               | map({cls: .[0].cls, path: .[0].path, n: length, st: (map(.st) | unique | join(","))})
               | sort_by(-.n))}' "$F_ERR")
    EXT=$(jq '.ext' <<< "$AGG"); INT=$(jq '.int' <<< "$AGG")
    FETCHED=$(jq 'length' "$F_ERR")
    TRUNC=""
    [ "$N_ERR" -gt "$FETCHED" ] && TRUNC=" ; lecture tronquée à $FETCHED lignes sur $N_ERR"
    signal err5xx "Erreurs 5xx PROD (24 h)" info "externes : $EXT ; internes (agent node) : $INT$TRUNC" "$ERR_SRC" "$Q_REQ" direct
    detail "### Erreurs 5xx PROD sur 24 h, par chemin" ""
    for CLS in externe interne; do
      detail "**Appels ${CLS}s$( [ "$CLS" = interne ] && echo " (agent \`node\`, rendu serveur)" )** — 10 premiers chemins :" ""
      LINES=$(jq -r --arg c "$CLS" '[.top[] | select(.cls == $c)][:10][] | "| `\(.path)` | \(.n) | \(.st) |"' <<< "$AGG")
      if [ -n "$LINES" ]; then
        detail "| Chemin | Nombre | Statut ou code |" "|---|---|---|" "$LINES" ""
      else
        detail "_Aucun._" ""
      fi
    done
  else
    signal err5xx "Erreurs 5xx PROD (24 h)" indisponible "lecture PostgREST en échec" "$ERR_SRC" "$Q_REQ" ""
  fi
  rm -f "$F_ERR"
fi

# ---- Google clicks, weekly trend ----
# __seo_gsc_daily_property_total (1 row per day, property total; the reading of
# GET /timeseries/gsc). A missing or unconfirmed day (commit_version null) makes the
# week incomplete: the trend is then « indisponible », never a partial sum.
GSC_SRC="__seo_gsc_daily_property_total (total propriété Search Console, jour confirmé)"
if [ -n "$DB_WHY" ]; then
  signal gsc "Clics Google, tendance hebdomadaire" indisponible "$DB_WHY" "$GSC_SRC" "$Q_COH" ""
else
  F_GSC=$(mktemp)
  N_GSC=$(pg_get "__seo_gsc_daily_property_total?select=date,clicks,commit_version&date=gte.$(date -u -d '35 days ago' +%F)&order=date.desc" "$F_GSC" 0-99 || true)
  if is_int "$N_GSC" && [ "$N_GSC" -gt 0 ] && jq -e 'type == "array"' "$F_GSC" >/dev/null 2>&1; then
    TREND=$(jq -c '
      (map(.date) | max) as $last
      | ($last + "T00:00:00Z" | fromdateiso8601) as $t
      | (INDEX(.date)) as $by
      | [range(0; 14) | ($t - . * 86400 | strftime("%Y-%m-%d"))] as $days
      | {last: $last,
         missing: [$days[] | select(($by[.] == null) or ($by[.].commit_version == null))],
         w1: ([$days[0:7][] | $by[.].clicks // 0] | add),
         w0: ([$days[7:14][] | $by[.].clicks // 0] | add),
         w1_from: $days[6], w0_from: $days[13], w0_to: $days[7]}' "$F_GSC")
    MISSING=$(jq -r '.missing | join(", ")' <<< "$TREND")
    LAST=$(jq -r '.last' <<< "$TREND")
    if [ -n "$MISSING" ]; then
      signal gsc "Clics Google, tendance hebdomadaire" indisponible "semaines incomplètes (jours absents ou non confirmés : $MISSING)" "$GSC_SRC" "$Q_COH" "$LAST"
    else
      W1=$(jq '.w1' <<< "$TREND"); W0=$(jq '.w0' <<< "$TREND")
      PCT=$(jq -rn --argjson a "$W1" --argjson b "$W0" 'if $b == 0 then "n/a" else ((($a - $b) * 1000 / $b | round) / 10 | tostring) + " %" end')
      signal gsc "Clics Google, tendance hebdomadaire" info "$W1 clics du $(jq -r .w1_from <<< "$TREND") au $LAST contre $W0 la semaine précédente ($PCT) ; dernier jour publié : $LAST" "$GSC_SRC" "$Q_COH" "$LAST"
    fi
  else
    signal gsc "Clics Google, tendance hebdomadaire" indisponible "lecture PostgREST en échec ou table vide" "$GSC_SRC" "$Q_COH" ""
  fi
  rm -f "$F_GSC"
fi

# ---- PROD smoke tests, last completed run ----
SMOKE_SRC="runs GitHub de prod-smoke-tests.yml (sans panier, commande ni paiement)"
SMOKE=$(gh run list --workflow=prod-smoke-tests.yml --repo "$REPO" --status completed --limit 1 \
  --json conclusion,createdAt,url --jq '.[0] // empty | "\(.conclusion) \(.createdAt) \(.url)"' 2>/dev/null || true)
if [ -z "$SMOKE" ]; then
  signal smoke "Tests de fumée PROD" indisponible "aucun run terminé lisible" "$SMOKE_SRC" "$Q_QUAL" ""
else
  read -r S_CONC S_AT S_URL <<< "$SMOKE"
  S_AGE=$(( ( $(date -u +%s) - $(date -u -d "$S_AT" +%s) ) / 3600 ))
  case "$S_CONC" in success) S_C=vert ;; failure) S_C=rouge ;; *) S_C=orange ;; esac
  signal smoke "Tests de fumée PROD" "$S_C" "$S_CONC il y a ${S_AGE} h — $S_URL" "$SMOKE_SRC" "$Q_QUAL" "$S_AT"
fi

# ---- Owner's gestures: open PRs, labelled issues (read once, used below) ----
# Mandate CJ (2026-11-18): `gh pr list --limit 100 --json …,files,statusCheckRollup` ended
# in HTTP 504 (GraphQL timeout; statusCheckRollup alone ≈ 11 s for 61 PRs), its error was
# thrown away and the gestures were written « illisible » with no cause. Now every read is
# bounded (timeout per call, a few tries on a transient error) and an unreadable source
# keeps a short cause (« liste des PR : HTTP 504 GitHub »), written in the report and the
# run log: an empty list is never taken for « no gesture ».
GH_READ_TRIES=${GH_READ_TRIES:-3}; GH_READ_PAUSE=${GH_READ_PAUSE:-5}; GH_READ_TIMEOUT=${GH_READ_TIMEOUT:-60}
# gh_cause <stderr file> <rc> → short cause, safe for the public issue (never the raw message)
gh_cause() {
  local http
  if [ "$2" = 124 ]; then echo "délai de ${GH_READ_TIMEOUT} s dépassé"; return 0; fi
  http=$(grep -oE 'HTTP [0-9]{3}' "$1" | head -n1 || true)
  if [ -n "$http" ]; then echo "$http GitHub"
  elif grep -q 'GraphQL' "$1"; then echo "erreur GraphQL GitHub"
  elif grep -qiE 'timeout|timed out|connection|could not resolve|EOF|TLS' "$1"; then echo "erreur réseau"
  else echo "échec de gh (code $2)"; fi
}
# gh_read <label> <jq test of a valid answer> <out file> <gh args…> → 0 and the answer in
# <out file>, or 1 and the cause in GH_WHY. A transient failure (HTTP 5xx, timeout,
# network, unreadable answer) is tried again, GH_READ_TRIES times at most.
gh_read() {
  local label="$1" test="$2" out="$3" try=1 rc err
  shift 3
  err=$(mktemp); GH_WHY=""
  while :; do
    rc=0; timeout "$GH_READ_TIMEOUT" gh "$@" > "$out" 2> "$err" || rc=$?
    if [ "$rc" = 0 ]; then
      if jq -e "$test" "$out" >/dev/null 2>&1; then rm -f "$err"; return 0; fi
      GH_WHY="réponse illisible"
    else
      GH_WHY=$(gh_cause "$err" "$rc")
    fi
    case "$GH_WHY" in "HTTP 5"*|délai*|"erreur réseau"|"réponse illisible") ;; *) break ;; esac
    [ "$try" -ge "$GH_READ_TRIES" ] && break
    echo "lecture $label : $GH_WHY, nouvel essai dans $((GH_READ_PAUSE * try)) s ($((try + 1))/$GH_READ_TRIES)"
    sleep $((GH_READ_PAUSE * try)); try=$((try + 1))
  done
  [ "$try" -gt 1 ] && GH_WHY="$GH_WHY après $try essais"
  rm -f "$err"; return 1
}

# Open PRs, two light queries instead of one heavy: pages of 50 with the rollup STATE only
# (≈ 2 s for 61 PRs), then the check names PR by PR, only for a PR whose rollup is not
# green (the heavy part). Output keeps the shape of the former `gh pr list` read:
# [{number, title, url, isDraft, headRefName, labels[{name}], files[{path}],
#   statusCheckRollup[{name, conclusion}], or null if that PR's checks are unreadable}].
PR_MAX=300; PR_PAGE=50
PR_BASE_Q='query($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title url isDraft headRefName
        labels(first: 50) { nodes { name } }
        files(first: 100) { nodes { path } }
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } } } }'
PR_CHECKS_Q='query($owner: String!, $name: String!, $n: Int!) {
  repository(owner: $owner, name: $name) { pullRequest(number: $n) {
    commits(last: 1) { nodes { commit { statusCheckRollup {
      contexts(first: 100) { nodes { ... on CheckRun { name conclusion } } } } } } } } } }'
PRS=""; PRS_WHY=""; PRS_TOTAL=0; CHK_FAIL=0; CHK_WHY=""
PR_F=$(mktemp); PR_PAGES=$(mktemp); PR_CUR=null
while :; do
  if ! gh_read "liste des PR" '.data.repository.pullRequests.nodes | type == "array"' "$PR_F" \
       api graphql -f query="$PR_BASE_Q" -F owner="${REPO%%/*}" -F name="${REPO#*/}" -F first="$PR_PAGE" -F after="$PR_CUR"; then
    PRS_WHY="liste des PR : $GH_WHY"; break
  fi
  jq -c '.data.repository.pullRequests.nodes[]' "$PR_F" >> "$PR_PAGES"
  PRS_TOTAL=$(jq '.data.repository.pullRequests.totalCount' "$PR_F")
  [ "$(jq -r '.data.repository.pullRequests.pageInfo.hasNextPage' "$PR_F")" = true ] || break
  [ "$(wc -l < "$PR_PAGES")" -lt "$PR_MAX" ] || break
  PR_CUR=$(jq -r '.data.repository.pullRequests.pageInfo.endCursor' "$PR_F")
done
if [ -z "$PRS_WHY" ]; then
  PRS=$(jq -cs 'unique_by(.number) | sort_by(-.number) | map({number, title, url, isDraft, headRefName,
          labels: [.labels.nodes[]? | {name}], files: [.files.nodes[]? | {path}],
          rollup: (.commits.nodes[0].commit.statusCheckRollup.state // null), statusCheckRollup: []})' "$PR_PAGES")
  for P in $(jq -r '.[] | select(.rollup != null and .rollup != "SUCCESS") | .number' <<< "$PRS"); do
    if [ "$CHK_FAIL" -eq 0 ] && gh_read "contrôles de la PR #$P" '.data.repository.pullRequest.commits.nodes | type == "array"' "$PR_F" \
         api graphql -f query="$PR_CHECKS_Q" -F owner="${REPO%%/*}" -F name="${REPO#*/}" -F n="$P"; then
      PRS=$(jq -c --argjson n "$P" --slurpfile c "$PR_F" 'map(if .number == $n then .statusCheckRollup =
              [$c[0].data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[]? | select(.name != null)]
            else . end)' <<< "$PRS")
    else
      # After one definitive failure the remaining PRs are not tried: the run stays bounded.
      [ "$CHK_FAIL" -eq 0 ] && CHK_WHY=$GH_WHY
      CHK_FAIL=$((CHK_FAIL + 1))
      PRS=$(jq -c --argjson n "$P" 'map(if .number == $n then .statusCheckRollup = null else . end)' <<< "$PRS")
    fi
  done
  [ "$CHK_FAIL" -gt 0 ] && echo "::warning::contrôles de $CHK_FAIL PR illisibles ($CHK_WHY) : PR en échec comptées au moins"
fi
rm -f "$PR_F" "$PR_PAGES"

LABELS_F=$(mktemp); LABELS_WHY=""
if gh_read "labels" 'type == "array"' "$LABELS_F" label list --repo "$REPO" --limit 500 --json name; then
  LABELS=$(jq -r '.[].name' "$LABELS_F")
else
  LABELS="__ILLISIBLE__"; LABELS_WHY="labels : $GH_WHY"
fi
rm -f "$LABELS_F"
# label_issues <label> <VAR> → VAR = JSON array [{n, t, u}] of open issues, "absent" if the
# label does not exist (not a failure: 0 issue, said so), "" if unreadable; VAR_WHY = cause.
label_issues() {
  local f
  f=$(mktemp)
  printf -v "$2" '%s' ""; printf -v "${2}_WHY" '%s' ""
  if [ "$LABELS" = "__ILLISIBLE__" ]; then
    printf -v "${2}_WHY" '%s' "$LABELS_WHY"
  elif ! grep -Fqx -- "$1" <<< "$LABELS"; then
    printf -v "$2" '%s' absent
  elif gh_read "issues au label $1" 'type == "array"' "$f" \
         issue list --repo "$REPO" --state open --label "$1" --limit 200 --json number,title,url,labels; then
    printf -v "$2" '%s' "$(jq -c --arg l "$1" '[.[] | select(any(.labels[]?; .name == $l)) | {n: .number, t: .title, u: .url}]' "$f")"
  else
    printf -v "${2}_WHY" '%s' "issues au label $1 : $GH_WHY"
  fi
  rm -f "$f"
}
label_issues "$LABEL_WAIT" WAIT_ISSUES
label_issues "$LABEL_ARB" ARB_ISSUES
# Causes of the gesture reads, deduplicated (unreadable labels fail both label reads).
GEST_WHY=$(printf '%s\n' "$PRS_WHY" "$WAIT_ISSUES_WHY" "$ARB_ISSUES_WHY" | awk 'NF && !seen[$0]++' | paste -sd';' - | sed 's/;/ ; /g')

# ---- Issues waiting for the owner (label attend-marwane, if it exists) ----
OWNER_SRC="issues ouvertes au label $LABEL_WAIT"
if [ "$LABELS" = "__ILLISIBLE__" ]; then
  signal owner "Issues en attente de Marwane" indisponible "lecture en échec ($LABELS_WHY)" "$OWNER_SRC" "$Q_QUAL" ""
elif [ "$WAIT_ISSUES" = absent ]; then
  signal owner "Issues en attente de Marwane" info "label $LABEL_WAIT inexistant (sa création revient à l'owner)" "$OWNER_SRC" "$Q_QUAL" direct
elif [ -n "$WAIT_ISSUES" ]; then
  signal owner "Issues en attente de Marwane" info "$(jq -r 'length as $n | "\($n)" + (if $n > 0 then " : " + (map("#\(.n)") | join(" ")) else "" end)' <<< "$WAIT_ISSUES")" "$OWNER_SRC" "$Q_QUAL" direct
else
  signal owner "Issues en attente de Marwane" indisponible "lecture en échec ($WAIT_ISSUES_WHY)" "$OWNER_SRC" "$Q_QUAL" ""
fi

# ======================================================================
# Delivery-chain signals (logic carried over from the dated digest)
# ======================================================================

# ---- Sitemap freshness ----
LM=$(curl -fsS -m 10 -I https://www.automecanik.com/sitemap.xml 2>/dev/null \
  | grep -i '^last-modified:' | sed 's/[Ll]ast-[Mm]odified:[[:space:]]*//I; s/\r$//' || echo "")
if [ -n "$LM" ]; then
  AGE_HRS=$(( ( $(date -u +%s) - $(date -u -d "$LM" +%s) ) / 3600 ))
  if [ "$AGE_HRS" -lt "$SITEMAP_GREEN_H" ]; then S=vert; elif [ "$AGE_HRS" -lt "$SITEMAP_ORANGE_H" ]; then S=orange; else S=rouge; fi
  signal sitemap "Fraîcheur du sitemap PROD" "$S" "last-modified $LM (${AGE_HRS} h, seuil < ${SITEMAP_GREEN_H} h)" "en-tête HTTP de https://www.automecanik.com/sitemap.xml" "$Q_QUAL" "$(iso "$LM")"
else
  signal sitemap "Fraîcheur du sitemap PROD" indisponible "en-tête last-modified illisible" "en-tête HTTP de https://www.automecanik.com/sitemap.xml" "$Q_QUAL" ""
fi

# runs_line <lines "YYYY-MM-DDTHH:MM… concl"> → first run date as ISO, for the freshness column
first_run_at() { head -n1 <<< "$1" | awk '{print substr($1,1,16) ":00Z"}'; }

# ---- Daily sitemap regeneration (OIDC) ----
OIDC=$(gh run list --workflow=sitemap-daily-regen.yml --limit 2 --repo "$REPO" \
  --json conclusion,createdAt --jq '.[] | "\(.createdAt[:16]) \(.conclusion // "running")"' 2>/dev/null || echo "")
if [ -z "$OIDC" ]; then
  signal oidc "Régénération quotidienne du sitemap" orange "aucun run" "runs GitHub de sitemap-daily-regen.yml" "$Q_QUAL" ""
else
  S=vert; grep -q failure <<< "$OIDC" && S=rouge
  signal oidc "Régénération quotidienne du sitemap" "$S" "$(tr '\n' ';' <<< "$OIDC" | sed 's/;$//; s/;/ ; /g')" "runs GitHub de sitemap-daily-regen.yml" "$Q_QUAL" "$(first_run_at "$OIDC")"
fi

# ---- CI on main ----
CI=$(gh run list --repo "$REPO" --branch main --workflow=ci.yml --limit 3 \
  --json conclusion,createdAt,headSha --jq '.[] | "\(.createdAt[:16]) \(.headSha[:7]) \(.conclusion // "running")"' 2>/dev/null || echo "")
if [ -z "$CI" ]; then
  signal ci "CI sur main (3 derniers runs)" indisponible "aucun run lisible" "runs GitHub de ci.yml sur main" "$Q_QUAL" ""
else
  S=vert; grep -q failure <<< "$CI" && S=rouge
  signal ci "CI sur main (3 derniers runs)" "$S" "$(tr '\n' ';' <<< "$CI" | sed 's/;$//; s/;/ ; /g')" "runs GitHub de ci.yml sur main" "$Q_QUAL" "$(first_run_at "$CI")"
fi

# ---- Open PRs with failing checks (from the PR list read above) ----
PRF_SRC="API GraphQL GitHub, contrôles des PR ouvertes ($PR_MAX au plus)"
if [ -n "$PRS" ]; then
  FAILS=$(jq -c '[.[] | {n: .number, t: (.title[:65]), head: .headRefName, failed: ([.statusCheckRollup[]? | select(.conclusion=="FAILURE") | .name] | unique)} | select((.failed | length) > 0)]' <<< "$PRS")
  DEPENDABOT=$(jq '[.[] | select(.head | startswith("dependabot/"))] | length' <<< "$FAILS")
  OTHER=$(jq '[.[] | select(.head | startswith("dependabot/") | not)] | length' <<< "$FAILS")
  if [ "$CHK_FAIL" -gt 0 ]; then
    # Some PRs' checks are unreadable: the counts are a floor, never a green.
    signal prfail "PR ouvertes en échec" indisponible "lecture partielle : au moins $OTHER hors Dependabot ; contrôles de $CHK_FAIL PR illisibles ($CHK_WHY)" "$PRF_SRC" "$Q_QUAL" ""
  else
    S=vert; [ "$OTHER" -gt 0 ] && S=orange
    signal prfail "PR ouvertes en échec" "$S" "$OTHER hors Dependabot ; $DEPENDABOT Dependabot (attendu, PR-9a)" "$PRF_SRC" "$Q_QUAL" direct
  fi
  if [ "$OTHER" -gt 0 ]; then
    detail "### PR en échec hors Dependabot" ""
    detail "$(jq -r '.[] | select(.head | startswith("dependabot/") | not) | "- #\(.n) \(.t | gsub("[`|]"; "")) — en échec : \(.failed | join(", "))"' <<< "$FAILS")" ""
  fi
else
  signal prfail "PR ouvertes en échec" indisponible "lecture en échec ($PRS_WHY)" "$PRF_SRC" "$Q_QUAL" ""
fi

# ---- Audit & drift on main ----
AUD=$(gh run list --workflow=audit.yml --limit 3 --repo "$REPO" --branch main \
  --json conclusion,createdAt --jq '.[] | "\(.createdAt[:16]) \(.conclusion // "running")"' 2>/dev/null || echo "")
DRF=$(gh run list --workflow=contract-drift-observatory.yml --limit 3 --repo "$REPO" --branch main \
  --json conclusion,createdAt --jq '.[] | "\(.createdAt[:16]) \(.conclusion // "running")"' 2>/dev/null || echo "")
AUD_C=$(awk '{print $2}' <<< "$AUD" | tr '\n' ' ' | sed 's/ *$//'); DRF_C=$(awk '{print $2}' <<< "$DRF" | tr '\n' ' ' | sed 's/ *$//')
if [ -z "$AUD$DRF" ]; then
  S=indisponible; AUD_F=""
else
  S=vert; grep -q failure <<< "$AUD_C $DRF_C" && S=rouge
  # the older of the two latest runs dates the signal
  AUD_F=$(printf '%s\n%s\n' "$(first_run_at "$AUD")" "$(first_run_at "$DRF")" | grep -v '^:00Z$' | sort | head -n1)
fi
signal audit "Audit et dérive de contrat sur main" "$S" "audit.yml : ${AUD_C:-aucun run sur main} ; contract-drift-observatory.yml : ${DRF_C:-aucun run sur main}" "runs GitHub (3 derniers de chaque)" "$Q_QUAL" "$AUD_F"

# ---- Yesterday's merges (information) ----
if MERGED=$(gh pr list --repo "$REPO" --state merged --search "merged:>=$YESTERDAY merged:<$TODAY" \
  --json number --jq '[.[].number | "#\(.)"] | join(" ")' 2>/dev/null); then
  signal merged "PR fusionnées hier ($YESTERDAY)" info "$(wc -w <<< "$MERGED")${MERGED:+ : $MERGED}" "gh pr list --state merged" "$Q_QUAL" direct
else
  signal merged "PR fusionnées hier ($YESTERDAY)" indisponible "lecture des PR fusionnées en échec" "gh pr list --state merged" "$Q_QUAL" ""
fi

# ---- Migration ledger freshness ----
# Reads only the CONCLUSION of migration-ledger-freshness.yml (04:30 UTC), the only
# holder of DATABASE_URL.
LEDGER=$(gh run list --workflow=migration-ledger-freshness.yml --limit 2 --repo "$REPO" \
  --json conclusion,createdAt --jq '.[] | "\(.createdAt[:16]) \(.conclusion // "running")"' 2>/dev/null || echo "")
if [ -z "$LEDGER" ]; then
  signal ledger "Registre des migrations" orange "aucun run" "runs GitHub de migration-ledger-freshness.yml" "$Q_QUAL" ""
else
  S=vert; V="$(tr '\n' ';' <<< "$LEDGER" | sed 's/;$//; s/;/ ; /g')"
  if grep -q failure <<< "$LEDGER"; then
    S=rouge; V="$V — infra.schema_migrations ne décrit plus la base ; le résumé du run liste la cause"
  fi
  signal ledger "Registre des migrations" "$S" "$V" "runs GitHub de migration-ledger-freshness.yml" "$Q_QUAL" "$(first_run_at "$LEDGER")"
fi

# ---- Automation registry freshness ----
# Reads the VERDICT LINE of the last completed run on main (04:15 UTC): a green run
# can carry a WARN verdict. This digest is the reader of that verdict.
FR_SRC="ligne de verdict du dernier run d'automation-registry-freshness.yml sur main"
FRESH=$(gh run list --workflow=automation-registry-freshness.yml --branch main --status completed \
  --limit 1 --repo "$REPO" --json databaseId,conclusion,createdAt \
  --jq '.[] | "\(.databaseId) \(.createdAt) \(.conclusion)"' 2>/dev/null || echo "")
if [ -z "$FRESH" ]; then
  signal registry "Fraîcheur du registre d'automatisation" orange "aucun run terminé sur main" "$FR_SRC" "$Q_QUAL" ""
else
  read -r FRESH_ID FRESH_AT FRESH_CONCLUSION <<< "$FRESH"
  FRESH_URL="$GH_URL/$REPO/actions/runs/$FRESH_ID"
  FRESH_AGE_HRS=$(( ( $(date -u +%s) - $(date -u -d "$FRESH_AT" +%s) ) / 3600 ))
  FRESH_LOG=$(gh run view "$FRESH_ID" --repo "$REPO" --log 2>/dev/null || echo "")
  FRESH_VERDICT=$(grep -m1 -oE '\[freshness\] (OK|WARN) — [0-9]+/[0-9]+ entries stale \(threshold [0-9]+d\)' <<< "$FRESH_LOG" || true)
  if [ "$FRESH_CONCLUSION" != "success" ]; then
    S=rouge; V="contrôle non exécuté (conclusion $FRESH_CONCLUSION) $FRESH_URL"
  elif [ "$FRESH_AGE_HRS" -ge "$REGISTRY_MAX_H" ]; then
    S=rouge; V="dernier run terminé il y a ${FRESH_AGE_HRS} h (seuil < ${REGISTRY_MAX_H} h) $FRESH_URL"
  elif [ -z "$FRESH_LOG" ]; then
    S=indisponible; V="journal du dernier run illisible $FRESH_URL"
  elif [ -z "$FRESH_VERDICT" ]; then
    S=rouge; V="run vert sans ligne de verdict : registre non évalué $FRESH_URL"
  elif [[ "$FRESH_VERDICT" == "[freshness] WARN "* ]]; then
    S=orange; V="$FRESH_VERDICT — entrées à revérifier, listées dans le résumé du run $FRESH_URL"
  else
    S=vert; V="$FRESH_VERDICT"
  fi
  signal registry "Fraîcheur du registre d'automatisation" "$S" "$V" "$FR_SRC" "$Q_QUAL" "$FRESH_AT"
fi

# ======================================================================
# Freshness of every source (decision 68, mandat AT)
# ======================================================================
# A dated source older than FRESH_MAX_J days is « périmée »: its colour is raised to at
# least orange (a colour change, hence one comment) and it is listed under the table.
SIG2=$(mktemp)
jq -c --argjson now "$(date -u +%s)" --argjson maxj "$FRESH_MAX_J" --arg today "$TODAY" '
  (if (.f | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T")) then
     ((try (.f | sub("\\.[0-9]+"; "") | fromdateiso8601) catch null) as $e
      | if $e == null then {} else {age_h: ((($now - $e) / 3600) | floor)} | .st = (.age_h > $maxj * 24) end)
   elif (.f | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) then
     ((((($today + "T00:00:00Z") | fromdateiso8601) - ((.f + "T00:00:00Z") | fromdateiso8601)) / 86400) | floor) as $d
     | {age_j: $d, st: ($d > $maxj)}
   else {} end) as $a
  | . + $a + {st: ($a.st // false)}
  | if .st and (.c == "vert" or .c == "info") then .c0 = .c | .c = "orange" else . end' "$SIG" > "$SIG2"
mv "$SIG2" "$SIG"

# ======================================================================
# Departments: one line each (decision 67)
# ======================================================================
# Source: .spec/00-canon/ai-registry/agent-operating-map.yaml, parsed as in
# scripts/ops/pilote-file.sh. Open issues are counted per dept:NN-<id> label. KPI values
# are NOT published (public repository, project-state-report rule).
MAP_FILE="$ROOT/.spec/00-canon/ai-registry/agent-operating-map.yaml"
DEPTS=$(python3 - "$MAP_FILE" 2>/dev/null <<'PY' || true
import json, sys, yaml
carte = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
rows = []
for v in carte.values() if isinstance(carte, dict) else []:
    if isinstance(v, list):
        for d in v:
            if isinstance(d, dict) and isinstance(d.get("business_number"), int) and d.get("id"):
                rows.append({"n": d["business_number"], "label": "dept:%02d-%s" % (d["business_number"], d["id"]),
                             "intitule": d.get("label", ""), "etat": d.get("state", "")})
rows.sort(key=lambda r: r["n"])
if len(rows) != 24 or len({r["label"] for r in rows}) != 24:
    sys.exit(1)
print(json.dumps(rows, ensure_ascii=False))
PY
)
DEPT_ISSUES=$(gh issue list --repo "$REPO" --state open --limit 3000 --json labels 2>/dev/null \
  | jq -c '[.[].labels[]?.name | select(startswith("dept:"))] | group_by(.) | map({(.[0]): length}) | add // {}' 2>/dev/null || true)

# ======================================================================
# Registry functions and their thresholds (mandate BZ, decision 9)
# ======================================================================
# scripts/governance/registry-thresholds.sh: one line per department (functions by
# status, « pas de mesure »), evaluable thresholds read from their declared producer,
# one dept:NN issue per crossed threshold. THRESHOLD_ISSUES_MODE = off | dry-run | write,
# dry-run by default (nothing written); write acts only with --publish. Never fails here.
FN_SECTION=$(mktemp)
REPO="$REPO" GITHUB_SERVER_URL="$GH_URL" PUBLISH="$( [ "$MODE" = "--publish" ] && echo 1 || echo 0 )" \
  bash "$ROOT/scripts/governance/registry-thresholds.sh" "$FN_SECTION" || : > "$FN_SECTION"

# ======================================================================
# Owner's gestures, then the daily mail (decision 67)
# ======================================================================
# Fusions: open PRs out of draft and out of Dependabot, migration PRs apart.
# Migrations: open PRs out of draft touching $MIG_PATH (gh lists 100 files per PR).
# Disagreements: issues and PRs labelled $LABEL_ARB. Waiting: issues labelled $LABEL_WAIT.
if [ -n "$PRS" ]; then
  GEST=$(jq -c --arg mig "$MIG_PATH" --arg arb "$LABEL_ARB" --arg wait "$LABEL_WAIT" --argjson total "$PRS_TOTAL" '
    map(. + {mig: any(.files[]?; .path | startswith($mig)), dep: (.headRefName | startswith("dependabot/")),
             failed: (if .statusCheckRollup == null then null
                      else ([.statusCheckRollup[]? | select(.conclusion == "FAILURE")] | length) end)})
    | {fusions:   [.[] | select((.isDraft | not) and (.dep | not) and (.mig | not))],
       migrations:[.[] | select((.isDraft | not) and .mig)],
       mig_draft: ([.[] | select(.isDraft and .mig)] | length),
       drafts:    ([.[] | select(.isDraft)] | length),
       arb_pr:    [.[] | select(any(.labels[]?; .name == $arb))],
       wait_pr:   [.[] | select(any(.labels[]?; .name == $wait))],
       read: length, total: $total, truncated: ($total > length)}' <<< "$PRS")
else
  GEST=""
fi
g_count() { [ -n "$GEST" ] && jq "$1" <<< "$GEST" || echo 0; }
N_FUS=$(g_count '.fusions | length'); N_MIG=$(g_count '.migrations | length')
N_ARB=$(( $(g_count '.arb_pr | length') + $( [ -n "$ARB_ISSUES" ] && [ "$ARB_ISSUES" != absent ] && jq length <<< "$ARB_ISSUES" || echo 0 ) ))
N_WAIT=$(( $(g_count '.wait_pr | length') + $( [ -n "$WAIT_ISSUES" ] && [ "$WAIT_ISSUES" != absent ] && jq length <<< "$WAIT_ISSUES" || echo 0 ) ))
N_GEST=$((N_FUS + N_MIG + N_ARB + N_WAIT))
GEST_READ=1; { [ -z "$GEST" ] || [ -z "$WAIT_ISSUES" ] || [ -z "$ARB_ISSUES" ]; } && GEST_READ=0
# A failed read always carries its cause (GEST_WHY); the run log says which one.
[ "$GEST_READ" = 0 ] && [ -z "$GEST_WHY" ] && GEST_WHY="cause non déterminée"
if [ "$GEST_READ" = 1 ]; then
  echo "Gestes de Marwane : $N_GEST (fusions $N_FUS, migrations $N_MIG, désaccords $N_ARB, en attente $N_WAIT) ; PR ouvertes lues : $(jq .read <<< "$GEST")/$(jq .total <<< "$GEST")"
else
  echo "::warning::Gestes de Marwane : $N_GEST au moins, lecture en échec — $GEST_WHY"
fi

MAIL_DAY=$(jq -r '.mail_jour // ""' <<< "$META_PREV"); MAIL_PREV=$(jq -r '.mail // ""' <<< "$META_PREV")
DAY_MAIL="sans objet (mode historique)"; DAY_MAIL_DAY="$MAIL_DAY"; DAY_MAIL_SEND=0
if [ "$MODE" = "--publish" ]; then
  if [ "$PARIS_H" -lt "$HOUR" ]; then
    DAY_MAIL="non envoyé : passage avant ${HOUR} h (heure de Paris)"
  elif [ "$MAIL_DAY" = "$PARIS_DAY" ] && [ "$MAIL_PREV" = "envoyé" ]; then
    DAY_MAIL="envoyé"   # already sent today: a forced rerun does not send it twice
  elif [ "$N_GEST" -eq 0 ] && [ "$GEST_READ" = 1 ]; then
    DAY_MAIL="aucun geste attendu, pas de mail"; DAY_MAIL_DAY="$PARIS_DAY"
  elif [ "$N_GEST" -eq 0 ]; then
    DAY_MAIL="non envoyé : liste des gestes illisible ($GEST_WHY)"
  else
    # Sent AFTER the body is published (link to the issue, no mail if publication fails);
    # this line and the report-meta marker are then rewritten with the outcome.
    DAY_MAIL="envoi après publication de ce corps"; DAY_MAIL_SEND=1
  fi
fi

# ======================================================================
# Assemble
# ======================================================================
OVERALL=$(jq -rs 'map(.c) as $c
  | if any($c[]; . == "rouge") then "rouge"
    elif any($c[]; . == "orange" or . == "indisponible") then "orange"
    else "vert" end' "$SIG")
badge() { case "$1" in vert) echo "🟢 vert" ;; orange) echo "🟠 orange" ;; rouge) echo "🔴 rouge" ;; indisponible) echo "⚪ indisponible" ;; nonbranche) echo "⚫ non branché" ;; *) echo "🔵 info" ;; esac; }
# shellcheck disable=SC2016  # jq program: $s is a jq variable
JQ_DEFS='
  def esc: gsub("\\|"; "\\|") | gsub("[\n\r]"; " ");
  def emoji: {"vert":"🟢","orange":"🟠","rouge":"🔴","indisponible":"⚪","nonbranche":"⚫"}[.] // "🔵";
  def word: {"vert":"vert","orange":"orange","rouge":"rouge","indisponible":"indisponible","nonbranche":"non branché"}[.] // "info";
  def rank: {"rouge":4,"orange":3,"indisponible":2,"vert":1,"info":0,"nonbranche":-1}[.] // 0;
  def age: if .age_h != null then (if .age_h >= 48 then "\(.age_h / 24 | floor) j" else "\(.age_h) h" end)
           elif .age_j != null then "\(.age_j) j" else "" end;
  def donnee: . as $s | (if .f == "direct" then "lecture directe" elif .f == "" then "—"
               elif (.f | length) == 10 then "\(.f) (\(age))" else "\(.f[0:10]) \(.f[11:16]) (\(age))" end)
              | if $s.st then "⚠️ " + . else . end;'
ORDER='["tunnel","parcours","unpaid","err5xx","gsc","smoke","owner","secu","prix","sitemap","oidc","ci","prfail","audit","merged","ledger","registry"]'
gest_list() { # <jq path in GEST> → markdown list
  jq -r "$1[] | \"- [#\\(.number)](\\(.url)) \\(.title | gsub(\"[\`|\\\\[\\\\]<>\\n\\r]\"; \"\") | .[0:90])\" + (if .failed == null then \" — contrôles illisibles\" elif .failed > 0 then \" — \\(.failed) check(s) en échec\" else \"\" end)" <<< "$GEST"
}
issue_list() { jq -r '.[] | "- [#\(.n)](\(.u)) \(.t | gsub("[`|\\[\\]<>\n\r]"; "") | .[0:90])"' <<< "$1"; }

{
  echo "## Gestes attendus de Marwane : $( [ "$GEST_READ" = 1 ] && echo "$N_GEST" || echo "$N_GEST au moins (liste partielle)" )"
  echo ""
  [ "$GEST_READ" = 1 ] || { echo "_Lecture en échec : $GEST_WHY. « Aucun geste » n'est pas affirmé._"; echo ""; }
  if [ -z "$GEST" ]; then
    echo "_Liste des PR ouvertes illisible ($PRS_WHY) : fusions et migrations **indisponibles**._"
  else
    echo "**Fusions à décider ($N_FUS)** — PR ouvertes hors brouillon et hors Dependabot ; la commande de fusion est dans chaque PR."
    [ "$N_FUS" -gt 0 ] && gest_list '.fusions'
    echo ""
    echo "**Migrations à appliquer ($N_MIG)** — PR ouvertes hors brouillon qui touchent \`$MIG_PATH\`$( [ "$(jq .mig_draft <<< "$GEST")" -gt 0 ] && echo " ; $(jq .mig_draft <<< "$GEST") autre(s) en brouillon" )."
    [ "$N_MIG" -gt 0 ] && gest_list '.migrations'
    echo ""
    echo "_$(jq .drafts <<< "$GEST") PR en brouillon, non listées$( [ "$(jq .truncated <<< "$GEST")" = true ] && echo " ; lecture limitée aux $(jq .read <<< "$GEST") dernières PR ouvertes sur $(jq .total <<< "$GEST")" )._"
  fi
  echo ""
  echo "**Désaccords à arbitrer ($N_ARB)** — label \`$LABEL_ARB\`."
  case "$ARB_ISSUES" in absent) echo "_Label $LABEL_ARB inexistant._" ;; "") echo "_Issues **indisponibles** ($ARB_ISSUES_WHY)._" ;; *) issue_list "$ARB_ISSUES" ;; esac
  [ -n "$GEST" ] && [ "$(jq '.arb_pr | length' <<< "$GEST")" -gt 0 ] && gest_list '.arb_pr'
  echo ""
  echo "**En attente de Marwane ($N_WAIT)** — label \`$LABEL_WAIT\`."
  case "$WAIT_ISSUES" in absent) echo "_Label $LABEL_WAIT inexistant._" ;; "") echo "_Issues **indisponibles** ($WAIT_ISSUES_WHY)._" ;; *) issue_list "$WAIT_ISSUES" ;; esac
  [ -n "$GEST" ] && [ "$(jq '.wait_pr | length' <<< "$GEST")" -gt 0 ] && gest_list '.wait_pr'
  echo ""
  echo "Mail du jour : $DAY_MAIL."
  echo ""
  if [ "$(jq 'length' <<< "$URG_NOW")" -gt 0 ]; then
    echo "## Urgences en cours"
    echo ""
    jq -r --argjson s "$URG_NEXT" 'to_entries[] | "- \(.value.l) — depuis \($s[.key].depuis // "?") ; mail : \($s[.key].mail // "?")"' <<< "$URG_NOW"
    echo ""
  fi
  echo "## État au $NOW_UTC — couleur globale : $(badge "$OVERALL")"
  echo ""
  if [ "$MODE" = "--publish" ]; then
    echo "Issue unique, corps remplacé une fois par jour à ${HOUR} h (heure de Paris) par \`morning-health-digest\` ; ce passage : $DAILY_WHY."
    echo "Les urgences (parcours d'achat, alertes de sécurité critiques, garde-fou des prix) sont vérifiées toutes les 15 minutes et envoyées par mail une seule fois par incident."
    echo "Un commentaire n'est posté que lorsqu'un signal change de couleur."
  fi
  echo "Une source illisible est écrite « indisponible », jamais zéro ; une source sans producteur est écrite « non branché »."
  echo ""
  echo "| Signal | Couleur | Valeur | Source | Donnée du (âge) | Lu à (UTC) | Confiance |"
  echo "|---|---|---|---|---|---|---|"
  jq -rs --argjson o "$ORDER" "$JQ_DEFS"'
    sort_by(.id as $i | ($o | index($i)) // 99)[] | . as $s
    | "| \(.l | esc) | \(.c | emoji) \(.c | word) | \(.v | esc) | \(.s | esc) | \(donnee | esc) | \(.t[11:19]) | \(.q) |"' "$SIG"
  echo ""
  STALE=$(jq -rs "$JQ_DEFS"'.[] | select(.st) | . as $s | "- \(.l) : donnée du \(donnee | ltrimstr("⚠️ "))" + (if .c0 then " ; couleur relevée de \(.c0 | word) à orange" else "" end)' "$SIG")
  echo "### Sources périmées (plus de $FRESH_MAX_J j)"
  echo ""
  if [ -n "$STALE" ]; then echo "$STALE"; else echo "_Aucune parmi les sources datées._"; fi
  echo ""
  echo "## Départements"
  echo ""
  if [ -z "$DEPTS" ]; then
    echo "_Carte des départements **indisponible** (\`.spec/00-canon/ai-registry/agent-operating-map.yaml\` illisible ou ≠ 24 départements)._"
  else
    echo "Une ligne par département de la carte d'exploitation. Les valeurs de KPI ne sont pas publiées (dépôt public). $DEPT_MAP_NOTE."
    echo ""
    echo "| N° | Département | État (carte) | Couleur | Signaux de ce rapport | Issues ouvertes |"
    echo "|---|---|---|---|---|---|"
    jq -rn --argjson d "$DEPTS" --argjson m "$DEPT_MAP" --argjson iss "${DEPT_ISSUES:-null}" --slurpfile sig "$SIG" \
      --arg base "$GH_URL/$REPO/issues?q=is%3Aopen+label%3A" "$JQ_DEFS"'
      $d[] | . as $dep
      | [$sig[] | select(($m[.id] // null) == $dep.n)] as $ss
      | ($ss | map(.c) | max_by(rank) // null) as $worst
      | "| \(if $dep.n < 10 then "0" else "" end)\($dep.n) | \($dep.intitule | esc) | \($dep.etat) | "
        + (if $worst == null then "—" else "\($worst | emoji) \($worst | word)" end) + " | "
        + (if ($ss | length) == 0 then "aucun" else ($ss | map("\(.c | emoji) \(.l)") | join(" · ")) end) + " | "
        + (if $iss == null then "indisponible" else "[\($iss[$dep.label] // 0)](\($base)\($dep.label | @uri))" end) + " |"'
  fi
  echo ""
  if [ -s "$FN_SECTION" ]; then
    cat "$FN_SECTION"
  else
    echo "## Fonctions du registre et seuils"
    echo ""
    echo "_Section **indisponible** (\`scripts/governance/registry-thresholds.sh\` sans sortie) : aucun seuil évalué, aucune issue écrite._"
  fi
  echo ""
  if [ -s "$DET" ]; then
    echo "## Détail"
    echo ""
    cat "$DET"
  fi
  echo "## Niveaux de confiance"
  echo ""
  echo "- **qualifié** : valeur lue à la source qui fait foi pour ce qu'elle affirme (conclusion d'un run GitHub, en-tête HTTP servi, label GitHub)."
  echo "- **cohérent en interne** : plusieurs lectures de nos propres données concordent (recoupement du 2026-11-15), sans rapprochement avec la source externe (Paybox, Google)."
  echo "- **à requalifier** : lecture connue pour mêler des causes ; ne pas conclure sans requalification (5xx : 319 sur \`/api/rm/alternatives\`, agent node, mandat dédié)."
  echo "- **non qualifié** : jamais recoupé."
  echo "- 🔵 **info** : aucun seuil gouverné pour ce signal ; il ne change de couleur que si sa source est périmée."
  echo "- ⚫ **non branché** : aucun producteur ; compté ni vert ni orange dans la couleur globale."
  echo ""
  echo "## Configuration"
  echo ""
  echo "- $CFG_NOTE."
  echo "- Heure du rapport : ${HOUR} h (heure de Paris) ; fraîcheur maximale : ${FRESH_MAX_J} j ; sitemap : vert < ${SITEMAP_GREEN_H} h, orange < ${SITEMAP_ORANGE_H} h ; registre d'automatisation : < ${REGISTRY_MAX_H} h ; disponibilité minimale du parcours d'achat : ${PA_MIN_PCT:-aucune (pas de seuil gouverné)}."
  echo ""
  echo "---"
  echo "Run : $RUN_URL"
} > "$OUT"

if [ "$MODE" = "--publish" ]; then
  meta_next() {
    jq -cn --argjson p "$META_PREV" --arg day "$PARIS_DAY" --arg md "$DAY_MAIL_DAY" --arg m "$DAY_MAIL" \
      --argjson past "$( [ "$PARIS_H" -ge "$HOUR" ] && echo true || echo false )" --arg at "$NOW_UTC" '
      {jour_paris: (if $past then $day else ($p.jour_paris // "") end), mail_jour: $md, mail: $m, publie: $at}'
  }
  {
    echo ""
    report_marker_line "report-meta:v1" "$(meta_next)"
    report_marker_line "urgent-state:v1" "$URG_NEXT"
  } >> "$OUT"
  STATE=$(jq -cs 'map({(.id): {c: .c, l: .l}}) | add' "$SIG")
  N=$(report_issue_publish "$TITLE" "$OUT" "$STATE" ak125)

  if [ "$DAY_MAIL_SEND" = 1 ]; then
    MAIL_BODY=$(mktemp)
    {
      if [ "$GEST_READ" = 1 ]; then
        echo "Rapport du matin du $PARIS_DAY : $N_GEST geste(s) attendu(s)."
      else
        echo "Rapport du matin du $PARIS_DAY : $N_GEST geste(s) attendu(s) au moins (liste partielle : $GEST_WHY)."
      fi
      echo ""
      if [ -n "$GEST" ]; then
        echo "- fusions à décider : $N_FUS"
        echo "- migrations à appliquer : $N_MIG"
      else
        echo "- fusions à décider : indisponible ($PRS_WHY)"
        echo "- migrations à appliquer : indisponible ($PRS_WHY)"
      fi
      echo "- désaccords à arbitrer ($LABEL_ARB) : $( [ -n "$ARB_ISSUES_WHY" ] && echo "$N_ARB au moins ($ARB_ISSUES_WHY)" || echo "$N_ARB" )$( [ "$ARB_ISSUES" = absent ] && echo " (label inexistant)" )"
      echo "- en attente ($LABEL_WAIT) : $( [ -n "$WAIT_ISSUES_WHY" ] && echo "$N_WAIT au moins ($WAIT_ISSUES_WHY)" || echo "$N_WAIT" )$( [ "$WAIT_ISSUES" = absent ] && echo " (label inexistant)" )"
      echo ""
      echo "Liste et liens directs : $GH_URL/$REPO/issues/$N"
    } > "$MAIL_BODY"
    set +e
    LINE=$(REPORT_MAIL_SUBJECT="AutoMecanik — $N_GEST geste(s) attendu(s)$( [ "$GEST_READ" = 1 ] || echo ' au moins'), rapport du $PARIS_DAY" \
      python3 "$HERE/report-mail.py" "$MAIL_BODY" 2>/dev/null | tail -n1)
    set -e
    rm -f "$MAIL_BODY"
    case "$LINE" in
      OK) DAY_MAIL="envoyé"; DAY_MAIL_DAY="$PARIS_DAY" ;;
      INDISPONIBLE:*) DAY_MAIL="canal mail indisponible : ${LINE#INDISPONIBLE:} non transmis au job" ;;
      *) DAY_MAIL="échec de l'envoi (${LINE:-aucune sortie})" ;;
    esac
    [ "$DAY_MAIL" = "envoyé" ] || echo "::warning::mail du jour : $DAY_MAIL"
    # One more edit: the outcome line and the report-meta marker, nothing else.
    FIN=$(mktemp)
    if gh issue view "$N" --repo "$REPO" --json body --jq '.body' > "$FIN.src"; then
      STATUS_LINE="Mail du jour : $DAY_MAIL." META_LINE="$(report_marker_line "report-meta:v1" "$(meta_next)")" \
        awk '/^Mail du jour : /{print ENVIRON["STATUS_LINE"]; next} /^<!-- report-meta:v1 /{print ENVIRON["META_LINE"]; next} {print}' \
        "$FIN.src" > "$FIN"
      gh issue edit "$N" --repo "$REPO" --body-file "$FIN" > /dev/null \
        || echo "::warning::issue #$N : résultat du mail non écrit (pas de nouvel envoi avant demain, sauf relance manuelle)"
    else
      echo "::warning::issue #$N illisible après publication : résultat du mail non écrit"
    fi
    rm -f "$FIN" "$FIN.src"
  fi
  echo "Issue de rapport : #$N (couleur globale : $OVERALL ; gestes : $N_GEST$( [ "$GEST_READ" = 1 ] || echo " au moins, lecture en échec : $GEST_WHY" ) ; mail du jour : $DAY_MAIL ; urgences actives : $(jq 'length' <<< "$URG_NOW"))"
  {
    echo "issue=$N"
    echo "overall=$OVERALL"
  } >> "${GITHUB_OUTPUT:-/dev/null}"
else
  case "$OVERALL" in vert) E="✅" ;; orange) E="⚠️" ;; *) E="⛔" ;; esac
  {
    echo "title=$E Morning health digest — $TODAY"
    echo "body_path=$OUT"
  } >> "${GITHUB_OUTPUT:-/dev/stdout}"
fi
