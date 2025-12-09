#!/bin/bash

###############################################################################
# ðŸ”§ Init Meilisearch Index - SEO Audits
#
# Configure l'index Meilisearch pour stocker les rapports d'audit SEO
#
# Usage: ./scripts/init-meilisearch-seo-audits.sh
###############################################################################

set -euo pipefail

MEILISEARCH_HOST="${MEILISEARCH_HOST:-http://localhost:7700}"
MEILISEARCH_API_KEY="${MEILISEARCH_API_KEY}"
INDEX_NAME="seo_audits"

echo "ðŸ”§ Configuration de l'index Meilisearch pour les audits SEO"
echo "Host: $MEILISEARCH_HOST"
echo "Index: $INDEX_NAME"
echo ""

# VÃ©rifier que Meilisearch est accessible
if ! curl -s "$MEILISEARCH_HOST/health" > /dev/null; then
  echo "âŒ Erreur: Meilisearch n'est pas accessible sur $MEILISEARCH_HOST"
  exit 1
fi

echo "âœ… Meilisearch accessible"
echo ""

# CrÃ©er ou mettre Ã  jour l'index

## 1. Attributs filtrables (pour facettes et filtres)
echo "ðŸ“ Configuration des attributs filtrables..."
curl -X PATCH "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings/filterable-attributes" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    "audit_date",
    "audit_type",
    "triggered_by",
    "summary.status",
    "summary.total_errors",
    "summary.total_warnings",
    "results.xsd_validation",
    "results.noindex_urls",
    "results.http_errors",
    "results.hreflang_errors",
    "results.canonical_divergent",
    "indexed_at"
  ]'

echo ""

## 2. Attributs recherchables (full-text search)
echo "ðŸ“ Configuration des attributs recherchables..."
curl -X PATCH "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings/searchable-attributes" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    "sitemap_url",
    "output_dir"
  ]'

echo ""

## 3. Attributs triables
echo "ðŸ“ Configuration des attributs triables..."
curl -X PATCH "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings/sortable-attributes" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    "audit_date",
    "indexed_at",
    "summary.total_errors",
    "summary.total_warnings",
    "total_urls"
  ]'

echo ""

## 4. Configuration du faceting
echo "ðŸ“ Configuration du faceting..."
curl -X PATCH "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings/faceting" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "maxValuesPerFacet": 100
  }'

echo ""

## 5. Attributs affichÃ©s (optimisation perf)
echo "ðŸ“ Configuration des attributs affichÃ©s..."
curl -X PATCH "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings/displayed-attributes" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    "*"
  ]'

echo ""

## 6. ClÃ© primaire
echo "ðŸ“ Configuration de la clÃ© primaire..."
curl -X PATCH "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryKey": "audit_date"
  }'

echo ""

# Attendre que la configuration soit appliquÃ©e
echo "â³ Attente de l'indexation..."
sleep 3

# VÃ©rifier la configuration
echo ""
echo "ðŸ” VÃ©rification de la configuration..."

SETTINGS=$(curl -s "$MEILISEARCH_HOST/indexes/$INDEX_NAME/settings" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY")

echo "$SETTINGS" | jq .

echo ""
echo "âœ… Index SEO Audits configurÃ© avec succÃ¨s!"
echo ""
echo "ðŸ“Š Vous pouvez maintenant:"
echo "  - Lancer des audits via: POST /seo-logs/audit/run"
echo "  - Rechercher: GET /indexes/seo_audits/search?q=FAIL"
echo "  - Filtrer: GET /indexes/seo_audits/search?filter=summary.status=PASS"
echo "  - Trier: GET /indexes/seo_audits/search?sort=audit_date:desc"
