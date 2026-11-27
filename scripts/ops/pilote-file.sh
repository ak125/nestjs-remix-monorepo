#!/usr/bin/env bash
# Routine pilote-file (ADR-128 D3/D6, étape 1 de D8) — pilote de la file de travail GitHub.
#
#   pilote-file.sh controle --sortie DIR            lecture seule : constats + empreinte → DIR/etat.json
#   pilote-file.sh session  --sortie DIR            session Claude seulement si l'empreinte a changé
#                                                   et si le producteur du KPI du rôle est présent (D2) :
#                                                   le code définit ce KPI (`id: '<kpi>'` ou
#                                                   `const id = '<kpi>'`, détecté par ast-grep), une
#                                                   simple mention ne suffit pas
#   pilote-file.sh publier  --sortie DIR [--a-blanc]
#                                                   issue de pilotage + commentaires bornés ;
#                                                   --a-blanc : n'écrit rien sur GitHub
#
# Le pilote propose : il ne ferme, ne fusionne et ne relabellise rien (D6, AI2). Les seules
# écritures GitHub sont le corps de l'issue de pilotage et des commentaires sur les issues citées.
# Le coût (sessions ouvertes, jetons, USD) est écrit dans DIR/cout.json à chaque exécution.
#
# Environnement : REPO (owner/nom, obligatoire) ; gh authentifié (GH_TOKEN en CI) ;
# pour `controle`, ast-grep dans PATH à la version épinglée de package.json (@ast-grep/cli) ;
# pour `session`, CLAUDE_CODE_OAUTH_TOKEN (jeton d'abonnement Claude, `claude setup-token`) ou, à
# défaut, ANTHROPIC_API_KEY ; un seul des deux est transmis à la CLI, aucun à gh, aucun affiché.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
CARTE="$RACINE/.spec/00-canon/ai-registry/agent-operating-map.yaml"
# ADR-128 D2 : producteur « présent » = l'un des deux fichiers où vivent les producteurs définit le
# KPI : objet `{ id: '<kpi>' }` du service, ou `const id = '<kpi>'` d'une règle. Détection par
# ast-grep (règles versionnées dans REGLE_PRODUCTEUR), jamais par recherche de texte : l'identifiant
# cité en commentaire, dans une liste ou dans une chaîne ne compte pas.
SOURCES_KPI=(
  "backend/src/modules/admin/services/command-center-kpi.service.ts"
  "backend/src/modules/admin/services/command-center-action-rules/department-kpi.rules.ts"
)
REGLE_PRODUCTEUR="$ICI/pilote-file.producteur-kpi.yml"

: "${REPO:?REPO (owner/nom) manquant}"
TITRE="${PILOTE_TITRE:-Pilotage de la file (pilote-file, ADR-128 D6)}"
JOURS="${PILOTE_JOURS_SANS_MOUVEMENT:-7}"          # convention de weekly-pr-hygiene.sh (≥ 7 j)
MAX_COMMENTAIRES="${PILOTE_MAX_COMMENTAIRES:-5}"
MODELE="${PILOTE_MODELE:-claude-opus-5-5}"
BUDGET="${PILOTE_BUDGET_USD:-1}"
CLI_VERSION="${PILOTE_CLI_VERSION:-2.1.316}"
DEPARTEMENT="${PILOTE_DEPARTEMENT:-23}"              # rôle de la routine (bloc routine:)
REF="${GITHUB_SHA:-main}"                           # version du code lue pour le producteur
LIMITE=1000

die() { echo "pilote-file : $*" >&2; exit 1; }

CMD="${1:-}"; shift || true
SORTIE=""; A_BLANC=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sortie) SORTIE="$2"; shift 2 ;;
    --a-blanc) A_BLANC=1; shift ;;
    *) die "argument inconnu : $1" ;;
  esac
done
[[ -n "$SORTIE" ]] || die "--sortie DIR obligatoire"
mkdir -p "$SORTIE/brut"

corps_pilote() { # corps actuel de l'issue de pilotage (vide si absente)
  local n; n="$(jq -r '.pilote_issue // empty' "$SORTIE/etat.json")"
  [[ -n "$n" ]] || { echo ""; return 0; }
  gh issue view "$n" --repo "$REPO" --json body --jq '.body'
}

controle() {
  gh issue list --repo "$REPO" --state open --limit "$LIMITE" \
    --json number,title,labels,createdAt,updatedAt,author,comments > "$SORTIE/brut/issues.json"
  gh pr list --repo "$REPO" --state open --limit "$LIMITE" \
    --json number,title,body,author,isDraft > "$SORTIE/brut/prs.json"
  local ni np
  ni="$(jq length "$SORTIE/brut/issues.json")"; np="$(jq length "$SORTIE/brut/prs.json")"
  [[ "$ni" -lt "$LIMITE" && "$np" -lt "$LIMITE" ]] || die "liste tronquée à $LIMITE ($ni issues, $np PR)"

  [[ -f "$CARTE" ]] || die "carte des départements absente : $CARTE"
  python3 - "$CARTE" > "$SORTIE/brut/departements.json" <<'PY'
import json, sys, yaml
carte = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
rows = []
for v in carte.values() if isinstance(carte, dict) else []:
    if isinstance(v, list):
        for d in v:
            if isinstance(d, dict) and isinstance(d.get("business_number"), int) and d.get("id"):
                rows.append({"label": "dept:%02d-%s" % (d["business_number"], d["id"]),
                             "intitule": d.get("label", "")})
rows.sort(key=lambda r: r["label"])
if len(rows) != 24 or len({r["label"] for r in rows}) != 24:
    sys.exit("attendu 24 départements distincts, lu %d" % len(rows))
print(json.dumps(rows, ensure_ascii=False))
PY

  # KPI du rôle (kpi_primary de la carte) et présence de son producteur (ADR-128 D2, AI1).
  local kpi producteur=absent
  kpi="$(python3 - "$CARTE" "$DEPARTEMENT" <<'PY'
import sys, yaml
carte = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
for v in carte.values() if isinstance(carte, dict) else []:
    if isinstance(v, list):
        for d in v:
            if isinstance(d, dict) and d.get("business_number") == int(sys.argv[2]):
                print(d.get("kpi_primary") or "")
PY
)"
  [[ -n "$kpi" ]] || die "kpi_primary du département $DEPARTEMENT introuvable dans la carte"
  # ast-grep à la version épinglée du dépôt ; absent ou d'une autre version ⇒ arrêt, jamais « absent ».
  local v_ag ag
  v_ag="$(jq -r '.devDependencies["@ast-grep/cli"] // .dependencies["@ast-grep/cli"] // empty' \
          "$RACINE/package.json")" || die "lecture de package.json impossible : producteur non évalué"
  [[ -n "$v_ag" ]] || die "version de @ast-grep/cli absente de package.json : producteur non évalué"
  ag="$(command -v ast-grep)" \
    || die "ast-grep absent du PATH (version épinglée $v_ag, package.json) : producteur non évalué"
  [[ "$("$ag" --version 2>&1)" == "ast-grep $v_ag" ]] \
    || die "ast-grep trouvé « $("$ag" --version 2>&1 | head -n1) », version épinglée $v_ag : producteur non évalué"
  # Les deux fichiers sont lus à la même version du code (REF).
  # Chemins absolus : ast-grep rend `./x` sous la forme `x`, la comparaison de .file en dépend.
  local src f n=0 fichiers=() brut; brut="$(cd "$SORTIE/brut" && pwd)"
  for src in "${SOURCES_KPI[@]}"; do
    n=$((n + 1)); f="$brut/source-kpi-$n.ts"
    gh api "repos/$REPO/contents/$src?ref=$REF" -H 'Accept: application/vnd.github.raw' \
      > "$f" || die "lecture de $src impossible"
    [[ -s "$f" ]] || die "$src vide"
    fichiers+=("$f")
  done
  local res="$SORTIE/brut/producteur-kpi.jsonl" err="$SORTIE/brut/producteur-kpi.stderr"
  "$ag" scan --rule "$REGLE_PRODUCTEUR" --json=stream "${fichiers[@]}" > "$res" 2> "$err" \
    || die "ast-grep en échec : $(head -n1 "$err") : producteur non évalué"
  [[ ! -s "$err" ]] || die "ast-grep : $(head -n1 "$err") : producteur non évalué"
  n=0
  for src in "${SOURCES_KPI[@]}"; do
    f="${fichiers[$n]}"; n=$((n + 1))
    jq -se --arg f "$f" 'any(.[]; .ruleId == "pilote-file-fichier-lu" and .file == $f)' "$res" > /dev/null \
      || die "$src non analysé par ast-grep (encodage ?) : producteur non évalué"
    local ligne
    ligne="$(jq -sr --arg f "$f" 'map(select(.ruleId == "pilote-file-erreur-syntaxe" and .file == $f))
                                  | first | .range.start.line // empty' "$res")"
    [[ -z "$ligne" ]] || die "$src : erreur de syntaxe ligne $((ligne + 1)) : producteur non évalué"
  done
  if jq -se --arg kpi "$kpi" 'any(.[]; .ruleId == "pilote-file-producteur-kpi"
        and (.metaVariables.single.KPI.text | .[1:-1]) == $kpi)' "$res" > /dev/null; then
    producteur=présent
  fi

  jq -n --slurpfile i "$SORTIE/brut/issues.json" --slurpfile p "$SORTIE/brut/prs.json" \
    --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson jours "$JOURS" --arg titre "$TITRE" \
    '{issues: $i[0], prs: $p[0], maintenant: $now, jours_sans_mouvement: $jours, titre_pilote: $titre}' \
    | jq -f "$ICI/pilote-file.constats.jq" > "$SORTIE/etat.json"

  local empreinte precedente
  empreinte="$(jq -cS '{file, constats: (.constats | .sans_mouvement |= map(.issue))}' "$SORTIE/etat.json" \
               | sha256sum | cut -d' ' -f1)"
  precedente="$(corps_pilote | grep -o 'pilote-file:empreinte:[0-9a-f]\{64\}' | head -n1 | cut -d: -f3 || true)"
  jq --arg e "$empreinte" --arg p "$precedente" --slurpfile d "$SORTIE/brut/departements.json" \
    --arg kpi "$kpi" --arg prod "$producteur" --arg src "$(IFS=,; echo "${SOURCES_KPI[*]}")@$REF" \
    '. + {empreinte: $e, empreinte_precedente: (if $p == "" then null else $p end),
          nouveau: ($e != $p), departements: $d[0],
          kpi: {id: $kpi, producteur: $prod, source: $src}}' "$SORTIE/etat.json" > "$SORTIE/etat.tmp"
  mv "$SORTIE/etat.tmp" "$SORTIE/etat.json"

  local nouveau; nouveau="$(jq -r .nouveau "$SORTIE/etat.json")"
  [[ -z "${GITHUB_OUTPUT:-}" ]] || echo "nouveau=$nouveau" >> "$GITHUB_OUTPUT"
  jq '{pilote_issue, nouveau, empreinte, empreinte_precedente, kpi, compteurs,
       constats: (.constats | with_entries(.value |= (if type == "array" then length else . end)))}' \
    "$SORTIE/etat.json"
}

ecrire_cout() { # ecrire_cout <sessions> [fichier sortie CLI] [erreur]
  jq -n --argjson s "$1" --arg brut "${2:-}" --arg err "${3:-}" --arg modele "$MODELE" \
    --arg cli "$CLI_VERSION" --arg auth "${AUTH:-}" --arg susp "${SUSPENSION:-}" --arg run "${GITHUB_RUN_ID:-local}" --arg jour "$(date -u +%F)" \
    --slurpfile r "${2:-/dev/null}" '
    ($r[0] // {}) as $o
    | { jour: $jour, run_id: $run, sessions_ouvertes: $s, modele: $modele, cli_version: $cli,
        authentification: (if $auth == "" then null else $auth end),
        total_cost_usd: ($o.total_cost_usd // 0),
        usage: { input_tokens: ($o.usage.input_tokens // 0),
                 output_tokens: ($o.usage.output_tokens // 0),
                 cache_creation_input_tokens: ($o.usage.cache_creation_input_tokens // 0),
                 cache_read_input_tokens: ($o.usage.cache_read_input_tokens // 0) },
        num_turns: ($o.num_turns // null), duration_ms: ($o.duration_ms // null),
        subtype: ($o.subtype // null), erreur: (if $err == "" then null else $err end),
        suspension: (if $susp == "" then null else $susp end) }' \
    > "$SORTIE/cout.json"
}

session() {
  [[ -f "$SORTIE/etat.json" ]] || die "etat.json absent : lancer controle d'abord"
  if [[ "$(jq -r .nouveau "$SORTIE/etat.json")" != "true" ]]; then
    ecrire_cout 0; echo "rien de nouveau depuis l'exécution précédente : aucune session"; return 0
  fi
  # ADR-128 D2 (AI1) : pas de session agent tant que le producteur du KPI du rôle est absent.
  # La routine reste déterministe (contrôle + constats publiés) ; exécution verte, suspension tracée.
  if [[ "$(jq -r '.kpi.producteur // "absent"' "$SORTIE/etat.json")" != "présent" ]]; then
    SUSPENSION="producteur du KPI $(jq -r '.kpi.id // "?"' "$SORTIE/etat.json") absent (ADR-128 D2)"
    ecrire_cout 0; echo "session suspendue : $SUSPENSION"; return 0
  fi
  local auth
  if [[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
    AUTH=abonnement; auth=(CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN")
  elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    AUTH=cle-api; auth=(ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY")
  else
    local m="secret CLAUDE_CODE_OAUTH_TOKEN (ou ANTHROPIC_API_KEY) absent"
    ecrire_cout 0 "" "$m"; die "$m"
  fi
  local tmp; tmp="$(mktemp -d)"
  jq '{jours_sans_mouvement, constats, file, departements}' "$SORTIE/etat.json" > "$tmp/entree.json"
  local rc=0
  # Environnement vidé : la session ne reçoit ni GH_TOKEN ni GITHUB_TOKEN ; aucun outil, aucun MCP,
  # aucun réglage lu ; sa sortie est un objet JSON validé par le schéma, publié par `publier`.
  ( cd "$tmp" && env -i PATH="$PATH" HOME="$tmp" "${auth[@]}" \
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
      npx -y "@anthropic-ai/claude-code@$CLI_VERSION" -p \
        "Analyse la file fournie sur l'entrée standard et rends l'objet JSON demandé." \
        --output-format json --json-schema "$(cat "$ICI/pilote-file.schema.json")" \
        --system-prompt "$(cat "$ICI/pilote-file.prompt.md")" \
        --tools "" --restricted --strict-mcp-config --disable-slash-commands \
        --no-session-persistence --model "$MODELE" --max-budget-usd "$BUDGET" \
        < "$tmp/entree.json" > "$SORTIE/session.json" 2> "$SORTIE/session.stderr" ) || rc=$?
  rm -rf "$tmp"
  if ! jq -e . "$SORTIE/session.json" > /dev/null 2>&1; then
    ecrire_cout 1 "" "sortie de session illisible (code $rc)"; die "sortie de session illisible (code $rc)"
  fi
  if [[ "$rc" -ne 0 ]] || jq -e '.is_error == true or (.structured_output == null)' "$SORTIE/session.json" > /dev/null; then
    ecrire_cout 1 "$SORTIE/session.json" "session en échec (code $rc, $(jq -r '.subtype // "?"' "$SORTIE/session.json"))"
    die "session en échec (code $rc)"
  fi
  ecrire_cout 1 "$SORTIE/session.json"
  jq '.structured_output' "$SORTIE/session.json" > "$SORTIE/propositions.json"
  jq '{sessions_ouvertes, total_cost_usd, usage}' "$SORTIE/cout.json"
}

publier() {
  [[ -f "$SORTIE/etat.json" ]] || die "etat.json absent : lancer controle d'abord"
  [[ -f "$SORTIE/cout.json" ]] || ecrire_cout 0 "" "étape session non exécutée"
  local ancien; ancien="$(corps_pilote)"
  printf '%s' "$ancien" > "$SORTIE/brut/corps-precedent.md"
  [[ -f "$SORTIE/propositions.json" ]] || echo 'null' > "$SORTIE/propositions.json"
  local run_url="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:-0}"

  # Propositions retenues : type et issue cohérents avec les constats ; labels connus ; pas de @.
  jq -n --slurpfile e "$SORTIE/etat.json" --slurpfile p "$SORTIE/propositions.json" '
    $e[0] as $e | ($p[0].propositions // []) as $props
    | ([$e.file[].number]) as $ouvertes | ([$e.departements[].label]) as $labels
    | { sans_departement: $e.constats.sans_departement,
        departement_multiple: [$e.constats.departement_multiple[].issue],
        blocage: $e.constats.bloquees,
        sans_mouvement: [$e.constats.sans_mouvement[].issue] } as $cibles
    | def valide: (.issue as $n | $ouvertes | index($n)) != null
        and (if .type == "doublon"
             then (.doublon_de != null and .doublon_de != .issue
                   and ((.doublon_de as $d | $ouvertes | index($d)) != null))
             else ((.issue as $n | $cibles[.type] // [] | index($n)) != null) end)
        and (.departement_suggere == null or ((.departement_suggere as $l | $labels | index($l)) != null));
    { retenues: [ $props[] | select(valide)
                  | .proposition |= (gsub("@"; "@​") | gsub("\\s+"; " ")) ]
                | unique_by([.issue, .type]),
      rejetees: [ $props[] | select(valide | not) ] }' > "$SORTIE/propositions-retenues.json"

  # Commentaires : bornés, un par (issue, type), jamais deux fois le même.
  jq -c --slurpfile i "$SORTIE/brut/issues.json" --argjson max "$MAX_COMMENTAIRES" '
    ($i[0] | map({key: (.number | tostring), value: [.comments[]?.body // ""]}) | from_entries) as $c
    | [ .retenues[]
        | . as $x | ("<!-- pilote-file:" + .type + " -->") as $m
        | select(($c[$x.issue | tostring] // []) | any(contains($m)) | not)
        | { issue, type,
            corps: ($m + "\n**Proposition du pilote (ADR-128 D6)** — aucune action prise ; l\u2019owner arbitre.\n\n"
                    + .proposition
                    + (if .departement_suggere then "\n\nLabel proposé : `" + .departement_suggere + "`" else "" end)
                    + (if .doublon_de then "\n\nDoublon probable de `#" + (.doublon_de | tostring) + "`" else "" end)) } ]
    | .[:$max][]' "$SORTIE/propositions-retenues.json" > "$SORTIE/commentaires.jsonl"

  # Propositions : section reprise du corps précédent si aucune session n'a tourné.
  local section
  if [[ "$(jq -r '.sessions_ouvertes' "$SORTIE/cout.json")" == "1" && "$(jq -r '.erreur' "$SORTIE/cout.json")" == "null" ]]; then
    section="$(jq -r --arg run "$run_url" --arg jour "$(date -u +%FT%H:%MZ)" --slurpfile p "$SORTIE/propositions.json" '
      "_Session du " + $jour + " ([exécution](" + $run + "))._\n\n"
      + (($p[0].recapitulatif // "") | gsub("@"; "@​")) + "\n\n"
      + (if (.retenues | length) == 0 then "Aucune proposition retenue."
         else (.retenues | map("- `#" + (.issue | tostring) + "` — " + .type
                + (if .departement_suggere then " → `" + .departement_suggere + "`" else "" end)
                + (if .doublon_de then " (doublon de `#" + (.doublon_de | tostring) + "`)" else "" end)
                + " : " + .proposition) | join("\n")) end)
      + (if (.rejetees | length) > 0 then "\n\n" + (.rejetees | length | tostring)
           + " proposition(s) écartée(s) : issue ou label hors constats." else "" end)' \
      "$SORTIE/propositions-retenues.json")"
  else
    section="$(printf '%s' "$ancien" | jq -Rrs 'capture("<!-- pilote-file:propositions:debut -->\n(?<s>[\\s\\S]*?)\n<!-- pilote-file:propositions:fin -->").s // "Aucune session n\u2019a encore produit de proposition."')"
    [[ -n "$section" ]] || section="Aucune session n\u2019a encore produit de proposition."
  fi
  printf '%s\n' "$section" > "$SORTIE/brut/section-propositions.md"

  # Coût par jour UTC : une ligne-marqueur JSON par jour, 14 jours gardés.
  printf '%s' "$ancien" | jq -Rs --slurpfile c "$SORTIE/cout.json" '
    [ split("\n")[] | select(startswith("<!-- pilote-file:cout "))
      | ltrimstr("<!-- pilote-file:cout ") | rtrimstr(" -->") | (fromjson? // empty) ] as $jours
    | $c[0] as $c
    | ([$jours[] | select(.jour == $c.jour)][0] // {jour: $c.jour, executions: 0, sessions: 0,
         input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, usd: 0}) as $j
    | ($j | .executions += 1 | .sessions += $c.sessions_ouvertes
          | .input_tokens += $c.usage.input_tokens | .output_tokens += $c.usage.output_tokens
          | .cache_creation_input_tokens += $c.usage.cache_creation_input_tokens
          | .cache_read_input_tokens += $c.usage.cache_read_input_tokens
          | .usd = ((.usd + $c.total_cost_usd) * 1000000 | round / 1000000)) as $maj
    | ([$jours[] | select(.jour != $c.jour)] + [$maj]) | sort_by(.jour) | .[-14:]' > "$SORTIE/cout-jours.json"

  jq -r --slurpfile c "$SORTIE/cout.json" --slurpfile j "$SORTIE/cout-jours.json" \
    --rawfile s "$SORTIE/brut/section-propositions.md" --arg run "$run_url" '
    def liste(f): if length == 0 then "—"
      else (.[:30] | map("`#" + (f | tostring) + "`") | join(" "))
           + (if length > 30 then " … et " + ((length - 30) | tostring) + " autres" else "" end) end;
    "<!-- pilote-file:recap -->\n# Pilotage de la file — état au " + .genere_a + "\n\n"
    + "Issue tenue par la routine `pilote-file` (ADR-128 D6). Le pilote propose ; l\u2019owner arbitre par label ou commentaire. "
    + "Le pilote ne ferme, ne fusionne et ne relabellise rien. Corps régénéré à chaque exécution : ne pas l\u2019éditer à la main.\n\n"
    + "Dernière exécution : [run](" + $run + ") · session Claude : "
    + (if $c[0].erreur != null then "échec (" + $c[0].erreur + ")"
       elif $c[0].suspension != null then "suspendue (" + $c[0].suspension + ")"
       elif $c[0].sessions_ouvertes == 1 then "ouverte" else "non ouverte (rien de nouveau)" end) + "\n\n"
    + "## Constats (" + (.compteurs.issues_ouvertes | tostring) + " issues, " + (.compteurs.prs_ouvertes | tostring) + " PR ouvertes)\n\n"
    + "| Signal | Nombre | Éléments |\n|---|---:|---|\n"
    + "| Issue sans label `dept:` | " + (.constats.sans_departement | length | tostring) + " | " + (.constats.sans_departement | liste(.)) + " |\n"
    + "| Issue avec plusieurs `dept:` | " + (.constats.departement_multiple | length | tostring) + " | " + (.constats.departement_multiple | liste(.issue)) + " |\n"
    + "| `statut:bloqué` | " + (.constats.bloquees | length | tostring) + " | " + (.constats.bloquees | liste(.)) + " |\n"
    + "| Sans mouvement ≥ " + (.jours_sans_mouvement | tostring) + " j | " + (.constats.sans_mouvement | length | tostring) + " | " + (.constats.sans_mouvement | liste(.issue)) + " |\n"
    + "| Titres identiques | " + (.constats.doublons_titre | length | tostring) + " | " + (if (.constats.doublons_titre | length) == 0 then "—" else (.constats.doublons_titre | map(map("`#" + tostring + "`") | join(" = ")) | join(" ; ")) end) + " |\n"
    + "| PR sans `Refs/Closes #N` | " + (.constats.prs_sans_issue | length | tostring) + " | " + (.constats.prs_sans_issue | liste(.pr)) + " |\n"
    + "| Mandat expiré | non couvert | " + .constats.mandats_expires.raison + " |\n\n"
    + "## Propositions\n\n<!-- pilote-file:propositions:debut -->\n" + ($s | rtrimstr("\n")) + "\n<!-- pilote-file:propositions:fin -->\n\n"
    + "## Coût mesuré (jour UTC)\n\n| Jour | Exécutions | Sessions | Jetons entrée | sortie | cache écrit | cache lu | USD |\n|---|---:|---:|---:|---:|---:|---:|---:|\n"
    + ($j[0] | map("| " + .jour + " | " + (.executions | tostring) + " | " + (.sessions | tostring) + " | "
        + (.input_tokens | tostring) + " | " + (.output_tokens | tostring) + " | "
        + (.cache_creation_input_tokens | tostring) + " | " + (.cache_read_input_tokens | tostring) + " | "
        + (.usd | tostring) + " |") | join("\n")) + "\n\n"
    + ($j[0] | map("<!-- pilote-file:cout " + tojson + " -->") | join("\n")) + "\n"
    # Session en échec ou suspendue : empreinte précédente gardée, pour que le tour suivant retente.
    + (if $c[0].erreur == null and $c[0].suspension == null then "<!-- pilote-file:empreinte:" + .empreinte + " -->\n"
       elif .empreinte_precedente != null then "<!-- pilote-file:empreinte:" + .empreinte_precedente + " -->\n"
       else "" end)' "$SORTIE/etat.json" > "$SORTIE/corps.md"

  local n; n="$(jq -r '.pilote_issue // empty' "$SORTIE/etat.json")"
  if [[ "$A_BLANC" -eq 1 ]]; then
    echo "== À BLANC : aucune écriture GitHub =="
    echo "issue de pilotage : ${n:-à créer (« $TITRE »)}"
    echo "commentaires prévus : $(wc -l < "$SORTIE/commentaires.jsonl")"
    jq -r '"  - #" + (.issue | tostring) + " (" + .type + ")"' "$SORTIE/commentaires.jsonl"
    echo "corps prévu : $SORTIE/corps.md"
    return 0
  fi

  local postes=0 ligne
  while IFS= read -r ligne; do
    printf '%s' "$ligne" | jq -r .corps > "$SORTIE/brut/commentaire.md"
    gh issue comment "$(printf '%s' "$ligne" | jq -r .issue)" --repo "$REPO" --body-file "$SORTIE/brut/commentaire.md" > /dev/null
    postes=$((postes + 1))
  done < "$SORTIE/commentaires.jsonl"
  if [[ -n "$n" ]]; then
    gh issue edit "$n" --repo "$REPO" --body-file "$SORTIE/corps.md" > /dev/null
  else
    n="$(gh issue create --repo "$REPO" --title "$TITRE" --body-file "$SORTIE/corps.md" | grep -o '[0-9]\+$')"
  fi
  jq -n --argjson n "$n" --argjson p "$postes" '{pilote_issue: $n, commentaires_postes: $p}' | tee "$SORTIE/publication.json"
}

case "$CMD" in
  controle) controle ;;
  session) session ;;
  publier) publier ;;
  *) die "usage : pilote-file.sh controle|session|publier --sortie DIR [--a-blanc]" ;;
esac
