#!/usr/bin/env bash
# registry-thresholds.sh — section « Fonctions du registre et seuils » du rapport du matin
# (mandat BZ, décisions 7, 8, 9, 24, 67, 72).
#
#   bash scripts/governance/registry-thresholds.sh <section.md>
#
# Appelé par .github/scripts/morning-health-digest.sh dans le passage du rapport du jour
# (correctif docs/plans/2026-11-18-mandat-bz-patches/01-*). N'échoue jamais pour l'appelant :
# toute source illisible est écrite dans la section, jamais remplacée par zéro ou par un succès.
#
# 1. Lit les indicateurs des seuils évaluables par leur producteur
#    (registry-threshold-read.ts, tsx et node_modules requis ; sinon « non mesuré »).
# 2. Évalue les seuils (registry-thresholds.py) et écrit une ligne par département.
# 3. Une issue par fonction dont le seuil est franchi, au titre fixe « Seuil de fonction — <id> »,
#    label dept:NN-<id> existant (jamais créé), corps remplacé, commentaire au changement de
#    couleur seulement ; au retour sous le seuil, commentaire de retour à la normale, jamais
#    de fermeture. Logique réutilisée : .github/scripts/report-issue-publish.sh.
#
# Env :
#   THRESHOLD_ISSUES_MODE  off | dry-run | write (défaut dry-run ; valeur inconnue = dry-run).
#                          write n'écrit que si PUBLISH=1 (rapport lancé avec --publish).
#   PUBLISH                1 si le rapport publie (--publish), sinon rien n'est écrit.
#   REPO, GH_TOKEN         lecture des issues et des labels ; écriture en mode write seulement.
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  lus par le producteur, jamais affichés.
#   THRESHOLD_READINGS     (tests) fichier de lectures à utiliser à la place du lecteur.
#   THRESHOLD_MAP          (tests) carte à lire à la place du registre du dépôt.
#   THRESHOLD_READER       (tests) commande à lancer à la place du lecteur (même argument).
# Lecteur en échec : raison filtrée (nom, code, paquet) dans le journal (::warning::) et dans
# la section ; son stderr brut n'est jamais affiché.
#   GITHUB_SERVER_URL      base des liens (défaut https://github.com).
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT_MD="${1:?usage : registry-thresholds.sh <section.md>}"
MAP_REL=".spec/00-canon/ai-registry/agent-operating-map.yaml"
GH_URL="${GITHUB_SERVER_URL:-https://github.com}"
# shellcheck source=/dev/null
. "$ROOT/.github/scripts/report-issue-publish.sh"

MODE_ASKED="${THRESHOLD_ISSUES_MODE:-dry-run}"
case "$MODE_ASKED" in off|dry-run|write) TMODE="$MODE_ASKED" ;; *) TMODE="dry-run" ;; esac
WRITE=0
[ "$TMODE" = write ] && [ "${PUBLISH:-0}" = 1 ] && WRITE=1

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

run_reader() { # <sortie.json> — lecteur du dépôt, ou THRESHOLD_READER (essai)
  if [ -n "${THRESHOLD_READER:-}" ]; then timeout 180 "$THRESHOLD_READER" "$1"
  else (cd "$ROOT/backend" && timeout 180 ../node_modules/.bin/tsx ../scripts/governance/registry-threshold-read.ts "$1"); fi
}

# Raison courte et sûre d'un lecteur en échec, tirée de son stderr par jetons autorisés seulement
# (nom d'erreur, code système, nom de paquet) : jamais le message brut, qui peut citer une URL,
# une clé ou un chemin. La ligne finale du lecteur est déjà filtrée (safeReason).
reader_reason() { # <code retour> <stderr>
  local rc="$1" f="$2" own name code pkg
  [ "$rc" = 124 ] && { echo "délai de 180 s dépassé"; return; }
  own=$(grep -m1 -oE '^registry-threshold-read : échec \([A-Za-z]{1,40}( [A-Z][A-Z0-9_]{1,40})?( (@[a-z0-9._-]+/)?[a-z0-9._-]+)?\)$' "$f" 2>/dev/null)
  if [ -n "$own" ]; then echo "${own#registry-threshold-read : }, code retour $rc"; return; fi
  name=$(grep -m1 -oE '^[A-Za-z]{0,30}(Error|Exception)\b' "$f" 2>/dev/null)
  code=$(grep -m1 -oE "code: '[A-Z][A-Z0-9_]{1,40}'" "$f" 2>/dev/null | grep -oE '[A-Z][A-Z0-9_]+')
  pkg=""
  case "$code" in *MODULE_NOT_FOUND)
    pkg=$(grep -m1 'Cannot find module' "$f" 2>/dev/null | grep -m1 -oE 'node_modules/(@[a-z0-9._-]+/)?[a-z0-9._-]+' | sed 's#^node_modules/##') ;;
  esac
  echo "$(echo "${name:-erreur} $code $pkg" | tr -s ' ' | sed 's/ $//'), code retour $rc"
}
READINGS="-"
READ_NOTE=""
if [ "$TMODE" != off ]; then
  if [ -n "${THRESHOLD_READINGS:-}" ]; then
    READINGS="$THRESHOLD_READINGS"; READ_NOTE="lectures fournies par THRESHOLD_READINGS (essai)"
  elif [ -n "${THRESHOLD_READER:-}" ] || { [ -x "$ROOT/node_modules/.bin/tsx" ] && [ -d "$ROOT/node_modules/@nestjs/config" ]; }; then
    # stdout du lecteur = journaux du producteur, jetés ; stderr gardé dans un fichier, jamais
    # affiché : seule une raison filtrée (reader_reason) sort, dans le journal et la section.
    rc=0
    run_reader "$WORK/readings.json" >/dev/null 2> "$WORK/reader.err" || rc=$?
    if [ "$rc" = 0 ] && jq -e '.indicators | type == "object"' "$WORK/readings.json" >/dev/null 2>&1; then
      READINGS="$WORK/readings.json"; READ_NOTE="lecteur exécuté"
    else
      if [ "$rc" = 0 ]; then why="sortie du lecteur illisible"; else why=$(reader_reason "$rc" "$WORK/reader.err"); fi
      echo "::warning::registry thresholds : lecteur en échec ($why), indicateurs non mesurés"
      READ_NOTE="lecteur en échec ($why) : indicateurs non mesurés"
    fi
  else
    echo "::warning::registry thresholds : dépendances du producteur absentes du job (tsx, node_modules), indicateurs non mesurés"
    READ_NOTE="dépendances du producteur absentes du job (tsx, node_modules) : indicateurs non mesurés"
  fi
  # Indicateur lu mais non mesuré : sa raison (déjà filtrée par le lecteur) va aussi au journal.
  [ "$READINGS" != "-" ] && jq -r '.indicators // {} | to_entries[] | select(.value.unmeasured)
    | "::warning::registry thresholds : \(.key) non mesuré (\(.value.unmeasured | tostring | .[0:200]))"' "$READINGS" 2>/dev/null
fi

if ! python3 "$HERE/registry-thresholds.py" "${THRESHOLD_MAP:-$ROOT/$MAP_REL}" "$READINGS" "$TMODE" \
     "$GH_URL/${REPO:-?}/blob/main/$MAP_REL" > "$WORK/eval.json" 2> "$WORK/eval.err"; then
  {
    echo "## Fonctions du registre et seuils"
    echo ""
    echo "_Registre **indisponible** (\`$MAP_REL\` illisible ou ≠ 24 départements) : aucun seuil évalué, aucune issue écrite._"
  } > "$OUT_MD"
  exit 0
fi

label_exists() { gh api "repos/$REPO/labels/$(jq -rn --arg l "$1" '$l | @uri')" >/dev/null 2>&1; }
prev_color() { gh issue view "$1" --repo "$REPO" --json body --jq '.body' 2>/dev/null | report_state_extract | jq -r --arg k "$2" '.[$k].c // ""'; }

# One action line per measured threshold (franchi or sous le seuil).
ACTIONS="$WORK/actions.md"
: > "$ACTIONS"
jq -c '.thresholds[] | select(.state == "franchi" or .state == "sous_le_seuil")' "$WORK/eval.json" | while IFS= read -r th; do
  id=$(jq -r .id <<< "$th"); state=$(jq -r .state <<< "$th"); color=$(jq -r .color <<< "$th")
  title=$(jq -r .title <<< "$th"); label=$(jq -r .issue_label <<< "$th"); key="seuil:$id"
  st=$(jq -cn --arg k "$key" --arg c "$color" --arg l "$(jq -r .state_label <<< "$th")" '{($k): {c: $c, l: $l}}')
  if [ -z "${REPO:-}" ] || ! number=$(report_issue_find "$title" 2>/dev/null); then
    echo "- \`$id\` : issues illisibles, aucune action." >> "$ACTIONS"; continue
  fi
  if [ "$state" = sous_le_seuil ] && [ -z "$number" ]; then
    echo "- \`$id\` : sous le seuil, aucune issue ouverte : rien à faire." >> "$ACTIONS"; continue
  fi
  if [ -z "$number" ] && ! label_exists "$label"; then
    echo "- \`$id\` : seuil franchi mais label \`$label\` absent : aucune issue (label jamais créé ici)." >> "$ACTIONS"; continue
  fi
  if [ -z "$number" ]; then
    what="ouvrir « $title » (label \`$label\`)"
  elif [ "$state" = sous_le_seuil ]; then
    pc=$(prev_color "$number" "$key")
    if [ -n "$pc" ] && [ "$pc" != vert ]; then what="mettre à jour #$number et commenter le retour à la normale ($pc → vert), sans la fermer"
    else what="mettre à jour #$number (déjà sous le seuil), sans commentaire"; fi
  else
    pc=$(prev_color "$number" "$key")
    if [ -n "$pc" ] && [ "$pc" != "$color" ]; then what="mettre à jour #$number et commenter le changement ($pc → $color)"
    else what="mettre à jour #$number"; fi
  fi
  if [ "$WRITE" = 1 ]; then
    jq -r .body <<< "$th" > "$WORK/body.md"
    if n=$(report_issue_publish "$title" "$WORK/body.md" "$st" ak125 2>/dev/null) && [ -n "$n" ]; then
      [ -z "$number" ] && { gh issue edit "$n" --repo "$REPO" --add-label "$label" >/dev/null 2>&1 \
        || echo "::warning::issue #$n ouverte sans le label $label (ajout en échec)"; }
      echo "- \`$id\` : fait — $what → #$n." >> "$ACTIONS"
    else
      echo "- \`$id\` : écriture en échec — $what." >> "$ACTIONS"
    fi
  else
    echo "- \`$id\` : ferait — $what." >> "$ACTIONS"
  fi
done

{
  echo "## Fonctions du registre et seuils"
  echo ""
  echo "Une ligne par département : fonctions du registre (\`$MAP_REL\`) par statut, puis les seuils mesurés ; « pas de mesure » quand aucun indicateur n'est mesurable. Valeurs de KPI non publiées (dépôt public)."
  echo ""
  jq -r '.departments[] | "- \(.line)"' "$WORK/eval.json"
  echo ""
  echo "### Seuils évaluables"
  echo ""
  case "$TMODE" in
    off) echo "Mode \`off\` : seuils non évalués, aucune issue." ;;
    write) if [ "$WRITE" = 1 ]; then echo "Mode \`write\` : issues ouvertes ou mises à jour ci-dessous."
           else echo "Mode \`write\` demandé, rapport non publié (sans --publish) : rien n'est écrit, actions listées à blanc."; fi ;;
    *) echo "Mode \`dry-run\`$( [ "$MODE_ASKED" != dry-run ] && echo " (valeur « $MODE_ASKED » inconnue, à blanc par défaut)" ) : rien n'est écrit ; actions qui seraient faites ci-dessous." ;;
  esac
  [ -n "$READ_NOTE" ] && echo "Lecture des indicateurs : $READ_NOTE."
  echo ""
  echo "| Fonction | Label | État | Détail |"
  echo "|---|---|---|---|"
  jq -r '.thresholds[] | select(.state != "non_evaluable")
    | "| `\(.id)` | `\(.issue_label)` | \({"franchi":"franchi","sous_le_seuil":"sous le seuil","non_mesure":"non mesuré","non_evalue":"non évalué","non_branche":"non branché"}[.state]) \(if .color then {"rouge":"🔴","orange":"🟠","vert":"🟢"}[.color] else "" end) | \(.detail | gsub("\\|"; "\\|")) |"' "$WORK/eval.json"
  echo ""
  echo "Seuils en texte seul, non évaluables (n'ouvrent rien) : $(jq '[.thresholds[] | select(.state == "non_evaluable")] | length' "$WORK/eval.json")."
  echo ""
  if [ -s "$ACTIONS" ]; then
    echo "**Issues de seuil** :"
    echo ""
    cat "$ACTIONS"
  else
    echo "**Issues de seuil** : aucune (aucun seuil mesuré)."
  fi
} > "$OUT_MD"
exit 0
