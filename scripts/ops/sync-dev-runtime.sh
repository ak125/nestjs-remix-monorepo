#!/usr/bin/env bash
# ==============================================================================
# sync-dev-runtime.sh — garde DEV:3000 aligné sur origin/main
#
# CONTEXTE (cf. mémoire feedback_dev_runtime_parity_4_gaps + deployment.md) :
#   DEV (46.224.118.55:3000) = environnement réel de dev/tests/MESURES, servi par
#   `npm run dev` (nodemon) DEPUIS CE working tree. Le merge `main` ne met à jour
#   que le container PREPROD — JAMAIS DEV:3000. Ce script comble ce trou : il
#   resynchronise le runtime DEV sur `origin/main` après chaque merge.
#
# PHILOSOPHIE : alerter, jamais casser. Si une dérive non auto-réparable est
#   détectée (env, version Node, migration, branche, working tree sale), le
#   script ABORTE proprement + alerte — il ne laisse jamais DEV dans un état pire.
#   Il n'upgrade PAS Node et n'applique PAS de migration DB (actions manuelles,
#   trop risquées en cron sur une DB partagée).
#
# Idempotent : no-op si le SHA local == origin/main. Conçu pour tourner en cron
#   (~10 min) sur la box DEV. Voir crontab `* /10 * * * *`.
# ==============================================================================
set -uo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
APP_DIR="${APP_DIR:-/opt/automecanik/app}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"
LOG_TAG="sync-dev-runtime"
START=$(date +%s)

cd "$APP_DIR" 2>/dev/null || { echo "[$LOG_TAG] FATAL: $APP_DIR introuvable" >&2; exit 1; }

# shellcheck disable=SC1091
source scripts/cron/lib-supabase-report.sh 2>/dev/null || true

log()   { echo "[$LOG_TAG] $1"; }
alert() {
  echo "[$LOG_TAG] ⚠️ ALERT: $1" >&2
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -sf --max-time 5 -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' -d "{\"text\":\"[DEV sync] $1\"}" >/dev/null 2>&1 || true
}
report() { command -v cron_report >/dev/null 2>&1 && cron_report "$LOG_TAG" "$1" "$(( $(date +%s) - START ))" "${2:-{}}" "${3:-}" 2>/dev/null || true; }
abort()  { alert "$1"; report "error" "{}" "$1"; exit 1; }

# 5e axe de dérive — Workspaces npm (drift install/dist).
# Détecte (sans corriger — canon no-silent-fallback) :
#   - packages/*/package.json sans symlink node_modules/<name>   → install manquant
#   - packages/* avec "main": "./dist/..." sans fichier dist/    → build manquant
# Pourquoi : npm install (étape 6) ne tourne que si package-lock.json change ;
# turbo build skip aussi un workspace si sa dépendance graph ne l'inclut pas.
# Un workspace fraîchement mergé peut donc rester invisible jusqu'au boot crash
# backend (cf. incident 2026-05-25 : @repo/domain-commerce + @repo/cwv-taxonomy
# présents sur disque mais sans symlinks ni dist → MODULE_NOT_FOUND).
# Sortie : exit 0 = sain · exit 1 = drift détecté (alerté avant retour).
check_workspace_integrity() {
  # Dépendance dure : `jq` est requis pour parser package.json sans heuristique
  # fragile. Faute explicite (pas un skip silencieux) — canon no-silent-fallback.
  command -v jq >/dev/null 2>&1 || {
    alert "jq absent — check_workspace_integrity ne peut pas s'exécuter (apt install jq)"
    return 2
  }

  local missing_links=() missing_dist=()
  local pkgdir pkg_name main_field

  for pkgdir in packages/*/; do
    [ -f "${pkgdir}package.json" ] || continue
    pkg_name=$(jq -r '.name // empty' "${pkgdir}package.json" 2>/dev/null)
    [ -n "$pkg_name" ] || continue

    if [ ! -e "node_modules/${pkg_name}" ]; then
      missing_links+=("$pkg_name")
      continue
    fi

    main_field=$(jq -r '.main // empty' "${pkgdir}package.json" 2>/dev/null)
    if [[ "$main_field" == *"/dist/"* ]]; then
      [ -f "${pkgdir}${main_field#./}" ] || missing_dist+=("$pkg_name")
    fi
  done

  local drift=0
  if [ "${#missing_links[@]}" -gt 0 ]; then
    alert "workspaces sans symlink node_modules (run: npm install) : ${missing_links[*]}"
    drift=1
  fi
  if [ "${#missing_dist[@]}" -gt 0 ]; then
    alert "workspaces sans dist compilé (run: npm run build) : ${missing_dist[*]}"
    drift=1
  fi
  return "$drift"
}

# ---------------------------------------------------------------------------
# Sonde de topologie runtime — 6e axe de dérive.
#
# POURQUOI ELLE EXISTE : le 2026-09-09 09:01:41, `turbo dev` (superviseur du
# stack DEV) est mort en SIGSEGV. Ses tâches persistantes ont survécu,
# reparentées à PID 1, et `:3000` a continué de répondre 200. Résultat : plus
# aucun superviseur, mais TOUS les signaux existants restaient au vert. La
# cause du crash est un bug amont (turbo 2.10.0, cf. audit) — ce que cette
# sonde corrige, c'est le SILENCE, qui lui est local.
#
# CE QU'ELLE AJOUTE que /health ne peut pas voir : /health interroge le
# processus backend, pas la chaîne qui le supervise. Un superviseur mort avec
# enfants orphelins rend exactement le même 200 qu'un stack sain. Le seul
# signal qui distingue les deux est TOPOLOGIQUE (qui est le parent), pas HTTP.
#
# POURQUOI AVANT LES GARDES GIT (1 et 2) : la mort du superviseur est un fait
# runtime, sans rapport avec l'état git. Les gardes branche/working-tree font
# `abort` ; placée après elles, la sonde ne verrait jamais un incident survenu
# pendant qu'une branche feature ou un fichier modifié traîne dans le checkout.
# C'est précisément l'état du 2026-09-09 (branche feature + turbo.json modifié)
# : le cron abortait à l'étape 1 et n'a rien probé pendant ~10 h.
#
# ALERT-ONLY, JAMAIS `abort` : un abort ici stopperait les axes de resync git
# qui gardent DEV:3000 frais — on transformerait un incident d'observabilité en
# panne de synchronisation.
check_dev_runtime_topology() {
  local drift=0 stamp="/tmp/.${LOG_TAG}-topology-stamp"

  # (a) Santé HTTP à CHAQUE tick. L'unique appel à $HEALTH_URL du script vit
  #     dans l'étape 8, atteignable seulement sur le chemin de resync : quand
  #     HEAD == origin/main (le cas nominal) le script sortait sans avoir rien
  #     probé du runtime.
  #     Debounce volontaire (3 essais / 5 s) : nodemon coupe :3000 quelques
  #     secondes à chaque rebuild tsc. Sans ça le cron alerterait sur une
  #     fenêtre de redémarrage normale, et une alerte qui crie faux finit
  #     ignorée — exactement le mode de panne qu'on cherche à supprimer.
  local up=0 i
  for i in 1 2 3; do
    if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then up=1; break; fi
    [ "$i" -lt 3 ] && sleep 5
  done
  if [ "$up" != "1" ]; then
    alert "DEV:3000 ne répond pas après 3 essais ($HEALTH_URL) — runtime DOWN"
    drift=1
  fi

  # (b) Superviseur mort, enfants orphelins. Signature exacte de l'incident :
  #     une racine de stack dev reparentée à PID 1. Dans un stack sain la
  #     racine a un parent shell/tmux/VS Code, jamais init. On restreint au
  #     cwd du repo pour ne pas compter un autre projet de la machine.
  local orphans=() pid ppid cwd cmd
  while read -r pid ppid cmd; do
    [ "$ppid" = "1" ] || continue
    case "$cmd" in *"npm run dev"*|*"turbo dev"*) ;; *) continue ;; esac
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null) || continue
    case "$cwd" in "$APP_DIR"*) orphans+=("$pid") ;; esac
  done < <(ps -eo pid=,ppid=,args= 2>/dev/null)
  if [ "${#orphans[@]}" -gt 0 ]; then
    alert "superviseur dev MORT — ${#orphans[@]} racine(s) orpheline(s) reparentée(s) à PID 1 (pids: ${orphans[*]}). Le stack tourne sans superviseur : /health reste vert mais plus rien ne surveille les watchers. Cf. turbo 2.10.0 SIGSEGV au shutdown."
    drift=1
  fi

  # (c) Stacks dev concurrents. Après le crash du 2026-09-09, deux arbres
  #     `npm run dev` tournaient en parallèle sur le même backend/dist : deux
  #     tsc écrivant le même dist, deux nodemon le surveillant. État instable
  #     qu'aucun signal existant ne rendait visible.
  local all_roots
  all_roots=$(pgrep -c -f '^npm run dev$' 2>/dev/null || true)
  if [ "${all_roots:-0}" -gt 1 ]; then
    alert "stacks dev CONCURRENTS : $all_roots racines \`npm run dev\` simultanées — elles se disputent backend/dist (tsc + nodemon en double). Une seule doit tourner."
    drift=1
  fi

  # (d) Crash dumps frais imputables au repo. La machine écrit déjà des dumps
  #     apport dans /var/crash ; personne ne les lit jamais (aucun script du
  #     repo ne référence /var/crash — vérifié). On ne lit PAS le contenu des
  #     dumps (pas de privilège requis) : uniquement nom + mtime.
  if [ -d /var/crash ]; then
    local newdumps
    if [ -f "$stamp" ]; then
      newdumps=$(find /var/crash -maxdepth 1 -name '*.crash' -newer "$stamp" 2>/dev/null \
                 | grep -E 'automecanik|turbo|node' || true)
    else
      newdumps=$(find /var/crash -maxdepth 1 -name '*.crash' -mmin -15 2>/dev/null \
                 | grep -E 'automecanik|turbo|node' || true)
    fi
    if [ -n "$newdumps" ]; then
      alert "crash dump(s) frais dans /var/crash : $(echo "$newdumps" | tr '\n' ' ')— un process du stack a crashé (SIGSEGV/SIGBUS). Inspecter avec: grep -a '^Signal\|^ProcCmdline' <fichier>"
      drift=1
    fi
  fi
  touch "$stamp" 2>/dev/null || true

  return "$drift"
}

# 0. Sonde de topologie runtime (6e axe) — AVANT les gardes git, alert-only.
#    Voir l'en-tête de check_dev_runtime_topology pour le « pourquoi avant ».
check_dev_runtime_topology || true

# 1. Garde branche : le checkout runtime DOIT rester sur main (features = worktrees).
branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || abort "checkout sur '$branch' (pas main) — resync refusée (cf. convention worktree)"

# 2. Garde working tree sale (on tolère le bruit log.md du hook session-log).
dirty=$(git status --porcelain --untracked-files=no | grep -vE '(^| )log\.md$' || true)
[ -z "$dirty" ] || abort "working tree sale — resync refusée: $(echo "$dirty" | tr '\n' ' ')"

# 3. Fetch + comparer.
git fetch --quiet origin main || abort "git fetch échoué"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse origin/main)
if [ "$local_sha" = "$remote_sha" ]; then
  # Pas de sync git — mais on probe quand même l'intégrité workspaces. Un drift
  # ici (symlink supprimé, dist effacé entre 2 ticks cron, install manuel
  # interrompu) doit être visible AVANT que nodemon redémarre et crashe.
  if ! check_workspace_integrity; then
    report "error" "{\"action\":\"workspace_drift_noop\",\"sha\":\"$local_sha\"}" "workspace drift detected without git change"
    exit 1
  fi
  report "ok" "{\"action\":\"noop\",\"sha\":\"$local_sha\"}" ""
  exit 0
fi

# 4. Fast-forward only (jamais reset --hard ; une divergence = réconciliation manuelle).
# La garde l.96 "tolère" le bruit log.md dans le check de propreté, mais
# `git merge --ff-only` butait QUAND MÊME dessus quand log.md a aussi avancé en
# amont (refus d'écraser une modif locale) → le cron avortait en boucle ici =
# drift silencieux (31 commits observés le 2026-06-16, violation no-silent-fallback).
# On matérialise donc la tolérance : reset du SEUL log.md (régénéré par le hook
# session-log) avant le ff. Sûr — la garde l.96-97 a déjà refusé tout autre fichier
# sale ; jamais de `reset --hard`, seul ce fichier auto-généré est touché.
if ! git diff --quiet -- log.md 2>/dev/null; then
  git checkout --quiet -- log.md \
    && log "bruit log.md local réinitialisé avant ff (toléré, régénéré par session-log)"
fi
# Généralisation de la tolérance log.md (ci-dessus) à TOUTE collision de fichier
# untracked : `git merge --ff-only` avorte si un fichier AJOUTÉ en amont existe
# déjà localement en untracked (ex. skill workspace créé hors-git, observé le
# 2026-06-20 : DEV figé 3j / 34 commits). Sans ça = cron qui avorte en boucle =
# drift silencieux (même classe que l'incident log.md). On SAUVEGARDE (réversible,
# zéro perte) puis on continue ; l'alerte (stderr → MAILTO) rend l'éviction
# observable. Jamais de suppression : seulement un déplacement vers /tmp.
collisions=$(git diff --name-only --diff-filter=A "$local_sha".."$remote_sha" 2>/dev/null \
  | while IFS= read -r f; do
      [ -n "$f" ] && [ -e "$f" ] \
        && ! git ls-files --error-unmatch "$f" >/dev/null 2>&1 \
        && printf '%s\n' "$f"
    done)
if [ -n "$collisions" ]; then
  bkdir="/tmp/${LOG_TAG}-untracked-backup-$(date +%Y%m%d-%H%M%S)"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    mkdir -p "$bkdir/$(dirname "$f")" && mv "$f" "$bkdir/$f"
  done <<< "$collisions"
  alert "fichiers untracked en collision avec le ff — sauvegardés dans $bkdir puis écartés : $(printf '%s ' $collisions)"
fi
git merge --ff-only origin/main || abort "non fast-forwardable (lignée divergente) — réconcilier main à la main"
log "synced $local_sha → $remote_sha"

# 5. Garde parité Node (.nvmrc) — alerte seulement (upgrade = manuel via NodeSource).
want_major=$(tr -d 'v' < .nvmrc 2>/dev/null | cut -d. -f1)
have_major=$(node -v 2>/dev/null | tr -d 'v' | cut -d. -f1)
if [ -n "$want_major" ] && [ -n "$have_major" ] && [ "$want_major" != "$have_major" ]; then
  alert "dérive Node : v$have_major installé, .nvmrc=$want_major attendu — l'app peut crasher ; upgrade manuel requis (NodeSource setup_${want_major}.x)"
fi

# 6. npm ci si lockfile changé, puis build. Sorties capturées dans /tmp et
#    re-déversées (tail -50) sur stderr en cas d'échec — pas de silencement total
#    (canon no-silent-fallback). Logs gardés sur disque pour postmortem manuel.
#
#    `npm ci` (pas `npm install`) DÉLIBÉRÉMENT : DEV est un miroir read-only de
#    l'état COMMITTÉ de `main`. `npm install` réécrit les annotations du lockfile
#    (dev/peer/optional) selon le node_modules local → working tree sali → bloque
#    le ff-pull du run suivant (cause de la dérive 2026-06). `npm ci` est
#    déterministe : installe EXACTEMENT le lockfile committé, ne le réécrit JAMAIS
#    (échoue franc si package.json↔lockfile désync, ce qui aligne no-silent-fallback).
#    C'est aussi ce que fait la CI. Contrepartie assumée : `npm ci` purge
#    node_modules avant réinstall → un échec laisse DEV sans deps jusqu'au prochain
#    run ; le cron alerte déjà (abort ci-dessous) et re-tente au tick suivant (~10 min).
INSTALL_LOG="/tmp/${LOG_TAG}-npm-install-$$.log"
BUILD_LOG="/tmp/${LOG_TAG}-npm-build-$$.log"
if ! git diff --quiet "$local_sha" "$remote_sha" -- package-lock.json 2>/dev/null; then
  log "package-lock.json modifié → npm ci (install déterministe, log: $INSTALL_LOG)"
  if ! npm ci >"$INSTALL_LOG" 2>&1; then
    tail -50 "$INSTALL_LOG" >&2
    abort "npm ci échoué — log complet : $INSTALL_LOG"
  fi
fi
if ! npm run build >"$BUILD_LOG" 2>&1; then
  tail -50 "$BUILD_LOG" >&2
  abort "npm run build échoué — log complet : $BUILD_LOG"
fi

# 6b. Probe d'intégrité workspaces post-build (5e axe). Si install/build sont
#     passés "verts" mais qu'un workspace reste sans symlink ou sans dist, c'est
#     un drift silencieux (turbo a skippé, lockfile pas refreshé, etc.). On
#     refuse de marquer ":3000 sain" sans l'avoir vérifié.
check_workspace_integrity || abort "drift workspaces après npm install + build — install/build incomplet (cf. alerts ci-dessus)"

# 7. Redémarrer le runtime (nodemon surveille dist ; le build l'a réécrit, on force un boot propre).
touch backend/dist/main.js

# 8. Health check avec retries — un échec ici = dérive non auto-réparable (env manquant,
#    migration DB pendante, Node…). On alerte pour intervention manuelle, sans masquer.
healthy=0
for i in $(seq 1 12); do
  sleep 5
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then healthy=1; break; fi
done
if [ "$healthy" != "1" ]; then
  abort ":3000 KO après resync vers $remote_sha — vérifier : env (env-validation.ts), migrations DB pendantes, version Node"
fi

log "✅ DEV:3000 sain sur $remote_sha"
report "ok" "{\"action\":\"synced\",\"from\":\"$local_sha\",\"to\":\"$remote_sha\"}" ""
exit 0
