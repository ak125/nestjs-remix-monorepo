#!/usr/bin/env bash
# ==============================================================================
# registry-self-heal.sh — répare la dérive des projections registry (cron DEV)
#
# CONTEXTE (cf. mémoire project_dependabot_registry_self_heal_20260708) :
#   Dependabot bump les manifests package.json sans régénérer les 2 projections
#   déterministes du Repository Control Plane (ADR-058/062) :
#     - audit/registry/deps.json
#     - audit/dependencies/dependency-modernization-inventory.json
#   Les gates CI de fraîcheur DÉTECTENT la dérive mais ne la réparent pas, et un
#   workflow GitHub ne peut PAS la réparer seul : push direct sur main rejeté
#   (GH006, enforce_admins + required checks — prouvé run 28922013091) et une PR
#   créée par GITHUB_TOKEN ne déclenche pas la CI. L'owner a refusé tout secret
#   stocké (App/PAT) → le heal tourne ICI, sur la box DEV, avec la session `gh`
#   qui existe déjà (ak125) — aucun credential copié nulle part.
#
# CE QUE FAIT CE SCRIPT (idempotent, no-op si main frais) :
#   1. fetch origin/main + worktree jetable au tip (sous .claude/worktrees/ pour
#      hériter du node_modules du checkout principal par résolution ascendante)
#   2. régénère les 2 projections via les scripts gouvernés (les MÊMES que
#      dependency-family-bump.yml) ; zéro diff → no-op
#   3. scope-guard : tout fichier hors des 2 projections → ABORT (jamais de
#      commit partiel — canon no-silent-fallback)
#   4. branche fixe chore/registry-self-heal → push → PR (la CI tourne dessus :
#      gates de fraîcheur + 13 required checks re-valident TOUT) → auto-merge
#
# PHILOSOPHIE : alerter, jamais casser (même contrat que sync-dev-runtime.sh).
#   Le script n'écrit JAMAIS dans le checkout principal ni sur main directement ;
#   la seule voie d'entrée vers main est une PR verte auto-mergée.
#   Le workflow .github/workflows/registry-deps-self-heal.yml reste en place
#   comme FILET DE DÉTECTION cloud (warn-only sans identité) si cette box dort.
#
# Cron : */30 * * * * (voir crontab deploy). Log : /tmp/registry-self-heal.log
# Usage : registry-self-heal.sh [--check]
#   --check : dry-run — détecte et loggue la dérive, ne pousse RIEN (ni branche,
#             ni PR, ni auto-merge). Pour vérification manuelle / smoke-test.
# ==============================================================================
set -uo pipefail

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
APP_DIR="${APP_DIR:-/opt/automecanik/app}"
REPO_SLUG="${REPO_SLUG:-ak125/nestjs-remix-monorepo}"
HEAL_BRANCH="chore/registry-self-heal"
WT_DIR="$APP_DIR/.claude/worktrees/registry-self-heal-cron"
DEPS_FILE="audit/registry/deps.json"
INV_FILE="audit/dependencies/dependency-modernization-inventory.json"
LOG_TAG="registry-self-heal"
LOCK_FILE="/tmp/${LOG_TAG}.lock"
START=$(date +%s)

cd "$APP_DIR" 2>/dev/null || { echo "[$LOG_TAG] FATAL: $APP_DIR introuvable" >&2; exit 1; }

# shellcheck disable=SC1091
source scripts/cron/lib-supabase-report.sh 2>/dev/null || true

log()   { echo "[$LOG_TAG] $(date -u +%FT%TZ) $1"; }
alert() {
  echo "[$LOG_TAG] ⚠️ ALERT: $1" >&2
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -sf --max-time 5 -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' -d "{\"text\":\"[registry-self-heal] $1\"}" >/dev/null 2>&1 || true
}
report() { command -v cron_report >/dev/null 2>&1 && cron_report "$LOG_TAG" "$1" "$(( $(date +%s) - START ))" "${2:-{}}" "${3:-}" 2>/dev/null || true; }
abort()  { alert "$1"; report "error" "{}" "$1"; cleanup; exit 1; }

cleanup() {
  cd "$APP_DIR" 2>/dev/null || return 0
  git worktree remove "$WT_DIR" --force >/dev/null 2>&1 || true
  git branch -D "$HEAL_BRANCH" >/dev/null 2>&1 || true
}

# --- Lock : jamais deux runs concurrents (npm/regen peuvent durer) ------------
exec 9>"$LOCK_FILE"
flock -n 9 || { log "run précédent encore actif — skip"; exit 0; }

# --- Préconditions (fail loud, jamais silencieux) -----------------------------
command -v gh  >/dev/null 2>&1 || abort "gh CLI absent"
command -v node >/dev/null 2>&1 || abort "node absent"
gh auth token >/dev/null 2>&1 || abort "session gh non authentifiée (gh auth login)"
git fetch origin main --quiet 2>/dev/null || abort "git fetch origin main échoué (réseau ?)"

# --- Worktree jetable au tip origin/main --------------------------------------
cleanup  # purge un éventuel reste d'un run tué
git worktree add -b "$HEAL_BRANCH" "$WT_DIR" origin/main >/dev/null 2>&1 \
  || abort "création worktree échouée"
cd "$WT_DIR" || abort "cd worktree échoué"

TIP=$(git rev-parse --short HEAD)

# --- Régénération (scripts gouvernés — les mêmes que family-bump / CI gates) --
# deps builder = node pur (fs/crypto), lit les manifests du worktree.
node scripts/registry/build-deps-registry.js >/dev/null 2>&1 \
  || abort "build-deps-registry.js a échoué au tip $TIP"
# inventory builder = tsx ; résolu depuis le node_modules du checkout principal
# (résolution Node ascendante — le worktree vit SOUS $APP_DIR). La CI de la PR
# re-valide de toute façon le résultat (gate déterminisme BLOQUANT).
"$APP_DIR/node_modules/.bin/tsx" scripts/audit/build-dependency-modernization-inventory.ts >/dev/null 2>&1 \
  || abort "build-dependency-modernization-inventory.ts a échoué au tip $TIP (tsx du checkout principal)"

# --- No-op si frais ------------------------------------------------------------
if git diff --quiet -- "$DEPS_FILE" "$INV_FILE"; then
  log "main $TIP frais — no-op"
  report "ok" "{\"drift\":false,\"tip\":\"$TIP\"}"
  cleanup
  exit 0
fi

# --- Scope-guard : SEULES les 2 projections peuvent changer --------------------
UNEXPECTED=$(git diff --name-only HEAD | grep -vE "^(${DEPS_FILE}|${INV_FILE})$" || true)
[ -n "$UNEXPECTED" ] && abort "régénération a touché des fichiers hors scope : $UNEXPECTED"

log "drift détecté au tip $TIP :"
git --no-pager diff --stat -- "$DEPS_FILE" "$INV_FILE" | while read -r l; do log "  $l"; done

# --- Mode --check : on s'arrête ici, rien n'est poussé --------------------------
if [ "$CHECK_ONLY" = "1" ]; then
  log "--check : dry-run terminé (drift présent, AUCUNE écriture distante)"
  report "ok" "{\"drift\":true,\"tip\":\"$TIP\",\"dry_run\":true}"
  cleanup
  exit 0
fi

# --- Commit + push + PR + auto-merge -------------------------------------------
# HUSKY=0 : diff JSON-only, hooks lint-staged inutiles ici — la CI de la PR est
# le vrai gate (même raisonnement que dependency-family-bump.yml step cpr).
git add -- "$DEPS_FILE" "$INV_FILE"
HUSKY=0 git commit --quiet \
  -m "chore(registry): self-heal deps.json + modernization inventory" \
  -m "Auto-generated by scripts/ops/registry-self-heal.sh (cron DEV, session gh existante)." \
  -m "Régénéré depuis les manifests live au tip ${TIP} via registry:build:deps + build-dependency-modernization-inventory." \
  -m "Projections dérivées de package.json (ADR-058/062) — DO NOT EDIT manually." \
  || abort "git commit échoué"

git push --force-with-lease origin "$HEAL_BRANCH" >/dev/null 2>&1 \
  || abort "git push $HEAL_BRANCH échoué"

# PR : réutilise la PR ouverte si elle existe (le push l'a déjà mise à jour).
PR_NUM=$(gh pr list --repo "$REPO_SLUG" --head "$HEAL_BRANCH" --state open \
  --json number --jq '.[0].number' 2>/dev/null || true)
if [ -z "$PR_NUM" ]; then
  PR_URL=$(gh pr create --repo "$REPO_SLUG" --base main --head "$HEAL_BRANCH" \
    --title "chore(registry): self-heal deps.json + modernization inventory" \
    --body "Auto-générée par \`scripts/ops/registry-self-heal.sh\` (cron box DEV — voie sans secret stocké choisie par l'owner 2026-07-14).

Régénère les 2 projections registry depuis les manifests live après un bump de dépendance mergé sans elles (classe Dependabot). Diff = 2 fichiers JSON, scripts gouvernés ADR-058/062, re-validé intégralement par les gates CI de cette PR.

DO NOT EDIT manually." 2>&1 | tail -1) || abort "gh pr create échoué"
  PR_NUM=${PR_URL##*/}
  log "PR créée : #$PR_NUM"
else
  log "PR #$PR_NUM déjà ouverte — mise à jour par le push"
fi

gh pr merge "$PR_NUM" --repo "$REPO_SLUG" --auto --squash >/dev/null 2>&1 \
  || alert "auto-merge non armable sur #$PR_NUM (à vérifier à la main)"

log "heal en vol : PR #$PR_NUM (auto-merge armé, la CI décide)"
report "ok" "{\"drift\":true,\"tip\":\"$TIP\",\"pr\":$PR_NUM}"
cleanup
exit 0
