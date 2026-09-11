#!/usr/bin/env bash
# ==============================================================================
# lib-supabase-report.sh — dernier état des jobs cron, enregistré localement
#
# Usage:
#   source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || \
#     source /opt/automecanik/app/scripts/cron/lib-supabase-report.sh 2>/dev/null || true
#
#   cron_report "job-name" "ok|warn|error" duration_s '{"key": val}' "Summary text"
#
# Écrit atomiquement (fichier temporaire puis mv) le DERNIER état du job dans
#   $CRON_STATE_DIR/<job>.json
#   (défaut : ${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/cron)
#   { job, status, ts, since, streak, duration_s, max_age_s, summary, metrics }
#   - since / streak : début et longueur de la série en cours du même statut
#     (« en échec depuis 06:10, 14 exécutions »).
#   - max_age_s : cadence maximale attendue, que le job déclare via
#     CRON_REPORT_MAX_AGE_S. Sans elle, un cron qui ne tourne plus du tout reste
#     indétectable : il n'écrit plus rien.
#
# Lecteur : scripts/claude-hooks/sessionstart-workspace-context.sh alerte au début
#   de chaque session Claude sur tout job de la machine en error/warn, ou muet
#   au-delà de son max_age_s.
#
# Contrat d'échec : cron_report ne fait jamais échouer le job appelant (return 0),
#   mais un état non enregistré est signalé sur stderr — jamais en silence.
#
# POURQUOI PLUS DE POST SUPABASE (2026-09-11)
#   Cette lib postait vers `__cron_runs` avec `curl -sf … || true`, et sortait par
#   `return 0` quand SUPABASE_URL manquait. La table a été supprimée le 2026-03-15
#   par l'audit structurel DB (classée EMPTY_UNKNOWN, « consumer non confirmé »)
#   sans que ses écrivains soient retirés ; elle n'avait jamais reçu une ligne,
#   faute d'identifiants dans l'environnement cron. Chaque rapport disparaissait
#   donc sans trace, et la sync DEV est restée figée du 2026-09-08 au 2026-09-11
#   sans aucun signal. Le transport distant est retiré plutôt que ré-aiguillé : la
#   seule table vivante de santé des jobs, `__admin_job_health`, est agrégée dans
#   le statut global de l'admin PROD — y écrire l'état d'un cron de la machine DEV
#   mélangerait les environnements.
# ==============================================================================

cron_report() {
  local job_name="${1:-}"
  local status="${2:-}"
  local duration_s="${3:-0}"
  # Pas de "${4:-{}}" : bash ferme l'expansion au premier `}` et colle le second à toute
  # valeur fournie ('{"a":1}' → '{"a":1}}', rejeté puis remplacé par {}).
  local metrics="${4:-}"
  [ -n "$metrics" ] || metrics='{}'
  local summary="${5:-}"

  if ! [[ "$job_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "[cron_report] ⚠️ état NON enregistré : nom de job invalide '${job_name}'" >&2
    return 0
  fi
  case "$status" in
    ok|warn|error) ;;
    *)
      echo "[cron_report] ⚠️ état de '${job_name}' NON enregistré : statut '${status}' hors ok|warn|error" >&2
      return 0
      ;;
  esac
  [[ "$duration_s" =~ ^[0-9]+$ ]] || duration_s=0

  if ! command -v jq >/dev/null 2>&1; then
    echo "[cron_report] ⚠️ état de '${job_name}' NON enregistré : jq absent" >&2
    return 0
  fi
  jq -e 'type == "object"' <<<"$metrics" >/dev/null 2>&1 || metrics='{}'

  local max_age="${CRON_REPORT_MAX_AGE_S:-}"
  [[ "$max_age" =~ ^[1-9][0-9]*$ ]] || max_age=null

  local dir="${CRON_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/cron}"
  local file="${dir}/${job_name}.json"
  local now since streak prev prev_since prev_streak
  now=$(date +%s)
  since=$now
  streak=1

  # Série en cours : même statut qu'au tick précédent → on garde son début.
  if [ -f "$file" ]; then
    if prev=$(jq -c '{status, since, streak}' "$file" 2>/dev/null); then
      if [ "$(jq -r '.status' <<<"$prev")" = "$status" ]; then
        prev_since=$(jq -r '.since' <<<"$prev")
        prev_streak=$(jq -r '.streak' <<<"$prev")
        [[ "$prev_since" =~ ^[0-9]+$ ]] && since=$prev_since
        [[ "$prev_streak" =~ ^[0-9]+$ ]] && streak=$((prev_streak + 1))
      fi
    else
      echo "[cron_report] ⚠️ état précédent de '${job_name}' illisible (${file}) — nouvelle série" >&2
    fi
  fi

  local tmp
  if ! mkdir -p "$dir" 2>/dev/null || ! tmp=$(mktemp "${dir}/.${job_name}.XXXXXX" 2>/dev/null); then
    echo "[cron_report] ⚠️ état de '${job_name}' NON enregistré : ${dir} non inscriptible" >&2
    return 0
  fi
  if jq -n \
      --arg job "$job_name" --arg status "$status" --arg summary "$summary" \
      --argjson ts "$now" --argjson since "$since" --argjson streak "$streak" \
      --argjson duration_s "$duration_s" --argjson max_age_s "$max_age" \
      --argjson metrics "$metrics" \
      '{job: $job, status: $status, ts: $ts, since: $since, streak: $streak,
        duration_s: $duration_s, max_age_s: $max_age_s, summary: $summary,
        metrics: $metrics}' >"$tmp" 2>/dev/null \
     && mv -f "$tmp" "$file" 2>/dev/null; then
    return 0
  fi
  rm -f "$tmp"
  echo "[cron_report] ⚠️ état de '${job_name}' NON enregistré : écriture de ${file} échouée" >&2
  return 0
}
