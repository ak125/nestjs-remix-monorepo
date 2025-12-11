#!/bin/bash

##############################################################################
# ðŸ¤– CRON JOB - GÃ‰NÃ‰RATION SITEMAPS NIGHTLY
#
# ExÃ©cution : Tous les jours Ã  3h du matin
# DurÃ©e : ~10-15 minutes (selon volume)
# Environnement : Production
##############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/cron"
LOG_FILE="$LOG_DIR/sitemap-nightly-$(date +%Y-%m-%d).log"
LOCK_FILE="/tmp/sitemap-nightly.lock"

# Couleurs pour logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

##############################################################################
# Fonctions utilitaires
##############################################################################

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

##############################################################################
# VÃ©rifications prÃ©liminaires
##############################################################################

# CrÃ©er rÃ©pertoire logs si nÃ©cessaire
mkdir -p "$LOG_DIR"

# VÃ©rifier lock file (Ã©viter exÃ©cutions simultanÃ©es)
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        error "Another sitemap generation is already running (PID: $PID)"
        exit 1
    else
        warn "Stale lock file found, removing..."
        rm -f "$LOCK_FILE"
    fi
fi

# CrÃ©er lock file
echo $$ > "$LOCK_FILE"

# Cleanup lock file on exit
trap "rm -f $LOCK_FILE" EXIT

##############################################################################
# GÃ©nÃ©ration sitemaps
##############################################################################

log "ðŸš€ Starting nightly sitemap generation..."
log "ðŸ“ Project root: $PROJECT_ROOT"
log "ðŸ“ Log file: $LOG_FILE"

cd "$PROJECT_ROOT"

# 1. GÃ©nÃ©rer delta sitemap (changements du jour)
log "ðŸ”„ Step 1/4: Generating delta sitemap..."
START_TIME=$(date +%s)

if curl -X POST "http://localhost:3000/sitemap-v2/delta/generate" \
    -H "Content-Type: application/json" \
    -o /dev/null -s -w "%{http_code}" | grep -q "200"; then
    
    DELTA_TIME=$(($(date +%s) - START_TIME))
    log "âœ… Delta sitemap generated successfully (${DELTA_TIME}s)"
else
    error "âŒ Failed to generate delta sitemap"
    exit 1
fi

# 2. GÃ©nÃ©rer sitemaps streaming (produits, catalog)
log "ðŸ—œï¸ Step 2/4: Generating streaming sitemaps..."
START_TIME=$(date +%s)

if curl -X POST "http://localhost:3000/sitemap-v2/streaming/generate?type=all&includeHreflang=true&includeImages=true" \
    -H "Content-Type: application/json" \
    -o /dev/null -s -w "%{http_code}" | grep -q "200"; then
    
    STREAMING_TIME=$(($(date +%s) - START_TIME))
    log "âœ… Streaming sitemaps generated successfully (${STREAMING_TIME}s)"
else
    error "âŒ Failed to generate streaming sitemaps"
    exit 1
fi

# 3. Nettoyer anciens deltas (> 30 jours)
log "ðŸ§¹ Step 3/4: Cleaning up old deltas..."
START_TIME=$(date +%s)

if curl -X POST "http://localhost:3000/sitemap-v2/delta/cleanup" \
    -H "Content-Type: application/json" \
    -o /dev/null -s -w "%{http_code}" | grep -q "200"; then
    
    CLEANUP_TIME=$(($(date +%s) - START_TIME))
    log "âœ… Old deltas cleaned up successfully (${CLEANUP_TIME}s)"
else
    warn "âš ï¸ Failed to cleanup old deltas (non-critical)"
fi

# 4. VÃ©rifier statistiques
log "ðŸ“Š Step 4/4: Fetching generation statistics..."

STATS=$(curl -s "http://localhost:3000/sitemap-v2/delta/stats")
log "ðŸ“ˆ Delta stats: $STATS"

FILES=$(curl -s "http://localhost:3000/sitemap-v2/streaming/files" | jq -r '.data | length')
log "ðŸ“¦ Total sitemap files: $FILES"

##############################################################################
# Notification (optionnel)
##############################################################################

TOTAL_TIME=$((DELTA_TIME + STREAMING_TIME + CLEANUP_TIME))
log "ðŸŽ‰ Nightly sitemap generation completed successfully!"
log "â±ï¸ Total execution time: ${TOTAL_TIME}s"

# Envoyer notification Slack/Discord (optionnel)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"âœ… Sitemap generation completed in ${TOTAL_TIME}s\"}" \
        > /dev/null 2>&1 || warn "Failed to send Slack notification"
fi

##############################################################################
# Archivage logs (garder 7 derniers jours)
##############################################################################

log "ðŸ—‚ï¸ Archiving old logs..."
find "$LOG_DIR" -name "sitemap-nightly-*.log" -mtime +7 -delete
log "âœ… Old logs cleaned up"

exit 0
