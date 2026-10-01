#!/usr/bin/env bash
# Test du hook PreToolUse pretool-worktree-claim.sh sur fixtures jetables.
# Deux « sessions » persistantes simulent deux processus Claude Code : chacune est un
# bash lancé avec argv[0]=claude (exec -a), qui exécute les commandes reçues sur une FIFO ;
# le hook et worktree-claim.sh y sont donc des descendants, comme sous Claude Code.
# SIMULATION : ni Claude Code ni son exécuteur de hooks ne sont exercés ; l'enveloppe est
# celle documentée (code.claude.com/docs/en/hooks, consultée 2026-09-30).
# Usage : bash scripts/claude-hooks/pretool-worktree-claim.test.sh
#   HOOK_ROOT=<racine> : éprouver une autre version (scripts/claude-hooks + scripts/agents).
set -uo pipefail
HERE="${HOOK_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
HOOK="$HERE/scripts/claude-hooks/pretool-worktree-claim.sh"; CLAIM="$HERE/scripts/agents/worktree-claim.sh"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
FIX="$(mktemp -d "${TMPDIR:-/tmp}/wt-claim-hook.XXXXXX")"
declare -A SPID
cleanup() { local s; for s in "${!SPID[@]}"; do kill "${SPID[$s]}" 2>/dev/null; done; rm -rf "$FIX"; }
trap cleanup EXIT
FAIL=0; LIM=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
limit() { if [[ "$2" == "$3" ]]; then echo "  LIMITE — $1 ($3) : contournement constaté, pas une protection"; LIM=$((LIM + 1)); else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }

cat > "$FIX/session-loop.sh" <<'EOF'
#!/usr/bin/env bash
# Processus « session » : exécute chaque ligne « <id> <commande> » de la FIFO $1 ; sortie et code dans $2/<id>.*
exec 3<>"$1"
while IFS=' ' read -r id line <&3; do
  [[ "$id" == quit ]] && exit 0
  eval "$line" >"$2/$id.out" 2>&1; echo $? > "$2/$id.rc.tmp"; mv "$2/$id.rc.tmp" "$2/$id.rc"
done
EOF
start_session() {
  mkfifo "$FIX/$1.fifo"; mkdir -p "$FIX/$1.out"
  ( exec -a claude bash "$FIX/session-loop.sh" "$FIX/$1.fifo" "$FIX/$1.out" ) &
  SPID[$1]=$!
}
# Identifiants de requête et d'enveloppe tirés d'un compteur fichier : les appels passent
# par des substitutions $(…), où un compteur shell serait perdu.
next_id() { local n; n=$(( $(cat "$FIX/seq") + 1 )); echo "$n" > "$FIX/seq"; echo "$n"; }
send() {  # send <session> <commande> -> code de sortie (sortie dans $FIX/last.out)
  local s="$1" id f; id="$(next_id)"; printf '%s %s\n' "$id" "$2" > "$FIX/$s.fifo"
  f="$FIX/$s.out/$id"
  for _ in $(seq 400); do [[ -e "$f.rc" ]] && break; sleep 0.05; done
  cp "$f.out" "$FIX/last.out" 2>/dev/null; cat "$f.rc" 2>/dev/null || echo TIMEOUT
}
stop_session() { printf 'quit -\n' > "$FIX/$1.fifo"; wait "${SPID[$1]}" 2>/dev/null; unset "SPID[$1]"; }
echo 0 > "$FIX/seq"
env_raw() { local f; f="$FIX/e$(next_id).json"; printf '%s' "$1" > "$f"; echo "$f"; }
# env_write <session_id> <chemin> ; env_bash <session_id> <commande> <cwd>
env_write() { env_raw "$(jq -nc --arg s "$1" --arg p "$2" '{session_id:$s,cwd:"/",hook_event_name:"PreToolUse",tool_name:"Write",tool_input:{file_path:$p,content:"x"}}')"; }
env_bash() { env_raw "$(jq -nc --arg s "$1" --arg c "$2" --arg d "$3" '{session_id:$s,cwd:$d,hook_event_name:"PreToolUse",tool_name:"Bash",tool_input:{command:$c}}')"; }
motif() { command grep -qF -- "$1" "$FIX/last.out" && echo "$1" || echo autre; }
hook() { send "$1" "bash '$HOOK' < '$2'"; }

mkrepo() { git init -q -b main "$1"; git -C "$1" config core.hooksPath "$FIX/no-hooks"
  mkdir -p "$1/src"; echo 'x' > "$1/src/a.ts"; git -C "$1" add src && git -C "$1" commit -qm base; }
R="$FIX/repo"; R2="$FIX/repo2"; mkrepo "$R"; mkrepo "$R2"
W1="$FIX/wt-m1"; W2="$FIX/wt-m2"
git -C "$R" worktree add -q -b feat/m1 "$W1"; git -C "$R" worktree add -q -b feat/m2 "$W2"
mkdir -p "$FIX/nogit"
start_session A; start_session B

echo "== attribution et détenteur"
check "C1 A attribue wt-m1 (--pid auto)" 0 "$(send A "bash '$CLAIM' claim --worktree '$W1' --repo '$R' --agent claude --session sess-A --mission m1 --pid auto")"
check "C2 A écrit un nouveau fichier dans wt-m1" 0 "$(hook A "$(env_write sess-A "$W1/src/nouveau/b.ts")")"
check "C3 A lance Bash dans wt-m1" 0 "$(hook A "$(env_bash sess-A 'ls' "$W1/src")")"
echo "== second rédacteur"
check "C4 B écrit dans wt-m1 → refusé" 2 "$(hook B "$(env_write sess-B "$W1/src/a.ts")")"
check "C4 motif : session de l'enveloppe" "session_id de l'enveloppe" "$(motif "session_id de l'enveloppe")"
check "C4b B avec le session_id de A → refusé par le processus" 2 "$(hook B "$(env_write sess-A "$W1/src/a.ts")")"
check "C4b motif : autre session" "autre session" "$(motif "autre session")"
check "C5 B lance Bash dans wt-m1 → refusé" 2 "$(hook B "$(env_bash sess-B 'ls' "$W1/src")")"
check "F3 processus de A, autre session_id (reprise/effacement) → refusé" 2 "$(hook A "$(env_write sess-X "$W1/src/a.ts")")"
check "F3 processus de A, session_id absent → refusé" 2 "$(hook A "$(env_raw '{"cwd":"/","tool_name":"Write","tool_input":{"file_path":"'"$W1"'/src/a.ts"}}')")"
echo "== évasions par le chemin"
mkdir -p "$FIX/nogit/"$'\n'
check "F7 retour à la ligne dans file_path (…/\\n/../../wt-m1) → refusé" 2 "$(hook B "$(env_write sess-B "$FIX/nogit/"$'\n'"/../../wt-m1/src/a.ts")")"
check "F7 retour à la ligne dans cwd (Bash) → refusé" 2 "$(hook B "$(env_bash sess-B 'ls' "$FIX/nogit"$'\n'"$W1")")"
ln -s "$W1/src/a.ts" "$FIX/nogit/lien.ts"
check "S1 lien symbolique hors dépôt vers wt-m1 → refusé" 2 "$(hook B "$(env_write sess-B "$FIX/nogit/lien.ts")")"
git init -q -b main "$W1/imbrique"
check "F5 B écrit dans un dépôt imbriqué dans wt-m1 → refusé" 2 "$(hook B "$(env_write sess-B "$W1/imbrique/x.ts")")"
check "F5 témoin : A (détenteur) y écrit" 0 "$(hook A "$(env_write sess-A "$W1/imbrique/x.ts")")"
git -c protocol.file.allow=always -C "$W1" submodule add -q "$R2" sous-module >/dev/null 2>&1
GD1="$(git -C "$W1" rev-parse --absolute-git-dir)"; SMGD="$(git -C "$W1/sous-module" rev-parse --absolute-git-dir 2>/dev/null)"
check "F5 fixture : gitdir du sous-module sous le dossier privé de wt-m1" oui "$([[ "$SMGD" == "$GD1"/modules/* ]] && echo oui || echo "non ($SMGD)")"
check "F5 B écrit dans un sous-module de wt-m1 → refusé" 2 "$(hook B "$(env_write sess-B "$W1/sous-module/src/a.ts")")"
check "F5 B lance Bash dans le sous-module → refusé" 2 "$(hook B "$(env_bash sess-B 'ls' "$W1/sous-module/src")")"
check "F5 témoin : A écrit dans le sous-module" 0 "$(hook A "$(env_write sess-A "$W1/sous-module/src/a.ts")")"
echo "== dossiers d'administration git"
check "F6 A (détenteur) écrit l'attribution elle-même → refusé" 2 "$(hook A "$(env_write sess-A "$GD1/agent-claim.json")")"
check "F6 B écrit la config du gitdir du sous-module → refusé" 2 "$(hook B "$(env_write sess-B "$SMGD/config")")"
check "F6 B écrit la config du dépôt commun → refusé" 2 "$(hook B "$(env_write sess-B "$R/.git/config")")"
check "F6 témoin : config d'un dépôt sans worktree attribué" 0 "$(hook B "$(env_write sess-B "$R2/.git/config")")"
mkdir -p "$FIX/badgit"; printf 'garbage\n' > "$FIX/badgit/.git"
check "E1 fichier .git illisible → refusé (échec fermé)" 2 "$(hook B "$(env_write sess-B "$FIX/badgit/x.ts")")"
check "E1 motif : état git illisible" "état git illisible" "$(motif "état git illisible")"
echo "== hors portée du hook (autorisé sans avis)"
check "C6 B écrit dans wt-m2 non attribué" 0 "$(hook B "$(env_write sess-B "$W2/src/a.ts")")"
check "C7 B écrit dans le checkout principal" 0 "$(hook B "$(env_write sess-B "$R/src/a.ts")")"
check "C8 B écrit hors dépôt git" 0 "$(hook B "$(env_write sess-B "$FIX/nogit/x.txt")")"
check "C9 outil non concerné (Read)" 0 "$(hook B "$(env_raw '{"session_id":"s","tool_name":"Read","tool_input":{"file_path":"'"$W1"'/src/a.ts"}}')")"
echo "== échec fermé"
check "C10 enveloppe illisible → refusé" 2 "$(hook B "$(env_raw 'pas du json')")"
check "C11 Write sans file_path → refusé" 2 "$(hook B "$(env_raw '{"session_id":"s","tool_name":"Write","tool_input":{}}')")"
GD2="$(git -C "$W2" rev-parse --absolute-git-dir)"; printf '{tronqué' > "$GD2/agent-claim.json"
check "C12 attribution illisible (wt-m2) → refusé" 2 "$(hook B "$(env_write sess-B "$W2/src/a.ts")")"
rm -f "$GD2/agent-claim.json"
echo "== contournement connu"
limit "C13 B écrit dans wt-m1 par Bash depuis un autre cwd" 0 "$(hook B "$(env_bash sess-B "echo x > '$W1/src/a.ts'" "$FIX/nogit")")"
echo "== transfert A → B"
check "C14 A cède (handoff) à B" 0 "$(send A "bash '$CLAIM' handoff --worktree '$W1' --agent claude --session sess-A --mission m1 --to-agent claude --to-session sess-B --tests 'fixture' --risks 'aucun'")"
check "C15 A n'écrit plus après son transfert" 2 "$(hook A "$(env_write sess-A "$W1/src/a.ts")")"
check "C16 B ne reprend pas tant que A vit (non confirmé)" 5 "$(send B "bash '$CLAIM' takeover --worktree '$W1' --repo '$R' --agent claude --session sess-B --mission m1 --pid auto")"
stop_session A
check "C17 B reprend après l'arrêt de A" 0 "$(send B "bash '$CLAIM' takeover --worktree '$W1' --repo '$R' --agent claude --session sess-B --mission m1 --pid auto")"
check "C18 B écrit dans wt-m1" 0 "$(hook B "$(env_write sess-B "$W1/src/a.ts")")"
check "F3 processus de B, ancien session_id (sess-A) → refusé" 2 "$(hook B "$(env_write sess-A "$W1/src/a.ts")")"
echo "== revalidation à chaque appel"
git -C "$W1" switch -q -c autre-branche
check "C19 référence changée depuis l'attribution → refusé" 2 "$(hook B "$(env_write sess-B "$W1/src/a.ts")")"
git -C "$W1" switch -q feat/m1
ln -s "$FIX/nogit" "$W1/src/sortant"
check "C20 lien sortant apparu après l'attribution → refusé" 2 "$(hook B "$(env_write sess-B "$W1/src/a.ts")")"
rm "$W1/src/sortant"
check "C21 état rétabli → autorisé" 0 "$(hook B "$(env_write sess-B "$W1/src/a.ts")")"

echo "== coût (fixture, 20 appels du hook dans un worktree attribué, mesurés dans la session)"
E="$(env_write sess-B "$W1/src/a.ts")"
send B "t0=\$(date +%s%N); for _ in \$(seq 20); do bash '$HOOK' < '$E' || exit 9; done; echo \$(( (\$(date +%s%N) - t0) / 20000000 ))" >/dev/null
echo "   moyenne : $(cat "$FIX/last.out") ms par appel (hook autorisé ; ordre de grandeur, machine partagée)"
stop_session B

echo
if [[ $FAIL -ne 0 ]]; then echo "TESTS EN ÉCHEC"; exit 1; fi
echo "TOUS LES TESTS PASSENT ($LIM limite(s) documentée(s), non comptée(s) comme protection)"
