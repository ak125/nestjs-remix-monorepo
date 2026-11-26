#!/usr/bin/env bash
# ==============================================================================
# purchase-path-probe.sh — alerte et synthèse de la sonde du parcours d'achat
# (mandat AU, décision 52 ; alerte décision 67 ; robot exclu des mesures, décision 36)
#
# La sonde elle-même : frontend/tests/purchase-probe/purchase-path.probe.ts, lancée
# toutes les 15 min par .github/workflows/purchase-path-probe.yml (runner GitHub,
# donc de l'extérieur, comme un client). Ce script n'ouvre aucun navigateur.
#
# Usage :
#   purchase-path-probe.sh alert <résultat.json>
#       Après chaque passage. Ouvre UNE issue d'incident (assignée à l'owner, donc
#       un e-mail) quand ce passage ET le passage décisif précédent ont échoué, et
#       qu'aucun incident n'est déjà ouvert ; la ferme au premier passage réussi.
#       Fichier absent ou illisible = passage en échec (« sonde »).
#   purchase-path-probe.sh report <résultat.json> <parcours-achat.json>
#       Après chaque passage. Écrit l'agrégat des 24 h au format parcours-achat.v1
#       (disponibilité, temps par étape p50/p95/max/dernier, dernier passage et nombre
#       d'échecs consécutifs), lu par le rapport unique : .github/scripts/
#       morning-health-digest.sh (mandat AM), qui télécharge l'artefact du dernier run.
#
# Environnement :
#   GH_TOKEN, REPO (owner/nom)                        requis
#   GITHUB_RUN_ID                                     requis pour alert (passage courant)
#   PROBE_WORKFLOW   défaut purchase-path-probe.yml
#   PROBE_BRANCH     défaut main
#   PROBE_ASSIGNEE   défaut ak125 (destinataire de l'e-mail d'incident)
#   PROBE_ARTIFACT   défaut purchase-path-probe-result
#   PROBE_EXPECTED_RUNS_24H  défaut 96 (une exécution toutes les 15 min)
#
# Données : uniquement étapes, durées, statuts et liens de runs. Le dépôt est
# public ; la sonde ne voit aucune donnée client et n'en écrit aucune ici.
# ==============================================================================
set -euo pipefail

: "${PROBE_WORKFLOW:=purchase-path-probe.yml}"
: "${PROBE_BRANCH:=main}"
: "${PROBE_ASSIGNEE:=ak125}"
: "${PROBE_ARTIFACT:=purchase-path-probe-result}"
: "${PROBE_EXPECTED_RUNS_24H:=96}"
SERVER="${GITHUB_SERVER_URL:-https://github.com}"
INCIDENT_PREFIX="🔴 Parcours d'achat PROD en échec"

die() { echo "[purchase-path-probe] $*" >&2; exit 3; }
log() { echo "[purchase-path-probe] $*" >&2; }

require_env() {
  [ -n "${GH_TOKEN:-}" ] || die "GH_TOKEN manquant"
  [ -n "${REPO:-}" ] || die "REPO manquant (owner/nom)"
  command -v gh >/dev/null || die "gh absent"
  command -v jq >/dev/null || die "jq absent"
}

run_url() { echo "$SERVER/$REPO/actions/runs/$1"; }

# Échec décisif d'un run : un passage annulé ou sauté ne dit rien du parcours.
DECISIVE='select(.status == "completed" and (.conclusion | IN("success","failure","timed_out","startup_failure")))'

open_incident() {
  gh issue list --repo "$REPO" --state open --limit 100 --json number,title,author \
    | jq -r --arg p "$INCIDENT_PREFIX" \
        '[.[] | select((.title | startswith($p)) and (.author.login | test("github-actions")))] | sort_by(.number) | .[0].number // empty'
}

# ------------------------------------------------------------------------------
cmd_alert() {
  local result="${1:-}"
  require_env
  [ -n "${GITHUB_RUN_ID:-}" ] || die "GITHUB_RUN_ID manquant"

  local ok=false step="sonde" label="Exécution de la sonde (aucun résultat)" failure="résultat absent ou illisible" steps_md=""
  if [ -n "$result" ] && jq -e '.schema == "purchase-path-probe/v1"' "$result" >/dev/null 2>&1; then
    ok=$(jq -r '.ok == true' "$result")
    step=$(jq -r '.failed_step // "inconnue"' "$result")
    label=$(jq -r '.failed_label // "inconnue"' "$result")
    # Une ligne, sans gabarit Markdown ni mention : texte de l'erreur Playwright de la sonde.
    failure=$(jq -r '.failure // ""' "$result" | tr '\n`' '  ' | sed 's/@/(at)/g' | cut -c1-300)
    steps_md=$(jq -r '.steps[] | "| \(.step) | \(if .ok then "✅" else "⛔" end) | \(.ms) |"' "$result")
  fi

  local incident
  incident=$(open_incident)

  if [ "$ok" = "true" ]; then
    if [ -n "$incident" ]; then
      gh issue comment "$incident" --repo "$REPO" \
        --body "✅ Rétabli : parcours complet réussi au passage $(run_url "$GITHUB_RUN_ID")."
      gh issue close "$incident" --repo "$REPO" --reason completed
      log "incident #$incident fermé (rétabli)"
    else
      log "passage réussi, aucun incident ouvert"
    fi
    return 0
  fi

  if [ -n "$incident" ]; then
    # Une seule alerte par incident : pas de commentaire à chaque échec (chaque
    # commentaire renverrait un e-mail). L'historique est dans les runs.
    log "échec à l'étape « $step », incident #$incident déjà ouvert — pas de nouvelle alerte"
    return 0
  fi

  local previous
  previous=$(gh run list --repo "$REPO" --workflow "$PROBE_WORKFLOW" --branch "$PROBE_BRANCH" --limit 20 \
      --json databaseId,status,conclusion,createdAt \
    | jq -r --argjson cur "$GITHUB_RUN_ID" \
        "[.[] | select(.databaseId != \$cur) | $DECISIVE] | sort_by(.createdAt) | last | \"\(.databaseId // \"\") \(.conclusion // \"\")\"")
  local prev_id prev_conclusion
  read -r prev_id prev_conclusion <<<"$previous" || true

  if [ -z "$prev_id" ] || [ "$prev_conclusion" = "success" ]; then
    log "1er échec consécutif (étape « $step ») — alerte au 2e"
    return 0
  fi

  local body
  body=$(mktemp)
  {
    echo "Le parcours d'achat simulé échoue **deux passages de suite** (décision 52, alerte décision 67)."
    echo
    echo "- Étape en échec : **$label** (\`$step\`)"
    echo "- Erreur : $failure"
    echo "- Passage courant : $(run_url "$GITHUB_RUN_ID")"
    echo "- Passage précédent ($prev_conclusion) : $(run_url "$prev_id")"
    echo
    if [ -n "$steps_md" ]; then
      echo "| Étape | Issue | Durée (ms) |"
      echo "|---|---|---|"
      echo "$steps_md"
      echo
    fi
    echo "Robot : UA \`AutoMecanik-PurchaseProbe-bot/1.0\`, aucun paiement, panier vidé et session fermée à chaque passage."
    echo "Cette issue se ferme seule au premier passage réussi ; aucune autre alerte n'est envoyée tant qu'elle reste ouverte."
  } >"$body"
  local url
  url=$(gh issue create --repo "$REPO" --title "$INCIDENT_PREFIX — étape « $label »" \
    --assignee "$PROBE_ASSIGNEE" --body-file "$body")
  rm -f "$body"
  log "incident ouvert : $url"
}

# ------------------------------------------------------------------------------
# Étapes, dans l'ordre du parcours (frontend/tests/purchase-probe/purchase-path.probe.ts).
STEPS_JSON='["accueil","vehicule","gamme","produit","ajout_panier","panier","commande","paiement","nettoyage"]'

cmd_report() {
  local current="${1:-}" out="${2:-}"
  require_env
  [ -n "${GITHUB_RUN_ID:-}" ] || die "GITHUB_RUN_ID manquant"
  [ -n "$out" ] || die "usage : report <résultat.json> <sortie.json>"
  local now since tmp runs
  now=$(date -u +%FT%TZ)
  since=$(date -u -d '24 hours ago' +%FT%TZ)
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  # Passages décisifs des 24 h, hors passage courant, du plus récent au plus ancien.
  runs=$(gh run list --repo "$REPO" --workflow "$PROBE_WORKFLOW" --branch "$PROBE_BRANCH" \
      --created ">=$since" --limit 200 --json databaseId,status,conclusion,createdAt)
  # Données de taille variable passées à jq par fichier, jamais en argument : un
  # argument est borné à 128 Kio par le noyau (MAX_ARG_STRLEN), dépassé vers 50
  # passages détaillés de ~2,6 Ko (« Argument list too long », mandat EY).
  jq -c --argjson cur "$GITHUB_RUN_ID" \
    "[.[] | select(.databaseId != \$cur) | $DECISIVE] | sort_by(.createdAt) | reverse" <<<"$runs" >"$tmp/runs.json"

  # Détail des passages précédents : un artefact par passage (rétention courte),
  # 8 téléchargements en parallèle. Un artefact absent compte dans runs_without_detail.
  jq -r '.[].databaseId' "$tmp/runs.json" \
    | xargs -r -P 8 -I{} sh -c 'gh run download "$1" --repo "$2" -n "$3" -D "$4/$1" >/dev/null 2>&1 || true' \
        _ {} "$REPO" "$PROBE_ARTIFACT" "$tmp"
  find "$tmp" -name result.json -exec cat {} + | jq -s '[.[] | select(.schema == "purchase-path-probe/v1")]' >"$tmp/prev.json"

  # Passage courant : fichier absent ou illisible = échec de la sonde elle-même.
  if [ -n "$current" ] && jq -e '.schema == "purchase-path-probe/v1"' "$current" >/dev/null 2>&1; then
    jq -c . "$current" >"$tmp/cur.json"
  else
    jq -cn --arg now "$now" '{schema:"purchase-path-probe/v1", ok:false, failed_step:"sonde", finished_at:$now, steps:[]}' >"$tmp/cur.json"
  fi

  # Format parcours-achat.v1, lu par .github/scripts/morning-health-digest.sh (mandat AM).
  # consecutive_failures : échecs décisifs consécutifs jusqu'au passage courant compris
  # (0 s'il a réussi) ; l'alerte part à 2 (décision 67). Agrégats seulement : aucun texte
  # d'erreur, aucune donnée client (le rapport est une issue publique).
  # --slurpfile lie un tableau des valeurs du fichier : [0] rend la valeur unique.
  jq -n --slurpfile cur "$tmp/cur.json" --slurpfile prev "$tmp/prev.json" --slurpfile runs "$tmp/runs.json" \
        --argjson steps "$STEPS_JSON" --argjson expected "$PROBE_EXPECTED_RUNS_24H" \
        --arg now "$now" --arg url "$(run_url "$GITHUB_RUN_ID")" '
    $cur[0] as $cur | $prev[0] as $prev | $runs[0] as $runs
    | def pct(p): sort | .[((length * p) | ceil) - 1];
    def stat(p): if length > 0 then pct(p) else null end;
    ($runs | length + 1) as $total
    | (([$runs[] | select(.conclusion == "success")] | length) + (if $cur.ok == true then 1 else 0 end)) as $ok
    | ([$prev[], $cur] | [.[] | (.steps // [])[]]) as $all
    | {
        schema: "parcours-achat.v1",
        generated_at: $now,
        window_hours: 24,
        availability_pct: (($ok * 1000 / $total | floor) / 10),
        runs_total: $total,
        runs_ok: $ok,
        runs_expected: $expected,
        runs_without_detail: (($runs | length) - ($prev | length) | if . < 0 then 0 else . end),
        steps: [
          $steps[] as $s
          | ([($cur.steps // [])[] | select(.step == $s)] | first) as $c
          | ([$all[] | select(.step == $s and .ok == true) | .ms]) as $ms
          | select($c != null or ($ms | length) > 0)
          | {name: $s, p50_ms: ($ms | stat(0.5)), p95_ms: ($ms | stat(0.95)),
             max_ms: (if ($ms | length) > 0 then ($ms | max) else null end),
             last_ms: ($c.ms // null), ok: ($c.ok == true)}
        ],
        last_run: {
          at: ($cur.finished_at // $now),
          ok: ($cur.ok == true),
          failed_step: (if $cur.ok == true then null else ($cur.failed_step // "inconnue") end),
          consecutive_failures: (if $cur.ok == true then 0
            else 1 + ([$runs[] | .conclusion == "success"] | index(true) // length) end),
          url: $url
        }
      }' >"$out"
  log "rapport écrit : $(jq -c '{availability_pct, runs_ok, runs_total, last: .last_run.ok, cf: .last_run.consecutive_failures}' "$out")"
}

case "${1:-}" in
  alert) shift; cmd_alert "$@" ;;
  report) shift; cmd_report "$@" ;;
  *) echo "usage: $0 alert <résultat.json> | report <résultat.json> <parcours-achat.json>" >&2; exit 3 ;;
esac
