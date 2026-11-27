#!/usr/bin/env bash
# Tests de codex-tri.sh, sans réseau ni modèle réel : dépôt d'origine nu local, faux « gh » (issues
# et PR ouvertes, -R exigé) et faux « claude » (aide, version, sortie JSON sous schéma ou non) dans
# $FIX/bin, constats du contrôleur fabriqués dans un dossier d'état de test.
# Usage : bash scripts/ops/codex-controleur/codex-tri.test.sh
# Apostrophes typographiques voulues dans les textes français.
# shellcheck disable=SC1112,SC2016
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ICI/codex-tri.sh"
FIX="$(mktemp -d)"
trap '[[ -n "${GARDER:-}" ]] || rm -rf "$FIX"' EXIT
export GIT_CONFIG_GLOBAL="$FIX/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global user.name test; git config --global user.email test@example.invalid
git config --global commit.gpgsign false; git config --global init.defaultBranch main

ok=0; ko=0
check() { if [[ "$2" == "$3" ]]; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "ÉCHEC $1 : attendu « $3 », obtenu « $2 »"; fi; }
contient() { if grep -qF -- "$3" "$2" 2> /dev/null; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "ÉCHEC $1 : « $3 » absent de $2"; fi; }
absent() { if ! grep -qF -- "$3" "$2" 2> /dev/null; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "ÉCHEC $1 : « $3 » présent dans $2"; fi; }

# --- Dépôt : origine nue + clone dédié de test ---
git init -q --bare "$FIX/origine.git"
git clone -q "$FIX/origine.git" "$FIX/depot" 2> /dev/null
mkdir -p "$FIX/depot/scripts/cron"
cp "$ICI/../../cron/lib-supabase-report.sh" "$FIX/depot/scripts/cron/"
echo base > "$FIX/depot/a.txt"; git -C "$FIX/depot" add -A; git -C "$FIX/depot" commit -qm base
git -C "$FIX/depot" push -q origin main 2> /dev/null
TETE="$(git -C "$FIX/depot" rev-parse HEAD)"
echo '[{"number":501,"title":"issue ouverte","labels":[{"name":"dept:23-ia-agents"}]}]' > "$FIX/issues.json"
echo '[{"number":601,"title":"PR ouverte","headRefName":"b","isDraft":true}]' > "$FIX/prs.json"

# --- Constats du contrôleur (format de bruts/<jour>/<objet>/) ---
constat() { # sévérité titre
  jq -nc --arg s "$1" --arg t "$2" '{file:"a.txt",line:1,severity:$s,category:"bug",title:$t,evidence:"e",proposed_fix:"f",confidence:"high"}'
}
objet() { # etat jour objet code alerte constats-json...
  local d="$1/bruts/$2/$3" code="$4" alerte="$5"; shift 5
  mkdir -p "$d"
  jq -n --argjson c "$code" --arg a "$alerte" '{base:"abc", modele:"m", effort:"e", codex:"x", code:$c}
    + (if $a == "" then {} else {alerte:$a} end)' > "$d/meta.json"
  printf '%s\n' "$@" | jq -s '{files_read:["a.txt"], findings:., notes:""}' > "$d/last.json"
}
peupler() { # etat
  objet "$1" 2026-11-19 pr2174 0 "" "$(constat medium 'a g=cause-commune')" "$(constat medium 'b g=cause-commune')" \
    "$(constat low 'bas')" "$(constat high 'c g=secu-acces')"
  objet "$1" 2026-11-20 pr2180 0 donnee_sensible_possible "$(constat medium 'TEXTE_RETENU_SENSIBLE')"
  objet "$1" 2026-11-20 pr2181 1 "" "$(constat medium 'TEXTE_PASSAGE_ECHOUE')"
  objet "$1" 2026-11-20 lot-x 0 "" "$(constat medium 'd g=fuite-chemin')" "$(constat info 'note')"
}

# --- Faux outils ---
mkdir -p "$FIX/bin" "$FIX/home" "$FIX/hors-depot"
cat > "$FIX/bin/gh" <<'EOF'
#!/usr/bin/env bash
[[ "${1:-}" == "-R" && "$2" == "$FIX/origine.git" ]] || { echo "gh sans -R du dépôt : $*" >&2; exit 1; }
shift 2
[[ ! -f "$FIX/gh-panne" ]] || { echo "gh en panne" >&2; exit 1; }
echo "gh $1 $2" >> "$FIX/ordre.log"
case "$1 $2" in
  "issue list") cat "$FIX/issues.json" ;;
  "pr list") cat "$FIX/prs.json" ;;
  *) exit 1 ;;
esac
EOF
# Le vrai passage de claude se fait sous env -i : FIX est écrit en dur dans le faux.
{ echo '#!/usr/bin/env bash'; echo "FIX='$FIX'"; cat <<'EOF'
case "${1:-}" in
  --help)
    for o in --print --output-format --json-schema --tools --disallowedTools --permission-mode --settings \
             --strict-mcp-config --mcp-config --no-session-persistence --disable-slash-commands --bare --model; do
      [[ "$o" == "$(cat "$FIX/sans" 2> /dev/null)" ]] || echo "  $o <valeur>   option"
    done; exit 0 ;;
  --version) echo "2.1.332 (Claude Code)"; exit 0 ;;
esac
echo "claude" >> "$FIX/ordre.log"
{ echo "=== appel"; printf '%s\n' "$@"; echo "CWD=$PWD"; echo "HEAD=$(git rev-parse HEAD 2> /dev/null)"
  echo "BRANCHE=$(git symbolic-ref -q HEAD || echo détachée)"
  env | grep -E '^(GH_|GITHUB_|ANTHROPIC_|FAUX_)' | sed 's/=.*/=présent/'
  if [[ -e /proc/$$/fd/9 ]]; then echo "FD9=ouvert"; else echo "FD9=fermé"; fi; } >> "$FIX/claude.log"
cat > "$FIX/prompt-recu.txt"
entree="$(sed -n '/^ENTRÉE DU TRI (JSON)$/{n;p}' "$FIX/prompt-recu.txt")"
mode="$(cat "$FIX/mode" 2> /dev/null || echo normal)"
case "$mode" in
  quota) echo '{"type":"result","subtype":"error_during_execution","is_error":true,"result":"Claude AI usage limit reached"}'
         echo "usage limit reached" >&2; exit 1 ;;
  panne) echo "erreur de transport" >&2; exit 1 ;;
esac
so="$(jq -c --arg mode "$mode" '
  def grp: (.title | capture("g=(?<g>[a-z0-9-]+)").g) // "cause-commune";
  {constats: [.constats[] | {id, verdict: "confirmé", severity_revue: .severity, raison_gravite: "r",
     preuve: "\(.fichier):\(.ligne)", methode: "lu", groupe: grp, cause: "c", non_tranchable_besoin: null,
     correctif_propose: "f", risque_si_rien: "x"}],
   groupes: ([.constats[] | grp] | unique | map({groupe: ., titre: "Titre \(.)", gravite: "medium",
     securite: startswith("secu-"), couverture_numero: null, couverture_tri: null, couverture_note: "cherché",
     dept_propose: "dept:23-ia-agents", dept_preuve: ".github/CODEOWNERS:1",
     constat: (if startswith("fuite-") then "voir /home/deploy/x" elif startswith("mention-") then "demander à @quelqu1"
               else "Constat sobre, décorateur `@Controller`." end), correctif: "f", risque: "x"})),
   notes: "aucune"}
  | if $mode == "hors-schema" then del(.notes)
    elif $mode == "id-invente" then .constats += [.constats[0] | .id = "99-99#0#0"]
    elif $mode == "id-manquant" then .constats |= .[1:]
    elif $mode == "enum" then .constats[0].verdict = "peut-être"
    elif $mode == "num-invente" then .groupes[0].couverture_numero = 99999
    elif $mode == "cle-en-trop" then .groupes[0].extra = 1
    elif $mode == "couvert" then .groupes |= map(if .groupe == "cause-commune" then .couverture_numero = 501 else . end)
    else . end' <<< "$entree")"
if [[ "$mode" == "sans-structure" ]]; then so=null; fi
jq -n --argjson so "$so" '{type:"result", subtype:"success", is_error:false, duration_ms:1234, duration_api_ms:1000,
  num_turns:3, result:"", session_id:"11111111-2222-3333-4444-555555555555", total_cost_usd:0.12,
  usage:{input_tokens:100, cache_creation_input_tokens:20, cache_read_input_tokens:300, output_tokens:40},
  modelUsage:{"claude-opus-5-5":{}}, permission_denials:[]} + (if $so == null then {} else {structured_output:$so} end)'
EOF
} > "$FIX/bin/claude"
chmod +x "$FIX/bin/gh" "$FIX/bin/claude"

# Lancement hors dépôt, comme l'unité systemd ; jetons présents dans l'environnement appelant.
lance() { # dossier d'état, puis arguments ; affiche le code de sortie
  local etat="$1"; shift
  (cd "$FIX/hors-depot" && env -u CODEX_TRI_ANTERIEURS FIX="$FIX" HOME="$FIX/home" PATH="$FIX/bin:$PATH" \
    GH_TOKEN=jeton GITHUB_TOKEN=jeton GH_ENTERPRISE_TOKEN=jeton ANTHROPIC_API_KEY=cle \
    XDG_STATE_HOME="$FIX/state-$(basename "$etat")" CODEX_CONTROLEUR_DEPOT="$FIX/depot" \
    CODEX_CONTROLEUR_ETAT="$etat" CODEX_TRI_BIN="$FIX/bin/claude" "${FAUX[@]}" \
    bash "$SCRIPT" "$@" > "$etat.out" 2>&1) && echo 0 || echo $?
}
FAUX=()
cron() { jq -r ".${2:-status}" "$FIX/state-$(basename "$1")/automecanik/cron/codex-controleur-tri.json"; }
faits() { jq -c '[.faits[].id]' "$1/tri/curseur-tri.json"; }
jours() { find "$1/tri" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | paste -sd' '; }
AUJ="$(date -u +%Y-%m-%d)"

# 1. Gardes, avant toute écriture : checkout partagé, worktree lié, état dans un checkout protégé.
E0="$FIX/e0"
FAUX=(CODEX_CONTROLEUR_DEPOT=/opt/automecanik/app)
check "checkout partagé refusé" "$(lance "$E0" quotidien)" 2
contient "checkout partagé, message" "$E0.out" "dépôt refusé"
git -C "$FIX/depot" worktree add -q --detach "$FIX/lie" 2> /dev/null
FAUX=(CODEX_CONTROLEUR_DEPOT="$FIX/lie" CODEX_CONTROLEUR_PROTEGE="$FIX/depot")
check "worktree lié refusé" "$(lance "$E0" quotidien)" 2
git -C "$FIX/depot" worktree remove --force "$FIX/lie"
FAUX=(CODEX_CONTROLEUR_PROTEGE="$FIX/depot")
check "état dans le checkout protégé" "$(lance "$FIX/depot/etat" quotidien)" 2
check "gardes, rien créé" "$([[ -e "$E0" || -e "$FIX/depot/etat" ]] && echo oui || echo non)" non
rm -f "$FIX/depot/etat.out"   # sortie du test lui-même, pas du script
FAUX=()

# 2. Usage invalide ; « commande » n'écrit rien.
check "sous-commande inconnue" "$(lance "$E0" nimporte)" 2
check "max invalide" "$(lance "$E0" quotidien --max 0)" 2
check "commande" "$(lance "$E0" commande)" 0
contient "commande, lecture seule" "$E0.out" "--permission-mode dontAsk"
check "commande, rien créé" "$([[ -e "$E0" ]] && echo oui || echo non)" non

# 3. Rien à trier : ni dossier du jour, ni appel gh ou claude.
E1="$FIX/e1"; mkdir -p "$E1"
check "rien à trier" "$(lance "$E1" quotidien)" 0
contient "rien à trier, message" "$E1.out" "rien à trier"
check "rien à trier, aucun dossier" "$(jours "$E1")" ""
check "rien à trier, aucun appel" "$([[ -e "$FIX/ordre.log" ]] && echo oui || echo non)" non
check "rien à trier, rapport" "$(cron "$E1")" "ok"

# 4. Plafond : 4 constats en attente, --max 3 ; puis reprise du reste dans <jour>-2.
peupler "$E1"
touch "$FIX/repere"
check "plafond" "$(lance "$E1" quotidien --max 3)" 0
J1="$E1/tri/$AUJ"
check "plafond, triés" "$(jq -c '[.[].id]' "$J1/constats-tries.json")" '["11-19#2174#0","11-19#2174#1","11-19#2174#3"]'
check "plafond, curseur" "$(faits "$E1")" '["11-19#2174#0","11-19#2174#1","11-19#2174#3"]'
contient "plafond, reportés au rapport" "$J1/rapport.md" "Reportés au tri suivant (plafond) : 1"
contient "plafond, message" "$E1.out" "1 reportés au tri suivant"
check "plafond, rapport warn" "$(cron "$E1")" "warn"
check "plafond, métrique reportés" "$(cron "$E1" metrics.reportes)" "1"
check "plafond, max_age 36 h" "$(cron "$E1" max_age_s)" "129600"
# Ordre : gh (issues, PR) avant claude ; un seul appel du modèle.
check "gh avant claude" "$(paste -sd, "$FIX/ordre.log")" "gh issue list,gh pr list,claude"
# Session : options exactes, environnement vidé, worktree détaché sur origin/main, verrou non hérité.
L="$FIX/claude.log"
for a in --print json --json-schema --tools Read,Grep,Glob --permission-mode dontAsk --strict-mcp-config \
         --no-session-persistence --disable-slash-commands '{"mcpServers":{}}' \
         '{"permissions":{"blockReadsOutsideWorkingDirectories":true}}' \
         'Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Agent,REPL,mcp__*'; do
  contient "claude, option $a" "$L" "$a"
done
for a in --bare --model --setting-sources --dangerously-skip-permissions bypassPermissions --add-dir; do
  absent "claude, pas $a" "$L" "$a"
done
for v in GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN ANTHROPIC_API_KEY; do absent "claude, sans $v" "$L" "$v=présent"; done
contient "claude, worktree jetable" "$L" "CWD=$E1/wt-tri-"
contient "claude, sur origin/main" "$L" "HEAD=$TETE"
contient "claude, détaché" "$L" "BRANCHE=détachée"
contient "claude, verrou non hérité" "$L" "FD9=fermé"
# Entrée : consigne + JSON ; objet en alerte et passage échoué jamais envoyés.
P="$FIX/prompt-recu.txt"
contient "prompt, consigne" "$P" "Consigne permanente du tri"
contient "prompt, issues ouvertes" "$P" '"number":501'
absent "prompt, objet sensible exclu" "$P" "TEXTE_RETENU_SENSIBLE"
absent "prompt, passage échoué ignoré" "$P" "TEXTE_PASSAGE_ECHOUE"
absent "prompt, low non envoyé" "$P" '"severity":"low"'
contient "rapport, exclus comptés" "$J1/rapport.md" "jamais envoyés au modèle : 1 objets, 1 constats (2026-11-20/pr2180)"
contient "rapport, low comptés" "$J1/rapport.md" "low et info, comptés seulement : 2 constats dans 2 objets"
contient "rapport, tokens" "$J1/rapport.md" "Tokens : entrée 100, cache créé 20, cache lu 300, sortie 40"
contient "rapport, durée" "$J1/rapport.md" "API 1234 ms, 3 tours"
contient "rapport, rapport seul" "$J1/rapport.md" "Rapport seul : aucune issue"
check "méta, tokens" "$(jq -c '[.entree,.cache_creation,.cache_lecture,.sortie]' "$J1/meta-tri.json")" "[100,20,300,40]"
check "cron, tokens" "$(cron "$E1" metrics.tokens.cache_lecture)" "300"
# Format du mandat FB ; groupe de sécurité sans brouillon public.
check "B01 public" "$(jq -r '.[] | select(.id=="11-19#2174#0") | .brouillon' "$J1/constats-tries.json")" "B01"
check "sécurité marquée" "$(jq -r '.[] | select(.id=="11-19#2174#3") | .brouillon' "$J1/constats-tries.json")" "sécurité — hors GitHub public"
check "département proposé seulement" "$(jq -r '.[0].dept_statut' "$J1/constats-tries.json")" "proposé seulement"
B="$J1/brouillons-issues.md"
contient "brouillon B01" "$B" "## B01 — Titre cause-commune"
contient "entrée S01" "$B" "## S01 — sécurité — hors GitHub public"
absent "sécurité, aucun texte public" "$B" "Titre secu-acces"
contient "décorateur entre accents graves admis" "$B" '`@Controller`'
absent "brouillons, pas d'alerte" "$J1/rapport.md" "brouillon retenu"
# Droits.
check "droits tri" "$(stat -c %a "$E1/tri")" 700
check "droits jour" "$(stat -c %a "$J1")" 700
check "droits constats" "$(stat -c %a "$J1/constats-tries.json")" 600
check "droits curseur" "$(stat -c %a "$E1/tri/curseur-tri.json")" 600
check "curseur du contrôleur intact" "$([[ -e "$E1/curseur.json" ]] && echo oui || echo non)" non

# 5. Reprise : le constat reporté seul, brouillon avec chemin du serveur retenu pour alerte.
check "reprise" "$(lance "$E1" quotidien)" 0
J2="$E1/tri/$AUJ-2"
check "reprise, dossier du jour suivant" "$(jours "$E1")" "$AUJ $AUJ-2"
check "reprise, constat restant" "$(jq -c '[.[].id]' "$J2/constats-tries.json")" '["11-20#lot-x#0"]'
check "reprise, curseur" "$(faits "$E1" | jq length)" 4
contient "alerte, brouillon retenu" "$J2/brouillons-issues.md" 'B01 — alerte : brouillon retenu (groupe `fuite-chemin`)'
absent "alerte, chemin absent du brouillon" "$J2/brouillons-issues.md" "/home/deploy"
contient "alerte, au rapport" "$J2/rapport.md" "chemin du serveur"
check "alerte, rapport warn" "$(cron "$E1")" "warn"
check "alerte, métrique" "$(cron "$E1" metrics.alertes)" "1"
check "rien de plus" "$(lance "$E1" quotidien)" 0
check "rien de plus, aucun dossier" "$(jours "$E1")" "$AUJ $AUJ-2"

# 6. Aucun worktree laissé ; aucune écriture hors du dossier d'état (et du .git du clone dédié).
check "worktrees retirés (dépôt)" "$(git -C "$FIX/depot" worktree list | wc -l)" 1
check "worktrees retirés (état)" "$(find "$E1" -maxdepth 1 -name 'wt-*' | wc -l)" 0
check "clone dédié propre" "$(git -C "$FIX/depot" status --porcelain | paste -sd' ')" ""
hors="$(find "$FIX" -newer "$FIX/repere" -type f \
  -not -path "$E1/*" -not -path "$FIX/state-e1/*" -not -path "$FIX/depot/.git/*" \
  -not -name '*.log' -not -name '*.out' -not -name prompt-recu.txt | paste -sd' ')"
check "aucune écriture hors de l'état" "$hors" ""
check "home intact" "$(find "$FIX/home" -type f | wc -l)" 0

# 7. Sorties refusées : rien écrit des trois fichiers, curseur inchangé, état « error ».
for m in hors-schema id-invente id-manquant enum num-invente cle-en-trop sans-structure panne; do
  E="$FIX/r-$m"; peupler "$E"; echo "$m" > "$FIX/mode"
  check "refus $m" "$(lance "$E" quotidien)" 1
  check "refus $m, aucun fichier" "$(find "$E/tri" -name 'constats-tries.json' -o -name 'rapport.md' -o -name 'brouillons-issues.md' | wc -l)" 0
  check "refus $m, curseur vide" "$(faits "$E")" "[]"
  check "refus $m, rapport" "$(cron "$E")" "error"
  check "refus $m, worktree retiré" "$(find "$E" -maxdepth 1 -name 'wt-*' | wc -l)" 0
done
contient "refus, sortie gardée" <(find "$FIX/r-hors-schema/tri" -name sortie-refusee.json) "sortie-refusee.json"

# 8. Limite de l'abonnement : code 5, « warn », tout repris au tri suivant.
E="$FIX/r-quota"; peupler "$E"; echo quota > "$FIX/mode"
check "quota" "$(lance "$E" quotidien)" 5
check "quota, rapport" "$(cron "$E")" "warn"
check "quota, curseur vide" "$(faits "$E")" "[]"
echo normal > "$FIX/mode"
check "après quota, reprise" "$(lance "$E" quotidien)" 0
check "après quota, tout trié" "$(faits "$E" | jq length)" 4

# 8 bis. Échec en cours de passage (gh en panne) : code 1, état « error » posé sans attendre 36 h.
E="$FIX/r-gh"; peupler "$E"; : > "$FIX/gh-panne"
check "gh en panne" "$(lance "$E" quotidien)" 1
check "gh en panne, rapport" "$(cron "$E")" "error"
contient "gh en panne, résumé" "$FIX/state-r-gh/automecanik/cron/codex-controleur-tri.json" "issues ouvertes illisible"
check "gh en panne, curseur vide" "$(faits "$E")" "[]"
rm -f "$FIX/gh-panne"

# 9. Couverture par une issue ouverte : pas de brouillon, numéro cité.
E="$FIX/e-couvert"; peupler "$E"; echo couvert > "$FIX/mode"
check "couvert" "$(lance "$E" quotidien)" 0
J="$(find "$E/tri" -mindepth 1 -maxdepth 1 -type d | head -n1)"
check "couvert, issue citée" "$(jq -r '.[] | select(.id=="11-19#2174#0") | .issue_ou_pr_existante' "$J/constats-tries.json")" "#501"
check "couvert, pas de brouillon" "$(jq -r '.[] | select(.id=="11-19#2174#0") | .brouillon' "$J/constats-tries.json")" "null"
absent "couvert, pas de B pour la cause" "$J/brouillons-issues.md" "Titre cause-commune"
echo normal > "$FIX/mode"

# 10. Tri antérieur (format du mandat FB) : ids déjà triés sautés, même groupe = couverture posée par le script.
mkdir -p "$FIX/FB"
echo '[{"id":"11-19#2174#0","groupe":"cause-commune","cause":"c","brouillon":"B07","issue_ou_pr_existante":null}]' \
  > "$FIX/FB/constats-tries.json"
E="$FIX/e-ant"; peupler "$E"
FAUX=(CODEX_TRI_ANTERIEURS="$FIX/FB/constats-tries.json")
check "antérieur" "$(lance "$E" quotidien)" 0
J="$(find "$E/tri" -mindepth 1 -maxdepth 1 -type d | head -n1)"
check "antérieur, id sauté" "$(jq -c '[.[].id]' "$J/constats-tries.json")" '["11-19#2174#1","11-19#2174#3","11-20#lot-x#0"]'
contient "antérieur, ref dans l'entrée" "$FIX/prompt-recu.txt" '"ref":"FB/B07"'
check "antérieur, couverture posée" "$(jq -r '.[] | select(.id=="11-19#2174#1") | .issue_ou_pr_existante' "$J/constats-tries.json")" "FB/B07"
absent "antérieur, pas de second brouillon" "$J/brouillons-issues.md" "Titre cause-commune"
contient "antérieur, compté au rapport" "$J/rapport.md" "Déjà triés avant (curseur ou tri antérieur) : 1"
FAUX=(CODEX_TRI_ANTERIEURS="$FIX/FB/absent.json")
check "antérieur donné mais absent" "$(lance "$FIX/e-ant2" quotidien)" 2
FAUX=()
E="$FIX/e-defaut"; peupler "$E"
check "défaut sans tri FB" "$(lance "$E" quotidien)" 0
contient "défaut, aucun antérieur" "$(find "$E/tri" -name rapport.md | head -n1)" "Tris antérieurs lus : aucun"

# 11. Verrou partagé avec le contrôleur : code 7.
exec 8> "$E1/.verrou"; flock -n 8
check "verrou" "$(lance "$E1" quotidien)" 7
exec 8>&-

# 12. Option absente de « claude --help » : code 4, modèle non lancé.
E="$FIX/e-option"; peupler "$E"; echo --json-schema > "$FIX/sans"; : > "$FIX/ordre.log"
check "option absente" "$(lance "$E" quotidien)" 4
contient "option absente, message" "$E.out" "option --json-schema absente"
check "option absente, rapport" "$(cron "$E")" "error"
check "option absente, aucun appel" "$(wc -l < "$FIX/ordre.log")" 0
rm -f "$FIX/sans"

# 13. Unités livrées : tri démarré par OnSuccess= du contrôleur, jamais par minuteur ni au boot.
U="$ICI/automecanik-codex-tri.service"
contient "contrôleur, OnSuccess" "$ICI/automecanik-codex-controleur.service" "OnSuccess=automecanik-codex-tri.service"
absent "contrôleur, pas OnFailure vers le tri" "$ICI/automecanik-codex-controleur.service" "OnFailure="
contient "tri, oneshot" "$U" "Type=oneshot"
contient "tri, script du clone" "$U" \
  "ExecStart=/usr/bin/bash %h/codex-controleur/app/scripts/ops/codex-controleur/codex-tri.sh quotidien"
contient "tri, dépôt du clone" "$U" "Environment=CODEX_CONTROLEUR_DEPOT=%h/codex-controleur/app"
contient "tri, plafond" "$U" "TimeoutStartSec="
absent "tri, pas d'[Install]" "$U" "[Install]"
absent "tri, pas le checkout partagé" "$U" "/opt/automecanik/app"
check "tri, pas de minuteur" "$([[ -e "$ICI/automecanik-codex-tri.timer" ]] && echo oui || echo non)" non

echo "codex-tri : $ok vérifications réussies, $ko en échec"
[[ "$ko" -eq 0 ]]
