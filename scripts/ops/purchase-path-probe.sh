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
#   purchase-path-probe.sh summary
#       Synthèse des dernières 24 h en Markdown sur stdout, pour le rapport unique.
#       Code de sortie = niveau : 0 ✅, 1 ⚠️, 2 ⛔ ; autre = erreur du script.
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
cmd_summary() {
  require_env
  local since tmp runs
  since=$(date -u -d '24 hours ago' +%FT%TZ)
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  runs=$(gh run list --repo "$REPO" --workflow "$PROBE_WORKFLOW" --branch "$PROBE_BRANCH" \
      --created ">=$since" --limit 200 --json databaseId,status,conclusion,createdAt)
  local decisive total ok failed availability
  decisive=$(jq -c "[.[] | $DECISIVE]" <<<"$runs")
  total=$(jq 'length' <<<"$decisive")
  ok=$(jq '[.[] | select(.conclusion == "success")] | length' <<<"$decisive")
  failed=$((total - ok))

  echo "## Parcours d'achat simulé (PROD, 24 h)"
  if [ "$total" -eq 0 ]; then
    echo "⛔ Aucun passage décisif depuis $since — la sonde ne tourne pas ($PROBE_WORKFLOW)."
    return 2
  fi
  availability=$(jq -n --argjson ok "$ok" --argjson t "$total" '($ok * 1000 / $t | floor) / 10')

  # Résultats détaillés : un artefact par passage (rétention courte). Jusqu'à 96
  # téléchargements : 8 en parallèle pour tenir dans le délai du digest (8 min).
  local id missing=0
  jq -r '.[].databaseId' <<<"$decisive" \
    | xargs -r -P 8 -I{} sh -c 'gh run download "$1" --repo "$2" -n "$3" -D "$4/$1" >/dev/null 2>&1 || true' \
        _ {} "$REPO" "$PROBE_ARTIFACT" "$tmp"
  for id in $(jq -r '.[].databaseId' <<<"$decisive"); do
    [ -f "$tmp/$id/result.json" ] || missing=$((missing + 1))
  done
  local results
  results=$(find "$tmp" -name result.json -exec cat {} + | jq -s '[.[] | select(.schema == "purchase-path-probe/v1")]')

  local incident level=0
  incident=$(open_incident)
  if [ -n "$incident" ] || [ "$(jq -n --argjson a "$availability" '$a < 95')" = "true" ]; then
    level=2
  elif [ "$failed" -gt 0 ] || [ "$total" -lt $((PROBE_EXPECTED_RUNS_24H * 3 / 4)) ]; then
    level=1
  fi
  local icon
  icon=$(case $level in 0) echo "✅" ;; 1) echo "⚠️" ;; *) echo "⛔" ;; esac)

  echo "$icon Disponibilité **${availability} %** — $ok/$total passages réussis ($total décisifs sur $PROBE_EXPECTED_RUNS_24H attendus)."
  if [ -n "$incident" ]; then
    echo "- Incident ouvert : $SERVER/$REPO/issues/$incident"
  fi
  [ "$missing" -eq 0 ] || echo "- $missing passage(s) sans résultat détaillé (artefact absent ou expiré)."
  echo
  echo "| Étape | Échecs | Médiane (ms) | p95 (ms) | Max (ms) |"
  echo "|---|---|---|---|---|"
  jq -r '
    def pct(p): sort | .[((length * p) | ceil) - 1];
    [.[] | .steps[]] as $all
    | ["accueil","vehicule","gamme","produit","ajout_panier","panier","commande","paiement","nettoyage"][] as $s
    | ([$all[] | select(.step == $s)]) as $rows
    | ([$rows[] | select(.ok) | .ms]) as $ms
    | ([.[] | select(.failed_step == $s)] | length) as $fails
    | select(($rows | length) > 0 or $fails > 0)
    | "| \($s) | \($fails) | \(if ($ms|length) > 0 then ($ms | pct(0.5)) else "—" end) | \(if ($ms|length) > 0 then ($ms | pct(0.95)) else "—" end) | \(if ($ms|length) > 0 then ($ms | max) else "—" end) |"
  ' <<<"$results"
  echo
  echo "Durées des étapes réussies seulement. Seuils : ⛔ incident ouvert ou disponibilité < 95 % ; ⚠️ un échec, ou moins de $((PROBE_EXPECTED_RUNS_24H * 3 / 4)) passages."
  return "$level"
}

case "${1:-}" in
  alert) shift; cmd_alert "$@" ;;
  summary) shift; cmd_summary "$@" ;;
  *) echo "usage: $0 alert <résultat.json> | summary" >&2; exit 3 ;;
esac
