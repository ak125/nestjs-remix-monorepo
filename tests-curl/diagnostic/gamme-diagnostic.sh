#!/bin/bash
# DIAGNOSTIC GAMME — Affiche l'état complet d'une gamme : RAG + SEO + Readiness
# Usage: bash tests-curl/diagnostic/gamme-diagnostic.sh <pg_alias>
# Exemple: bash tests-curl/diagnostic/gamme-diagnostic.sh disque-de-frein

set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
ALIAS="${1:?Usage: $0 <pg_alias>}"

# Auth check
if [ ! -f "$COOKIE_FILE" ]; then
  bash "$(dirname "$0")/../00-auth.sh"
fi

echo "========================================"
echo "  DIAGNOSTIC GAMME : $ALIAS"
echo "========================================"
echo ""

# ── 1. Trouver le pg_id ──
# Methode 1 : API catalog families
PG_ID=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/catalog/families" | \
  jq -r --arg a "$ALIAS" '[if type == "array" then .[] elif .data then .data[] else empty end | select(.pg_alias == $a or .alias == $a)] | .[0].pg_id // .[0].id // empty' 2>/dev/null)

if [ -z "$PG_ID" ]; then
  # Methode 2 : gammes-seo list
  PG_ID=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo?limit=5000" | \
    jq -r --arg a "$ALIAS" '[if type == "array" then .[] elif .data then .data[] else empty end | select(.pg_alias == $a)] | .[0].pg_id // empty' 2>/dev/null)
fi

if [ -z "$PG_ID" ]; then
  # Methode 3 : recherche directe par alias dans l'URL gamme (ex: pieces/batterie-1.html)
  # Tester les pg_id courants (1-10000) via le detail endpoint
  for TRY_ID in $(seq 1 5); do
    CHECK=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/$TRY_ID/detail" | \
      jq -r --arg a "$ALIAS" '.data.gamme.pg_alias // empty' 2>/dev/null)
    if [ "$CHECK" = "$ALIAS" ]; then
      PG_ID=$TRY_ID
      break
    fi
  done
fi

if [ -z "$PG_ID" ]; then
  # Methode 4 : RAG knowledge — extraire pg_id depuis les docs de cette gamme
  RAG_PG=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge" | \
    jq -r --arg a "$ALIAS" '[.[] | select(.gamme_aliases != null and (.gamme_aliases | tostring | contains($a)))] | .[0].source // empty' 2>/dev/null)
  if [ -n "$RAG_PG" ]; then
    echo "RAG doc trouvee pour $ALIAS mais pg_id non resolu. Utiliser le slug directement."
    PG_ID="unknown"
  fi
fi

if [ -z "$PG_ID" ]; then
  echo "ERREUR: gamme '$ALIAS' non trouvee"
  exit 1
fi
echo "pg_id: $PG_ID"
echo ""

# ── 2. État RAG ──
echo "--- RAG ---"
RAG_DOCS=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge")
GAMME_DOCS=$(echo "$RAG_DOCS" | jq --arg a "$ALIAS" '[.[] | select(.gamme_aliases != null and (.gamme_aliases | tostring | contains($a)))]' 2>/dev/null)
RAG_COUNT=$(echo "$GAMME_DOCS" | jq 'length' 2>/dev/null)

if [ "${RAG_COUNT:-0}" -gt 0 ]; then
  L1=$(echo "$GAMME_DOCS" | jq '[.[] | select(.truth_level == "L1")] | length' 2>/dev/null)
  L2=$(echo "$GAMME_DOCS" | jq '[.[] | select(.truth_level == "L2")] | length' 2>/dev/null)
  L3=$(echo "$GAMME_DOCS" | jq '[.[] | select(.truth_level == "L3")] | length' 2>/dev/null)
  DOMAINS=$(echo "$GAMME_DOCS" | jq -r '[.[].domain // "?"] | unique | join(", ")' 2>/dev/null)
  CATEGORIES=$(echo "$GAMME_DOCS" | jq -r '[.[].category // "?"] | unique | join(", ")' 2>/dev/null)
  echo "Docs: $RAG_COUNT (L1=$L1, L2=$L2, L3=$L3)"
  echo "Domaines: $DOMAINS"
  echo "Categories: $CATEGORIES"
else
  echo "AUCUN doc RAG pour cette gamme"
fi
echo ""

# ── 3. État SEO ──
echo "--- SEO ---"
DETAIL=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/$PG_ID/detail")
DETAIL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/$PG_ID/detail")

if [ "$DETAIL_CODE" = "200" ]; then
  # R1
  SG_CONTENT_LEN=$(echo "$DETAIL" | jq -r '.data.seo.sg_content // ""' 2>/dev/null | wc -c)
  SG_H1=$(echo "$DETAIL" | jq -r '.data.seo.sg_h1 // "ABSENT"' 2>/dev/null)
  SG_UPDATED=$(echo "$DETAIL" | jq -r '.data.seo.sg_updated_at // "?"' 2>/dev/null)
  if [ "$SG_CONTENT_LEN" -gt 100 ] 2>/dev/null; then
    echo "R1: ${SG_CONTENT_LEN}c, h1='${SG_H1:0:50}...', MAJ $SG_UPDATED [OK]"
  else
    echo "R1: ABSENT ou trop court (${SG_CONTENT_LEN}c) [MANQUE]"
  fi

  # Gamme name
  GAMME_NAME=$(echo "$DETAIL" | jq -r '.data.gamme.pg_name // .data.gamme.pg_alias // "?"' 2>/dev/null)
  echo "Gamme: $GAMME_NAME"
else
  echo "R1: endpoint inaccessible (HTTP $DETAIL_CODE)"
fi

# R3
R3_RESPONSE=$(curl -s "$BASE_URL/api/blog/conseil/$PG_ID")
R3_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/conseil/$PG_ID")
if [ "$R3_CODE" = "200" ]; then
  R3_SIZE=$(echo "$R3_RESPONSE" | jq 'tostring | length' 2>/dev/null)
  R3_SECTIONS=$(echo "$R3_RESPONSE" | jq '[.sections // [] | length] | .[0] // 0' 2>/dev/null)
  if [ "${R3_SIZE:-0}" -gt 500 ]; then
    echo "R3: ${R3_SIZE}c [OK]"
  else
    echo "R3: ${R3_SIZE}c [FAIBLE]"
  fi
else
  echo "R3: ABSENT (HTTP $R3_CODE) [MANQUE]"
fi

# R4
R4_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reference-auto/$ALIAS")
if [ "$R4_CODE" = "200" ]; then
  echo "R4: page reference existe [OK]"
else
  echo "R4: ABSENT (HTTP $R4_CODE) [MANQUE]"
fi

echo ""

# ── 4. Recommandations ──
echo "--- RECOMMANDATIONS ---"
RECO_COUNT=0

if [ "${RAG_COUNT:-0}" -eq 0 ]; then
  echo "1. PRIORITE : Ingerer au moins 1-2 URLs RAG pour cette gamme"
  echo "   curl -X POST $BASE_URL/api/rag/admin/ingest/web/single -b cookies -H 'Content-Type: application/json' -d '{\"url\":\"...\",\"truthLevel\":\"L2\"}'"
  RECO_COUNT=$((RECO_COUNT + 1))
fi

if [ "${RAG_COUNT:-0}" -gt 0 ] && [ "${RAG_COUNT:-0}" -lt 3 ]; then
  echo "$((RECO_COUNT + 1)). Couverture RAG faible ($RAG_COUNT docs). Ingerer 2-3 URLs supplementaires."
  RECO_COUNT=$((RECO_COUNT + 1))
fi

if [ "$SG_CONTENT_LEN" -lt 100 ] 2>/dev/null; then
  echo "$((RECO_COUNT + 1)). R1 absent ou trop court. Lancer force-enrich apres ingestion RAG."
  RECO_COUNT=$((RECO_COUNT + 1))
fi

if [ "$R3_CODE" != "200" ] || [ "${R3_SIZE:-0}" -lt 500 ]; then
  echo "$((RECO_COUNT + 1)). R3 conseil absent ou faible. Ingerer un guide de remplacement/entretien."
  RECO_COUNT=$((RECO_COUNT + 1))
fi

if [ "$R4_CODE" != "200" ]; then
  echo "$((RECO_COUNT + 1)). R4 reference absente. Ingerer une source technique/definition."
  RECO_COUNT=$((RECO_COUNT + 1))
fi

if [ "${RAG_COUNT:-0}" -ge 3 ] && [ "$SG_CONTENT_LEN" -gt 100 ] 2>/dev/null; then
  echo "$((RECO_COUNT + 1)). Gamme prete pour force-enrich :"
  echo "   curl -X POST $BASE_URL/api/admin/rag/pdf-merge/force-enrich -b cookies -H 'Content-Type: application/json' -d '{\"pgAlias\":\"$ALIAS\"}'"
  RECO_COUNT=$((RECO_COUNT + 1))
fi

if [ "$RECO_COUNT" -eq 0 ]; then
  echo "Aucune recommandation — gamme semble complete."
fi

echo ""
echo "========================================"
