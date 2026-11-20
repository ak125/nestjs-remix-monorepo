#!/usr/bin/env bash
# Tests de la lecture des gestes de Marwane du rapport du matin (mandat CJ, 2026-11-18),
# sans réseau ni base : un faux `gh` et un faux `curl` sur le PATH, scénario par fichiers.
# Chaque échec de lecture (liste des PR, contrôles d'une PR, labels, issues d'un label) est
# simulé et la cause affichée est vérifiée dans le corps, la ligne du mail du jour et le
# journal ; un label absent n'est pas un échec ; le mail du jour ne part qu'avec des gestes.
#
#   bash scripts/ops/morning-health-digest.test.sh
#   MHD_SUT=<chemin> bash scripts/ops/morning-health-digest.test.sh   (autre copie du script)
#
# Le script testé tourne en --publish --force avec une heure de rapport à 0 h (REPORT_CONFIG),
# sans variable GMAIL_* : report-mail.py répond INDISPONIBLE, aucun mail ne part ; « canal mail
# indisponible » prouve donc qu'un envoi a été tenté, « non envoyé » / « pas de mail » qu'il ne l'a pas été.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
SUT="${MHD_SUT:-$ROOT/.github/scripts/morning-health-digest.sh}"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
FAIL=0; N=0

check() { N=$((N + 1)); if eval "$2"; then echo "ok  - $1"; else echo "KO  - $1"; FAIL=$((FAIL + 1)); fi; }
contient() { grep -qF -- "$2" "$1"; }
absent() { ! grep -qF -- "$2" "$1"; }

mkdir -p "$T/bin"
cat > "$T/bin/curl" <<'SH'
#!/usr/bin/env bash
exit 22
SH
cat > "$T/bin/gh" <<'SH'
#!/usr/bin/env bash
# Faux gh. Un fichier $FAKE_DIR/fail.<clé> simule un échec : « <fois|*> <mode> [message] »,
# mode stderr (message sur stderr, code 1), html (page HTML, code 0), sleep (attente).
D="$FAKE_DIR"; echo "$*" >> "$D/calls"
fail() {
  [ -f "$D/fail.$1" ] || return 0
  local times mode msg n
  read -r times mode msg < "$D/fail.$1"
  n=$(( $(cat "$D/n.$1" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$D/n.$1"
  [ "$times" != "*" ] && [ "$n" -gt "$times" ] && return 0
  case "$mode" in
    stderr) echo "$msg" >&2; exit 1 ;;
    html) echo '<!DOCTYPE html><html><head><title>Unicorn! · GitHub</title></head></html>'; exit 0 ;;
    sleep) sleep "$msg"; exit 0 ;;
  esac
}
argval() { local k="$1" a; shift; for a in "$@"; do case "$a" in "$k="*) echo "${a#"$k="}"; return ;; esac; done; }
flagval() { local k="$1" p="" a; shift; for a in "$@"; do [ "$p" = "$k" ] && { echo "$a"; return; }; p="$a"; done; }
case "$1 $2" in
  "api graphql")
    q=$(argval query "$@")
    if [[ "$q" == *"pullRequests("* ]]; then
      fail prs; cat "$D/prs-page-$(argval after "$@").json"
    else
      fail checks; cat "$D/checks-$(argval n "$@").json"
    fi ;;
  "api repos/"*)
    case "$2" in *dependabot*) cat "$D/alerts-dependabot" 2>/dev/null ;; esac ;;
  "label list") fail labels; cat "$D/labels.json" ;;
  "issue list")
    l=$(flagval --label "$@")
    if [ -n "$l" ]; then fail "issues-$l"; cat "$D/issues-$l.json" 2>/dev/null || echo "[]"; else echo "[]"; fi ;;
  "issue create") cp "$(flagval --body-file "$@")" "$D/issue.md"; echo "https://github.com/o/r/issues/4242" ;;
  "issue view") cat "$D/issue.md" ;;
  "issue edit") cp "$(flagval --body-file "$@")" "$D/issue.md" ;;
  *) : ;;   # run list / run view / pr list --state merged / issue comment : vide
esac
exit 0
SH
chmod +x "$T/bin/gh" "$T/bin/curl"
printf '{"schema":"report-config.v1","rapport":{"heure_paris":0}}\n' > "$T/config.json"

# pr <n> <brouillon> <branche> <état du rollup> [fichier] → un nœud GraphQL de PR
pr() {
  jq -cn --argjson n "$1" --argjson d "$2" --arg h "$3" --arg s "$4" --arg f "${5:-src/a.ts}" \
    '{number: $n, title: "PR \($n)", url: "https://github.com/o/r/pull/\($n)", isDraft: $d, headRefName: $h,
      labels: {nodes: []}, files: {nodes: [{path: $f}]},
      commits: {nodes: [{commit: {statusCheckRollup: {state: $s}}}]}}'
}
page() { # <total> <page suivante ? true|false> <curseur> <nœuds…>
  local total="$1" next="$2" cur="$3"; shift 3
  printf '%s\n' "$@" | jq -cs --argjson t "$total" --argjson h "$next" --arg c "$cur" \
    '{data: {repository: {pullRequests: {totalCount: $t, pageInfo: {hasNextPage: $h, endCursor: $c}, nodes: .}}}}'
}
checks() { # <conclusions…> → réponse de la requête des contrôles d'une PR
  printf '%s\n' "$@" | jq -Rcs 'split("\n") | map(select(length > 0)) | to_entries
    | {data: {repository: {pullRequest: {commits: {nodes: [{commit: {statusCheckRollup: {contexts: {nodes:
        (map({name: "check-\(.key)", conclusion: .value}) + [{}])}}}}]}}}}}'
}
issues() { # <label> <numéros…>
  local l="$1"; shift
  printf '%s\n' "$@" | jq -Rcs --arg l "$l" 'split("\n") | map(select(length > 0) | tonumber
    | {number: ., title: "Issue \(.)", url: "https://github.com/o/r/issues/\(.)", labels: [{name: $l}]})'
}

# Jeu « gestes » : 4 PR sur 2 pages ; #10 fusion (contrôle en échec), #9 migration, #8 brouillon,
# #7 Dependabot (contrôle en échec) ; 1 issue en attente. Gestes : 1 + 1 + 0 + 1 = 3.
mkdir -p "$T/gestes" "$T/vide"
page 4 true C1 "$(pr 10 false feat/x FAILURE)" "$(pr 9 false fix/m SUCCESS backend/supabase/migrations/2026_x.sql)" > "$T/gestes/prs-page-null.json"
page 4 false "" "$(pr 8 true feat/d SUCCESS)" "$(pr 7 false dependabot/npm/y FAILURE)" > "$T/gestes/prs-page-C1.json"
checks SUCCESS FAILURE > "$T/gestes/checks-10.json"
checks FAILURE > "$T/gestes/checks-7.json"
issues attend-marwane 50 > "$T/gestes/issues-attend-marwane.json"
# Jeu « vide » : une PR en brouillon, aucune issue en attente. Gestes : 0.
page 1 false "" "$(pr 8 true feat/d SUCCESS)" > "$T/vide/prs-page-null.json"
for J in gestes vide; do
  printf '[{"name":"attend-marwane"},{"name":"needs-human"},{"name":"dept:21-runtime"}]\n' > "$T/$J/labels.json"
  echo "[]" > "$T/$J/issues-needs-human.json"
done
echo "[]" > "$T/vide/issues-attend-marwane.json"

run() { # <nom> <jeu> [fichier=contenu …] [-- VAR=valeur …] → corps publié $T/<nom>.md, journal $T/<nom>.log
  local name="$1" set="$2"; shift 2
  export FAKE_DIR="$T/$name.d"; mkdir -p "$FAKE_DIR"; cp "$T/$set/"* "$FAKE_DIR/"; : > "$FAKE_DIR/calls"
  while [ $# -gt 0 ] && [ "$1" != -- ]; do printf '%s\n' "${1#*=}" > "$FAKE_DIR/${1%%=*}"; shift; done
  [ "${1:-}" = -- ] && shift
  env -u GMAIL_CLIENT_ID -u GMAIL_CLIENT_SECRET -u GMAIL_REFRESH_TOKEN -u GMAIL_USER_EMAIL -u ALERT_EMAIL_TO \
    -u EMAIL_FROM -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u PARCOURS_ACHAT_JSON -u GARDE_PRIX_JSON \
    PATH="$T/bin:$PATH" GH_TOKEN=x REPO=o/r REPORT_CONFIG="$T/config.json" THRESHOLD_ISSUES_MODE=off \
    GITHUB_OUTPUT="$T/$name.ghout" GH_READ_PAUSE=0 "$@" \
    bash "$SUT" --publish --force > "$T/$name.log" 2>&1
  echo $? > "$T/$name.rc"
  cp "$FAKE_DIR/issue.md" "$T/$name.md" 2>/dev/null || : > "$T/$name.md"
}
calls() { grep -c -- "$2" "$T/$1.d/calls" || true; }
E504='HTTP 504: 504 Gateway Timeout (https://api.github.com/graphql)'

# 1. Lecture complète : pagination, contrôles lus pour les seules PR non vertes, mail tenté.
run ok gestes
check "ok : code retour 0" '[ "$(cat $T/ok.rc)" = 0 ]'
check "ok : journal, nombre de gestes lus" 'contient $T/ok.log "Gestes de Marwane : 3 (fusions 1, migrations 1, désaccords 0, en attente 1) ; PR ouvertes lues : 4/4"'
check "ok : en-tête du corps" 'contient $T/ok.md "## Gestes attendus de Marwane : 3"'
check "ok : PR de fusion et son contrôle en échec" 'contient $T/ok.md "[#10](https://github.com/o/r/pull/10) PR 10 — 1 check(s) en échec"'
check "ok : PR de migration" 'contient $T/ok.md "[#9](https://github.com/o/r/pull/9) PR 9"'
check "ok : issue en attente" 'contient $T/ok.md "[#50](https://github.com/o/r/issues/50) Issue 50"'
check "ok : deux pages lues" '[ "$(calls ok "pullRequests(")" = 2 ]'
check "ok : contrôles lus pour #10 et #7 seulement" '[ "$(calls ok "n=10")" = 1 ] && [ "$(calls ok "n=7")" = 1 ] && [ "$(calls ok "n=9")" = 0 ] && [ "$(calls ok "n=8")" = 0 ]'
check "ok : signal PR en échec" 'contient $T/ok.md "| 1 hors Dependabot ; 1 Dependabot (attendu, PR-9a) |"'
check "ok : mail du jour tenté (gestes présents)" 'contient $T/ok.md "Mail du jour : canal mail indisponible"'
check "ok : aucune lecture en échec affichée" 'absent $T/ok.md "Lecture en échec" && absent $T/ok.log "lecture en échec"'

# 2. Liste des PR en HTTP 504 persistant, aucun autre geste : le cas du 18 nov.
run pr504 vide fail.prs="* stderr $E504"
check "pr504 : code retour 0" '[ "$(cat $T/pr504.rc)" = 0 ]'
check "pr504 : 3 essais bornés" '[ "$(calls pr504 "pullRequests(")" = 3 ]'
check "pr504 : cause dans l en-tête" 'contient $T/pr504.md "_Lecture en échec : liste des PR : HTTP 504 GitHub après 3 essais."'
check "pr504 : cause sur la liste des PR" 'contient $T/pr504.md "_Liste des PR ouvertes illisible (liste des PR : HTTP 504 GitHub après 3 essais)"'
check "pr504 : mail non envoyé, cause écrite" 'contient $T/pr504.md "Mail du jour : non envoyé : liste des gestes illisible (liste des PR : HTTP 504 GitHub après 3 essais)."'
check "pr504 : « aucun geste » jamais affirmé" 'absent $T/pr504.md "aucun geste attendu" && contient $T/pr504.md "## Gestes attendus de Marwane : 0 au moins (liste partielle)"'
check "pr504 : signal PR en échec indisponible avec cause" 'contient $T/pr504.md "lecture en échec (liste des PR : HTTP 504 GitHub après 3 essais)"'
check "pr504 : journal du job" 'contient $T/pr504.log "::warning::Gestes de Marwane : 0 au moins, lecture en échec — liste des PR : HTTP 504 GitHub après 3 essais" && contient $T/pr504.log "gestes : 0 au moins, lecture en échec : liste des PR : HTTP 504 GitHub après 3 essais"'
check "pr504 : message brut jamais publié" 'absent $T/pr504.md "Gateway Timeout" && absent $T/pr504.md "api.github.com"'

# 3. Même échec avec des gestes lus ailleurs : mail partiel tenté, « au moins ».
run pr504g gestes fail.prs="* stderr $E504"
check "pr504g : gestes partiels" 'contient $T/pr504g.md "## Gestes attendus de Marwane : 1 au moins (liste partielle)"'
check "pr504g : mail partiel tenté" 'contient $T/pr504g.md "Mail du jour : canal mail indisponible"'

# 4. 502 passager : un nouvel essai suffit, aucune perte.
run transitoire gestes fail.prs="1 stderr HTTP 502: Bad Gateway"
check "transitoire : nouvel essai journalisé" 'contient $T/transitoire.log "lecture liste des PR : HTTP 502 GitHub, nouvel essai dans 0 s (2/3)"'
check "transitoire : gestes complets" 'contient $T/transitoire.log "Gestes de Marwane : 3 (fusions 1" && absent $T/transitoire.md "Lecture en échec"'

# 5. Délai dépassé, réponse non JSON, erreur GraphQL (non répétée).
run delai vide fail.prs="* sleep 3" -- GH_READ_TIMEOUT=1
check "délai : cause" 'contient $T/delai.md "liste des gestes illisible (liste des PR : délai de 1 s dépassé après 3 essais)"'
run html vide fail.prs="* html"
check "html : cause" 'contient $T/html.md "liste des gestes illisible (liste des PR : réponse illisible après 3 essais)"'
run graphql vide fail.prs="* stderr GraphQL: Something went wrong while executing your query."
check "graphql : cause, un seul essai" 'contient $T/graphql.md "liste des gestes illisible (liste des PR : erreur GraphQL GitHub)" && [ "$(calls graphql "pullRequests(")" = 1 ]'

# 6. Contrôles d'une PR illisibles : gestes lus, signal PR en échec indisponible, lecture bornée.
run checks gestes fail.checks="* stderr $E504"
check "checks : gestes complets malgré tout" 'contient $T/checks.md "## Gestes attendus de Marwane : 3"'
check "checks : PR marquée contrôles illisibles" 'contient $T/checks.md "[#10](https://github.com/o/r/pull/10) PR 10 — contrôles illisibles"'
check "checks : signal indisponible avec cause" 'contient $T/checks.md "lecture partielle : au moins 0 hors Dependabot ; contrôles de 2 PR illisibles (HTTP 504 GitHub après 3 essais)"'
check "checks : PR suivante non tentée après échec définitif" '[ "$(calls checks "pullRequest(number")" = 3 ]'

# 7. Labels illisibles : les deux lectures de label portent la même cause, écrite une fois.
run labels vide fail.labels="* stderr HTTP 502: Bad Gateway"
check "labels : mail non envoyé, cause unique" 'contient $T/labels.md "Mail du jour : non envoyé : liste des gestes illisible (labels : HTTP 502 GitHub après 3 essais)."'
check "labels : signal en attente indisponible" 'contient $T/labels.md "lecture en échec (labels : HTTP 502 GitHub après 3 essais)"'
check "labels : sections des labels indisponibles" 'contient $T/labels.md "_Issues **indisponibles** (labels : HTTP 502 GitHub après 3 essais)._"'

# 8. Issues d'un label refusées (403, non passager : un seul essai).
run issues403 vide fail.issues-attend-marwane="* stderr HTTP 403: Resource not accessible by integration"
check "issues403 : cause sans nouvel essai" 'contient $T/issues403.md "liste des gestes illisible (issues au label attend-marwane : HTTP 403 GitHub)." && [ "$(calls issues403 "label attend-marwane")" = 1 ]'

# 9. Label d'arbitrage absent : pas un échec, dit tel quel ; aucun geste ⇒ aucun mail.
run sanslabel vide labels.json='[{"name":"attend-marwane"}]'
check "sans label : déclaré inexistant" 'contient $T/sanslabel.md "_Label needs-human inexistant._"'
check "sans label : lecture complète, aucun geste, pas de mail" 'contient $T/sanslabel.md "Mail du jour : aucun geste attendu, pas de mail." && contient $T/sanslabel.log "Gestes de Marwane : 0 (fusions 0"'
check "sans label : aucune issue lue pour ce label" '[ "$(calls sanslabel "label needs-human")" = 0 ]'

# 10. Urgences inchangées : une alerte critique ouverte reste signalée et son mail tenté.
run urgence vide alerts-dependabot=17
check "urgence : incident listé, mail tenté" 'contient $T/urgence.md "## Urgences en cours" && contient $T/urgence.md "Alerte de sécurité critique (Dependabot) — depuis" && contient $T/urgence.md "mail : canal indisponible"'

echo ""
echo "$((N - FAIL))/$N vérifications réussies"
[ "$FAIL" -eq 0 ]
