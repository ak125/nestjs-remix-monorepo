#!/usr/bin/env bash
# Test de prune-merged-worktrees.sh sur un dépôt FIXTURE jetable (jamais le dépôt réel).
#
# Chaque cas construit l'état qui a produit (ou pouvait produire) une perte réelle :
# changements suivis non reconnus + « ?? .playwright-mcp/ » (→ --force), commits ajoutés
# après la tête de la PR, session active dans le worktree, worktree d'un autre gestionnaire,
# statut illisible, un dry-run qui écrivait dans le dépôt, des fichiers ignorés non
# régénérables, un sous-module porteur de commits locaux, des modifications masquées par
# skip-worktree / assume-unchanged, un chemin contenant une espace, une attribution de
# mission sans verrou, une écriture tardive (entre contrôle et retrait) et un `gh` en échec.
#
# Usage : bash prune-merged-worktrees.test.sh
#         PRUNE_SCRIPT=/chemin/autre-version.sh bash prune-merged-worktrees.test.sh
# Dépendances : git, jq. `gh` est remplacé par un faux (PATH) qui sert une liste de PR figée.
set -uo pipefail

SCRIPT="${PRUNE_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prune-merged-worktrees.sh}"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/prune-wt-test.XXXXXX")"
FAIL=0
PIDS=()

cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; rm -rf "$FIX"; }
trap cleanup EXIT

check() { # check <description> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi
}
present() { [[ -e "$1" ]] && echo present || echo absent; }
branch()  { git -C "$R" show-ref --verify --quiet "refs/heads/$1" && echo present || echo absent; }

# --- Isolation : aucune config globale/système, aucun hook, aucun dépôt réel ---
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid

R="$FIX/repo"; WT="$R/.claude/worktrees"
git init -q --bare -b main "$FIX/origin.git"
git init -q -b main "$R"
git -C "$R" config core.hooksPath "$FIX/no-hooks"
printf '.claude/worktrees/\n.env\nnode_modules/\ndist/\n__pycache__/\n.eslintcache\nlocal-scripts/\n' > "$R/.gitignore"
printf 'base\n' > "$R/a.txt"; printf 'rename-me\n' > "$R/r.txt"
git -C "$R" add .gitignore a.txt r.txt && git -C "$R" commit -qm base
git -C "$R" remote add origin "$FIX/origin.git"
git -C "$R" push -q origin main

mkwt() { # mkwt <dir> <branche> -> SHA de la pointe (1 commit propre à la branche)
  git -C "$R" worktree add -q -b "$2" "$1" main
  printf '%s\n' "$2" > "$1/work.txt"
  git -C "$1" add work.txt && git -C "$1" commit -qm "work $2"
  git -C "$1" rev-parse HEAD
}
mkbr() { # mkbr <branche> -> SHA (branche sans worktree, 1 commit hors main)
  git -C "$R" branch -q "$1" main
  local t; t="$(git -C "$R" commit-tree -p "$1" -m "work $1" "$(git -C "$R" rev-parse "$1^{tree}")")"
  git -C "$R" update-ref "refs/heads/$1" "$t"; echo "$t"
}
PRS='[]'
pr() { PRS="$(jq -c --argjson n "$1" --arg s "$2" --arg b "$3" --arg o "$4" \
  '. + [{number:$n,state:$s,headRefName:$b,headRefOid:$o}]' <<<"$PRS")"; }

# W1 — MERGED, rename indexé puis modifié (RM) + « ?? .playwright-mcp/ »
s=$(mkwt "$WT/w1-rm" feat/w1-rm); pr 1 MERGED feat/w1-rm "$s"
git -C "$WT/w1-rm" mv r.txt r2.txt; printf 'TRAVAIL-NON-COMMITÉ\n' >> "$WT/w1-rm/r2.txt"
mkdir -p "$WT/w1-rm/.playwright-mcp"; : > "$WT/w1-rm/.playwright-mcp/shot.png"
# W2 — MERGED, modification indexée puis fichier supprimé (MD), sans untracked
s=$(mkwt "$WT/w2-md" feat/w2-md); pr 2 MERGED feat/w2-md "$s"
printf 'mod\n' >> "$WT/w2-md/a.txt"; git -C "$WT/w2-md" add a.txt; rm "$WT/w2-md/a.txt"
# W3 — MERGED, propre, pointe = tête PR (témoin positif)
s=$(mkwt "$WT/w3-clean" feat/w3-clean); pr 3 MERGED feat/w3-clean "$s"
# W4 — MERGED, seulement « ?? .playwright-mcp/ » (jetable : suppression attendue)
s=$(mkwt "$WT/w4-pw" feat/w4-pw); pr 4 MERGED feat/w4-pw "$s"
mkdir -p "$WT/w4-pw/.playwright-mcp"; : > "$WT/w4-pw/.playwright-mcp/shot.png"
# W5 — MERGED, puis un commit ajouté APRÈS la tête de PR (cas « auto session entry »)
s=$(mkwt "$WT/w5-extra" feat/w5-extra); pr 5 MERGED feat/w5-extra "$s"
printf 'log\n' > "$WT/w5-extra/log.md"; git -C "$WT/w5-extra" add log.md
git -C "$WT/w5-extra" commit -qm "chore(log): auto session entry for feat/w5-extra"
W5_EXTRA="$(git -C "$WT/w5-extra" rev-parse HEAD)"
# W6 — MERGED, verrouillé (git worktree lock)
s=$(mkwt "$WT/w6-locked" feat/w6-locked); pr 6 MERGED feat/w6-locked "$s"
git -C "$R" worktree lock --reason "agent-claim test/w6" "$WT/w6-locked"
# W7 — MERGED, propre, mais un processus y a son répertoire courant (session active)
s=$(mkwt "$WT/w7-active" feat/w7-active); pr 7 MERGED feat/w7-active "$s"
(cd "$WT/w7-active" && exec sleep 600) & PIDS+=($!)
# W8 — MERGED, propre, racine ancienne mais commit récent (reflog/index récents)
s=$(mkwt "$WT/w8-recent" feat/w8-recent); pr 8 MERGED feat/w8-recent "$s"
# W9 — MERGED, index corrompu : « git status » échoue
s=$(mkwt "$WT/w9-statuserr" feat/w9-statuserr); pr 9 MERGED feat/w9-statuserr "$s"
printf 'not-an-index' > "$(git -C "$WT/w9-statuserr" rev-parse --absolute-git-dir)/index"
# W10 — MERGED, propre, hors .claude/worktrees/ (autre gestionnaire, ex. Codex direct)
s=$(mkwt "$FIX/worktrees/codex-w10" codex/w10); pr 10 MERGED codex/w10 "$s"
# W11 — dossier disparu : registration « prunable »
s=$(mkwt "$WT/w11-gone" feat/w11-gone); pr 11 MERGED feat/w11-gone "$s"; rm -rf "$WT/w11-gone"
# W12 — CLOSED non fusionnée : commits hors main
s=$(mkwt "$WT/w12-closed" feat/w12-closed); pr 12 CLOSED feat/w12-closed "$s"
# W13 — autre gestionnaire (type pont Hermes) : HEAD détachée, un commit sur aucune branche,
# dossier disparu. Sa registration est la seule référence de ce commit.
git -C "$R" worktree add -q --detach "$FIX/worktrees/tg-w13" main
printf 'w13\n' > "$FIX/worktrees/tg-w13/work.txt"
git -C "$FIX/worktrees/tg-w13" add work.txt && git -C "$FIX/worktrees/tg-w13" commit -qm "work w13"
W13_SHA="$(git -C "$FIX/worktrees/tg-w13" rev-parse HEAD)"; rm -rf "$FIX/worktrees/tg-w13"
# W14 — MERGED, propre, un seul fichier IGNORÉ non régénérable (copie locale de .env factice)
s=$(mkwt "$WT/w14-env" feat/w14-env); pr 14 MERGED feat/w14-env "$s"
printf 'FAKE_SECRET=fixture-only-w14\n' > "$WT/w14-env/.env"
# W15 — MERGED, propre, seulement des sorties régénérables ignorées (témoin positif)
s=$(mkwt "$WT/w15-regen" feat/w15-regen); pr 15 MERGED feat/w15-regen "$s"
mkdir -p "$WT/w15-regen/node_modules/x" "$WT/w15-regen/pkg/dist"
: > "$WT/w15-regen/node_modules/x/i.js"; : > "$WT/w15-regen/pkg/dist/o.js"
mkdir -p "$WT/w15-regen/pkg/__pycache__"; : > "$WT/w15-regen/pkg/__pycache__/m.pyc"; : > "$WT/w15-regen/pkg/.eslintcache"
# cache pytest réel : un `.gitignore` interne `*` fait lister ses entrées une à une
mkdir -p "$WT/w15-regen/tests/.pytest_cache/v/cache"; printf '*\n' > "$WT/w15-regen/tests/.pytest_cache/.gitignore"
: > "$WT/w15-regen/tests/.pytest_cache/README.md"; : > "$WT/w15-regen/tests/.pytest_cache/CACHEDIR.TAG"; : > "$WT/w15-regen/tests/.pytest_cache/v/cache/nodeids"
# W16 — MERGED, propre, un script local ignoré (travail non versionné, type backend/scripts/*.ts)
s=$(mkwt "$WT/w16-localscript" feat/w16-localscript); pr 16 MERGED feat/w16-localscript "$s"
mkdir -p "$WT/w16-localscript/local-scripts"; printf 'probe\n' > "$WT/w16-localscript/local-scripts/probe.ts"
# W17 — MERGED, propre, `.env` ignoré DANS un dossier source suivi nommé `build/`
s=$(mkwt "$WT/w17-srcbuild" feat/w17-srcbuild)
mkdir -p "$WT/w17-srcbuild/tools/build"; printf 'echo run\n' > "$WT/w17-srcbuild/tools/build/run.sh"
git -C "$WT/w17-srcbuild" add tools/build/run.sh && git -C "$WT/w17-srcbuild" commit -qm "tools"
pr 31 MERGED feat/w17-srcbuild "$(git -C "$WT/w17-srcbuild" rev-parse HEAD)"
printf 'FAKE_SECRET=fixture-only-w17\n' > "$WT/w17-srcbuild/tools/build/.env"
# W18 — MERGED, sous-module peuplé portant un commit local sur une branche (HEAD revenue à la
# révision enregistrée : git status est propre) + « ?? .playwright-mcp/ » (→ --force en base)
git init -q -b main "$FIX/subsrc"; printf 's\n' > "$FIX/subsrc/s.txt"
git -C "$FIX/subsrc" add s.txt && git -C "$FIX/subsrc" commit -qm sub
s=$(mkwt "$WT/w18-sub" feat/w18-sub)
git -C "$WT/w18-sub" -c protocol.file.allow=always submodule add -q "$FIX/subsrc" sub
git -C "$WT/w18-sub" commit -qm "add sub"
pr 32 MERGED feat/w18-sub "$(git -C "$WT/w18-sub" rev-parse HEAD)"
git -C "$WT/w18-sub/sub" checkout -q -b local-work
printf 'local\n' >> "$WT/w18-sub/sub/s.txt"; git -C "$WT/w18-sub/sub" commit -qam "sub local work"
W18_SUB_SHA="$(git -C "$WT/w18-sub/sub" rev-parse HEAD)"; W18_GD="$(git -C "$WT/w18-sub" rev-parse --absolute-git-dir)"
git -C "$WT/w18-sub/sub" checkout -q --detach HEAD~1
mkdir -p "$WT/w18-sub/.playwright-mcp"; : > "$WT/w18-sub/.playwright-mcp/shot.png"
# W19 / W20 — MERGED, modification d'un fichier suivi masquée par skip-worktree / assume-unchanged
s=$(mkwt "$WT/w19-skipwt" feat/w19-skipwt); pr 33 MERGED feat/w19-skipwt "$s"
git -C "$WT/w19-skipwt" update-index --skip-worktree a.txt; printf 'MASQUÉ-W19\n' >> "$WT/w19-skipwt/a.txt"
s=$(mkwt "$WT/w20-assume" feat/w20-assume); pr 34 MERGED feat/w20-assume "$s"
git -C "$WT/w20-assume" update-index --assume-unchanged a.txt; printf 'MASQUÉ-W20\n' >> "$WT/w20-assume/a.txt"
# W21 — chemin avec espace (MERGED, propre) + worktree « w21 » sans PR à la même pointe :
# un découpage du chemin sur l'espace retirerait « w21 » au lieu de « w21 sp »
s=$(mkwt "$WT/w21 sp" feat/w21-sp); pr 35 MERGED feat/w21-sp "$s"
git -C "$R" worktree add -q -b feat/w21-next "$WT/w21" feat/w21-sp
# W22 — MERGED, propre, attribution de mission présente mais sans verrou git
s=$(mkwt "$WT/w22-claimed" feat/w22-claimed); pr 36 MERGED feat/w22-claimed "$s"
printf '{"mission":"fixture-w22"}\n' > "$(git -C "$WT/w22-claimed" rev-parse --absolute-git-dir)/agent-claim.json"
# W23 — MERGED, « ?? .playwright-mcp/ » ; une écriture arrive juste avant le retrait (git factice)
s=$(mkwt "$WT/w23-late" feat/w23-late); pr 37 MERGED feat/w23-late "$s"
mkdir -p "$WT/w23-late/.playwright-mcp"; : > "$WT/w23-late/.playwright-mcp/shot.png"

# Branches sans worktree (passe 2)
s=$(mkbr feat/b1-extra); pr 21 MERGED feat/b1-extra "$s"
B1_EXTRA="$(git -C "$R" commit-tree -p "$s" -m 'chore(log): auto session entry' "$(git -C "$R" rev-parse "$s^{tree}")")"
git -C "$R" update-ref refs/heads/feat/b1-extra "$B1_EXTRA"
s=$(mkbr feat/b2-squashed);  pr 22 MERGED feat/b2-squashed "$s"
s=$(mkbr feat/b3-closed);    pr 23 CLOSED feat/b3-closed "$s"
git -C "$R" branch -q feat/b4-closed-in-main main; pr 24 CLOSED feat/b4-closed-in-main "$(git -C "$R" rev-parse main)"
s=$(mkbr feat/b5-nopr)
s=$(mkbr feat/b6-open);      pr 26 OPEN feat/b6-open "$s"

# Référence distante supprimée côté origin : un fetch --prune la ferait disparaître
git -C "$R" push -q origin main:refs/heads/feat/remote-gone
git -C "$R" fetch -q origin
git -C "$FIX/origin.git" update-ref -d refs/heads/feat/remote-gone

# Vieillir toutes les dates (sauf l'index/reflog de W8, laissés « maintenant »)
for d in "$WT"/w* "$FIX/worktrees/codex-w10"; do
  [[ -d "$d" ]] || continue
  gd="$(git -C "$d" rev-parse --absolute-git-dir 2>/dev/null || true)"
  touch -d '2 days ago' "$d"
  [[ "$d" == */w8-recent ]] && continue
  for f in "$gd/index" "$gd/logs/HEAD" "$gd/HEAD"; do [[ -e "$f" ]] && touch -d '2 days ago' "$f"; done
done

mkdir -p "$FIX/bin" "$FIX/shim" "$FIX"/logs/{dry,ghfail,apply,again}
printf '%s' "$PRS" > "$FIX/prs.json"
cat > "$FIX/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_GH_CALLS"
[[ "$1 $2" == "pr list" ]] || { echo "fake gh: appel inattendu: $*" >&2; exit 3; }
[[ "${FAKE_GH_FAIL:-0}" == "1" ]] && { echo "fake gh: HTTP 502" >&2; exit 1; }
cat "$FAKE_GH_JSON"
EOF
# git factice (W23) : écrit dans le worktree visé juste avant de passer la main au vrai git
cat > "$FIX/shim/git" <<'EOF'
#!/usr/bin/env bash
if [[ -n "${LATE_WRITE_TARGET:-}" && "${1:-} ${2:-}" == "worktree remove" ]]; then
  for a in "$@"; do [[ "$a" == "$LATE_WRITE_TARGET" ]] && printf 'ÉCRITURE-TARDIVE\n' >> "$a/a.txt"; done
fi
exec "$REAL_GIT" "$@"
EOF
chmod +x "$FIX/bin/gh" "$FIX/shim/git"
export REAL_GIT="$(command -v git)"
export PATH="$FIX/bin:$PATH" FAKE_GH_JSON="$FIX/prs.json" FAKE_GH_CALLS="$FIX/gh-calls.txt"
export RECENT_MIN=180 REPO=fixture/fixture

snapshot() { # état complet des métadonnées du dépôt fixture
  git -C "$R" for-each-ref --format='%(refname) %(objectname)'
  ls -1 "$R/.git/worktrees"
  sha256sum "$R"/.git/worktrees/*/index 2>/dev/null
}
snap_local() { # branches locales + registrations + dossiers de worktree (un fetch --prune peut toucher refs/remotes)
  git -C "$R" for-each-ref --format='%(refname) %(objectname)' refs/heads/
  ls -1 "$R/.git/worktrees"; ls -1 "$WT"
}

# Garde : on ne lance le script que dans la fixture.
[[ "$(cd "$R" && git rev-parse --show-toplevel)" == "$R" ]] || { echo "FATAL: fixture introuvable"; exit 2; }
echo "Script testé : $SCRIPT"
echo "Fixture      : $FIX"

# ---------------- 1. dry-run ----------------
before="$(snapshot)"
DRY="$(cd "$R" && LOG_DIR="$FIX/logs/dry" bash "$SCRIPT" 2>&1)"; rc=$?
after="$(snapshot)"
echo "--- dry-run (rc=$rc) ---"
echo "[dry-run]"
check "dry-run : code de sortie"                                  0 "$rc"
check "dry-run : refs, registrations et index inchangés"           same "$([[ "$before" == "$after" ]] && echo same || echo changed)"
check "dry-run : registration du dossier disparu conservée (W11)"  present "$(present "$R/.git/worktrees/w11-gone")"
check "dry-run : ref distante origin/feat/remote-gone conservée"   present "$(git -C "$R" show-ref --verify --quiet refs/remotes/origin/feat/remote-gone && echo present || echo absent)"
check "dry-run : W9 (statut illisible) non proposé à la suppression" no "$(grep -q 'WOULD-REMOVE.*w9-statuserr' <<<"$DRY" && echo yes || echo no)"
check "dry-run : W14 (.env ignoré) non proposé à la suppression"    no "$(grep -q 'WOULD-REMOVE.*w14-env' <<<"$DRY" && echo yes || echo no)"

# ---------------- 2. apply sans état PR lisible ----------------
before="$(snap_local)"
GHFAIL="$(cd "$R" && FAKE_GH_FAIL=1 LOG_DIR="$FIX/logs/ghfail" bash "$SCRIPT" --apply 2>&1)"; rc=$?
after="$(snap_local)"
echo "[gh en échec]"
check "gh en échec : code de sortie non nul"                     1 "$rc"
check "gh en échec : branches, registrations et dossiers inchangés" same "$([[ "$before" == "$after" ]] && echo same || echo changed)"
check "gh en échec : cause affichée"                             yes "$(grep -q 'FATAL' <<<"$GHFAIL" && echo yes || echo no)"

# ---------------- 3. apply ----------------
APPLY_OUT="$(cd "$R" && LOG_DIR="$FIX/logs/apply" LATE_WRITE_TARGET="$WT/w23-late" PATH="$FIX/shim:$PATH" bash "$SCRIPT" --apply 2>&1)"; rc=$?
echo "[apply]"
check "apply : code de sortie" 0 "$rc"
check "W1 RM + .playwright-mcp : worktree conservé"                 present "$(present "$WT/w1-rm")"
check "W1 RM + .playwright-mcp : travail non commité intact"        yes "$(grep -q 'TRAVAIL-NON-COMMITÉ' "$WT/w1-rm/r2.txt" 2>/dev/null && echo yes || echo no)"
check "W2 MD : worktree conservé"                                    present "$(present "$WT/w2-md")"
check "W3 propre, pointe=tête PR : worktree supprimé (témoin)"       absent "$(present "$WT/w3-clean")"
check "W3 : branche supprimée (témoin)"                              absent "$(branch feat/w3-clean)"
check "W4 seulement .playwright-mcp : worktree supprimé (témoin)"    absent "$(present "$WT/w4-pw")"
check "W5 commit après tête PR : branche conservée"                  present "$(branch feat/w5-extra)"
check "W5 : commit ajouté toujours référencé"                        yes "$(git -C "$R" branch --contains "$W5_EXTRA" 2>/dev/null | grep -q . && echo yes || echo no)"
check "W6 verrouillé : worktree conservé"                            present "$(present "$WT/w6-locked")"
check "W7 session active : worktree conservé"                        present "$(present "$WT/w7-active")"
check "W8 commit récent (racine ancienne) : worktree conservé"       present "$(present "$WT/w8-recent")"
check "W9 statut illisible : worktree conservé"                      present "$(present "$WT/w9-statuserr")"
check "W10 autre gestionnaire : worktree conservé"                   present "$(present "$FIX/worktrees/codex-w10")"
check "W11 dossier disparu : registration conservée (pas de prune global)" present "$(present "$R/.git/worktrees/w11-gone")"
check "W11 : branche conservée (KEEP tenu jusqu'au bout)"            present "$(branch feat/w11-gone)"
check "W13 autre gestionnaire, dossier disparu : registration conservée" present "$(present "$R/.git/worktrees/tg-w13")"
check "W14 .env ignoré (non régénérable) : worktree conservé"       present "$(present "$WT/w14-env")"
check "W14 : fichier ignoré intact"                                 yes "$(grep -q 'fixture-only-w14' "$WT/w14-env/.env" 2>/dev/null && echo yes || echo no)"
check "W14 : branche conservée"                                     present "$(branch feat/w14-env)"
check "W15 seulement caches/builds ignorés : supprimé (témoin)"     absent "$(present "$WT/w15-regen")"
check "W16 script local ignoré : worktree conservé"                 present "$(present "$WT/w16-localscript/local-scripts/probe.ts")"
check "W17 .env ignoré sous un dossier source « build/ » : worktree conservé" present "$(present "$WT/w17-srcbuild")"
check "W17 : fichier ignoré intact"                                 yes "$(grep -q 'fixture-only-w17' "$WT/w17-srcbuild/tools/build/.env" 2>/dev/null && echo yes || echo no)"
check "W18 sous-module peuplé : worktree conservé"                  present "$(present "$WT/w18-sub")"
check "W18 : commit local du sous-module toujours présent"          yes "$(git --git-dir="$W18_GD/modules/sub" cat-file -e "$W18_SUB_SHA^{commit}" 2>/dev/null && echo yes || echo no)"
check "W19 skip-worktree : worktree conservé"                       present "$(present "$WT/w19-skipwt")"
check "W19 : modification masquée intacte"                          yes "$(grep -q 'MASQUÉ-W19' "$WT/w19-skipwt/a.txt" 2>/dev/null && echo yes || echo no)"
check "W20 assume-unchanged : worktree conservé"                    present "$(present "$WT/w20-assume")"
check "W20 : modification masquée intacte"                          yes "$(grep -q 'MASQUÉ-W20' "$WT/w20-assume/a.txt" 2>/dev/null && echo yes || echo no)"
check "W21 « w21 » sans PR (même pointe) : worktree conservé"       present "$(present "$WT/w21")"
check "W21 « w21 sp » MERGED propre : worktree supprimé (témoin)"   absent "$(present "$WT/w21 sp")"
check "W22 attribution sans verrou : worktree conservé"             present "$(present "$WT/w22-claimed")"
check "W23 écriture tardive : worktree conservé"                    present "$(present "$WT/w23-late")"
check "W23 : écriture tardive intacte"                              yes "$(grep -q 'ÉCRITURE-TARDIVE' "$WT/w23-late/a.txt" 2>/dev/null && echo yes || echo no)"
ALL_OUT="$( { printf '%s\n' "$DRY" "$GHFAIL" "$APPLY_OUT"; cat "$FIX"/logs/*/* 2>/dev/null; } )"
check "journaux et sorties relus (témoin : W14 y figure)"           yes "$(grep -q 'w14-env' <<<"$ALL_OUT" && echo yes || echo no)"
check "valeur d'un fichier ignoré absente des sorties et journaux"  0 "$(grep -c 'fixture-only' <<<"$ALL_OUT" || true)"
check "nom d'un fichier ignoré absent des sorties et journaux"      0 "$(grep -c 'probe\.ts' <<<"$ALL_OUT" || true)"
check "W13 : commit détaché toujours référencé"                      yes "$(git -C "$R" worktree list --porcelain | grep -qx "HEAD $W13_SHA" && echo yes || echo no)"
check "W12 CLOSED non fusionnée : branche conservée"                 present "$(branch feat/w12-closed)"
check "B1 commit après tête PR : branche conservée"                  present "$(branch feat/b1-extra)"
check "B2 squash (pointe=tête PR) : branche supprimée (témoin)"      absent "$(branch feat/b2-squashed)"
check "B3 CLOSED avec commits : branche conservée"                   present "$(branch feat/b3-closed)"
check "B4 CLOSED déjà dans main : branche supprimée (témoin)"        absent "$(branch feat/b4-closed-in-main)"
check "B5 sans PR : branche conservée"                               present "$(branch feat/b5-nopr)"
check "B6 PR ouverte : branche conservée"                            present "$(branch feat/b6-open)"
check "gh : aucun appel autre que « pr list »"                       0 "$(grep -vc '^pr list ' "$FAKE_GH_CALLS" || true)"

# ---------------- 4. idempotence ----------------
AGAIN="$(cd "$R" && LOG_DIR="$FIX/logs/again" bash "$SCRIPT" --apply 2>&1)"; rc=$?
echo "[idempotence]"
check "2e apply : code de sortie"                   0 "$rc"
# BRANCH-DEL n'est écrit que dans le journal : les deux sources sont lues, avec un témoin.
check "1er apply : suppressions journalisées (témoin)" yes "$(cat "$FIX"/logs/apply/* 2>/dev/null | grep -qE '^BRANCH-DEL ' && echo yes || echo no)"
check "2e apply : aucune suppression supplémentaire" 0 "$( { printf '%s\n' "$AGAIN"; cat "$FIX"/logs/again/* 2>/dev/null; } | grep -cE '^(REMOVED|BRANCH-DEL) ' || true)"
check "2e apply : aucun échec de suppression"        0 "$(grep -c '^FAIL ' <<<"$AGAIN" || true)"

if [[ "${VERBOSE:-0}" == "1" ]]; then echo "--- sortie dry-run ---"; echo "$DRY"; echo "--- sortie apply ---"; echo "$APPLY_OUT"; echo "--- sortie gh en échec ---"; echo "$GHFAIL"; fi
if [[ "$FAIL" == "0" ]]; then echo "TOUS LES TESTS PASSENT"; else echo "TESTS EN ÉCHEC"; fi
exit "$FAIL"
