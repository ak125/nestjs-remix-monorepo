#!/bin/bash

# ==============================================================================
# Script d'initialisation de l'index Meilisearch pour les logs
# ==============================================================================

set -e

MEILISEARCH_HOST=${MEILISEARCH_HOST:-http://localhost:7700}
MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY:-}

if [ -z "$MEILISEARCH_API_KEY" ]; then
    echo "❌ Erreur: MEILISEARCH_API_KEY non définie"
    exit 1
fi

echo "🔧 Configuration de l'index Meilisearch access_logs"
echo "===================================================="
echo ""

# 1. Configurer les champs filtrables (pour les facettes et filtres)
echo "📋 Configuration des champs filtrables..."
curl -s -X PATCH "$MEILISEARCH_HOST/indexes/access_logs/settings" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "filterableAttributes": [
            "status",
            "method",
            "day",
            "ts",
            "marque",
            "modele",
            "type",
            "pieces_category",
            "bot",
            "country",
            "city"
        ]
    }' | jq

echo ""

# 2. Configurer les champs cherchables (full-text search)
echo "🔍 Configuration des champs cherchables..."
curl -s -X PATCH "$MEILISEARCH_HOST/indexes/access_logs/settings" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "searchableAttributes": [
            "path",
            "route",
            "referer",
            "ua"
        ]
    }' | jq

echo ""

# 3. Configurer les champs triables
echo "📊 Configuration des champs triables..."
curl -s -X PATCH "$MEILISEARCH_HOST/indexes/access_logs/settings" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "sortableAttributes": [
            "ts",
            "latency_ms",
            "bytes_written",
            "day"
        ]
    }' | jq

echo ""

# 4. Configurer le nombre max de facettes
echo "🎯 Configuration des facettes..."
curl -s -X PATCH "$MEILISEARCH_HOST/indexes/access_logs/settings" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "faceting": {
            "maxValuesPerFacet": 100
        }
    }' | jq

echo ""

# 5. Afficher la configuration finale
echo "✅ Configuration appliquée avec succès!"
echo ""
echo "📋 Résumé de la configuration:"
curl -s "$MEILISEARCH_HOST/indexes/access_logs/settings" \
    -H "Authorization: Bearer $MEILISEARCH_API_KEY" | \
    jq '{
        filterableAttributes,
        searchableAttributes,
        sortableAttributes,
        faceting
    }'

echo ""
echo "🎉 Index access_logs configuré et prêt à l'emploi!"
