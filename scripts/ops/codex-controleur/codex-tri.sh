#!/usr/bin/env bash
# Tri des constats du contrôleur Codex — relecture automatique, en lecture seule, rapport seul.
#
# routine:
#   id: codex-controleur-tri
#   owner: Marwane
#   departement: 23-ia-agents
#   kpi: absent (useful_capabilities_not_complexity, producteur absent)
#   trigger: après chaque passage réussi du contrôleur, par OnSuccess= de
#            automecanik-codex-controleur.service vers automecanik-codex-tri.service (unités
#            systemd utilisateur de la machine DEV, livrées non installées)
#   approach: relève les constats critical, high et medium du contrôleur pas encore triés (curseur de
#             tri propre, tris antérieurs lus en entrée), lit les issues et PR ouvertes, puis les fait
#             relire par une session Claude Code non interactive (claude -p) sans outil d'écriture,
#             dans un worktree jetable détaché sur origin/main ; valide sa sortie sous schéma et écrit
#             seul rapport.md, constats-tries.json et brouillons-issues.md. N'ouvre, ne commente, ne
#             corrige et ne publie rien.
#   evidence: $ETAT/tri/<jour>/ (entrée, sortie brute, méta, trois fichiers) ; dernier état dans
#             ~/.local/state/automecanik/cron/codex-controleur-tri.json (cron_report), affiché par le
#             hook SessionStart ; muet au-delà de 36 h = alerte
#   escalation: sortie hors schéma, limite de l'abonnement, option absente de --help ou échec = arrêt
#               propre, curseur de tri inchangé, état « error »/« warn » ; le tri suivant reprend tout
#               ce qui reste ; arrêt = retirer la ligne OnSuccess= du contrôleur
#   secret: aucun dans le dépôt ; session Claude Code de l'abonnement de la machine DEV (jetons GitHub
#           et ANTHROPIC_API_KEY retirés de son environnement)
#
# Usage :
#   codex-tri.sh quotidien [--max N]   trie au plus N constats en attente (40 par défaut)
#   codex-tri.sh commande              affiche la commande claude effective
# Codes de sortie : 0 fait (ou rien à trier) ; 1 échec ou sortie refusée ; 2 usage ou garde ;
#   4 claude ou une option introuvable ; 5 limite de l'abonnement ; 7 passage déjà en cours.
# Apostrophes typographiques voulues dans les textes français.
# shellcheck disable=SC1112
set -euo pipefail
umask 077   # entrée, sortie et constats triés privés : ils citent le contenu des fichiers lus

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONSIGNE="$ICI/consigne-tri.md"
SCHEMA="$ICI/tri.schema.json"
DEPOT="${CODEX_CONTROLEUR_DEPOT:-$(cd "$ICI/../../.." && pwd)}"
ETAT="${CODEX_CONTROLEUR_ETAT:-${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/codex-controleur}"
BRANCHE="${CODEX_CONTROLEUR_BRANCHE:-main}"
BIN="${CODEX_TRI_BIN:-$HOME/.local/bin/claude}"
MAX="${CODEX_TRI_MAX:-40}"
JOB="codex-controleur-tri"
OUTIL="codex-tri"
# Tris antérieurs lus en entrée (format constats-tries.json du mandat FB), séparés par « : ». Non
# défini : le tri du mandat FB s'il existe. Défini (même vide) : exactement cette liste.
if [[ -n "${CODEX_TRI_ANTERIEURS+x}" ]]; then ANTERIEURS_DONNES=1; ANTERIEURS="$CODEX_TRI_ANTERIEURS"
else ANTERIEURS_DONNES=0; ANTERIEURS="$HOME/mandats/FB/constats-tries.json"; fi
# Limite de l'abonnement ou surcharge : cherchée dans les seules erreurs d'un passage échoué.
QUOTA_RE='usage limit|limit reached|rate.?limit|overloaded|quota|credit balance|\b429\b'
# Options de claude employées : chacune doit figurer dans « claude --help » (sinon code 4).
OPTIONS=(--print --output-format --json-schema --tools --disallowedTools --permission-mode
         --settings --strict-mcp-config --mcp-config --no-session-persistence --disable-slash-commands)
usage() { sed -n '/^# Usage :/,/^# Codes de sortie/p' "${BASH_SOURCE[0]}" >&2; exit 2; }
# shellcheck source=commun.sh
source "$ICI/commun.sh"   # SENSIBLE_RE, die, horodate, gh_depot, rapport, garder_depot, verrou, preparer_worktree
# Échec d'un passage quotidien (gh, fetch, worktree, curseur…) : état « error » posé tout de suite,
# sans attendre l'alerte des 36 h. Ni pour l'usage, une garde ou le verrou (codes 2 et 7), ni quand
# l'appelant a déjà rendu compte (RAPPORTE=1).
die() {
  local c="${2:-1}"
  if [[ "$CMD" == quotidien && "$c" != 2 && "$c" != 7 && -z "${RAPPORTE:-}" ]]; then rapport error 0 "$1" '{}'; fi
  echo "$OUTIL : $1" >&2; exit "$c"
}

CMD="${1:-}"; shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max) MAX="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
[[ "$MAX" =~ ^[1-9][0-9]*$ ]] || die "--max doit être un entier positif" 2

garder_depot   # avant toute écriture

TRI="$ETAT/tri"
CURSEUR_TRI="$TRI/curseur-tri.json"   # {"faits": [{"id", "jour", "objet", "pr", "index", "tri", "verdict", "le"}]}

# --- Session claude : lecture seule, sans jeton GitHub, sans MCP, sans outil d'écriture ---
# Chaque couche, sa source et ce qu'elle bloque : README.md, section « Tri des constats ».
commande_claude() { # remplit le tableau CLAUDE_CMD
  CLAUDE_CMD=("$BIN" --print --output-format json --json-schema "$(jq -c . "$SCHEMA")"
    --tools "Read,Grep,Glob"
    --disallowedTools "Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Agent,REPL,mcp__*"
    --permission-mode dontAsk
    --settings '{"permissions":{"blockReadsOutsideWorkingDirectories":true}}'
    --strict-mcp-config --mcp-config '{"mcpServers":{}}'
    --no-session-persistence --disable-slash-commands)
}

verifier_claude() {
  [[ -x "$BIN" ]] || { rapport error 0 "claude introuvable ($BIN) ; rien trié" '{}'; RAPPORTE=1 die "claude introuvable ($BIN)" 4; }
  local aide o
  aide="$("$BIN" --help 2>&1)" || true
  for o in "${OPTIONS[@]}"; do
    grep -qF -- "$o" <<< "$aide" || {
      rapport error 0 "option $o absente de « claude --help » ; rien trié" '{}'
      RAPPORTE=1 die "option $o absente de « claude --help »" 4
    }
  done
  VERSION_CLAUDE="$("$BIN" --version 2>&1 | head -n1)" || VERSION_CLAUDE="inconnue"
}

# --- Inventaire : tous les constats du contrôleur, un objet par relecture valide ---
inventaire() { # sortie : tableau JSON d'objets {jour, objet, pr, base, alerte, findings}
  local m d
  for m in "$ETAT"/bruts/*/*/meta.json; do
    [[ -f "$m" ]] || continue
    d="$(dirname "$m")"
    [[ -s "$d/last.json" ]] || continue
    jq -c --arg jour "$(basename "$(dirname "$d")")" --arg objet "$(basename "$d")" --slurpfile m "$m" \
      'select(($m[0].code // 1) == 0 and (.findings | type) == "array")
       | {jour: $jour, objet: $objet,
          pr: ($objet | capture("^pr(?<n>[0-9]+)$").n // null | if . == null then null else tonumber end),
          base: $m[0].base, alerte: ($m[0].alerte // null), findings}' "$d/last.json" 2> /dev/null || true
  done | jq -s '.'
}

# Fichiers de tris antérieurs : ceux donnés (ou celui du mandat FB) puis les tris de cette routine.
anterieurs_fichiers() {
  local f liste=()
  IFS=':' read -r -a liste <<< "$ANTERIEURS" || true
  for f in "${liste[@]}"; do
    [[ -n "$f" ]] || continue
    if [[ -f "$f" ]]; then echo "$f"
    elif [[ "$ANTERIEURS_DONNES" -eq 1 ]]; then die "tri antérieur illisible : $f" 2; fi
  done
  for f in "$TRI"/*/constats-tries.json; do [[ -f "$f" ]] && echo "$f"; done
  return 0
}
etiquette() { # étiquette d'un tri antérieur : tri-<dossier> pour cette routine, sinon <dossier>
  local dir; dir="$(basename "$(dirname "$1")")"
  if [[ "$(dirname "$(dirname "$1")")" == "$TRI" ]]; then echo "tri-$dir"; else echo "$dir"; fi
}

# Brouillon publiable : ni forme de secret ou de donnée personnelle, ni chemin du serveur, ni UUID
# (identifiant de session), ni mention @ hors d'un passage entre accents graves.
brouillon_sensible() { # $1 = texte ; retour 0 = sensible, motif dans MOTIF_SENSIBLE
  local hors_code
  hors_code="$(sed 's/`[^`]*`//g' <<< "$1")"
  MOTIF_SENSIBLE=""
  if grep -qE "$SENSIBLE_RE" <<< "$1"; then MOTIF_SENSIBLE="forme de secret ou de donnée personnelle"
  elif grep -qE '/(home|opt)/' <<< "$1"; then MOTIF_SENSIBLE="chemin du serveur"
  elif grep -qiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' <<< "$1"; then MOTIF_SENSIBLE="UUID"
  elif grep -qE '@[A-Za-z0-9_-]' <<< "$hors_code"; then MOTIF_SENSIBLE="mention @"
  else return 1; fi
  return 0
}

case "$CMD" in
  commande)
    commande_claude
    echo "cd <WORKTREE jetable sur origin/$BRANCHE> && env -i HOME=… PATH=… LANG=C.UTF-8 USER=… LOGNAME=… XDG_RUNTIME_DIR=… \\"
    printf '%q ' "${CLAUDE_CMD[@]}"; echo " < <CONSIGNE + ENTRÉE DU TRI (JSON)>"
    ;;

  quotidien)
    mkdir -p "$TRI"
    # umask ne resserre pas un dossier déjà là : droits posés ici.
    chmod 700 "$ETAT" "$TRI"
    verrou; verifier_claude
    t0=$(date +%s)
    [[ -f "$CURSEUR_TRI" ]] || jq -n '{faits: []}' > "$CURSEUR_TRI"
    jq -e '.faits | type == "array"' "$CURSEUR_TRI" > /dev/null 2>&1 || die "curseur de tri illisible ($CURSEUR_TRI)"
    inv="$(inventaire)"
    liste_ant="$(anterieurs_fichiers)"
    fichiers_ant=()
    [[ -z "$liste_ant" ]] || mapfile -t fichiers_ant <<< "$liste_ant"
    ant_ids='[]'; ant_refs='[]'
    for f in "${fichiers_ant[@]}"; do
      jq -e 'type == "array"' "$f" > /dev/null 2>&1 || die "tri antérieur illisible : $f"
      ant_ids="$(jq -c --argjson a "$ant_ids" '$a + [.[].id]' "$f")"
      ant_refs="$(jq -c -L "$ICI" --argjson a "$ant_refs" --arg e "$(etiquette "$f")" 'include "tri"; $a + anterieurs($e)' "$f")"
    done
    # Constats : id = MM-JJ#<PR ou objet>#<index dans last.json>, comme le tri du mandat FB.
    calc="$(jq -c --argjson faits "$(jq -c '[.faits[].id]' "$CURSEUR_TRI")" --argjson anciens "$ant_ids" --argjson max "$MAX" '
      ([.[] | select(.alerte != null)]) as $alertes
      | [.[] | select(.alerte == null) | . as $o | .findings | to_entries[]
         | {id: "\($o.jour[5:])#\($o.pr // $o.objet)#\(.key)", jour: $o.jour, objet: $o.objet, pr: $o.pr,
            index: .key, base_codex: $o.base, severity: .value.severity, category: .value.category,
            title: .value.title, fichier: .value.file, ligne: .value.line, evidence: .value.evidence,
            proposed_fix: .value.proposed_fix, confidence: .value.confidence}] as $tous
      | ($faits + $anciens) as $vus
      | [$tous[] | select(.severity | IN("critical","high","medium"))] as $hm
      | ([$hm[] | select(.id as $i | $vus | index($i) | not)] | sort_by(.jour, (.pr // 0), .objet, .index)) as $attente
      | {lot: $attente[0:$max], reportes: ([($attente | length) - $max, 0] | max),
         bas: ([$tous[] | select(.severity | IN("low","info"))] | length),
         bas_objets: ([$tous[] | select(.severity | IN("low","info")) | "\(.jour)/\(.objet)"] | unique | length),
         exclus_objets: ($alertes | length), exclus_constats: ([$alertes[].findings | length] | add // 0),
         exclus_liste: [$alertes[] | "\(.jour)/\(.objet)"],
         deja_tries: (($hm | length) - ($attente | length))}' <<< "$inv")"
    n_lot="$(jq '.lot | length' <<< "$calc")"; reportes="$(jq '.reportes' <<< "$calc")"
    exclus="$(jq '.exclus_objets' <<< "$calc")"
    if [[ "$n_lot" -eq 0 ]]; then
      metr="$(jq -c '{tries:0, reportes:0, exclus_sensibles:.exclus_objets, bas:.bas}' <<< "$calc")"
      rapport ok $(( $(date +%s) - t0 )) "rien à trier ($exclus objets retenus pour alerte, non triés)" "$metr"
      echo "rien à trier ($exclus objets retenus pour alerte, non triés)"; exit 0
    fi
    jour="$TRI/$(date -u +%Y-%m-%d)"; k=2
    while [[ -e "$jour" ]]; do jour="$TRI/$(date -u +%Y-%m-%d)-$k"; k=$((k + 1)); done
    mkdir -p "$jour"; chmod 700 "$jour"
    # Issues et PR ouvertes lues par le script, avant toute session du modèle.
    gh_depot issue list --state open --limit 1000 --json number,title,labels > "$jour/issues.brut" \
      || die "liste des issues ouvertes illisible"
    gh_depot pr list --state open --limit 1000 --json number,title,headRefName,isDraft > "$jour/prs.brut" \
      || die "liste des PR ouvertes illisible"
    jq '[.[] | {number, title, labels: [(.labels // [])[].name]}]' "$jour/issues.brut" > "$jour/issues-ouvertes.json" \
      || die "liste des issues ouvertes illisible"
    jq '[.[] | {number, title, headRefName, isDraft}]' "$jour/prs.brut" > "$jour/prs-ouvertes.json" \
      || die "liste des PR ouvertes illisible"
    rm -f "$jour/issues.brut" "$jour/prs.brut"
    for l in issues prs; do
      [[ "$(jq length "$jour/$l-ouvertes.json")" -lt 1000 ]] || die "liste des $l ouvertes tronquée à 1000"
    done
    preparer_worktree wt-tri
    jq -n --arg base "$BASE" --argjson c "$calc" --slurpfile i "$jour/issues-ouvertes.json" \
      --slurpfile p "$jour/prs-ouvertes.json" --argjson a "$ant_refs" \
      '{base: $base, constats: $c.lot, issues_ouvertes: $i[0], prs_ouvertes: $p[0], tris_anterieurs: $a}' \
      > "$jour/entree.json"
    { cat "$CONSIGNE"; printf '\nENTRÉE DU TRI (JSON)\n'; jq -c . "$jour/entree.json"; } > "$jour/prompt.txt"
    commande_claude
    debut=$(date +%s); code=0
    # Environnement vidé : ni jeton GitHub, ni ANTHROPIC_API_KEY (l'abonnement reste la seule
    # facturation), ni variable d'une session Claude parente. Le verrou (fd 9) n'est pas hérité.
    (cd "$WT" && env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 USER="${USER:-}" LOGNAME="${LOGNAME:-}" \
      XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" "${CLAUDE_CMD[@]}" < "$jour/prompt.txt" 9>&-) \
      > "$jour/sortie.json" 2> "$jour/stderr.txt" || code=$?
    duree=$(( $(date +%s) - debut ))
    sortie_json="$(jq -c 'select(type == "object")' "$jour/sortie.json" 2> /dev/null | tail -n1 || true)"
    [[ -n "$sortie_json" ]] || sortie_json='{}'
    jq -n --arg base "$BASE" --arg version "$VERSION_CLAUDE" --argjson code "$code" --argjson duree "$duree" \
      --arg consigne "$(sha256sum "$CONSIGNE" | cut -d' ' -f1)" --arg schema "$(sha256sum "$SCHEMA" | cut -d' ' -f1)" \
      --argjson s "$sortie_json" \
      '{base: $base, claude: $version, consigne_sha256: $consigne, schema_sha256: $schema, code: $code,
        duree_s: $duree, duree_ms: ($s.duration_ms // null), tours: ($s.num_turns // null),
        session: ($s.session_id // null), modeles: (($s.modelUsage // {}) | keys),
        entree: ($s.usage.input_tokens // 0), cache_creation: ($s.usage.cache_creation_input_tokens // 0),
        cache_lecture: ($s.usage.cache_read_input_tokens // 0), sortie: ($s.usage.output_tokens // 0),
        refus: ($s.permission_denials // []), cout_estime_usd: ($s.total_cost_usd // null)}' > "$jour/meta-tri.json"
    tokens="$(jq -c '{entree, cache_creation, cache_lecture, sortie}' "$jour/meta-tri.json")"
    metr_base="$(jq -nc --argjson t "$tokens" --argjson d "$duree" --argjson r "$((reportes + n_lot))" --argjson x "$exclus" \
      '{tries:0, reportes:$r, exclus_sensibles:$x, duree_s:$d, tokens:$t}')"
    ok_sortie="$(jq -L "$ICI" --slurpfile e "$jour/entree.json" 'include "tri";
      .type == "result" and .subtype == "success" and .is_error == false and valide($e[0])' <<< "$sortie_json" 2> /dev/null || true)"
    if [[ "$ok_sortie" != "true" ]]; then
      mv -f "$jour/sortie.json" "$jour/sortie-refusee.json"
      erreurs="$(cat "$jour/stderr.txt"; jq -r '.result // empty, (.errors // [])[]' <<< "$sortie_json" 2> /dev/null || true)"
      if [[ "$code" -ne 0 || "$(jq -r '.is_error // false' <<< "$sortie_json")" == "true" ]] \
         && grep -qiE "$QUOTA_RE" <<< "$erreurs"; then
        rapport warn "$duree" "limite de l'abonnement atteinte : $n_lot constats repris au prochain tri" "$metr_base"
        RAPPORTE=1 die "limite de l'abonnement atteinte : $n_lot constats repris au prochain tri" 5
      fi
      rapport error "$duree" "sortie de claude refusée (code $code, hors schéma ou incohérente avec l'entrée) ; rien écrit, curseur de tri inchangé" "$metr_base"
      RAPPORTE=1 die "sortie de claude refusée (code $code) : $jour/sortie-refusee.json ; rien écrit, curseur de tri inchangé"
    fi
    # Même nom de groupe qu'un tri antérieur = même cause : couverture posée par le script si le
    # modèle n'en a cité aucune (pas de second brouillon).
    s="$(jq -c --argjson a "$ant_refs" '.structured_output
      | .groupes |= map(. as $g | if .couverture_numero == null and .couverture_tri == null
          and any($a[]; .groupe == $g.groupe) then
          .couverture_tri = ([$a[] | select(.groupe == $g.groupe) | .ref][0])
          | .couverture_note += " Couverture posée par le script : même groupe qu’un tri antérieur."
        else . end)' <<< "$sortie_json")"
    statut="relu par claude -p en lecture seule sur origin/$BRANCHE $BASE ; non relu par un humain"
    plan="$(jq -c -n -L "$ICI" --argjson s "$s" 'include "tri"; plan($s)')"
    jq -n -L "$ICI" --slurpfile e "$jour/entree.json" --argjson s "$s" --argjson p "$plan" --arg st "$statut" \
      'include "tri"; assemble($e[0]; $s; $p; $st)' > "$jour/constats-tries.tmp"
    mv -f "$jour/constats-tries.tmp" "$jour/constats-tries.json"
    # Brouillons : publics (B..) contrôlés un par un ; sécurité (S..) sans texte.
    brs="$(jq -c -n -L "$ICI" --slurpfile e "$jour/entree.json" --argjson s "$s" --argjson p "$plan" 'include "tri"; brouillons($e[0]; $s; $p)')"
    nb="$(jq length <<< "$brs")"; alertes=(); alertes_n=0
    {
      echo "# Brouillons d’issues — tri du $(basename "$jour")"
      echo
      echo "Rapport seul : aucune issue n’est ouverte. Base origin/$BRANCHE \`$BASE\`. Chaque brouillon"
      echo "regroupe des constats confirmés d’une même cause, sans issue, PR ni tri antérieur qui la couvre."
      echo "Label proposé = département proposé seulement. À relire par un humain avant toute publication."
      echo
      for ((i = 0; i < nb; i++)); do
        ref="$(jq -r ".[$i].ref" <<< "$brs")"; grp="$(jq -r ".[$i].groupe" <<< "$brs")"
        texte="$(jq -r ".[$i].texte" <<< "$brs")"
        if brouillon_sensible "$texte"; then
          alertes+=("$ref ($grp) : $MOTIF_SENSIBLE"); alertes_n=$((alertes_n + 1))
          printf '## %s — alerte : brouillon retenu (groupe `%s`)\n\n' "$ref" "$grp"
          printf 'Texte retenu hors de ce fichier (%s). Lire le groupe dans constats-tries.json du dossier d’état.\n\n---\n\n' "$MOTIF_SENSIBLE"
        else
          printf '%s\n' "$texte"
        fi
      done
      jq -r -n --argjson s "$s" --argjson p "$plan" '
        [$s.groupes[] | select(($p[.groupe] // "") | startswith("S"))] | sort_by($p[.groupe])[]
        | . as $g | "## \($p[$g.groupe]) — sécurité — hors GitHub public\n\n- **Groupe** : `\($g.groupe)` · **gravité revue** : \($g.gravite)\n- **Constats Codex** : \([$s.constats[] | select(.groupe == $g.groupe and .verdict == "confirmé") | .id] | join(", "))\n\nAucun brouillon public : à traiter hors GitHub public.\n\n---\n"'
    } > "$jour/brouillons-issues.md"
    secu="$(jq '[to_entries[] | select(.value | startswith("S"))] | length' <<< "$plan")"
    # Rapport du tri.
    {
      echo "# Tri des constats du contrôleur Codex — $(basename "$jour")"
      echo
      echo "Rapport seul : aucune issue, aucun label, aucun commentaire, aucun correctif."
      echo
      echo "## Identification"
      echo
      jq -r --arg br "$BRANCHE" '"- Base origin/\($br) : `\(.base)`\n- claude : \(.claude) · modèles : \(.modeles | join(", ")) · session : \(.session // "inconnue")\n- Durée : \(.duree_s) s (API \(.duree_ms // "?") ms, \(.tours // "?") tours)\n- Tokens : entrée \(.entree), cache créé \(.cache_creation), cache lu \(.cache_lecture), sortie \(.sortie)\n- Coût estimé affiché par la CLI : \(.cout_estime_usd // "absent") USD (estimation ; facturation = abonnement)\n- Refus de permission pendant la session : \(.refus | length)\n- Consigne sha256 `\(.consigne_sha256)` · schéma sha256 `\(.schema_sha256)`"' "$jour/meta-tri.json"
      echo
      echo "## Périmètre"
      echo
      jq -r --argjson n "$n_lot" '"- Triés ce passage : \($n) constats critical, high ou medium\n- Reportés au tri suivant (plafond) : \(.reportes)\n- Déjà triés avant (curseur ou tri antérieur) : \(.deja_tries)\n- Retenus pour alerte (donnée sensible possible), jamais envoyés au modèle : \(.exclus_objets) objets, \(.exclus_constats) constats\(if .exclus_objets > 0 then " (" + (.exclus_liste | join(", ")) + ")" else "" end)\n- low et info, comptés seulement : \(.bas) constats dans \(.bas_objets) objets"' <<< "$calc"
      printf -- '- Tris antérieurs lus : %s\n' "$(if [[ ${#fichiers_ant[@]} -eq 0 ]]; then echo aucun; else for f in "${fichiers_ant[@]}"; do printf '%s (%s constats) ' "$(etiquette "$f")" "$(jq length "$f")"; done; fi)"
      echo
      echo "## Verdicts × gravité revue"
      echo
      jq -r '"| Verdict | critical | high | medium | low | info | Total |", "|---|---|---|---|---|---|---|",
        (group_by(.verdict)[] | . as $v | "| \($v[0].verdict) | \(["critical","high","medium","low","info"] | map(. as $g | [$v[] | select(.severity_revue == $g)] | length) | join(" | ")) | \($v | length) |")' "$jour/constats-tries.json"
      echo
      echo "## Groupes"
      echo
      echo "| Groupe | Gravité | Brouillon | Couverture | Département proposé | Constats |"
      echo "|---|---|---|---|---|---|"
      jq -r -n --argjson s "$s" --argjson p "$plan" '$s.groupes[] | . as $g
        | "| `\(.groupe)` | \(.gravite) | \(if $p[.groupe] == null then "—" elif .securite then "\($p[.groupe]) (sécurité — hors GitHub public)" else $p[.groupe] end) | \(if .couverture_numero != null then "#\(.couverture_numero)" else (.couverture_tri // "aucune") end) | \(.dept_propose // "—") | \([$s.constats[] | select(.groupe == $g.groupe) | "\(.id) \(.verdict)"] | join(", ")) |"'
      echo
      echo "## Constats"
      echo
      echo "| id | Fichier:ligne | Gravité (Codex → revue) | Verdict | Groupe | Preuve |"
      echo "|---|---|---|---|---|---|"
      jq -r '.[] | "| \(.id) | `\(.fichier):\(.ligne)` | \(.severity_origine) → \(.severity_revue) | \(.verdict) | `\(.groupe)` | \(.preuve | gsub("\\|"; "/") | gsub("\n"; " ")) |"' "$jour/constats-tries.json"
      echo
      echo "## Non tranchables"
      echo
      jq -r '[.[] | select(.verdict == "non tranchable")] | if length == 0 then "Aucun." else .[] | "- \(.id) : \(.non_tranchable_besoin // "besoin non précisé")" end' "$jour/constats-tries.json"
      echo
      echo "## Contrôle des brouillons"
      echo
      echo "- Brouillons publics : $nb · groupes de sécurité sans brouillon public : $secu"
      if [[ "$alertes_n" -eq 0 ]]; then echo "- Alerte : aucune (secret ou donnée personnelle, chemin du serveur, UUID, mention @ hors code)"
      else printf -- '- Alerte, brouillon retenu : %s\n' "${alertes[@]}"; fi
      echo
      echo "## Notes du modèle"
      echo
      jq -r '.notes' <<< "$s"
    } > "$jour/rapport.md"
    # Curseur de tri : avancé seulement après écriture des trois fichiers.
    tmp="$(mktemp "$TRI/.curseur-tri.XXXXXX")"
    jq --slurpfile c "$jour/constats-tries.json" --arg tri "$(basename "$jour")" --arg t "$(horodate)" \
      '.faits += [$c[0][] | {id, jour, objet, pr, index, tri: $tri, verdict, le: $t}]' "$CURSEUR_TRI" > "$tmp"
    mv -f "$tmp" "$CURSEUR_TRI"
    metr="$(jq -c --argjson n "$n_lot" --argjson r "$reportes" --argjson b "$nb" --argjson sc "$secu" --argjson al "$alertes_n" \
      '.tries = $n | .reportes = $r | . + {brouillons:$b, securite:$sc, alertes:$al}' <<< "$metr_base")"
    resume="$n_lot constats triés, $nb brouillons, $secu groupes sécurité ; rapport $jour/rapport.md"
    if [[ "$alertes_n" -gt 0 ]]; then
      rapport warn "$duree" "$resume ; $alertes_n brouillons retenus pour alerte" "$metr"
    elif [[ "$reportes" -gt 0 ]]; then
      rapport warn "$duree" "$resume ; $reportes reportés (plafond de $MAX)" "$metr"
    else
      rapport ok "$duree" "$resume" "$metr"
    fi
    if [[ "$reportes" -gt 0 ]]; then echo "$resume ; $reportes reportés au tri suivant"; else echo "$resume"; fi
    ;;

  *) usage ;;
esac
