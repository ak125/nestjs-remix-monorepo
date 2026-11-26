#!/usr/bin/env bash
# scripts/git-hooks/run.test.sh — preuve du lanceur scripts/git-hooks/ (issue #2281).
#
# Dépôts jetables (mktemp -d, supprimés à la sortie). Le dépôt « principal » reçoit les vrais
# .husky/pre-commit, commit-msg et pre-push et le lanceur de SRC, plus de faux outils dans
# node_modules/.bin qui notent leurs appels ; un worktree lié, hors du dépôt principal, n'a ni
# .husky/_ ni node_modules, comme ceux créés par `git worktree add` sur DEV.
#
# Usage : bash scripts/git-hooks/run.test.sh [SRC]   (SRC = arbre testé, défaut : ce dépôt)
#         Sur un arbre sans scripts/git-hooks/ (origin/main avant ce correctif), les cas qui
#         exigent le lanceur échouent : c'est la preuve attendue.
set -uo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE HUSKY NODE_PATH npm_config_prefix

SRC=$(cd "${1:-$(dirname "$0")/../..}" && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
export HOME="$T/home" TMPDIR="$T/tmp" CALLS="$T/calls.log" GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$T/gitconfig"
mkdir -p "$HOME" "$TMPDIR"
git config --global user.name test; git config --global user.email test@example.invalid
git config --global init.defaultBranch main; git config --global advice.detachedHead false

fails=0
ok() { echo "PASS  $1"; }
ko() { echo "FAIL  $1"; [[ -n ${2:-} ]] && sed 's/^/        /' <<< "$2"; fails=$((fails + 1)); }
called() { grep -q -- "$1" "$CALLS" 2>/dev/null; }

# Copie de husky/husky (le .husky/_/h que génère `prepare: husky`), pour reproduire l'état de DEV.
husky_h=""
for c in "$SRC/node_modules/husky/husky" \
  "$(git -C "$SRC" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/../node_modules/husky/husky" \
  "$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/../node_modules/husky/husky"; do
  [[ -f $c ]] && { husky_h=$c; break; }
done
husky_install() { # $1 = racine où générer .husky/_ comme husky 9
  mkdir -p "$1/.husky/_"; cp "$husky_h" "$1/.husky/_/h"; printf '*' > "$1/.husky/_/.gitignore"
  for h in pre-commit commit-msg pre-push; do
    printf '#!/usr/bin/env sh\n. "$(dirname "$0")/h"' > "$1/.husky/_/$h"; chmod +x "$1/.husky/_/$h"
  done
}

fake() { # $1 = nom, $2 = corps
  printf '#!/bin/sh\necho "%s $*" >> "$CALLS"\n%s\n' "$1" "${2:-}" > "$M/node_modules/.bin/$1"
  chmod +x "$M/node_modules/.bin/$1"
}

# ── dépôt principal (checkout partagé) + dépôt distant ──────────────────────────────────────
M="$T/app"; REMOTE="$T/remote.git"
git init -q --bare "$REMOTE"
git init -q "$M"
mkdir -p "$M/.husky" "$M/node_modules/.bin"
cp "$SRC/.husky/pre-commit" "$SRC/.husky/commit-msg" "$SRC/.husky/pre-push" "$M/.husky/"
[[ -d $SRC/scripts/git-hooks ]] && { mkdir -p "$M/scripts"; cp -R "$SRC/scripts/git-hooks" "$M/scripts/"; }
printf 'node_modules\n' > "$M/.gitignore"
printf '{"name":"fixture","private":true}\n' > "$M/package.json"
printf '{"lockfileVersion":3}\n' > "$M/package-lock.json"
fake lint-staged 'if git diff --cached --name-only | grep -q "^backend/src/.*\.ts$"; then [ -f node_modules/eslint/bin/eslint.js ] || { echo "Error: Cannot find module $PWD/node_modules/eslint/bin/eslint.js" >&2; exit 1; }; fi'
fake ast-grep
fake tsx
fake commitlint 'head -n1 "$2" | grep -Eq "^[a-z]+(\([^)]+\))?: .+" || { echo "commitlint: subject may not be empty / type may not be empty" >&2; exit 1; }'
git -C "$M" add -A && git -C "$M" commit -q -m "chore: fixture"
git -C "$M" remote add origin "$REMOTE"
git -C "$M" push -q origin main && git -C "$M" fetch -q origin
# État de DEV : husky a posé core.hooksPath relatif et généré .husky/_ dans le seul checkout principal.
git -C "$M" config core.hooksPath .husky/_
git -C "$M" config extensions.worktreeConfig true
[[ -n $husky_h ]] && husky_install "$M"

# ── C0 : git 2.43 et le chemin relatif (constat d'origine, indépendant du correctif) ─────────
if [[ -n $husky_h ]]; then
  W0="$T/wt/w0"; git -C "$M" worktree add -q -b feat/w0 "$W0"
  : > "$CALLS"; echo a > "$W0/a.txt"; git -C "$W0" add a.txt
  git -C "$W0" commit -q -m "pas conforme" > /dev/null 2>&1; r1=$?
  sans=$(cat "$CALLS")
  husky_install "$W0"; mkdir -p "$W0/node_modules"; ln -s "$M/node_modules/.bin" "$W0/node_modules/.bin"
  echo b > "$W0/b.txt"; git -C "$W0" add b.txt
  git -C "$W0" commit -q -m "fix(t): b" > /dev/null 2>&1; r2=$?
  if [[ $r1 = 0 && -z $sans && $r2 = 0 ]] && called "^commitlint --edit"; then
    ok "C0 git $(git --version | cut -d' ' -f3) : worktree lié sans .husky/_ = aucun hook, même pour un message non conforme ; avec .husky/_ = hooks lancés"
  else ko "C0 constat git (sans .husky/_ : exit $r1 ; avec : exit $r2)" "$(cat "$CALLS" 2>/dev/null)"; fi
else echo "SKIP  C0 : husky/husky introuvable (node_modules absent de SRC et du checkout principal)"; fi

# ── activation (geste du propriétaire), puis réécriture de core.hooksPath par husky ──────────
if [[ -x $M/scripts/git-hooks/activate.sh ]]; then
  out=$(cd "$M" && bash scripts/git-hooks/activate.sh 2>&1); r=$?
  git -C "$M" config core.hooksPath .husky/_   # ce que refait `prepare: husky` à chaque npm ci
else out="scripts/git-hooks/activate.sh absent de SRC"; r=1; fi
W="$T/wt/w"; git -C "$M" worktree add -q -b feat/w "$W"
eff=$(git -C "$W" config core.hooksPath)
if [[ $r = 0 && $eff = "$M/scripts/git-hooks" ]]; then
  ok "C1 activation : core.hooksPath effectif du worktree lié = lanceur du checkout principal, même après réécriture par husky"
else ko "C1 activation (exit $r, core.hooksPath effectif = $eff)" "$out"; fi

[[ ! -e $W/.husky/_ && ! -e $W/node_modules ]] || ko "fixture : le worktree lié a déjà .husky/_ ou node_modules"

# ── C2 : commit dans le worktree lié sans .husky/_ ni node_modules ───────────────────────────
: > "$CALLS"; echo a > "$W/a.txt"; git -C "$W" add a.txt
out=$(git -C "$W" commit -m "fix(test): a" 2>&1); r=$?
if [[ $r = 0 ]] && called "^lint-staged" && called "^ast-grep scan" && called "^commitlint --edit" \
   && grep -q "outils lus dans $M/node_modules" <<< "$out"; then
  ok "C2 worktree lié sans .husky/_ ni node_modules : pre-commit et commit-msg tournent, outils du checkout principal"
else ko "C2 hooks dans le worktree lié (exit $r)" "$out"$'\n'"appels: $(tr '\n' ';' < "$CALLS")"; fi

# ── C3 : le commit-msg y refuse un message non conforme ──────────────────────────────────────
head=$(git -C "$W" rev-parse HEAD); echo b > "$W/b.txt"; git -C "$W" add b.txt
out=$(git -C "$W" commit -m "message libre" 2>&1); r=$?
if [[ $r != 0 && $(git -C "$W" rev-parse HEAD) = "$head" ]] && grep -q "commit-msg a échoué" <<< "$out"; then
  ok "C3 worktree lié : commit-msg (commitlint) refuse un message non conforme"
else ko "C3 commit-msg dans le worktree lié (exit $r)" "$out"; fi
git -C "$W" reset -q

# ── C4 : étape qui exige le node_modules du worktree → refus avec message explicite ──────────
mkdir -p "$W/backend/src"; echo 'export const x = 1;' > "$W/backend/src/x.ts"; git -C "$W" add backend/src/x.ts
out=$(git -C "$W" commit -m "fix(test): x" 2>&1); r=$?
if [[ $r != 0 && $(git -C "$W" rev-parse HEAD) = "$head" ]] && grep -q "ne peut pas tourner ici" <<< "$out"; then
  ok "C4 étape qui lit node_modules/ du worktree (eslint de lint-staged) : commit refusé, message explicite"
else ko "C4 étape exigeant node_modules (exit $r)" "$out"; fi
git -C "$W" reset -q

# ── C5 : push direct sur main refusé depuis le worktree lié ──────────────────────────────────
rmain=$(git -C "$REMOTE" rev-parse main)
out=$(git -C "$W" push origin HEAD:refs/heads/main 2>&1); r=$?
if [[ $r != 0 && $(git -C "$REMOTE" rev-parse main) = "$rmain" ]] && grep -q "Refused by .husky/pre-push" <<< "$out"; then
  ok "C5 worktree lié : push direct sur main refusé par .husky/pre-push"
else ko "C5 push direct sur main (exit $r, main distant $(git -C "$REMOTE" rev-parse --short main))" "$out"; fi

# ── C6 : push d'une branche de travail accepté (le refus de C5 n'est pas un refus de tout) ───
out=$(git -C "$W" push -q origin feat/w 2>&1); r=$?
if [[ $r = 0 ]]; then ok "C6 worktree lié : push d'une branche de travail accepté"; else ko "C6 push de branche (exit $r)" "$out"; fi

# ── C7 : rien n'est laissé hors du worktree ──────────────────────────────────────────────────
left=$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -name 'git-hooks.*' | wc -l)
if [[ $left = 0 ]]; then ok "C7 dossier temporaire d'emprunt supprimé après chaque hook"; else ko "C7 $left dossier(s) git-hooks.* laissé(s) dans TMPDIR"; fi

# ── C8 : checkout principal (node_modules présent) : outils locaux, pas d'emprunt ────────────
: > "$CALLS"; echo m > "$M/m.txt"; git -C "$M" add m.txt
out=$(git -C "$M" commit -m "fix(test): m" 2>&1); r=$?
if [[ $r = 0 ]] && called "^lint-staged" && called "^commitlint" && ! grep -q "outils lus dans" <<< "$out"; then
  ok "C8 checkout principal : hooks lancés avec ses propres outils"
else ko "C8 checkout principal (exit $r)" "$out"; fi

# ── C9 : chaque hook de .husky/ a son lanceur exécutable ─────────────────────────────────────
miss=""
for f in "$SRC"/.husky/*; do
  [[ -f $f ]] || continue
  [[ -x $SRC/scripts/git-hooks/$(basename "$f") ]] || miss="$miss $(basename "$f")"
done
if [[ -z $miss ]]; then ok "C9 chaque hook de .husky/ a son lanceur dans scripts/git-hooks/"; else ko "C9 lanceur absent pour :$miss"; fi

# ── C10 : --undo rend la main à husky ────────────────────────────────────────────────────────
if [[ -x $M/scripts/git-hooks/activate.sh ]]; then
  (cd "$M" && bash scripts/git-hooks/activate.sh --undo > /dev/null 2>&1)
  eff=$(git -C "$W" config core.hooksPath)
  if [[ $eff = .husky/_ && ! -e $M/.git/git-hooks-runner.gitconfig ]]; then ok "C10 --undo : core.hooksPath revient à .husky/_"
  else ko "C10 --undo (core.hooksPath = $eff)"; fi
else ko "C10 --undo : activate.sh absent de SRC"; fi

echo "---"
if [[ $fails = 0 ]]; then echo "OK — tous les cas passent"; else echo "ÉCHEC — $fails cas en échec"; fi
exit $(( fails > 0 ))
