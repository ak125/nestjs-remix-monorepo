#!/bin/bash

# 🚀 Script de test de performance pour automecanik.fr
# Usage: ./scripts/test-performance.sh

set -e

DOMAIN="${1:-https://automecanik.fr}"
HEALTH_ENDPOINT="$DOMAIN/health"
HOME_ENDPOINT="$DOMAIN/"

echo "════════════════════════════════════════════════════════"
echo "🚀 Test de Performance - automecanik.fr"
echo "════════════════════════════════════════════════════════"
echo ""

# Test 1: Health Check Performance
echo "📊 Test 1: Health Check Latency"
echo "────────────────────────────────────────────────────────"
curl -o /dev/null -s -w "Time:\n  DNS Lookup: %{time_namelookup}s\n  TCP Connect: %{time_connect}s\n  TLS Handshake: %{time_appconnect}s\n  Server Processing: %{time_starttransfer}s\n  Total Time: %{time_total}s\n\nHTTP Code: %{http_code}\n" $HEALTH_ENDPOINT
echo ""

# Test 2: Uptime Check
echo "⏱️  Test 2: Server Uptime"
echo "────────────────────────────────────────────────────────"
if command -v jq &> /dev/null; then
    curl -s $HEALTH_ENDPOINT | jq -r '"Status: \(.status)\nTimestamp: \(.timestamp)\nUptime: \(.uptime) secondes (\(.uptime / 60 | floor) minutes)"'
else
    curl -s $HEALTH_ENDPOINT
fi
echo ""

# Test 3: Home Page Performance
echo "🏠 Test 3: Home Page Performance"
echo "────────────────────────────────────────────────────────"
curl -o /dev/null -s -w "Total Time: %{time_total}s\nSize: %{size_download} bytes\nSpeed: %{speed_download} bytes/s\nHTTP Code: %{http_code}\n" $HOME_ENDPOINT
echo ""

# Test 4: Load Test
echo "🔥 Test 4: Load Test (20 requêtes simultanées)"
echo "────────────────────────────────────────────────────────"
echo "Lancement du test de charge..."

success=0
total=20

for i in $(seq 1 $total); do
    response=$(curl -o /dev/null -s -w "%{http_code}" $HEALTH_ENDPOINT)
    if [ "$response" = "200" ]; then
        success=$((success + 1))
    fi
done

echo "Résultat: $success/$total requêtes réussies ($(( success * 100 / total ))%)"
echo ""

# Test 5: SSL/TLS Check
echo "🔒 Test 5: SSL/TLS Certificate"
echo "────────────────────────────────────────────────────────"
if command -v openssl &> /dev/null; then
    echo | openssl s_client -servername automecanik.fr -connect automecanik.fr:443 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo "SSL info non disponible"
else
    echo "OpenSSL non installé, test SSL ignoré"
fi
echo ""

# Résumé
echo "════════════════════════════════════════════════════════"
echo "✅ Tests de performance terminés"
echo "════════════════════════════════════════════════════════"
