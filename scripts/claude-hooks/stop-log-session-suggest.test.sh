#!/usr/bin/env bash
# Test du hook Stop stop-log-session-suggest.sh sur fixtures jetables : origine nue +
# clone + faux `gh` (aucun appel réseau). Les attendus sont ceux du correctif ; lancé
# contre la version de base (HOOK=<copie de base>), les lignes en ÉCHEC montrent le défaut.
#
# Harnais : le hook est copié dans la fixture. Si la copie écrit dans le fichier partagé
# /tmp/.session-log-commit-err (version de base), ce chemin est redirigé vers la fixture
# (sed, seule modification). Le cas « hors dépôt git » n'est PAS exécuté contre une
# version qui se replie vers un checkout codé en dur : il écrirait dans ce checkout.
# Ailleurs, ce cas passe par un git factice qui refuse tout sauf `rev-parse` et note
# chaque appel : un repli vers un autre dépôt, quel qu'il soit, apparaît dans la note.
#
# La fixture porte des compagnons factices (rotate-log.sh, stop-claude-md-suggest.sh),
# inactifs par défaut : ROTATE=1 ajoute une ligne à l'archive ; COMPANION_STAGE=1 indexe
# un autre fichier pendant l'exécution du hook (concurrence sur l'index).
#
# Usage : [HOOK=<script>] bash scripts/claude-hooks/stop-log-session-suggest.test.sh
set -uo pipefail
HOOK_SRC="${HOOK:-$(cd "$(dirname "$0")" && pwd)/stop-log-session-suggest.sh}"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
FIX="$(mktemp -d "${TMPDIR:-/tmp}/stop-log-test.XXXXXX")"
trap 'rm -rf "$FIX"' EXIT
FAIL=0; SKIP=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
skip() { echo "  NON EXÉCUTÉ — $1 : $2"; SKIP=$((SKIP + 1)); }

HOOK="$FIX/hook.sh"
sed "s|/tmp/.session-log-commit-err|$FIX/commit.err|" "$HOOK_SRC" > "$HOOK"
echo "== hook : $(sha256sum "$HOOK_SRC" | cut -c1-12) $(basename "$HOOK_SRC")"
if cmp -s "$HOOK_SRC" "$HOOK"; then echo "   harnais : copie identique"; else echo "   harnais : /tmp/.session-log-commit-err redirigé vers la fixture"; fi

# Faux gh : `pr list --head B --state open|all --json … --jq E` sur FAKE_GH_PRS (JSON).
mkdir -p "$FIX/bin" "$FIX/hooks-fail"
cat > "$FIX/bin/gh" <<'EOF'
#!/usr/bin/env bash
[[ "${FAKE_GH_FAIL:-0}" == 1 ]] && { echo "gh: échec simulé" >&2; exit 1; }
state=all; jqexpr=.
while [[ $# -gt 0 ]]; do case "$1" in --state) state="$2"; shift 2 ;; --jq) jqexpr="$2"; shift 2 ;; *) shift ;; esac; done
prs="${FAKE_GH_PRS:-[]}"
[[ $state == open ]] && prs="$(jq -c '[.[] | select(.state == "OPEN")]' <<< "$prs")"
jq -r "$jqexpr" <<< "$prs"
EOF
chmod +x "$FIX/bin/gh"
printf '#!/bin/sh\nexit 1\n' > "$FIX/hooks-fail/pre-commit"; chmod +x "$FIX/hooks-fail/pre-commit"

git init -q --bare -b main "$FIX/origin.git"
git clone -q "$FIX/origin.git" "$FIX/seed" 2>/dev/null
git -C "$FIX/seed" config core.hooksPath "$FIX/no-hooks"
printf '# log\n' > "$FIX/seed/log.md"
mkdir -p "$FIX/seed/scripts/claude-hooks"
printf '#!/usr/bin/env bash\n[ "${ROTATE:-0}" = 1 ] && printf "rotated\\n" >> "$2"\nexit 0\n' > "$FIX/seed/scripts/claude-hooks/rotate-log.sh"
printf '#!/usr/bin/env bash\nif [ "${COMPANION_STAGE:-0}" = 1 ]; then echo tiers > companion.txt; git add companion.txt; fi\nexit 0\n' > "$FIX/seed/scripts/claude-hooks/stop-claude-md-suggest.sh"
chmod +x "$FIX/seed/scripts/claude-hooks/"*.sh
git -C "$FIX/seed" add log.md scripts; git -C "$FIX/seed" commit -qm base
git -C "$FIX/seed" push -q origin main 2>/dev/null
ARCH="log-archive-$(date +%Y).md"

n=0
setup() {  # nouveau clone sur feat/x avec un commit en avance sur origin/main
  n=$((n + 1)); W="$FIX/w$n"
  git clone -q "$FIX/origin.git" "$W" 2>/dev/null
  git -C "$W" config core.hooksPath "$FIX/no-hooks"
  git -C "$W" switch -q -c feat/x
  echo "travail $n" > "$W/work.txt"; git -C "$W" add work.txt; git -C "$W" commit -qm "feat: travail $n"
  H0="$(git -C "$W" rev-parse HEAD)"
}
run() {  # run <dossier> [VAR=valeur…] : lance le hook comme Claude Code (cwd = session)
  local dir="$1"; shift
  (cd "$dir" && env PATH="$FIX/bin:$PATH" "$@" bash "$HOOK" </dev/null >"$FIX/out" 2>"$FIX/err"); echo $?
}
new_commits() { git -C "$W" rev-list --count "$H0"..HEAD; }
OPEN7='[{"number":7,"state":"OPEN"}]'

echo "== T1 PR ouverte : entrée journalisée"
setup; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T1 code de sortie" 0 "$rc"
check "T1 un commit de journal" 1 "$(new_commits)"
check "T1 le commit ne touche que log.md" "log.md" "$(git -C "$W" show --name-only --format= HEAD | tr '\n' ' ' | sed 's/ $//')"
check "T1 PR citée" 1 "$(command grep -c 'PR #7' "$W/log.md")"

echo "== T2 PR fusionnée (squash : branche toujours « en avance » sur origin/main)"
setup; rc=$(run "$W" FAKE_GH_PRS='[{"number":7,"state":"MERGED"}]')
check "T2 aucun commit après la tête de PR" 0 "$(new_commits)"
check "T2 log.md intact" "" "$(git -C "$W" status --porcelain -- log.md)"
check "T2 raison sur stderr" 1 "$(command grep -c 'fusionnée ou fermée' "$FIX/err")"

echo "== T3 branche réutilisée : ancienne PR fusionnée + nouvelle PR ouverte"
setup; rc=$(run "$W" FAKE_GH_PRS='[{"number":7,"state":"MERGED"},{"number":9,"state":"OPEN"}]')
check "T3 un commit de journal" 1 "$(new_commits)"
check "T3 PR ouverte citée" 1 "$(command grep -c 'PR #9' "$W/log.md")"

echo "== T4 un autre chemin est déjà indexé"
setup; echo "à moi" > "$W/autre.txt"; git -C "$W" add autre.txt
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T4 aucun commit" 0 "$(new_commits)"
check "T4 le fichier indexé l'est toujours, hors de tout commit" "A  autre.txt" "$(git -C "$W" status --porcelain -- autre.txt)"

echo "== T5 pre-commit en échec après rotation d'une archive suivie : retour arrière"
setup; echo "archive suivie" > "$W/$ARCH"; git -C "$W" add "$ARCH"; git -C "$W" commit -qm "archive"; H0="$(git -C "$W" rev-parse HEAD)"
git -C "$W" config core.hooksPath "$FIX/hooks-fail"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7" ROTATE=1)
check "T5 aucun commit" 0 "$(new_commits)"
check "T5 témoin : le hook a tenté le commit (marqueur écrit après l'échec)" "$H0" "$(cat "$W/.claude/.session-log-state/last-suggested-head" 2>/dev/null)"
check "T5 log.md et archive restaurés, index vide" "" "$(git -C "$W" status --porcelain -- log.md "$ARCH"; git -C "$W" diff --cached --name-only)"

echo "== T5b archive non suivie préexistante + pre-commit en échec"
setup; echo "notes à garder" > "$W/$ARCH"; git -C "$W" config core.hooksPath "$FIX/hooks-fail"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T5b archive préexistante conservée" "notes à garder" "$(cat "$W/$ARCH" 2>/dev/null || echo SUPPRIMÉE)"
check "T5b aucun commit" 0 "$(new_commits)"

echo "== T6 archive non suivie préexistante, commit possible"
setup; echo "notes à garder" > "$W/$ARCH"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T6 archive jamais embarquée dans un commit" 0 "$(git -C "$W" log --oneline -- "$ARCH" | wc -l)"
check "T6 archive toujours non suivie" "?? $ARCH" "$(git -C "$W" status --porcelain -- "$ARCH")"

echo "== T6b rotation, commit possible : l'archive créée part avec log.md"
setup; rc=$(run "$W" FAKE_GH_PRS="$OPEN7" ROTATE=1)
check "T6b un commit de journal" 1 "$(new_commits)"
check "T6b le commit contient log.md et l'archive" "$ARCH log.md" "$(git -C "$W" show --name-only --format= HEAD | sort | tr '\n' ' ' | sed 's/ $//')"

echo "== T7 gh en échec : état de PR inconnu, aucune entrée"
setup; rc=$(run "$W" FAKE_GH_FAIL=1)
check "T7 code de sortie" 0 "$rc"
check "T7 aucun commit" 0 "$(new_commits)"
check "T7 log.md intact" "" "$(git -C "$W" status --porcelain -- log.md)"
check "T7 état de PR inconnu signalé sur stderr" 1 "$(command grep -c 'état de PR inconnu' "$FIX/err")"

echo "== T8 session hors dépôt git"
if command grep -q '|| echo /opt/automecanik/app' "$HOOK"; then
  skip "T8" "cette version se replie vers un checkout codé en dur (lu, pas exécuté)"
else
  # git factice : note chaque appel, refuse tout sauf rev-parse (aucune écriture possible)
  mkdir -p "$FIX/nogit" "$FIX/gitshim" "$FIX/home"
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >> "%s"\nfor a in "$@"; do [ "$a" = rev-parse ] && exec "%s" "$@"; done\nexit 1\n' \
    "$FIX/git-calls" "$(command -v git)" > "$FIX/gitshim/git"; chmod +x "$FIX/gitshim/git"
  rc=$(cd "$FIX/nogit" && env HOME="$FIX/home" PATH="$FIX/gitshim:$FIX/bin:$PATH" FAKE_GH_PRS="$OPEN7" bash "$HOOK" </dev/null >"$FIX/out" 2>"$FIX/err"; echo $?)
  check "T8 code de sortie" 0 "$rc"
  check "T8 rien écrit dans le dossier courant" "" "$(ls -A "$FIX/nogit")"
  check "T8 un seul appel git (rev-parse), aucun repli vers un autre dépôt" 1 "$(wc -l < "$FIX/git-calls" 2>/dev/null || echo 0)"
fi

echo "== T9 sur main en avance sur origin/main : jamais de commit (comportement existant)"
setup; git -C "$W" switch -q main
echo local > "$W/local.txt"; git -C "$W" add local.txt; git -C "$W" commit -qm "local sur main"; H0="$(git -C "$W" rev-parse HEAD)"
check "T9 témoin : main en avance avant le hook (seule la protection de branche l'arrête)" 1 "$(git -C "$W" rev-list --count refs/remotes/origin/main..HEAD)"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T9 aucun commit sur main" 0 "$(new_commits)"

echo "== T10 un autre chemin est indexé PENDANT l'exécution du hook"
setup; rc=$(run "$W" FAKE_GH_PRS="$OPEN7" COMPANION_STAGE=1)
check "T10 un commit de journal" 1 "$(new_commits)"
check "T10 le commit ne touche que log.md" "log.md" "$(git -C "$W" show --name-only --format= HEAD | tr '\n' ' ' | sed 's/ $//')"
check "T10 le chemin du tiers reste indexé, hors de tout commit" "A  companion.txt" "$(git -C "$W" status --porcelain -- companion.txt)"

echo
if [[ $FAIL -ne 0 ]]; then echo "TESTS EN ÉCHEC"; exit 1
elif [[ $SKIP -ne 0 ]]; then echo "TESTS INCOMPLETS ($SKIP non exécuté(s) — jamais comptés comme réussis)"; exit 3
else echo "TOUS LES TESTS PASSENT"; fi
