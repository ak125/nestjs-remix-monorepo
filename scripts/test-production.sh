#!/bin/bash
# =============================================================================
# 🧪 TESTS PRODUCTION AUTOMECANIK
# Date: 20/12/2024
# Usage: ./scripts/test-production.sh
# =============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           🧪 TESTS PRODUCTION AUTOMECANIK                     ║"
echo "║           $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# URLs de test
URL1="https://www.automecanik.com/pieces/plaquettes-de-frein/renault/clio-3/1-5-dci-68ch.html"
URL2="https://automecanik.com/pieces/filtre-a-huile/peugeot/308/1-6-hdi-92ch.html"
URL3="https://www.automecanik.com/pieces/kit-de-distribution/volkswagen/golf-7/2-0-tdi-150ch.html"
URL4="https://automecanik.com/pieces/alternateur/volkswagen/golf-7/2-0-tdi-150ch.html"

# Compteurs
PASS=0
FAIL=0

# Fonction pour afficher le résultat
result() {
    if [ "$1" = "PASS" ]; then
        echo "   ✅ $2"
        ((PASS++))
    else
        echo "   ❌ $2"
        ((FAIL++))
    fi
}

# =============================================================================
# TEST 1: CACHE CLOUDFLARE
# =============================================================================
echo "1️⃣  CACHE CLOUDFLARE"
echo "────────────────────────────────────────────────"

test_cache() {
    local url=$1
    local name=$2
    local ttfb=$(curl -s -o /dev/null -w "%{time_starttransfer}" "$url")
    local status=$(curl -s -I "$url" 2>/dev/null | grep -o "cf-cache-status: [A-Z]*" | awk '{print $2}')

    echo -n "   $name: TTFB=${ttfb}s | cf-cache-status=$status"

    if [ "$status" = "HIT" ]; then
        result "PASS" ""
    elif [ "$status" = "MISS" ]; then
        echo " (première requête, cache en cours de remplissage)"
    else
        result "FAIL" "Cache non actif"
    fi
}

test_cache "$URL1" "Plaquettes Clio 3"
test_cache "$URL2" "Filtre huile 308 "
test_cache "$URL3" "Kit distrib Golf 7"
test_cache "$URL4" "Alternateur Golf 7"

echo ""

# =============================================================================
# TEST 2: WEBP AUTOMATIQUE
# =============================================================================
echo "2️⃣  IMAGES BRUTES (Supabase Storage - Sans transformation)"
echo "────────────────────────────────────────────────────"

IMAGE_ORIGINAL="https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/260/6216001.JPG"
IMAGE_WEBP="https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/260/6216001.JPG"

ORIGINAL_SIZE=$(curl -s -I "$IMAGE_ORIGINAL" | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
WEBP_SIZE=$(curl -s -I "$IMAGE_WEBP" -H "Accept: image/webp" | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
WEBP_TYPE=$(curl -s -I "$IMAGE_WEBP" -H "Accept: image/webp" | grep -i "content-type" | awk '{print $2}' | tr -d '\r')

echo "   Image originale: ${ORIGINAL_SIZE} bytes ($(echo "scale=0; $ORIGINAL_SIZE/1024" | bc)KB)"
echo "   Image WebP:      ${WEBP_SIZE} bytes ($(echo "scale=0; $WEBP_SIZE/1024" | bc)KB)"
echo "   Content-Type:    ${WEBP_TYPE}"

if [ -n "$ORIGINAL_SIZE" ] && [ -n "$WEBP_SIZE" ] && [ "$ORIGINAL_SIZE" -gt 0 ]; then
    REDUCTION=$((100 - (WEBP_SIZE * 100 / ORIGINAL_SIZE)))
    echo "   Réduction:       -${REDUCTION}%"

    if [ "$REDUCTION" -gt 50 ]; then
        result "PASS" "Compression WebP efficace"
    else
        result "FAIL" "Compression insuffisante"
    fi
else
    result "FAIL" "Impossible de calculer la réduction"
fi

if [[ "$WEBP_TYPE" == *"webp"* ]]; then
    result "PASS" "Format WebP détecté"
else
    result "FAIL" "Format WebP non détecté"
fi

echo ""

# =============================================================================
# TEST 3: JSON-LD SCHEMA
# =============================================================================
echo "3️⃣  JSON-LD SCHEMA (duplication URL)"
echo "─────────────────────────────────────────────────────────────"

HTML=$(curl -s "$URL1")

if echo "$HTML" | grep -q "rack-images/https://"; then
    result "FAIL" "Duplication URL détectée (rack-images/https://)"
else
    result "PASS" "Pas de duplication URL dans JSON-LD"
fi

# Vérifier présence du schema
if echo "$HTML" | grep -q '"@type":"Product"'; then
    result "PASS" "Schema Product présent"
else
    result "FAIL" "Schema Product manquant"
fi

echo ""

# =============================================================================
# TEST 4: ROBOTS.TXT
# =============================================================================
echo "4️⃣  ROBOTS.TXT"
echo "──────────────"

ROBOTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://automecanik.com/robots.txt")

if [ "$ROBOTS_STATUS" = "200" ]; then
    result "PASS" "robots.txt accessible (HTTP $ROBOTS_STATUS)"
else
    result "FAIL" "robots.txt inaccessible (HTTP $ROBOTS_STATUS)"
fi

echo ""

# =============================================================================
# TEST 5: SITEMAP
# =============================================================================
echo "5️⃣  SITEMAP"
echo "───────────"

SITEMAP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://automecanik.com/sitemap.xml")

if [ "$SITEMAP_STATUS" = "200" ]; then
    result "PASS" "sitemap.xml accessible (HTTP $SITEMAP_STATUS)"
else
    result "FAIL" "sitemap.xml inaccessible (HTTP $SITEMAP_STATUS)"
fi

echo ""

# =============================================================================
# TEST 6: HEADERS SECURITE
# =============================================================================
echo "6️⃣  HEADERS SÉCURITÉ"
echo "────────────────────"

HEADERS=$(curl -s -I "$URL1")

# Cache-Control
if echo "$HEADERS" | grep -qi "cache-control"; then
    CACHE=$(echo "$HEADERS" | grep -i "cache-control" | head -1 | tr -d '\r')
    echo "   $CACHE"
    result "PASS" "Cache-Control présent"
else
    result "FAIL" "Cache-Control manquant"
fi

# HSTS
if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    result "PASS" "HSTS activé"
else
    result "FAIL" "HSTS manquant"
fi

# X-Robots-Tag
if echo "$HEADERS" | grep -qi "x-robots-tag"; then
    result "PASS" "X-Robots-Tag présent"
else
    echo "   ⚠️  X-Robots-Tag absent (optionnel)"
fi

# CSP
if echo "$HEADERS" | grep -qi "content-security-policy"; then
    result "PASS" "Content-Security-Policy présent"
else
    result "FAIL" "CSP manquant"
fi

echo ""

# =============================================================================
# TEST 7: PRECONNECT/DNS-PREFETCH
# =============================================================================
echo "7️⃣  PRECONNECT & DNS-PREFETCH"
echo "─────────────────────────────"

if echo "$HTML" | grep -q 'rel="preconnect"'; then
    result "PASS" "Preconnect présent"
else
    result "FAIL" "Preconnect manquant"
fi

if echo "$HTML" | grep -q 'rel="dns-prefetch"'; then
    result "PASS" "DNS-Prefetch présent"
else
    echo "   ⚠️  DNS-Prefetch absent (optionnel)"
fi

echo ""

# =============================================================================
# TEST 8: FONTS NON-BLOQUANTES
# =============================================================================
echo "8️⃣  FONTS NON-BLOQUANTES"
echo "────────────────────────"

if echo "$HTML" | grep -q 'rel="preload".*as="style"'; then
    result "PASS" "Fonts avec preload"
elif echo "$HTML" | grep -q 'media="print".*onload'; then
    result "PASS" "Fonts avec media=print trick"
else
    echo "   ⚠️  Vérifier manuellement le chargement des fonts"
fi

echo ""

# =============================================================================
# TEST 9: IMAGES WIDTH/HEIGHT
# =============================================================================
echo "9️⃣  IMAGES WIDTH/HEIGHT (CLS)"
echo "─────────────────────────────"

IMG_COUNT=$(echo "$HTML" | grep -c '<img' || true)
IMG_WITH_SIZE=$(echo "$HTML" | grep -c 'width=".*height="' || true)

echo "   Images totales: $IMG_COUNT"
echo "   Avec width/height: $IMG_WITH_SIZE"

if [ "$IMG_COUNT" -gt 0 ] && [ "$IMG_WITH_SIZE" -gt 0 ]; then
    result "PASS" "Attributs width/height présents"
else
    echo "   ⚠️  Vérifier les images SSR"
fi

echo ""

# =============================================================================
# TEST 10: TTFB COMPARATIF
# =============================================================================
echo "🔟  TTFB COMPARATIF (www vs non-www)"
echo "────────────────────────────────────"

TTFB_WWW=$(curl -s -o /dev/null -w "%{time_starttransfer}" "https://www.automecanik.com/pieces/plaquettes-de-frein/renault/clio-3/1-5-dci-68ch.html")
TTFB_APEX=$(curl -s -o /dev/null -w "%{time_starttransfer}" "https://automecanik.com/pieces/plaquettes-de-frein/renault/clio-3/1-5-dci-68ch.html")

echo "   www.automecanik.com:  ${TTFB_WWW}s"
echo "   automecanik.com:      ${TTFB_APEX}s"

# Convertir en millisecondes pour comparaison
TTFB_WWW_MS=$(echo "$TTFB_WWW * 1000" | bc | cut -d'.' -f1)
TTFB_APEX_MS=$(echo "$TTFB_APEX * 1000" | bc | cut -d'.' -f1)

if [ "$TTFB_WWW_MS" -lt 200 ] && [ "$TTFB_APEX_MS" -lt 200 ]; then
    result "PASS" "TTFB < 200ms sur les deux domaines"
elif [ "$TTFB_WWW_MS" -lt 500 ] && [ "$TTFB_APEX_MS" -lt 500 ]; then
    echo "   ⚠️  TTFB acceptable mais pourrait être amélioré"
else
    result "FAIL" "TTFB trop élevé (>500ms)"
fi

echo ""

# =============================================================================
# RÉSUMÉ
# =============================================================================
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      📊 RÉSUMÉ                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "   ✅ Tests réussis: $PASS"
echo "   ❌ Tests échoués: $FAIL"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo "   🎉 TOUS LES TESTS PASSENT !"
    exit 0
else
    echo "   ⚠️  Certains tests ont échoué. Vérifiez les détails ci-dessus."
    exit 1
fi
