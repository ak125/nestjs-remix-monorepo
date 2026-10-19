#!/usr/bin/env bash
#
# dedup-worktree-node-modules.sh — dédoublonne les node_modules des worktrees Claude par liens physiques
#
# Une session qui rejoue la CI complète (typecheck, lint, vitest, chaîne registry) dans un worktree y
# lance `npm ci` : node_modules autonome, ~1,3 Gio par copie, et le disque DEV s'est rempli ainsi
# (99 % le 2026-10-19, 15 copies). Les deux raccourcis connus ne conviennent pas à ce rejeu : un lien
# symbolique vers le checkout principal fausse la chaîne registry, et `cp -al` depuis le checkout
# principal le ferait modifier par les caches que tsc, eslint et vite réécrivent sur place.
#
# Ce script remplace APRÈS COUP chaque fichier identique (contenu, droits, propriétaire ; la date est
# ignorée, npm date chaque fichier de l'heure d'installation) par un lien physique vers le même fichier
# d'un autre worktree au même package-lock.json : l'état que produit `cp -al`, sans le checkout
# principal. hardlink lie aussi les fichiers identiques d'un même node_modules (licences, fichiers
# répétés d'un paquet à l'autre : ~22 000 par copie sur DEV). Il ne supprime rien.
#
# Jamais liés : node_modules/.cache, .vite, .vite-temp (caches réécrits sur place) et .package-lock.json.
# Jamais touchés : le checkout principal ; les worktrees verrouillés ou attribués (agent-claim.json) ;
# ceux d'autres gestionnaires (hors DEDUP_ROOTS : Codex, pont Hermes) ; ceux où un processus a son
# répertoire courant, un fichier ouvert ou une bibliothèque chargée ; une installation absente, faite
# de liens symboliques, ou terminée depuis moins de SETTLE_MIN minutes.
#
# Après passage : `npm ci` reste sûr (il supprime node_modules avant d'installer) ; `npm install` ou
# patch-package exigent `rm -rf node_modules` avant, car ils écrivent sur place.
#
# Chaque worktree traité garde une empreinte de son installation (inode et date de
# node_modules/.package-lock.json, que npm réécrit à chaque installation) dans son dossier
# d'administration git : tant qu'elle ne change pas, il n'est pas repassé.
#
# Usage:
#   dedup-worktree-node-modules.sh            # dry-run (par défaut) : ne modifie rien
#   dedup-worktree-node-modules.sh --apply    # crée les liens
#
# Env (optionnel):
#   DEDUP_ROOTS  préfixes de chemin des worktrees concernés, séparés par « : »
#                (défaut : <checkout principal>/.claude/worktrees/:$HOME/worktrees/claude-)
#   SETTLE_MIN   minutes depuis la fin de l'installation sous lesquelles un worktree est épargné (défaut : 15)
#   CRON_REPORT_MAX_AGE_S  silence au-delà duquel le hook SessionStart signale le cron arrêté (défaut : 10800)
#
# Observabilité : chaque exécution --apply enregistre son issue (ok / error) via cron_report
# (scripts/cron/lib-supabase-report.sh), lue par le hook SessionStart. Un essai à blanc n'enregistre
# rien : lancé à la main, il masquerait l'état du cron.
#
# Dépendances: git, hardlink (util-linux), flock, sha256sum, jq (pour cron_report).
set -euo pipefail
# Un GIT_DIR / GIT_WORK_TREE hérité ferait agir chaque commande sur un autre dépôt.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR

APPLY=0
case "${1:-}" in
  "") ;;
  --apply) APPLY=1 ;;
  *) echo "usage: $0 [--apply]" >&2; exit 2 ;;
esac

LOG_TAG=dedup-worktree-node-modules
START="$(date +%s)"
# Cadence horaire : trois passages manqués = cron considéré arrêté.
CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-10800}"
# shellcheck source=lib-supabase-report.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-supabase-report.sh" 2>/dev/null || true
report() { # $1=ok|error $2=métriques JSON $3=résumé
  [[ $APPLY -eq 1 ]] || return 0
  if ! command -v cron_report >/dev/null 2>&1; then
    echo "WARN    cron_report indisponible (lib-supabase-report.sh non chargée) — issue du run NON enregistrée" >&2
    return 0
  fi
  cron_report "$LOG_TAG" "$1" "$(( $(date +%s) - START ))" "${2:-}" "${3:-}"
}
fatal() { echo "FATAL: $1" >&2; report error '' "$1"; exit 2; }

for bin in git hardlink flock sha256sum nice ionice realpath stat find awk df; do
  command -v "$bin" >/dev/null 2>&1 || fatal "'$bin' requis mais absent"
done
hardlink --version 2>&1 | grep -q util-linux || fatal "hardlink n'est pas celui de util-linux"

MAIN="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
SETTLE_MIN="${SETTLE_MIN:-15}"
IFS=: read -r -a ROOTS <<<"${DEDUP_ROOTS:-$MAIN/.claude/worktrees/:$HOME/worktrees/claude-}"
# Chemins complets (hardlink -x s'applique au chemin entier).
EXCL='/node_modules/(\.cache|\.vite|\.vite-temp)/|/node_modules/\.package-lock\.json$'
STAMP=node-modules-dedup
DRY=(-n); [[ $APPLY -eq 1 ]] && DRY=()

exec 9>"${TMPDIR:-/tmp}/dedup-worktree-node-modules.lock"
# Rien d'enregistré ici : l'exécution en cours enregistrera la sienne.
flock -n 9 || { echo "INFO    une autre exécution est en cours — rien fait"; exit 0; }

managed() { # $1=path
  local r
  for r in "${ROOTS[@]}"; do [[ -n "$r" && "$1" == "$r"* ]] && return 0; done
  return 1
}

# Un processus a-t-il ce dossier comme répertoire courant, un fichier ouvert ou une bibliothèque chargée dedans ?
# On lit la SORTIE, jamais le code retour : sous pipefail, le awk qui s'arrête au premier résultat coupe
# find/cat (SIGPIPE, 141) et find sort en 1 sur les processus illisibles d'autres utilisateurs — le code
# du pipeline dirait « libre » précisément quand un processus est trouvé.
busy() { # $1=path
  local rp hit
  rp="$(realpath -e -- "$1" 2>/dev/null)" || return 0
  hit="$( { find /proc/[0-9]*/exe /proc/[0-9]*/cwd /proc/[0-9]*/fd/ -maxdepth 1 -printf '%l\n' 2>/dev/null
            cat /proc/[0-9]*/maps 2>/dev/null | awk 'NF>=6{print $6}'; } \
          | awk -v p="$rp" '$0==p || index($0, p"/")==1 {print "x"; exit}' || true)"
  [[ -n "$hit" ]]
}

# Dossiers node_modules réels du worktree (racine, workspaces, packages/*) ; jamais un lien symbolique.
nm_dirs() { # $1=path
  local p
  for p in "$1/node_modules" "$1"/*/node_modules "$1"/packages/*/node_modules; do
    [[ -d "$p" && ! -L "$p" ]] && printf '%s\n' "$p"
  done
  return 0
}

stamp_of() { stat -c '%i:%Y' "$1/node_modules/.package-lock.json"; }

# Enregistrements `chemin NUL verrouillé NUL` (format -z : chemins avec espaces intacts).
list_worktrees() {
  local line p="" l=0
  while IFS= read -r -d '' line; do
    case "$line" in
      "worktree "*)      p="${line#worktree }"; l=0;;
      locked|"locked "*) l=1;;
      "") [[ -n "$p" ]] && printf '%s\0%s\0' "$p" "$l"; p="";;
    esac
  done < <(git -C "$MAIN" worktree list --porcelain -z)
}

mode_label="DRY-RUN (rien n'est modifié — utiliser --apply pour agir)"
[[ $APPLY -eq 1 ]] && mode_label="APPLY"
echo "=== dedup-worktree-node-modules — $mode_label — $(date '+%F %T') ==="
echo "Avant : $(df -h "$MAIN" | tail -1)"

NOW="$(date +%s)"
P=(); K=(); G=(); S=()   # chemin, clé de groupe, dossier git, empreinte à jour (0/1)
out_scope=0; no_nm=0
while IFS= read -r -d '' path && IFS= read -r -d '' locked; do
  [[ "$path" == "$MAIN" ]] && continue
  managed "$path" || { out_scope=$((out_scope + 1)); continue; }
  hpl="$path/node_modules/.package-lock.json"
  # Rien à dédoublonner : pas de node_modules, ou node_modules fait de liens (symlink, mk-ci-node-modules).
  if [[ -L "$path/node_modules" || ! -f "$hpl" || -L "$hpl" ]]; then no_nm=$((no_nm + 1)); continue; fi
  if [[ "$locked" == "1" ]]; then echo "SKIP    locked           $path"; continue; fi
  gd="$(git -C "$path" rev-parse --absolute-git-dir 2>/dev/null || true)"
  if [[ -z "$gd" || -e "$gd/agent-claim.json" ]]; then echo "SKIP    claimed-or-unreadable $path"; continue; fi
  age=$(( (NOW - $(stat -c %Y "$hpl")) / 60 ))
  if [[ "$age" -lt "$SETTLE_MIN" ]]; then echo "SKIP    recent-install(${age}m) $path"; continue; fi
  lock="$(sha256sum "$path/package-lock.json" 2>/dev/null | cut -c1-64)" \
    || { echo "SKIP    no-package-lock  $path"; continue; }
  if busy "$path"; then echo "SKIP    in-use           $path"; continue; fi
  st=0; [[ "$(cat "$gd/$STAMP" 2>/dev/null)" == "$(stamp_of "$path")" ]] && st=1
  P+=("$path"); K+=("$(stat -c %d "$path"):$lock"); G+=("$gd"); S+=("$st")
done < <(list_worktrees)

passes=0; fails=0; done_already=0
mapfile -t KEYS < <(printf '%s\n' "${K[@]}" | sort -u | sed '/^$/d')
for key in "${KEYS[@]}"; do
  ref=-1; todo=()
  # Référence : un worktree déjà traité si possible — ses fichiers portent déjà le plus de liens, donc
  # une copie réinstallée (référence comprise) rejoint les inodes du groupe (hardlink -m).
  for i in "${!P[@]}"; do [[ "${K[$i]}" == "$key" && "${S[$i]}" == 1 ]] && { ref=$i; break; }; done
  for i in "${!P[@]}"; do
    [[ "${K[$i]}" == "$key" ]] || continue
    if [[ "${S[$i]}" == 1 ]]; then [[ $i -ne $ref ]] && done_already=$((done_already + 1)); continue; fi
    if [[ $ref -lt 0 ]]; then ref=$i; else todo+=("$i"); fi
  done
  [[ "${S[$ref]}" == 1 ]] && done_already=$((done_already + 1))
  [[ ${#todo[@]} -gt 0 ]] || continue
  mapfile -t rdirs < <(nm_dirs "${P[$ref]}")
  echo "référence : ${P[$ref]}"
  ok=0
  for i in "${todo[@]}"; do
    # Revérifié juste avant la passe : la précédente a pu durer.
    if busy "${P[$i]}"; then echo "SKIP    in-use(au moment de la passe) ${P[$i]}"; continue; fi
    if busy "${P[$ref]}"; then echo "SKIP    référence in-use — groupe interrompu"; break; fi
    mapfile -t dirs < <(nm_dirs "${P[$i]}")
    echo "-- ${P[$i]}"
    rc=0; out="$(nice -n 19 ionice -c3 hardlink "${DRY[@]}" -m -t -x "$EXCL" -- "${rdirs[@]}" "${dirs[@]}" 2>&1)" || rc=$?
    printf '%s\n' "$out" | sed 's/^/    /'
    passes=$((passes + 1))
    # hardlink (2.39.3) sort en 0 même quand un lien échoue (droits, fichier disparu) : ses messages
    # d'erreur, préfixés « hardlink: », comptent comme un échec — sinon l'empreinte écrite plus bas
    # écarterait ce worktree de tous les passages suivants.
    if [[ $rc -ne 0 ]] || grep -q '^hardlink: ' <<<"$out"; then
      echo "FAIL    hardlink code $rc ${P[$i]}"; fails=$((fails + 1)); continue
    fi
    ok=1
    [[ $APPLY -eq 1 ]] && stamp_of "${P[$i]}" > "${G[$i]}/$STAMP"
  done
  [[ $APPLY -eq 1 && $ok -eq 1 && "${S[$ref]}" == 0 ]] && stamp_of "${P[$ref]}" > "${G[$ref]}/$STAMP"
done

summary="passes=$passes échecs=$fails déjà-dédoublonnés=$done_already hors-périmètre=$out_scope sans-node_modules-autonome=$no_nm"
echo "=== Bilan : $summary ==="
echo "Après : $(df -h "$MAIN" | tail -1)"
[[ $APPLY -eq 0 ]] && echo "(dry-run — relancer avec --apply pour exécuter)"
metrics="$(printf '{"passes":%d,"fails":%d,"already_deduped":%d,"out_of_scope":%d,"no_own_node_modules":%d}' \
  "$passes" "$fails" "$done_already" "$out_scope" "$no_nm")"
if [[ $fails -eq 0 ]]; then report ok "$metrics" "$summary"; else report error "$metrics" "$summary"; fi
[[ $fails -eq 0 ]]
