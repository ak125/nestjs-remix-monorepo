#!/usr/bin/env bash
# Tests de codex-controleur.sh, sans réseau ni Codex réel : dépôt d'origine nu local, faux `gh`
# (liste des PR fusionnées) et faux `codex` (version, constats, quota, échec) dans $FIX/bin.
# Usage : bash scripts/ops/codex-controleur/codex-controleur.test.sh
# Apostrophes typographiques voulues dans les textes français.
# shellcheck disable=SC1112
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ICI/codex-controleur.sh"
FIX="$(mktemp -d)"
trap '[[ -n "${GARDER:-}" ]] || rm -rf "$FIX"' EXIT
export GIT_CONFIG_GLOBAL="$FIX/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global user.name test; git config --global user.email test@example.invalid
git config --global commit.gpgsign false; git config --global init.defaultBranch main

ok=0; ko=0
check() { if [[ "$2" == "$3" ]]; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "ÉCHEC $1 : attendu « $3 », obtenu « $2 »"; fi; }
contient() { if grep -qF -- "$3" "$2" 2> /dev/null; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "ÉCHEC $1 : « $3 » absent de $2"; fi; }
absent() { if ! grep -qF -- "$3" "$2" 2> /dev/null; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "ÉCHEC $1 : « $3 » présent dans $2"; fi; }

# --- Dépôt : origine nue + clone de travail, trois « PR » fusionnées (une avec package-lock.json) ---
git init -q --bare "$FIX/origine.git"
git clone -q "$FIX/origine.git" "$FIX/depot" 2> /dev/null
mkdir -p "$FIX/depot/scripts/cron"
cp "$ICI/../../cron/lib-supabase-report.sh" "$FIX/depot/scripts/cron/"
echo base > "$FIX/depot/a.txt"; git -C "$FIX/depot" add -A; git -C "$FIX/depot" commit -qm base
declare -A SHA
for n in 101 102 103; do
  echo "pr $n" >> "$FIX/depot/a.txt"
  [[ "$n" != 101 ]] || echo '{"lock":"énorme"}' > "$FIX/depot/package-lock.json"
  git -C "$FIX/depot" add -A; git -C "$FIX/depot" commit -qm "feat: PR $n"
  SHA[$n]="$(git -C "$FIX/depot" rev-parse HEAD)"
done
git -C "$FIX/depot" push -q origin main 2> /dev/null
jq -n --arg a "${SHA[101]}" --arg b "${SHA[102]}" --arg c "${SHA[103]}" '[
  {number:103, title:"PR 103", mergedAt:"2026-11-19T09:00:00Z", mergeCommit:{oid:$c}},
  {number:101, title:"PR 101", mergedAt:"2026-11-19T07:00:00Z", mergeCommit:{oid:$a}},
  {number:102, title:"PR 102", mergedAt:"2026-11-19T08:00:00Z", mergeCommit:{oid:$b}}]' > "$FIX/prs.json"

# --- Faux outils ---
mkdir -p "$FIX/bin"
# Faux gh fidèle au vrai sur la résolution du dépôt : sans -R ni GH_REPO, il lit le dépôt du
# répertoire courant et échoue hors dépôt avec le message de gh 2.101.0 (mandat EF) ; avec -R, il
# n'accepte que l'URL du remote origin du dépôt de travail.
cat > "$FIX/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "$FIX/gh.log"
if [[ "${1:-}" == "-R" ]]; then
  [[ "$2" == "$FIX/origine.git" ]] || { echo "dépôt inattendu : $2" >&2; exit 1; }
  shift 2
elif [[ -z "${GH_REPO:-}" ]] && ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "failed to run git: fatal: not a git repository (or any of the parent directories): .git" >&2
  exit 1
fi
case "$1 $2" in
  "pr list") cat "$FIX/prs.json" ;;
  "pr view") jq -r --argjson n "$3" '.[]|select(.number==$n)|.mergedAt' "$FIX/prs.json" ;;
  *) exit 1 ;;
esac
EOF
cat > "$FIX/bin/codex" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then echo "codex-cli ${FAUX_VERSION:-0.170.0}"; exit 0; fi
out=""; prev=""; for a in "$@"; do [[ "$prev" == "-o" ]] && out="$a"; prev="$a"; done
prompt="${*: -1}"
objet="$(sed -n 's/^PR #\([0-9]*\) fusionnée.*/\1/p;s/.*lot « \([^»]*\) ».*/lot-\1/p' <<< "$prompt" | head -n1)"
{ echo "=== objet $objet"; printf '%s\n' "$@" | head -n -1; echo "GH_TOKEN=${GH_TOKEN:+présent}"; echo "GITHUB_TOKEN=${GITHUB_TOKEN:+présent}";
  echo "STDIN:"; cat; } >> "$FIX/codex.log"
echo '{"type":"thread.started"}'
if [[ -f "$FIX/quota" && "$objet" == "$(cat "$FIX/quota")" ]]; then
  echo '{"type":"turn.failed","error":{"message":"You have hit your usage limit (usage_limit_reached)"}}'
  echo "ERROR: usage_limit_reached" >&2; exit 1
fi
if [[ -f "$FIX/panne" && "$objet" == "$(cat "$FIX/panne")" ]]; then echo "erreur de transport" >&2; exit 1; fi
# Texte d'un fichier lu qui contient les mots du quota : ne doit pas déclencher l'arrêt.
echo '{"type":"item.completed","item":{"type":"command_execution","aggregated_output":"QUOTA_RE=usage_limit_reached"}}'
echo '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":900,"output_tokens":50,"reasoning_output_tokens":20}}'
preuve="e"; [[ -f "$FIX/sensible" && "$objet" == "$(cat "$FIX/sensible")" ]] && preuve="client jean.dupont@exemple.fr"
jq -n --arg o "$objet" --arg p "$preuve" '{findings:[{file:"a.txt",line:1,severity:"medium",category:"bug",title:("constat "+$o),
  evidence:$p,proposed_fix:"f",confidence:"high"}], files_read:["a.txt"], notes:""}' > "$out"
EOF
chmod +x "$FIX/bin/gh" "$FIX/bin/codex"

# Lancement depuis un répertoire hors dépôt, comme l'unité systemd (démarrée dans $HOME).
mkdir -p "$FIX/hors-depot"
lance() { # dossier d'état, puis arguments ; affiche le code de sortie
  local etat="$1"; shift
  (cd "$FIX/hors-depot" && env FIX="$FIX" PATH="$FIX/bin:$PATH" GH_TOKEN=jeton-de-test GITHUB_TOKEN=jeton-de-test \
    XDG_STATE_HOME="$FIX/state-$(basename "$etat")" CODEX_CONTROLEUR_DEPOT="$FIX/depot" \
    CODEX_CONTROLEUR_ETAT="$etat" "${FAUX[@]}" bash "$SCRIPT" "$@" > "$etat.out" 2>&1) && echo 0 || echo $?
}
FAUX=()
faites() { jq -c '[.faites[] | select(.statut=="relue") | .pr]' "$1/curseur.json"; }
cron() { jq -r '.status' "$FIX/state-$(basename "$1")/automecanik/cron/codex-controleur.json"; }

# 1. Sans curseur : code 6, rien relu.
E="$FIX/e1"
check "sans curseur" "$(lance "$E" quotidien)" 6
contient "sans curseur, message" "$E.out" "curseur absent"

# 2. init : format vérifié, double init refusée.
check "init format" "$(lance "$E" init --depuis 2026-11-19)" 2
check "init" "$(lance "$E" init --depuis 2026-11-19T06:30:00Z)" 0
check "init deux fois" "$(lance "$E" init --depuis 2026-11-18T00:00:00Z)" 1
check "curseur intact" "$(jq -r .depuis "$E/curseur.json")" "2026-11-19T06:30:00Z"

# 3. Version inattendue : code 4, rien relu, état « error ».
FAUX=(FAUX_VERSION=0.171.0)
check "version" "$(lance "$E" quotidien)" 4
contient "version, message" "$E.out" "version de Codex inattendue"
check "version, rien relu" "$(faites "$E")" "[]"
check "version, rapport" "$(cron "$E")" "error"
[[ ! -e "$FIX/codex.log" ]] && check "version, Codex non lancé" ok ok || check "version, Codex non lancé" lancé "non lancé"
FAUX=()

# 4. Quota à la PR 102 : 101 relue, arrêt code 5, curseur sur 101 ; reprise : 102 et 103 seules.
echo 102 > "$FIX/quota"
check "quota" "$(lance "$E" quotidien)" 5
contient "quota, message" "$E.out" "quota Codex épuisé à la PR #102"
check "quota, curseur" "$(faites "$E")" "[101]"
check "quota, depuis" "$(jq -r .depuis "$E/curseur.json")" "2026-11-19T07:00:00Z"
check "quota, rapport" "$(cron "$E")" "warn"
rm -f "$FIX/quota"; : > "$FIX/codex.log"
check "reprise" "$(lance "$E" quotidien)" 0
check "reprise, curseur" "$(faites "$E")" "[101,102,103]"
check "reprise, objets relus" "$(grep -c '^=== objet ' "$FIX/codex.log")" 2
absent "reprise, 101 non relue" "$FIX/codex.log" "=== objet 101"
check "reprise, rapport" "$(cron "$E")" "ok"
J="$E/bruts/$(date -u +%Y-%m-%d)"
contient "résumé écrit" "$E/resume-$(date -u +%Y-%m-%d).md" "constat 103"
check "méta, tokens" "$(jq -r '.entree,.cache' "$J/pr103/meta.json" | paste -sd/)" "1000/900"
check "méta, consigne" "$(jq -r .consigne_sha256 "$J/pr103/meta.json")" "$(sha256sum "$ICI/consigne.md" | cut -d' ' -f1)"
# Texte « usage_limit_reached » lu dans un fichier par Codex : pas pris pour un quota (103 relue).

# Dépôt GitHub explicite : chaque appel gh porte -R <origin du dépôt de travail> (mandat EF).
check "gh, dépôt explicite (pr list)" "$(grep -c "^-R $FIX/origine.git pr list " "$FIX/gh.log")" "$(grep -c 'pr list ' "$FIX/gh.log")"

# 5. Plus rien de neuf : code 0, Codex non lancé.
: > "$FIX/codex.log"
check "rien de neuf" "$(lance "$E" quotidien)" 0
check "rien de neuf, Codex non lancé" "$(wc -c < "$FIX/codex.log")" 0

# 6. Cadre de lecture seule : options présentes, jetons GitHub retirés de l'environnement de Codex.
L="$FIX/codex-cadre.log"; : > "$FIX/codex.log"
E2="$FIX/e2"; lance "$E2" init --depuis 2026-11-19T00:00:00Z > /dev/null
check "cadre, passage" "$(lance "$E2" quotidien --max 1)" 0
cp "$FIX/codex.log" "$L"
for opt in "-s" "read-only" "--ignore-user-config" "--ignore-rules" "--ephemeral" "--json" \
  'default_permissions="controleur"' "shell_environment_policy.inherit=\"core\"" "--output-schema" \
  "--disable" "plugins" "hooks" "gpt-6.2-astra" 'model_reasoning_effort="high"'; do
  contient "cadre, option $opt" "$L" "$opt"
done
absent "cadre, GH_TOKEN retiré" "$L" "GH_TOKEN=présent"
absent "cadre, GITHUB_TOKEN retiré" "$L" "GITHUB_TOKEN=présent"
absent "cadre, jeton jamais transmis" "$L" "jeton-de-test"
absent "cadre, aucun serveur MCP" "$L" "mcp_servers"
# Diff joint : package-lock.json retiré, a.txt présent.
contient "diff, fichier modifié" "$L" "+pr 101"
absent "diff, package-lock.json retiré" "$L" "énorme"

# 7. --max : une seule PR relue, état « warn », les autres reportées.
check "max, curseur" "$(faites "$E2")" "[101]"
check "max, rapport" "$(cron "$E2")" "warn"
contient "max, message" "$E2.out" "2 reportées"

# 8. Échec générique sur 102 : arrêt code 1, curseur inchangé, 103 non relue.
echo 102 > "$FIX/panne"
check "panne" "$(lance "$E2" quotidien)" 1
check "panne, curseur" "$(faites "$E2")" "[101]"
check "panne, rapport" "$(cron "$E2")" "error"
# 9. ignorer : la PR qui échoue est marquée avec motif, la suivante est relue.
check "ignorer sans motif" "$(lance "$E2" ignorer --pr 102)" 2
check "ignorer" "$(lance "$E2" ignorer --pr 102 --motif 'diff illisible')" 0
contient "ignorer, dépôt explicite (pr view)" "$FIX/gh.log" "-R $FIX/origine.git pr view 102 "
check "ignorer, statut" "$(jq -r '.faites[]|select(.pr==102)|.statut+":"+.motif' "$E2/curseur.json")" "ignoree:diff illisible"
check "après ignorer" "$(lance "$E2" quotidien)" 0
check "après ignorer, curseur" "$(faites "$E2")" "[101,103]"
rm -f "$FIX/panne"

# 10. Lot : constats rangés, curseur intact ; fichier absent refusé ; quota pendant un lot = 5.
printf 'a.txt\n' > "$FIX/lot.txt"
avant="$(cat "$E2/curseur.json")"
check "lot" "$(lance "$E2" lot --nom T1 --liste "$FIX/lot.txt" --departement 23)" 0
check "lot, curseur intact" "$(cat "$E2/curseur.json")" "$avant"
check "lot, constats" "$(jq '.findings|length' "$E2/bruts/$(date -u +%Y-%m-%d)/lot-T1/last.json")" 1
contient "lot, objet" "$E2/bruts/$(date -u +%Y-%m-%d)/lot-T1/prompt.txt" "du département 23"
printf 'absent.txt\n' > "$FIX/lot2.txt"
check "lot, fichier absent" "$(lance "$E2" lot --nom T2 --liste "$FIX/lot2.txt")" 1
echo lot-T3 > "$FIX/quota"
check "lot, quota" "$(lance "$E2" lot --nom T3 --liste "$FIX/lot.txt")" 5
rm -f "$FIX/quota"
# Constat qui cite un courriel : passage réussi, constat retenu hors du résumé, bruts privés.
echo lot-T4 > "$FIX/sensible"
check "lot, donnée sensible" "$(lance "$E2" lot --nom T4 --liste "$FIX/lot.txt")" 0
rm -f "$FIX/sensible"
check "sensible, alerte" "$(jq -r .alerte "$E2/bruts/$(date -u +%Y-%m-%d)/lot-T4/meta.json")" "donnee_sensible_possible"
R2="$E2/resume-$(date -u +%Y-%m-%d).md"
absent "sensible, courriel hors résumé" "$R2" "jean.dupont"
contient "sensible, mention" "$R2" "Constats retenus hors du résumé"
contient "sensible, autres lots intacts" "$R2" "constat lot-T1"
check "bruts privés" "$(stat -c %a "$E2/bruts")" 700
E3="$FIX/e3"; mkdir -p "$E3/bruts"; chmod 755 "$E3" "$E3/bruts"
lance "$E3" init --depuis 2026-11-19T00:00:00Z > /dev/null
check "état existant resserré" "$(stat -c %a "$E3") $(stat -c %a "$E3/bruts")" "700 700"
check "lot, nom invalide" "$(lance "$E2" lot --nom 'a b' --liste "$FIX/lot.txt")" 2

# 11. Verrou : un second passage simultané est refusé (code 7).
exec 8> "$E2/.verrou"; flock -n 8
check "verrou" "$(lance "$E2" quotidien)" 7
exec 8>&-

# 12. Aucun worktree jetable laissé derrière, ni dans l'état, ni dans le dépôt.
check "worktrees retirés (dépôt)" "$(git -C "$FIX/depot" worktree list | wc -l)" 1
check "worktrees retirés (état)" "$(find "$E" "$E2" -maxdepth 1 -name 'wt-*' | wc -l)" 0

# 13. Unités livrées : calendrier quotidien rattrapé, passage « quotidien », jamais au boot.
U="$ICI/automecanik-codex-controleur"
contient "minuteur, calendrier" "$U.timer" "OnCalendar=*-*-* 05:30:00 UTC"
contient "minuteur, rattrapage" "$U.timer" "Persistent=true"
absent "minuteur, pas OnBootSec" "$U.timer" "OnBootSec"
contient "service, oneshot" "$U.service" "Type=oneshot"
contient "service, sous-commande" "$U.service" "codex-controleur.sh quotidien"
contient "service, plafond" "$U.service" "TimeoutStartSec="
# Clone dédié : script et dépôt de travail dans %h/codex-controleur/app, jamais le checkout partagé.
contient "service, script du clone" "$U.service" \
  "ExecStart=/usr/bin/bash %h/codex-controleur/app/scripts/ops/codex-controleur/codex-controleur.sh quotidien"
contient "service, dépôt du clone" "$U.service" "Environment=CODEX_CONTROLEUR_DEPOT=%h/codex-controleur/app"
absent "service, pas le checkout partagé" "$U.service" "/opt/automecanik/app"

# 14. Usage invalide.
check "sous-commande inconnue" "$(lance "$E2" nimporte)" 2
check "max invalide" "$(lance "$E2" quotidien --max 0)" 2

# 15. Checkout partagé refusé comme dépôt de travail, avant toute écriture (aucun dossier d'état créé).
FAUX=(CODEX_CONTROLEUR_DEPOT=/opt/automecanik/app)
E4="$FIX/e4"
check "checkout partagé refusé" "$(lance "$E4" quotidien)" 2
contient "checkout partagé, message" "$E4.out" "dépôt refusé"
check "checkout partagé, rien créé" "$([[ -e "$E4" ]] && echo oui || echo non)" non
FAUX=()

echo "codex-controleur : $ok vérifications réussies, $ko en échec"
[[ "$ko" -eq 0 ]]
