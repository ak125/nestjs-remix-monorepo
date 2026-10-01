#!/usr/bin/env bash
# Test de worktree-claim.sh sur des dépôts FIXTURE jetables (jamais le dépôt réel).
#
# Couvre : isolation native de deux worktrees (A), acquisitions concurrentes (B),
# refus avant écriture — dépôt, chemin, alias, référence, lien sortant, attribution
# périmée, même identité depuis un autre processus (C), reprise après crash ou transfert
# sans perte (F), idempotence et absence de résidu (G), libération par le seul processus
# détenteur (L), absence de secret dans les métadonnées (K), --pid limité à l'appelant et
# à ses ancêtres (pid), verrou interne honoré (V), reprises et attributions simultanées sur
# un détenteur mort (R).
#
# Détenteurs : le shell de test ($$, ancêtre de chaque appel direct) et des « sessions »
# — processus durables qui exécutent comme leurs enfants les commandes reçues sur une
# FIFO, donc ancêtres de l'outil comme un agent réel. Ce test prouve le comportement de
# l'OUTIL. Il ne prouve pas qu'un agent réel l'appelle : l'outil est coopératif, pas une
# barrière d'écriture.
set -uo pipefail

TOOL="${CLAIM_TOOL:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/worktree-claim.sh}"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/wt-claim-test.XXXXXX")"
ROUNDS="${ROUNDS:-30}"; RACERS="${RACERS:-20}"; TK_ROUNDS="${TK_ROUNDS:-10}"
FAIL=0

cleanup() { [[ -f "$FIX/pids" ]] && while read -r p; do kill -KILL "$p" 2>/dev/null || true; done < "$FIX/pids"; rm -rf "$FIX"; }
trap cleanup EXIT

check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
rc() { local r=0; "$@" >/dev/null 2>&1 || r=$?; echo "$r"; }
why() { # why <motif> <commande...> -> « code|motif » si stderr contient le motif, « code|autre » sinon
  local m="$1" out r=0; shift; out="$("$@" 2>&1 >/dev/null)" || r=$?
  if [[ "$out" == *"$m"* ]]; then echo "$r|$m"; else echo "$r|autre"; fi
}
spawn_in() { # spawn_in <dir> -> PID d'un processus fixture (le nôtre) dont le cwd est <dir>
  (cd "$1" && exec sleep 600) </dev/null >/dev/null 2>&1 &
  echo "$!" >> "$FIX/pids"; echo "$!"
}
reap() { # termine le processus fixture et attend qu'il ait disparu de /proc (échec bruyant sinon)
  kill "$1" 2>/dev/null || true; kill -CONT "$1" 2>/dev/null || true
  for _ in $(seq 200); do kill -0 "$1" 2>/dev/null || return 0; sleep 0.05; done
  echo "  ÉCHEC — processus fixture $1 toujours présent après 10 s"; FAIL=1
}
gd() { git -C "$1" rev-parse --absolute-git-dir; }
locked() { git -C "$R" worktree list --porcelain -z | tr '\0' '\n' | awk -v p="$1" '$0=="worktree "p{f=1;next} /^worktree /{f=0} f&&/^locked/{l=1} END{print l?"locked":"unlocked"}'; }
claim_field() { jq -r "$2" "$(gd "$1")/agent-claim.json" 2>/dev/null || echo none; }
last_event() { jq -r "select(.event==\"$2\") | $3" "$(gd "$1")/agent-claim.log" 2>/dev/null | tail -1; }

# Sessions : processus détachés du shell de test (double fork), cwd = $FIX, argv[0] = codex
# ou claude. Chaque ligne « <id> <commande> » de la FIFO s'exécute comme enfant ; $$ y
# vaut le pid de la session.
cat > "$FIX/session-loop.sh" <<'EOF'
exec 3<>"$1"
while IFS=' ' read -r id line <&3; do
  eval "$line" >"$2/$id.out" 2>&1 </dev/null; echo $? > "$2/$id.rc.tmp"; mv "$2/$id.rc.tmp" "$2/$id.rc"
done
EOF
start_session() { # start_session <nom> [argv0] ; pid dans $FIX/<nom>.pid
  mkfifo "$FIX/$1.fifo"; mkdir -p "$FIX/$1.out"
  ( (cd "$FIX" && exec -a "${2:-codex}" bash "$FIX/session-loop.sh" "$FIX/$1.fifo" "$FIX/$1.out") </dev/null >/dev/null 2>&1 &
    echo "$!" > "$FIX/$1.pid" )
  cat "$FIX/$1.pid" >> "$FIX/pids"
}
spid() { cat "$FIX/$1.pid"; }
say() { # say <session> <commande> -> code de sortie ; sortie dans $FIX/<session>.last
  local s="$1" id f; id="$BASHPID-$(date +%s%N)"; printf '%s %s\n' "$id" "$2" > "$FIX/$s.fifo"
  f="$FIX/$s.out/$id"
  for _ in $(seq 400); do [[ -e "$f.rc" ]] && break; sleep 0.05; done
  cp "$f.out" "$FIX/$s.last" 2>/dev/null; cat "$f.rc" 2>/dev/null || echo TIMEOUT
}
saywhy() { # saywhy <motif> <session> <commande> -> « code|motif » ou « code|autre »
  local r; r="$(say "$2" "$3")"
  if grep -qF -- "$1" "$FIX/$2.last" 2>/dev/null; then echo "$r|$1"; else echo "$r|autre"; fi
}

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid

mkrepo() { git init -q -b main "$1"; git -C "$1" config core.hooksPath "$FIX/no-hooks"
  printf '.claude/worktrees/\n' > "$1/.gitignore"; printf 'base\n' > "$1/a.txt"
  git -C "$1" add .gitignore a.txt; git -C "$1" commit -qm base; }
R="$FIX/repo"; R2="$FIX/other-repo"; WT="$R/.claude/worktrees"
mkrepo "$R"; mkrepo "$R2"
BASE="$(git -C "$R" rev-parse HEAD)"
git -C "$R" worktree add -q -b feat/a "$WT/a" main
git -C "$R" worktree add -q -b feat/b "$WT/b" main
HOLDER=$$
C=(bash "$TOOL"); T="bash '$TOOL'"

echo "Outil testé : $TOOL"
echo "Fixture     : $FIX"

# ---------------- A. deux missions : fichiers, index, commits distincts ----------------
echo "[A] isolation native de deux worktrees"
printf 'mission-a\n' > "$WT/a/only-a.txt"; git -C "$WT/a" add only-a.txt; git -C "$WT/a" commit -qm "a"
printf 'mission-b\n' > "$WT/b/staged-b.txt"; git -C "$WT/b" add staged-b.txt
check "A : le commit de a n'apparaît pas dans b"          no "$(git -C "$WT/b" log --format=%s | grep -qx a && echo yes || echo no)"
check "A : le fichier indexé de b n'apparaît pas dans a"  no "$(git -C "$WT/a" status --porcelain | grep -q staged-b && echo yes || echo no)"
check "A : index distincts"                               distinct "$([[ "$(gd "$WT/a")/index" != "$(gd "$WT/b")/index" ]] && echo distinct || echo same)"
check "A : le fichier de a absent du disque de b"         absent "$([[ -e "$WT/b/only-a.txt" ]] && echo present || echo absent)"

# ---------------- B. acquisitions concurrentes ----------------
echo "[B] $RACERS acquisitions simultanées × $ROUNDS tours"
bad=0; winners_total=0
for round in $(seq 1 "$ROUNDS"); do
  rm -rf "$FIX/race"; mkdir -p "$FIX/race"; racers=()
  for i in $(seq 1 "$RACERS"); do
    ( r=0; "${C[@]}" claim --worktree "$WT/a" --repo "$R" --agent codex --session "s$i" --mission m-race \
        --pid "$BASHPID" >/dev/null 2>&1 || r=$?; echo "$r" > "$FIX/race/$i" ) &
    racers+=("$!")
  done
  wait "${racers[@]}"
  ok="$(grep -lx 0 "$FIX"/race/* | wc -l)"; lost="$(grep -lx 3 "$FIX"/race/* | wc -l)"
  winner="$(claim_field "$WT/a" .session)"
  if [[ "$ok" != 1 || "$lost" != $((RACERS-1)) || "$FIX/race/${winner#s}" != "$(grep -lx 0 "$FIX"/race/*)" ]]; then
    bad=$((bad+1)); echo "    tour $round : gagnants=$ok perdants=$lost détenteur=$winner"
  fi
  winners_total=$((winners_total+ok))
  # Le processus gagnant est terminé : même identité, autre processus, aucun cwd dans le worktree.
  [[ "$(rc "${C[@]}" release --worktree "$WT/a" --agent codex --session "$winner" --mission m-race --pid "$HOLDER")" == 0 ]] \
    || { bad=$((bad+1)); echo "    tour $round : libération après la fin du détenteur refusée"; }
done
check "B : exactement 1 détenteur par tour, les autres refusés (code 3), libération ensuite" 0 "$bad"
check "B : total des gagnants = nombre de tours" "$ROUNDS" "$winners_total"
check "B : aucun fichier temporaire résiduel" 0 "$(find "$(gd "$WT/a")" -maxdepth 1 -name '.agent-claim.*' | wc -l)"
check "B : worktree déverrouillé après libération" unlocked "$(locked "$WT/a")"

# ---------------- C. refus avant écriture ----------------
echo "[C] refus avant écriture"
nores() { [[ ! -e "$(gd "$1")/agent-claim.json" && "$(locked "$1")" == unlocked ]] && echo clean || echo residue; }
check "C : mauvais dépôt (code 4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/a" --repo "$R2" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : mauvais dépôt — aucun résidu" clean "$(nores "$WT/a")"
mkdir -p "$WT/a/sub"
check "C : sous-dossier au lieu de la racine (4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/a/sub" --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
ln -s "$WT/a" "$FIX/alias-a"
check "C : alias par lien symbolique (4)" 4 "$(rc "${C[@]}" claim --worktree "$FIX/alias-a" --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : chemin relatif (4)" 4 "$(cd "$R" && rc "${C[@]}" claim --worktree .claude/worktrees/a --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : checkout principal (4)" 4 "$(rc "${C[@]}" claim --worktree "$R" --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
git -C "$R" worktree add -q --detach "$WT/detached" main
check "C : HEAD détachée (4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/detached" --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
git -C "$R" worktree add -q -b master "$WT/master" main
check "C : branche master (4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/master" --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : mauvaise référence attendue (4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/a" --repo "$R" --ref feat/b --agent codex --session s1 --mission m1 --pid "$HOLDER")"
printf 'autre\n' > "$R2/b.txt"; git -C "$R2" add b.txt; git -C "$R2" commit -qm autre
other="$(git -C "$R2" rev-parse HEAD)"  # absent du dépôt R (les commits « base » sont identiques)
check "C : commit de départ étranger (4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/a" --repo "$R" --start-sha "$other" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : après tous ces refus — aucun résidu" clean "$(nores "$WT/a")"
# Lien sortant (comme backend/.env -> checkout principal) : faux secret, jamais un vrai.
git -C "$R" worktree add -q -b feat/link "$WT/link" main
printf 'FAKE_SECRET=fixture-not-a-real-secret-7f3c\n' > "$FIX/fake-main.env"
mkdir -p "$WT/link/backend"; ln -s "$FIX/fake-main.env" "$WT/link/backend/.env"
check "C : lien sortant du worktree refusé (4)" 4 "$(rc "${C[@]}" claim --worktree "$WT/link" --repo "$R" --agent codex --session s1 --mission m-link --pid "$HOLDER")"
check "C : lien sortant accepté seulement explicitement (0)" 0 "$(rc "${C[@]}" claim --worktree "$WT/link" --repo "$R" --agent codex --session s1 --mission m-link --pid "$HOLDER" --allow-outbound-symlinks)"
check "C : lien accepté consigné dans l'attribution" '["backend/.env"]' "$(jq -c .accepted_outbound_symlinks "$(gd "$WT/link")/agent-claim.json")"
check "K : faux secret absent des métadonnées d'attribution" 0 "$(grep -rl 'fixture-not-a-real-secret' "$(gd "$WT/link")" | wc -l)"
ln -s "$FIX/fake-main.env" "$WT/link/second-link"
check "C : check refuse un nouveau lien sortant apparu après l'attribution (4)" "4|liens sortants" "$(why "liens sortants" "${C[@]}" check --worktree "$WT/link" --agent codex --session s1 --mission m-link --pid "$HOLDER")"
rm "$WT/link/second-link"
# Attribution valide puis dérives
check "C : claim valide (0)" 0 "$(rc "${C[@]}" claim --worktree "$WT/a" --repo "$R" --ref feat/a --start-sha "$BASE" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : check par le processus détenteur (0)" 0 "$(rc "${C[@]}" check --worktree "$WT/a" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "C : check par une autre session (4)" 4 "$(rc "${C[@]}" check --worktree "$WT/a" --agent codex --session s2 --mission m1 --pid "$HOLDER")"
start_session O
check "C : même identité, autre processus vivant — check (4)" "4|autre session" "$(saywhy "autre session" O "$T check --worktree '$WT/a' --agent codex --session s1 --mission m1 --pid \$\$")"
check "C : même identité, autre processus vivant — claim (3)" "3|autre processus" "$(saywhy "autre processus" O "$T claim --worktree '$WT/a' --repo '$R' --agent codex --session s1 --mission m1 --pid \$\$")"
check "C : détenteur inchangé après ce refus" "$HOLDER" "$(claim_field "$WT/a" .holder.pid)"
check "C : second rédacteur refusé (3)" 3 "$(rc "${C[@]}" claim --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission m1 --pid "$HOLDER")"
git -C "$WT/a" switch -q -c feat/drift
check "C : check après changement de branche (4)" 4 "$(rc "${C[@]}" check --worktree "$WT/a" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
git -C "$WT/a" switch -q feat/a; git -C "$R" branch -q -D feat/drift
check "C : check après retour sur la branche (0)" 0 "$(rc "${C[@]}" check --worktree "$WT/a" --agent codex --session s1 --mission m1 --pid "$HOLDER")"

# ---------------- G. idempotence ----------------
echo "[G] idempotence"
check "G : même attribution redemandée par le même processus (0)" 0 "$(rc "${C[@]}" claim --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "G : un seul événement claim pour cette attribution" 1 "$(jq -c 'select(.event=="claim" and .session=="s1" and .mission=="m1")' "$(gd "$WT/a")/agent-claim.log" | wc -l)"
check "G : marqueur natif posé une fois" locked "$(locked "$WT/a")"
check "G : raison du marqueur explicite" yes "$(git -C "$R" worktree list --porcelain -z | tr '\0' '\n' | grep -q "pas un verrou d'écriture" && echo yes || echo no)"

# ---------------- L. libération ----------------
echo "[L] libération"
check "L : libération par une autre identité refusée (3)" 3 "$(rc "${C[@]}" release --worktree "$WT/a" --agent claude --session c1 --mission m1 --pid "$HOLDER")"
check "L : même identité, autre processus, détenteur vivant (3)" "3|seul le processus détenteur" "$(saywhy "seul le processus détenteur" O "$T release --worktree '$WT/a' --agent codex --session s1 --mission m1 --pid \$\$")"
check "L : attribution intacte après ces refus" "s1/$HOLDER" "$(claim_field "$WT/a" '"\(.session)/\(.holder.pid)"')"
check "L : libération par le processus détenteur (0)" 0 "$(rc "${C[@]}" release --worktree "$WT/a" --agent codex --session s1 --mission m1 --pid "$HOLDER")"
check "L : libérateur consigné" holder "$(last_event "$WT/a" release .released_by)"
check "L : marqueur retiré (posé par l'outil)" unlocked "$(locked "$WT/a")"
git -C "$R" worktree lock --reason "verrou manuel préexistant" "$WT/b"
"${C[@]}" claim --worktree "$WT/b" --repo "$R" --agent codex --session s9 --mission m9 --pid "$HOLDER" >/dev/null 2>&1
"${C[@]}" release --worktree "$WT/b" --agent codex --session s9 --mission m9 --pid "$HOLDER" >/dev/null 2>&1
check "L : un verrou préexistant n'est pas retiré par release" locked "$(locked "$WT/b")"
git -C "$R" worktree unlock "$WT/b"

# ---------------- F. reprise après crash ----------------
echo "[F] reprise après crash"
start_session H1
say H1 "$T claim --worktree '$WT/a' --repo '$R' --agent codex --session s1 --mission m-crash --pid \$\$" >/dev/null
printf 'travail non commité\n' >> "$WT/a/only-a.txt"; printf 'nouveau\n' > "$WT/a/untracked-work.txt"
before="$(cd "$WT/a" && sha256sum only-a.txt untracked-work.txt; git -C "$WT/a" status --porcelain)"
check "F : reprise refusée, détenteur vivant (5)" 5 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission m-crash --pid "$HOLDER")"
CHILD="$(spawn_in "$WT/a")"; reap "$(spid H1)"
check "F : détenteur mort mais processus actif dans le worktree (5)" 5 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission m-crash --pid "$HOLDER")"
reap "$CHILD"
cp "$(gd "$WT/a")/agent-claim.json" "$FIX/claim.bak"
jq -c '.holder.host="autre-machine"' "$FIX/claim.bak" > "$(gd "$WT/a")/agent-claim.json"
check "F : détenteur sur une autre machine (5)" 5 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission m-crash --pid "$HOLDER")"
check "F : HOSTNAME falsifié ne ramène pas la machine distante ici (5)" 5 "$(rc env HOSTNAME=autre-machine "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission m-crash --pid "$HOLDER")"
cp "$FIX/claim.bak" "$(gd "$WT/a")/agent-claim.json"
check "F : mauvaise mission (4)" 4 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission autre --pid "$HOLDER")"
rm -rf "$FIX/tk"; mkdir -p "$FIX/tk"; tks=()
for i in $(seq 1 10); do start_session "tk$i" claude; done
for i in $(seq 1 10); do
  ( say "tk$i" "$T takeover --worktree '$WT/a' --repo '$R' --agent claude --session tk$i --mission m-crash --pid \$\$" > "$FIX/tk/tk$i" ) &
  tks+=("$!")
done
wait "${tks[@]}"
check "F : 10 reprises simultanées → 1 seule réussit" 1 "$(grep -lx 0 "$FIX"/tk/* | wc -l)"
winner="$(claim_field "$WT/a" .session)"
check "F : le gagnant consigné est le processus qui a réussi" "$FIX/tk/$winner" "$(grep -lx 0 "$FIX"/tk/*)"
check "F : les perdants refusés (3 ou 5), jamais une autre erreur" 0 "$(grep -Lx '[035]' "$FIX"/tk/* | wc -l)"
check "F : mode consigné" crash "$(claim_field "$WT/a" .previous.takeover_mode)"
after="$(cd "$WT/a" && sha256sum only-a.txt untracked-work.txt; git -C "$WT/a" status --porcelain)"
check "F : travail non commité intact après reprise" same "$([[ "$before" == "$after" ]] && echo same || echo changed)"
check "C : l'ancien détenteur est désormais périmé (4)" 4 "$(rc "${C[@]}" check --worktree "$WT/a" --agent codex --session s1 --mission m-crash --pid "$HOLDER")"
check "L : identité du gagnant depuis un autre processus, gagnant vivant (3)" 3 "$(rc "${C[@]}" release --worktree "$WT/a" --agent claude --session "$winner" --mission m-crash --pid "$HOLDER")"
for i in $(seq 1 10); do reap "$(spid "tk$i")"; done
check "L : même identité après la fin du processus détenteur (0)" 0 "$(rc "${C[@]}" release --worktree "$WT/a" --agent claude --session "$winner" --mission m-crash --pid "$HOLDER")"
check "L : libération consignée comme posthume" same-identity-after-holder-exit "$(last_event "$WT/a" release .released_by)"
# PID réutilisé : même numéro, autre date de démarrage → mort
start_session H2
say H2 "$T claim --worktree '$WT/a' --repo '$R' --agent codex --session s1 --mission m-reuse --pid \$\$" >/dev/null
jq -c '.holder.pid_start="1"' "$(gd "$WT/a")/agent-claim.json" > "$FIX/c.json" && cp "$FIX/c.json" "$(gd "$WT/a")/agent-claim.json"
check "F : PID réutilisé (autre starttime) = détenteur mort (0)" 0 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent claude --session c1 --mission m-reuse --pid "$HOLDER")"
"${C[@]}" release --worktree "$WT/a" --agent claude --session c1 --mission m-reuse --pid "$HOLDER" >/dev/null; reap "$(spid H2)"

# ---------------- F. transfert explicite ----------------
echo "[F] transfert explicite"
start_session H3 claude
say H3 "$T claim --worktree '$WT/a' --repo '$R' --agent claude --session c1 --mission m-hand --pid \$\$" >/dev/null
check "F : handoff par une autre identité refusé (3)" 3 "$(rc "${C[@]}" handoff --worktree "$WT/a" --agent codex --session s1 --mission m-hand --to-agent codex --pid "$HOLDER")"
check "F : handoff avec l'identité du détenteur depuis un autre processus (3)" "3|seul le processus détenteur" "$(why "seul le processus détenteur" "${C[@]}" handoff --worktree "$WT/a" --agent claude --session c1 --mission m-hand --to-agent codex --pid "$HOLDER")"
check "F : handoff par le processus détenteur (0)" 0 "$(say H3 "$T handoff --worktree '$WT/a' --agent claude --session c1 --mission m-hand --to-agent codex --tests 'fixture: 3 ok' --risks aucun --resources aucune --pid \$\$")"
check "F : l'ancien détenteur ne peut plus écrire (check 4)" 4 "$(say H3 "$T check --worktree '$WT/a' --agent claude --session c1 --mission m-hand --pid \$\$")"
check "F : transfert destiné à un autre agent (4)" 4 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent hermes --session h1 --mission m-hand --pid "$HOLDER")"
check "F : détenteur en exécution, confirmation fournie → refusée (5)" "5|s'exécute encore" "$(why "s'exécute encore" "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m-hand --pid "$HOLDER" --holder-suspended-confirmed-by owner)"
check "F : détenteur en exécution, sans confirmation (5)" 5 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m-hand --pid "$HOLDER")"
kill -STOP "$(spid H3)"
printf 'écriture après transfert\n' >> "$WT/a/untracked-work.txt"
check "F : état modifié après transfert → reprise refusée (5)" 5 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m-hand --pid "$HOLDER" --holder-suspended-confirmed-by owner)"
sed -i '$d' "$WT/a/untracked-work.txt"
check "F : détenteur suspendu, sans confirmation (5)" "5|confirmation nominative" "$(why "confirmation nominative" "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m-hand --pid "$HOLDER")"
CHILD="$(spawn_in "$WT/a")"
check "F : processus en exécution dans le worktree, confirmation fournie (5)" "5|en cours d'exécution" "$(why "en cours d'exécution" "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m-hand --pid "$HOLDER" --holder-suspended-confirmed-by owner)"
kill -STOP "$CHILD"
check "F : tout suspendu + état intact + confirmation nominative (0)" 0 "$(rc "${C[@]}" takeover --worktree "$WT/a" --repo "$R" --agent codex --session s1 --mission m-hand --pid "$HOLDER" --holder-suspended-confirmed-by owner)"
check "F : confirmation consignée" owner "$(claim_field "$WT/a" .previous.suspension_confirmed_by)"
check "F : résultats de tests transmis" "fixture: 3 ok" "$(claim_field "$WT/a" .previous.handoff.tests)"
check "F : détenteur vivant (suspendu) consigné" true "$(claim_field "$WT/a" .previous.holder_alive_at_takeover)"
check "F : processus suspendu du worktree consigné" "$CHILD" "$(claim_field "$WT/a" .previous.cwd_processes_at_takeover | tr -d ' ')"
reap "$CHILD"; reap "$(spid H3)"
"${C[@]}" release --worktree "$WT/a" --agent codex --session s1 --mission m-hand --pid "$HOLDER" >/dev/null

# ---------------- V. verrou interne ----------------
echo "[V] verrou interne honoré"
lockf="$(gd "$WT/b")/agent-claim.lock"
( flock "$lockf" -c "touch '$FIX/v.started'; sleep 2" ) &
vp=$!
for _ in $(seq 100); do [[ -e "$FIX/v.started" ]] && break; sleep 0.02; done
t0=$(date +%s%N)
r="$(rc "${C[@]}" claim --worktree "$WT/b" --repo "$R" --agent codex --session s1 --mission m-lock --pid "$HOLDER")"
ms=$(( ($(date +%s%N) - t0) / 1000000 )); wait "$vp"
check "V : claim attend le verrou tenu par un autre appel (≥ 1500 ms)" "0|attendu" "$r|$([[ $ms -ge 1500 ]] && echo attendu || echo "immédiat ${ms} ms")"
"${C[@]}" release --worktree "$WT/b" --agent codex --session s1 --mission m-lock --pid "$HOLDER" >/dev/null 2>&1

# ---------------- --pid ----------------
echo "[pid] identification du processus agent"
out="$FIX/auto.rc"
setsid --fork bash -c "cd /; r=0; bash '$TOOL' claim --worktree '$WT/b' --repo '$R' --agent codex --session s1 --mission m-auto --pid auto >/dev/null 2>&1 || r=\$?; echo \$r > '$out'" </dev/null >/dev/null 2>&1
for _ in $(seq 1 50); do [[ -s "$out" ]] && break; sleep 0.1; done
check "pid : aucun ancêtre claude/codex → refus explicite (2)" 2 "$(cat "$out" 2>/dev/null || echo none)"
start_session P codex
check "pid : --pid auto dans une session « codex » (0)" 0 "$(say P "$T claim --worktree '$WT/b' --repo '$R' --agent codex --session s1 --mission m-auto --pid auto")"
check "pid : ancêtre « codex » détecté et consigné" "$(spid P)" "$(claim_field "$WT/b" .holder.pid)"
check "pid : --pid d'un processus non ancêtre refusé (4)" "4|ni l'appelant" "$(why "ni l'appelant" "${C[@]}" check --worktree "$WT/b" --agent codex --session s1 --mission m-auto --pid "$(spid P)")"
start_session Q codex
check "pid : check sans --pid = --pid auto, depuis une autre session « codex » (4)" "4|autre session" "$(saywhy "autre session" Q "$T check --worktree '$WT/b' --agent codex --session s1 --mission m-auto")"
check "pid : check sans --pid depuis la session détentrice (0)" 0 "$(say P "$T check --worktree '$WT/b' --agent codex --session s1 --mission m-auto")"
say P "$T release --worktree '$WT/b' --agent codex --session s1 --mission m-auto --pid \$\$" >/dev/null
reap "$(spid P)"; reap "$(spid Q)"

# ---------------- R. reprises + attributions simultanées sur un détenteur mort ----------------
echo "[R] 8 reprises + 8 attributions simultanées sur un détenteur mort × $TK_ROUNDS tours"
git -C "$R" worktree add -q -b feat/race "$WT/race" main
for i in $(seq 1 8); do start_session "t$i" claude; start_session "k$i" codex; done
bad=0
for round in $(seq 1 "$TK_ROUNDS"); do
  start_session "hr$round"
  say "hr$round" "$T claim --worktree '$WT/race' --repo '$R' --agent codex --session hr$round --mission m-stress --pid \$\$" >/dev/null
  reap "$(spid "hr$round")"
  rm -rf "$FIX/st"; mkdir -p "$FIX/st"; cs=()
  for i in $(seq 1 8); do
    ( say "t$i" "$T takeover --worktree '$WT/race' --repo '$R' --agent claude --session t$i --mission m-stress --pid \$\$" > "$FIX/st/t$i" ) &
    cs+=("$!")
    ( say "k$i" "$T claim --worktree '$WT/race' --repo '$R' --agent codex --session k$i --mission m-stress --pid \$\$" > "$FIX/st/k$i" ) &
    cs+=("$!")
  done
  wait "${cs[@]}"
  nwin="$(grep -lx 0 "$FIX"/st/* | wc -l)"; holder="$(claim_field "$WT/race" .session)"
  resid="$(find "$(gd "$WT/race")" -maxdepth 1 -name '.agent-claim.*' | wc -l)"
  # Seule une reprise peut gagner : l'attribution ne disparaît jamais pendant une reprise.
  if [[ "$nwin" != 1 || "$(grep -lx 0 "$FIX"/st/*)" != "$FIX/st/$holder" || "$holder" != t* || "$resid" != 0 ]]; then
    bad=$((bad+1))
    echo "    tour $round : gagnants=$nwin détenteur=$holder résidus=$resid codes=$(cd "$FIX/st" && for f in *; do printf '%s=%s ' "$f" "$(cat "$f")"; done)"
  fi
  # Remise à zéro : le détenteur enregistré libère (session vivante ou, à défaut, même identité).
  if [[ -f "$FIX/$holder.pid" ]] && kill -0 "$(spid "$holder")" 2>/dev/null; then
    say "$holder" "$T release --worktree '$WT/race' --agent $(claim_field "$WT/race" .agent) --session $holder --mission m-stress --pid \$\$" >/dev/null
  elif [[ "$holder" != none ]]; then
    "${C[@]}" release --worktree "$WT/race" --agent "$(claim_field "$WT/race" .agent)" --session "$holder" --mission m-stress --pid "$HOLDER" >/dev/null 2>&1
  fi
done
check "R : 1 seul gagnant par tour, toujours une reprise, sans résidu" 0 "$bad"

check "journal : événements JSONL lisibles" 0 "$(jq -e . "$(gd "$WT/a")/agent-claim.log" >/dev/null 2>&1; echo $?)"
if [[ "$FAIL" == "0" ]]; then echo "TOUS LES TESTS PASSENT"; else echo "TESTS EN ÉCHEC"; fi
exit "$FAIL"
