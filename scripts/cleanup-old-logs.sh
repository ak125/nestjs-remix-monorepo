#!/bin/bash

# ==============================================================================
# Script de nettoyage des logs anciens dans Meilisearch
# ==============================================================================
# 
# Purge les logs de plus de RETENTION_DAYS jours pour Ã©viter la surcharge
# Meilisearch n'est pas une base time-series, on garde seulement les donnÃ©es rÃ©centes
#
# Usage: ./cleanup-old-logs.sh [retention_days]
# Exemple: ./cleanup-old-logs.sh 90
#

set -e

RETENTION_DAYS=${1:-90}
MEILISEARCH_HOST=${MEILISEARCH_HOST:-http://localhost:7700}
MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY:-}

# VÃ©rifier que la clÃ© API est fournie
if [ -z "$MEILISEARCH_API_KEY" ]; then
    echo "âŒ Erreur: MEILISEARCH_API_KEY non dÃ©finie"
    echo "Usage: MEILISEARCH_API_KEY=xxx ./cleanup-old-logs.sh [retention_days]"
    echo "Ou: source .env.vector && ./cleanup-old-logs.sh [retention_days]"
    exit 1
fi

echo "ðŸ§¹ Nettoyage des logs Meilisearch"
echo "================================="
echo "Host: $MEILISEARCH_HOST"
echo "RÃ©tention: $RETENTION_DAYS jours"
echo ""

# Calculer le timestamp limite (Unix timestamp en secondes)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CUTOFF_TIMESTAMP=$(date -v-${RETENTION_DAYS}d +%s)
    CUTOFF_DATE=$(date -v-${RETENTION_DAYS}d +%Y-%m-%d)
else
    # Linux
    CUTOFF_TIMESTAMP=$(date -d "$RETENTION_DAYS days ago" +%s)
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
fi

echo "ðŸ“… Date limite: $CUTOFF_DATE"
echo "ðŸ• Timestamp limite: $CUTOFF_TIMESTAMP"
echo "ðŸ—‘ï¸  Suppression des logs avant cette date..."
echo ""

# Compter les documents avant suppression
BEFORE_COUNT=$(curl -s "$MEILISEARCH_HOST/indexes/access_logs/stats" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" | \
    jq -r '.numberOfDocuments // 0')

echo "ðŸ“Š Documents avant: $BEFORE_COUNT"

# Supprimer les documents anciens (ts < cutoff_timestamp)
RESPONSE=$(curl -s -X POST "$MEILISEARCH_HOST/indexes/access_logs/documents/delete" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"filter\": \"ts < $CUTOFF_TIMESTAMP\"}")

TASK_UID=$(echo "$RESPONSE" | jq -r '.taskUid // empty')

if [ -z "$TASK_UID" ]; then
    echo "âŒ Erreur lors de la suppression:"
    echo "$RESPONSE" | jq
    exit 1
fi

echo "âœ… TÃ¢che de suppression crÃ©Ã©e: $TASK_UID"
echo "â³ Attente de la fin de la tÃ¢che..."

# Attendre la fin de la tÃ¢che (max 30 secondes)
for i in {1..30}; do
    sleep 1
    
    TASK_STATUS=$(curl -s "$MEILISEARCH_HOST/tasks/$TASK_UID" \
        -H "Authorization: Bearer $MEILISEARCH_API_KEY" | \
        jq -r '.status // empty')
    
    if [ "$TASK_STATUS" == "succeeded" ]; then
        echo "âœ… Suppression terminÃ©e avec succÃ¨s"
        break
    elif [ "$TASK_STATUS" == "failed" ]; then
        echo "âŒ Erreur lors de la suppression:"
        curl -s "$MEILISEARCH_HOST/tasks/$TASK_UID" \
            -H "Authorization: Bearer $MEILISEARCH_API_KEY" | jq
        exit 1
    fi
    
    echo -n "."
done

echo ""
echo ""

# Compter les documents aprÃ¨s suppression
AFTER_COUNT=$(curl -s "$MEILISEARCH_HOST/indexes/access_logs/stats" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" | \
    jq -r '.numberOfDocuments // 0')

DELETED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))

echo "ðŸ“Š RÃ©sultat:"
echo "  - Documents avant: $BEFORE_COUNT"
echo "  - Documents aprÃ¨s: $AFTER_COUNT"
echo "  - Documents supprimÃ©s: $DELETED_COUNT"
echo ""

if [ $DELETED_COUNT -gt 0 ]; then
    echo "ðŸŽ‰ Nettoyage rÃ©ussi! $DELETED_COUNT logs anciens supprimÃ©s"
else
    echo "â„¹ï¸  Aucun log ancien Ã  supprimer (tous < $RETENTION_DAYS jours)"
fi

echo ""
echo "ðŸ’¡ Pour automatiser, ajouter dans crontab:"
echo "   0 2 * * * cd /path/to/project && source .env.vector && ./scripts/cleanup-old-logs.sh $RETENTION_DAYS >> /var/log/meilisearch-cleanup.log 2>&1"
