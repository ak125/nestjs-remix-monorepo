#!/usr/bin/env bash
# ==============================================================================
# rag-knowledge-backup.sh — archive quotidienne de rag/knowledge, issue enregistrée
#
# Remplace deux lignes de la crontab de l'utilisateur deploy sur DEV, qui jetaient
# leurs erreurs (2>/dev/null) et n'avaient donc aucun lecteur en cas d'échec :
#   0 3 * * * tar czf /opt/automecanik/backups/rag-knowledge-$(date +\%Y\%m\%d).tar.gz -C /opt/automecanik/rag knowledge/ 2>/dev/null
#   0 4 * * * find /opt/automecanik/backups -name "rag-knowledge-*.tar.gz" -mtime +7 -delete 2>/dev/null
# Ligne de remplacement :
#   0 3 * * * /usr/bin/bash /opt/automecanik/app/scripts/cron/rag-knowledge-backup.sh >> /opt/automecanik/rag/logs/rag-knowledge-backup.log 2>&1
#
# Comportement :
#   - attend le verrou RAG global (partagé avec sync-rag-from-wiki.sh, horaire, et
#     reindex_two_pass_cron.sh) : l'archive ne capture pas un dossier en cours d'écriture ;
#   - écrit l'archive sous un nom temporaire, la contrôle (gzip -t), puis la renomme :
#     une archive tronquée ne prend jamais le nom du jour ;
#   - l'archive garde le mode 0600 du fichier temporaire (mktemp) : lisible par deploy seul.
#     L'ancienne ligne tar suivait l'umask (0664). Aucun autre lecteur des archives
#     (crontab, scripts, cron système : vérifié le 2026-11-13) ; une restauration se fait
#     sous deploy ;
#   - ne retire les archives de plus de RAG_BACKUP_KEEP_DAYS jours qu'après une archive
#     réussie. Avant, la purge de 04:00 tournait même si la sauvegarde avait échoué :
#     huit échecs de suite effaçaient toutes les archives.
#
# Lecteur : cron_report (lib-supabase-report.sh) → hook SessionStart
#   (scripts/claude-hooks/sessionstart-workspace-context.sh) : ÉCHEC, ou MUET au-delà de
#   CRON_REPORT_MAX_AGE_S sans passage.
#
# Env (surcharges pour le test) :
#   AUTOMECANIK_RAG_PATH   (défaut /opt/automecanik/rag)
#   RAG_BACKUP_DIR         (défaut /opt/automecanik/backups)
#   RAG_BACKUP_KEEP_DAYS   (défaut 7, même seuil que l'ancienne ligne find -mtime +7)
#   RAG_GLOBAL_LOCK        (défaut /tmp/rag-global.lock)
#   RAG_BACKUP_LOCK_WAIT_S (défaut 900)
#   CRON_REPORT_MAX_AGE_S  (défaut 93600 : passage quotidien, 2 h de marge)
# ==============================================================================
set -euo pipefail

RAG_PATH="${AUTOMECANIK_RAG_PATH:-/opt/automecanik/rag}"
BACKUP_DIR="${RAG_BACKUP_DIR:-/opt/automecanik/backups}"
KEEP_DAYS="${RAG_BACKUP_KEEP_DAYS:-7}"
GLOBAL_LOCK="${RAG_GLOBAL_LOCK:-/tmp/rag-global.lock}"
LOCK_WAIT_S="${RAG_BACKUP_LOCK_WAIT_S:-900}"
CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-93600}"

LOG_TAG=rag-knowledge-backup
START="$(date +%s)"
# shellcheck source=lib-supabase-report.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-supabase-report.sh" 2>/dev/null || true

STEP=start
OUTCOME=""
FAILURE=""
TMP_ARCHIVE=""
TAR_ERR=""
METRICS=""
report_outcome() {
  local rc=$? status=ok summary
  if [ -n "$TMP_ARCHIVE" ]; then rm -f -- "$TMP_ARCHIVE"; fi
  if [ -n "$TAR_ERR" ]; then rm -f -- "$TAR_ERR"; fi
  if [ "$rc" -ne 0 ]; then
    status=error
    summary="échec à l'étape ${STEP} (code ${rc})${FAILURE:+ : ${FAILURE}} ; aucune archive retirée"
  else
    summary="$OUTCOME"
  fi
  log "$status — $summary"
  if command -v cron_report >/dev/null 2>&1; then
    cron_report "$LOG_TAG" "$status" "$(( $(date +%s) - START ))" "$METRICS" "$summary"
  else
    echo "WARN: cron_report indisponible (lib-supabase-report.sh non chargée) — issue du run NON enregistrée" >&2
  fi
}
log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*"; }
trap report_outcome EXIT

STEP=contrôles
[[ "$KEEP_DAYS" =~ ^[1-9][0-9]*$ ]] || { FAILURE="RAG_BACKUP_KEEP_DAYS invalide '${KEEP_DAYS}'"; exit 2; }
[[ "$LOCK_WAIT_S" =~ ^[0-9]+$ ]] || { FAILURE="RAG_BACKUP_LOCK_WAIT_S invalide '${LOCK_WAIT_S}'"; exit 2; }
[ -d "$RAG_PATH/knowledge" ] || { FAILURE="dossier source absent : $RAG_PATH/knowledge"; exit 2; }
[ -d "$BACKUP_DIR" ] || { FAILURE="dossier de sauvegarde absent : $BACKUP_DIR"; exit 2; }

STEP=verrou
exec 8>"$GLOBAL_LOCK"
flock -w "$LOCK_WAIT_S" 8 || { FAILURE="verrou RAG ($GLOBAL_LOCK) encore tenu après ${LOCK_WAIT_S} s"; exit 3; }

STEP=archive
DEST="$BACKUP_DIR/rag-knowledge-$(date +%Y%m%d).tar.gz"
TMP_ARCHIVE="$(mktemp "$BACKUP_DIR/.rag-knowledge-tmp.XXXXXX")"
TAR_ERR="$(mktemp "${TMPDIR:-/tmp}/rag-knowledge-backup-err.XXXXXX")"
if ! tar czf "$TMP_ARCHIVE" -C "$RAG_PATH" knowledge/ 2>"$TAR_ERR"; then
  FAILURE="tar : $(grep -m1 . "$TAR_ERR" || echo 'sans message')"
  cat "$TAR_ERR" >&2
  exit 4
fi

STEP=contrôle-archive
gzip -t "$TMP_ARCHIVE" || { FAILURE="archive illisible (gzip -t)"; exit 5; }
mv -f -- "$TMP_ARCHIVE" "$DEST"
TMP_ARCHIVE=""
SIZE=$(stat -c %s "$DEST")

# Purge seulement après une archive réussie ; l'archive du jour n'a jamais +KEEP_DAYS jours.
STEP=purge
PRUNED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'rag-knowledge-*.tar.gz' -mtime +"$KEEP_DAYS" -print -delete | wc -l)
KEPT=$(find "$BACKUP_DIR" -maxdepth 1 -name 'rag-knowledge-*.tar.gz' | wc -l)

METRICS="{\"size_bytes\":${SIZE},\"pruned\":${PRUNED},\"kept\":${KEPT}}"
OUTCOME="$(basename "$DEST") ($(( SIZE / 1048576 )) Mo) ; ${PRUNED} archive(s) de plus de ${KEEP_DAYS} j retirée(s), ${KEPT} conservée(s)"
