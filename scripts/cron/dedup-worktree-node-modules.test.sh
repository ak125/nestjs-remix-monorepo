#!/usr/bin/env bash
# Test de dedup-worktree-node-modules.sh sur un dépôt FIXTURE jetable (jamais le dépôt réel).
#
# Cas couverts : copies identiques datées différemment (npm date chaque fichier de l'heure
# d'installation), caches réécrits sur place qui ne doivent jamais être partagés, checkout principal,
# worktree verrouillé, d'un autre gestionnaire, occupé par un processus, installation trop récente,
# node_modules en lien symbolique, autre package-lock.json, fichier au contenu différent, chemin
# contenant une espace, doublon interne à une copie, dry-run qui ne doit rien écrire, second passage sans travail, référence
# réinstallée qui doit rejoindre les inodes du groupe, exécution concurrente, lien impossible (hardlink
# sort pourtant en 0), état enregistré pour le hook SessionStart (cron_report, en --apply seulement).
#
# Usage : bash dedup-worktree-node-modules.test.sh
#         DEDUP_SCRIPT=/chemin/autre-version.sh bash dedup-worktree-node-modules.test.sh
# Dépendances : git, hardlink (util-linux), flock, jq.
set -uo pipefail

SCRIPT="${DEDUP_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/dedup-worktree-node-modules.sh}"
if ! { command -v hardlink >/dev/null 2>&1 && hardlink --version 2>&1 | grep -q util-linux; }; then
  echo "ÉCHEC — hardlink (util-linux) absent : test impossible"; exit 2
fi
command -v jq >/dev/null 2>&1 || { echo "ÉCHEC — jq absent : test impossible"; exit 2; }
FIX="$(mktemp -d "${TMPDIR:-/tmp}/dedup-nm-test.XXXXXX")"
FAIL=0
PIDS=()

cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; chmod -R u+w "$FIX" 2>/dev/null; rm -rf "$FIX"; }
trap cleanup EXIT

check() { # check <description> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi
}
ino()   { stat -c %i "$1"; }
links() { stat -c %h "$1"; }
same()  { [[ "$(ino "$1")" == "$(ino "$2")" ]] && echo same || echo distinct; }
snapshot() { find "$FIX/home" "$R" -path '*/.git' -prune -o -type f -printf '%i %n %p\n' | sort | sha256sum | cut -c1-12; }

# --- Isolation : aucune config globale/système, aucun hook, aucun dépôt réel ---
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR DEDUP_ROOTS SETTLE_MIN
unset XDG_STATE_HOME CRON_STATE_DIR CRON_REPORT_MAX_AGE_S
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export HOME="$FIX/home" TMPDIR="$FIX/tmp"
mkdir -p "$HOME/worktrees" "$TMPDIR"

R="$FIX/repo"; H="$HOME/worktrees"
STATE="$HOME/.local/state/automecanik/cron/dedup-worktree-node-modules.json"
git init -q -b main "$R"
git -C "$R" config core.hooksPath "$FIX/no-hooks"
printf '.claude/worktrees/\nnode_modules/\n' > "$R/.gitignore"
printf '{"lockfileVersion":3,"v":"A"}\n' > "$R/package-lock.json"
mkdir -p "$R/frontend"; printf 'front\n' > "$R/frontend/README"
git -C "$R" add -A && git -C "$R" commit -qm base
git -C "$R" switch -q -c other-lock
printf '{"lockfileVersion":3,"v":"B"}\n' > "$R/package-lock.json"
git -C "$R" commit -qam "other lock"
git -C "$R" switch -q main

mknm() { # mknm <worktree> <date> : installation simulée, tous les fichiers datés de <date>
  local w=$1
  mkdir -p "$w/node_modules/pkg" "$w/node_modules/.cache/tsc" "$w/node_modules/.vite/deps" \
           "$w/frontend/node_modules/fe" "$w/frontend/node_modules/.vite-temp"
  printf 'module.exports = 1;\n' > "$w/node_modules/pkg/index.js"
  printf 'big-identical-payload\n%.0s' {1..200} > "$w/node_modules/pkg/big.bin"
  printf 'export default 2;\n' > "$w/frontend/node_modules/fe/index.js"
  printf 'MIT License\n' | tee "$w/node_modules/pkg/LICENSE" > "$w/frontend/node_modules/fe/LICENSE"
  printf 'cache\n' > "$w/node_modules/.cache/tsc/x.tsbuildinfo"
  printf 'deps\n' > "$w/node_modules/.vite/deps/_metadata.json"
  printf 'tmp\n' > "$w/frontend/node_modules/.vite-temp/t.mjs"
  printf '{"hidden":true}\n' > "$w/node_modules/.package-lock.json"
  find "$w/node_modules" "$w/frontend/node_modules" -type f -exec touch -d "$2" {} +
}
mkwt() { git -C "$R" worktree add -q --detach "$1" "${2:-main}"; }

A="$H/claude-a"; B="$H/claude-b"; C="$R/.claude/worktrees/c"; SP="$H/claude-sp ace"; D="$H/claude-diff"
LK="$H/claude-locked"; CX="$H/codex-x"; BZ="$H/claude-busy"; FR="$H/claude-fresh"; SL="$H/claude-symlink"
OL="$H/claude-other-lock"
for w in "$A" "$B" "$C" "$SP" "$D" "$LK" "$CX" "$BZ" "$FR" "$SL"; do mkwt "$w"; done
mkwt "$OL" other-lock
mknm "$R" '2026-01-01 00:00'
mknm "$A" '2026-01-02 00:00'; mknm "$B" '2026-01-03 00:00'; mknm "$C" '2026-01-04 00:00'
mknm "$SP" '2026-01-05 00:00'; mknm "$D" '2026-01-06 00:00'; mknm "$LK" '2026-01-07 00:00'
mknm "$CX" '2026-01-08 00:00'; mknm "$BZ" '2026-01-09 00:00'; mknm "$OL" '2026-01-10 00:00'
mknm "$FR" '2026-01-11 00:00'; touch "$FR/node_modules/.package-lock.json"        # installation terminée à l'instant
printf 'module.exports = 999;\n' > "$D/node_modules/pkg/index.js"; touch -d '2026-01-06 00:00' "$D/node_modules/pkg/index.js"
ln -s "$A/node_modules" "$SL/node_modules"
git -C "$R" worktree lock "$LK"
(cd "$BZ" && exec sleep 300) & PIDS+=($!)
sleep 0.2

run() { (cd "$R" && bash "$SCRIPT" "$@") ; }

echo "--- 1. dry-run : rien n'est écrit ---"
before="$(snapshot)"
out="$(run 2>&1)"; rc=$?
check "dry-run : code retour" 0 "$rc"
check "dry-run : aucun inode ni nombre de liens modifié" "$before" "$(snapshot)"
check "dry-run : aucune empreinte écrite" 0 "$(find "$R/.git/worktrees" -name node-modules-dedup | wc -l)"
check "dry-run : passes annoncées (b, c, diff, sp ace contre a)" 4 "$(grep -c '^-- ' <<<"$out")"
check "dry-run : aucun état cron enregistré" absent "$( [[ -e "$STATE" ]] && echo présent || echo absent)"

echo "--- 2. --apply ---"
out="$(run --apply 2>&1)"; rc=$?
check "apply : code retour" 0 "$rc"
for w in "$B" "$C" "$SP"; do
  check "fichier identique lié à la référence : ${w#"$FIX"/}" same "$(same "$A/node_modules/pkg/index.js" "$w/node_modules/pkg/index.js")"
done
check "dates différentes ignorées (gros fichier lié)" same "$(same "$A/node_modules/pkg/big.bin" "$D/node_modules/pkg/big.bin")"
check "workspace frontend/node_modules lié" same "$(same "$A/frontend/node_modules/fe/index.js" "$B/frontend/node_modules/fe/index.js")"
check "doublon interne à une copie lié" same "$(same "$B/node_modules/pkg/LICENSE" "$B/frontend/node_modules/fe/LICENSE")"
check "contenu différent jamais lié" distinct "$(same "$A/node_modules/pkg/index.js" "$D/node_modules/pkg/index.js")"
for f in node_modules/.cache/tsc/x.tsbuildinfo node_modules/.vite/deps/_metadata.json \
         frontend/node_modules/.vite-temp/t.mjs node_modules/.package-lock.json; do
  check "jamais partagé : $f" 1 "$(links "$A/$f")"
done
check "checkout principal intact" 1 "$(links "$R/node_modules/pkg/index.js")"
for w in "$LK" "$CX" "$BZ" "$FR" "$OL"; do
  check "intact : ${w#"$FIX"/}" 1 "$(links "$w/node_modules/pkg/index.js")"
done
check "verrouillé signalé" 1 "$(grep -c "^SKIP    locked .*claude-locked$" <<<"$out")"
check "occupé signalé" 1 "$(grep -c "^SKIP    in-use .*claude-busy$" <<<"$out")"
check "installation récente signalée" 1 "$(grep -c "^SKIP    recent-install.*claude-fresh$" <<<"$out")"
check "node_modules en lien symbolique non suivi" symlink "$( [[ -L "$SL/node_modules" ]] && echo symlink || echo autre)"
check "empreintes écrites (a, b, c, diff, sp ace)" 5 "$(find "$R/.git/worktrees" -name node-modules-dedup | wc -l)"
check "état cron : statut, passes, cadence attendue" "ok 4 10800" "$(jq -r '"\(.status) \(.metrics.passes) \(.max_age_s)"' "$STATE" 2>/dev/null)"

echo "--- 3. second passage : rien à refaire ---"
out="$(run --apply 2>&1)"; rc=$?
check "2e passage : code retour" 0 "$rc"
check "2e passage : aucune passe" 0 "$(grep -c '^-- ' <<<"$out")"
check "2e passage : 5 déjà dédoublonnés" 1 "$(grep -c 'déjà-dédoublonnés=5 ' <<<"$out")"

echo "--- 4. référence réinstallée : elle rejoint les inodes du groupe ---"
group_ino="$(ino "$B/node_modules/pkg/index.js")"
rm -rf "$A/node_modules" "$A/frontend/node_modules"; mknm "$A" '2026-02-01 00:00'
check "réinstallation : nouvel inode" distinct "$(same "$A/node_modules/pkg/index.js" "$B/node_modules/pkg/index.js")"
out="$(run --apply 2>&1)"; rc=$?
check "après réinstallation : code retour" 0 "$rc"
check "après réinstallation : une seule passe (a)" 1 "$(grep -c '^-- ' <<<"$out")"
check "a relié à l'inode du groupe" "$group_ino" "$(ino "$A/node_modules/pkg/index.js")"
check "inode du groupe inchangé pour b" "$group_ino" "$(ino "$B/node_modules/pkg/index.js")"

echo "--- 5. exécution concurrente ---"
# Le verrou est tenu par le processus sleep lui-même (exec) : le tuer le libère.
(exec 8>"$TMPDIR/dedup-worktree-node-modules.lock"; flock 8; exec sleep 30) & HOLDER=$!; PIDS+=("$HOLDER")
sleep 0.3
out="$(run --apply 2>&1)"; rc=$?
check "concurrente : code retour" 0 "$rc"
check "concurrente : rien fait" 1 "$(grep -c 'une autre exécution est en cours' <<<"$out")"
check "concurrente : état cron inchangé (3 passages réussis)" 3 "$(jq -r .streak "$STATE" 2>/dev/null)"
kill "$HOLDER"; wait "$HOLDER" 2>/dev/null

echo "--- 6. argument inconnu ---"
run --force >/dev/null 2>&1; check "argument inconnu : code retour" 2 "$?"

echo "--- 7. lien impossible : hardlink sort en 0, le script doit pourtant échouer ---"
RO="$H/claude-readonly"; mkwt "$RO"; mknm "$RO" '2026-03-01 00:00'
chmod a-w "$RO/node_modules/pkg"
out="$(run --apply 2>&1)"; rc=$?
check "lien impossible : code retour" 1 "$rc"
check "lien impossible : échec annoncé" 1 "$(grep -c '^FAIL .*claude-readonly$' <<<"$out")"
check "lien impossible : pas d'empreinte (repassé au prochain tour)" 0 "$(find "$R/.git/worktrees/claude-readonly" -name node-modules-dedup | wc -l)"
check "lien impossible : état cron en erreur" error "$(jq -r .status "$STATE" 2>/dev/null)"
chmod u+w "$RO/node_modules/pkg"
out="$(run --apply 2>&1)"; rc=$?
check "après correction : code retour" 0 "$rc"
check "après correction : lié" same "$(same "$A/node_modules/pkg/index.js" "$RO/node_modules/pkg/index.js")"
check "après correction : état cron revenu à ok" "ok 1" "$(jq -r '"\(.status) \(.streak)"' "$STATE" 2>/dev/null)"

echo
if [[ $FAIL -eq 0 ]]; then echo "TOUS LES CAS PASSENT"; else echo "ÉCHECS — voir ci-dessus"; fi
[[ $FAIL -eq 0 ]]
