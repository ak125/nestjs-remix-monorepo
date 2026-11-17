#!/usr/bin/env bash
# Test du hook Stop stop-log-session-suggest.sh sur fixtures jetables : origine nue +
# clone + faux `gh` (aucun appel réseau). Les attendus sont ceux du correctif : une
# suggestion sur stderr, aucune écriture ni aucun commit. Lancé contre une version
# antérieure (HOOK=<copie>), les lignes en ÉCHEC montrent l'écriture ou le commit.
#
# « Aucune écriture » = empreinte identique avant/après le hook du dépôt de fixture
# entier, .git compris : chemins, types et droits de chaque fichier et dossier, contenu
# de chaque fichier (HEAD, refs, index brut, marqueurs). Les sorties du test (stdout,
# stderr, notes d'appel) restent hors de ce dépôt.
#
# Harnais : le hook et le compagnon réel stop-claude-md-suggest.sh (COMPANION=<script>,
# par défaut celui à côté de ce test) sont copiés ensemble dans la fixture. Les copies
# redirigent vers la fixture /tmp/.session-log-commit-err (version ancienne) et le repli
# /opt/automecanik/app du compagnon (sed, seules modifications) ; le test s'arrête avant
# toute exécution si une copie cite encore un de ces chemins. Le cas « hors dépôt git »
# n'est PAS exécuté contre une version qui se replie vers un checkout codé en dur.
# Ailleurs, ce cas passe par un git factice qui refuse tout sauf `rev-parse` et note
# chaque appel : un repli vers un autre dépôt, quel qu'il soit, apparaît dans la note.
#
# Le dépôt de fixture porte des compagnons factices (scripts/claude-hooks/) : rotate-log.sh
# (ROTATE=1 ajoute une ligne à l'archive) et un stop-claude-md-suggest.sh qui note son
# appel hors du dépôt, comme la copie, peut-être plus ancienne, d'un worktree de session.
# FAKE_GH_STAGE=1 fait indexer un autre fichier par le faux gh pendant l'exécution du
# hook (concurrence sur l'index).
#
# Usage : [HOOK=<script>] [COMPANION=<script>] bash scripts/claude-hooks/stop-log-session-suggest.test.sh
set -uo pipefail
HOOK_SRC="${HOOK:-$(cd "$(dirname "$0")" && pwd)/stop-log-session-suggest.sh}"
COMPANION_SRC="${COMPANION:-$(cd "$(dirname "$0")" && pwd)/stop-claude-md-suggest.sh}"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
# Fixture obligatoire : sans elle, les chemins "$FIX/..." deviendraient des chemins racine.
# Arrêt avant tout mkdir, copie ou trap si mktemp échoue ou ne rend pas un répertoire.
FIX="$(mktemp -d "${TMPDIR:-/tmp}/stop-log-test.XXXXXX")" || { echo "ARRÊT — mktemp -d de la fixture impossible"; exit 1; }
if [ -z "$FIX" ] || [ ! -d "$FIX" ]; then echo "ARRÊT — fixture absente ou invalide (« $FIX »)"; exit 1; fi
trap 'rm -rf "$FIX"' EXIT
FAIL=0; SKIP=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
skip() { echo "  NON EXÉCUTÉ — $1 : $2"; SKIP=$((SKIP + 1)); }

mkdir -p "$FIX/hooks"
HOOK="$FIX/hooks/stop-log-session-suggest.sh"; COMP="$FIX/hooks/stop-claude-md-suggest.sh"
for pair in "$HOOK_SRC:$HOOK" "$COMPANION_SRC:$COMP"; do
  src="${pair%%:*}"; dst="${pair#*:}"
  [[ -f "$src" ]] || { echo "ABANDON : $src introuvable"; exit 2; }
  sed -e "s|/tmp/.session-log-commit-err|$FIX/commit.err|g" -e "s|/opt/automecanik/app|$FIX/no-checkout|g" "$src" > "$dst"
  chmod +x "$dst"
  echo "== $(basename "$src") : $(sha256sum "$src" | cut -c1-12)$(cmp -s "$src" "$dst" && echo ', copie identique' || echo ', chemins en service redirigés vers la fixture')"
done
if command grep -nE '/tmp/\.session-log-commit-err|/opt/automecanik/app' "$HOOK" "$COMP"; then
  echo "ABANDON : chemin en service dans une copie, rien n'a été exécuté"; exit 2
fi

# Faux gh : `pr list --head B --state open|all --json … --jq E` sur FAKE_GH_PRS (JSON).
mkdir -p "$FIX/bin"
cat > "$FIX/bin/gh" <<'EOF'
#!/usr/bin/env bash
[[ "${FAKE_GH_FAIL:-0}" == 1 ]] && { echo "gh: échec simulé" >&2; exit 1; }
[[ "${FAKE_GH_STAGE:-0}" == 1 ]] && { echo tiers > tiers.txt; git add tiers.txt; }
state=all; jqexpr=.
while [[ $# -gt 0 ]]; do case "$1" in --state) state="$2"; shift 2 ;; --jq) jqexpr="$2"; shift 2 ;; *) shift ;; esac; done
prs="${FAKE_GH_PRS:-[]}"
[[ $state == open ]] && prs="$(jq -c '[.[] | select(.state == "OPEN")]' <<< "$prs")"
jq -r "$jqexpr" <<< "$prs"
EOF
chmod +x "$FIX/bin/gh"

git init -q --bare -b main "$FIX/origin.git"
git clone -q "$FIX/origin.git" "$FIX/seed" 2>/dev/null
git -C "$FIX/seed" config core.hooksPath "$FIX/no-hooks"
printf '# log\n' > "$FIX/seed/log.md"
mkdir -p "$FIX/seed/scripts/claude-hooks"
printf '#!/usr/bin/env bash\n[ "${ROTATE:-0}" = 1 ] && printf "rotated\\n" >> "$2"\nexit 0\n' > "$FIX/seed/scripts/claude-hooks/rotate-log.sh"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$PWD" >> "%s"\nexit 0\n' "$FIX/repo-companion-calls" > "$FIX/seed/scripts/claude-hooks/stop-claude-md-suggest.sh"
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
snap() {  # empreinte du dépôt de fixture entier, .git compris, sans commande git
  { (cd "$W" && find . -printf '%y %m %p\n' | sort)
    (cd "$W" && find . -type f -print0 | sort -z | xargs -0 sha256sum)
  } | sha256sum | cut -c1-16
}
suggested() { command grep -c '/log-session' "$FIX/err"; }
md_suggested() { command grep -c '^\[stop-claude-md-suggest\]' "$FIX/err"; }
repo_companion_calls() { if [[ -f "$FIX/repo-companion-calls" ]]; then wc -l < "$FIX/repo-companion-calls"; else echo 0; fi; }
fixes() {  # deux commits de correction de plus : seuil du compagnon atteint (2 sur les 5 derniers)
  local s; for s in "fix: correction a" "fix(x): correction b"; do
    echo "$s" >> "$W/fix.txt"; git -C "$W" add fix.txt; git -C "$W" commit -qm "$s"
  done; H0="$(git -C "$W" rev-parse HEAD)"
}
MARKER=.claude/.session-log-state/last-claude-md-suggest-head
OPEN7='[{"number":7,"state":"OPEN"}]'

echo "== T1 PR ouverte : suggestion seule, aucune écriture"
setup; S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T1 code de sortie" 0 "$rc"
check "T1 aucun commit" 0 "$(new_commits)"
check "T1 aucune écriture (empreinte inchangée)" "$S0" "$(snap)"
check "T1 suggestion /log-session sur stderr" 1 "$(suggested)"
check "T1 PR citée dans le brouillon" 1 "$(command grep -c 'PR #7 |' "$FIX/err")"
check "T1 stdout vide" "" "$(cat "$FIX/out")"

echo "== T2 PR fusionnée (squash : branche toujours « en avance » sur origin/main)"
setup; S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS='[{"number":7,"state":"MERGED"}]')
check "T2 aucun commit après la tête de PR" 0 "$(new_commits)"
check "T2 aucune écriture" "$S0" "$(snap)"
check "T2 aucune suggestion" 0 "$(suggested)"
check "T2 raison sur stderr" 1 "$(command grep -c 'fusionnée ou fermée' "$FIX/err")"

echo "== T3 branche réutilisée : ancienne PR fusionnée + nouvelle PR ouverte"
setup; S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS='[{"number":7,"state":"MERGED"},{"number":9,"state":"OPEN"}]')
check "T3 aucun commit" 0 "$(new_commits)"
check "T3 aucune écriture" "$S0" "$(snap)"
check "T3 PR ouverte citée" 1 "$(command grep -c 'PR #9 |' "$FIX/err")"

echo "== T4 un autre chemin est déjà indexé"
setup; echo "à moi" > "$W/autre.txt"; git -C "$W" add autre.txt; S0="$(snap)"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T4 aucun commit" 0 "$(new_commits)"
check "T4 aucune écriture" "$S0" "$(snap)"
check "T4 le fichier indexé l'est toujours, hors de tout commit" "A  autre.txt" "$(git -C "$W" status --porcelain -- autre.txt)"

echo "== T5 archive suivie + ROTATE=1 : aucune rotation"
setup; echo "archive suivie" > "$W/$ARCH"; git -C "$W" add "$ARCH"; git -C "$W" commit -qm "archive"; H0="$(git -C "$W" rev-parse HEAD)"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7" ROTATE=1)
check "T5 aucun commit" 0 "$(new_commits)"
check "T5 aucune écriture (log.md et archive intacts)" "$S0" "$(snap)"

echo "== T6 archive non suivie préexistante"
setup; echo "notes à garder" > "$W/$ARCH"; S0="$(snap)"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T6 aucune écriture" "$S0" "$(snap)"
check "T6 archive jamais embarquée dans un commit" 0 "$(git -C "$W" log --oneline -- "$ARCH" | wc -l)"
check "T6 archive toujours non suivie" "?? $ARCH" "$(git -C "$W" status --porcelain -- "$ARCH")"

echo "== T6b ROTATE=1 sans archive : aucune archive créée"
setup; S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7" ROTATE=1)
check "T6b aucun commit" 0 "$(new_commits)"
check "T6b aucune écriture" "$S0" "$(snap)"
check "T6b aucune archive" "absente" "$([ -e "$W/$ARCH" ] && echo présente || echo absente)"

echo "== T7 gh en échec : état de PR inconnu, aucune suggestion"
setup; S0="$(snap)"; rc=$(run "$W" FAKE_GH_FAIL=1)
check "T7 code de sortie" 0 "$rc"
check "T7 aucun commit" 0 "$(new_commits)"
check "T7 aucune écriture" "$S0" "$(snap)"
check "T7 état de PR inconnu signalé sur stderr" 1 "$(command grep -c 'état de PR inconnu' "$FIX/err")"
check "T7 aucune suggestion" 0 "$(suggested)"

echo "== T8 session hors dépôt git"
if command grep -q '|| echo /opt/automecanik/app' "$HOOK_SRC"; then
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

echo "== T9 sur main en avance sur origin/main : ni commit ni suggestion (comportement existant)"
setup; git -C "$W" switch -q main
echo local > "$W/local.txt"; git -C "$W" add local.txt; git -C "$W" commit -qm "local sur main"; H0="$(git -C "$W" rev-parse HEAD)"
check "T9 témoin : main en avance avant le hook (seule la protection de branche l'arrête)" 1 "$(git -C "$W" rev-list --count refs/remotes/origin/main..HEAD)"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T9 aucun commit sur main" 0 "$(new_commits)"
check "T9 aucune écriture" "$S0" "$(snap)"
check "T9 aucune suggestion" 0 "$(suggested)"

echo "== T10 un autre chemin est indexé PENDANT l'exécution du hook"
setup; rc=$(run "$W" FAKE_GH_PRS="$OPEN7" FAKE_GH_STAGE=1)
check "T10 aucun commit" 0 "$(new_commits)"
check "T10 log.md intact" "" "$(git -C "$W" status --porcelain -- log.md)"
check "T10 le chemin du tiers reste indexé, hors de tout commit" "A  tiers.txt" "$(git -C "$W" status --porcelain -- tiers.txt)"

echo "== T11 branche déjà poussée, PR ouverte : rien à pousser, aucune suggestion"
setup; git -C "$W" push -q -f -u origin feat/x 2>/dev/null
check "T11 témoin : HEAD = origin/feat/x avant le hook" "$H0" "$(git -C "$W" rev-parse refs/remotes/origin/feat/x)"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T11 code de sortie" 0 "$rc"
check "T11 aucun commit après la tête poussée" 0 "$(new_commits)"
check "T11 aucune écriture" "$S0" "$(snap)"
check "T11 raison sur stderr" 1 "$(command grep -c 'déjà dans origin/feat/x' "$FIX/err")"
check "T11 aucune suggestion" 0 "$(suggested)"

echo "== T12 commit local après le push : suggestion, aucune écriture"
setup; git -C "$W" push -q -f -u origin feat/x 2>/dev/null
echo "suite" > "$W/suite.txt"; git -C "$W" add suite.txt; git -C "$W" commit -qm "feat: suite non poussée"; H0="$(git -C "$W" rev-parse HEAD)"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T12 aucun commit" 0 "$(new_commits)"
check "T12 aucune écriture" "$S0" "$(snap)"
check "T12 suggestion /log-session" 1 "$(suggested)"

echo "== T13 branche distante en avance (commit poussé d'ailleurs) : aucune suggestion"
setup; git -C "$W" push -q -f -u origin feat/x 2>/dev/null
git clone -q -b feat/x "$FIX/origin.git" "$FIX/other$n" 2>/dev/null
echo "projection" > "$FIX/other$n/proj.txt"; git -C "$FIX/other$n" add proj.txt
git -C "$FIX/other$n" -c core.hooksPath="$FIX/no-hooks" commit -qm "chore: projection"; git -C "$FIX/other$n" push -q origin feat/x 2>/dev/null
git -C "$W" fetch -q origin
check "T13 témoin : HEAD est un ancêtre strict de origin/feat/x" 1 "$(git -C "$W" rev-list --count HEAD..refs/remotes/origin/feat/x)"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T13 aucun commit" 0 "$(new_commits)"
check "T13 aucune écriture" "$S0" "$(snap)"
check "T13 aucune suggestion" 0 "$(suggested)"

echo "== T14 log.md déjà modifié (entrée en cours) : aucune suggestion, modification conservée"
setup; printf '\n## en cours\n' >> "$W/log.md"; S0="$(snap)"
rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T14 aucun commit" 0 "$(new_commits)"
check "T14 aucune écriture" "$S0" "$(snap)"
check "T14 aucune suggestion" 0 "$(suggested)"

echo "== T15 compagnon réel, ≥ 2 corrections, aucun dossier de marqueur : suggestion, rien créé"
setup; fixes; S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T15 code de sortie" 0 "$rc"
check "T15 aucun commit" 0 "$(new_commits)"
check "T15 aucune écriture (empreinte inchangée, .git compris)" "$S0" "$(snap)"
check "T15 dossier .claude/ non créé" "absent" "$([ -e "$W/.claude" ] && echo présent || echo absent)"
check "T15 suggestion du compagnon sur stderr" 1 "$(md_suggested)"
check "T15 suggestion /log-session sur stderr" 1 "$(suggested)"
check "T15 compagnon du dépôt de session jamais appelé depuis T1" 0 "$(repo_companion_calls)"
check "T15 stdout vide" "" "$(cat "$FIX/out")"

echo "== T16 marqueur existant sur une autre tête : suggestion, marqueur inchangé"
setup; fixes; mkdir -p "$W/.claude/.session-log-state"; git -C "$W" rev-parse HEAD~1 > "$W/$MARKER"; OLD="$(cat "$W/$MARKER")"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T16 aucune écriture" "$S0" "$(snap)"
check "T16 marqueur toujours sur l'ancienne tête" "$OLD" "$(cat "$W/$MARKER")"
check "T16 suggestion du compagnon" 1 "$(md_suggested)"

echo "== T17 marqueur sur la tête courante : déduplication respectée"
setup; fixes; mkdir -p "$W/.claude/.session-log-state"; echo "$H0" > "$W/$MARKER"
S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7")
check "T17 aucune écriture" "$S0" "$(snap)"
check "T17 aucune suggestion du compagnon" 0 "$(md_suggested)"
check "T17 suggestion /log-session" 1 "$(suggested)"

echo "== T18 CLAUDE_HOOKS_DISABLE=1 : compagnon muet, suggestion /log-session émise (comportement réel)"
setup; fixes; S0="$(snap)"; rc=$(run "$W" FAKE_GH_PRS="$OPEN7" CLAUDE_HOOKS_DISABLE=1)
check "T18 aucune écriture" "$S0" "$(snap)"
check "T18 aucune suggestion du compagnon" 0 "$(md_suggested)"
check "T18 suggestion /log-session toujours émise" 1 "$(suggested)"

echo "== T19 compagnon lancé seul (autre usage) : marqueur écrit comme avant"
setup; fixes
rc=$(cd "$W" && bash "$COMP" </dev/null >"$FIX/out" 2>"$FIX/err"; echo $?)
check "T19 code de sortie" 0 "$rc"
check "T19 suggestion du compagnon" 1 "$(md_suggested)"
check "T19 marqueur écrit sur la tête courante" "$H0" "$(cat "$W/$MARKER" 2>/dev/null)"
rc=$(cd "$W" && bash "$COMP" </dev/null >"$FIX/out" 2>"$FIX/err"; echo $?)
check "T19 second passage dédupliqué" 0 "$(md_suggested)"

echo "== Bilan : compagnon du dépôt de session jamais appelé par le hook"
check "aucun appel noté" 0 "$(repo_companion_calls)"

echo
if [[ $FAIL -ne 0 ]]; then echo "TESTS EN ÉCHEC"; exit 1
elif [[ $SKIP -ne 0 ]]; then echo "TESTS INCOMPLETS ($SKIP non exécuté(s) — jamais comptés comme réussis)"; exit 3
else echo "TOUS LES TESTS PASSENT"; fi
