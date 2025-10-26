#!/bin/bash

# Script pour générer des logs Caddy test pour Vector
# ==================================================

LOG_FILE=${1:-"/var/log/caddy/access.json"}
NUM_LOGS=${2:-50}

echo "🧪 Génération de $NUM_LOGS logs test dans $LOG_FILE"

# Créer le dossier si nécessaire
mkdir -p "$(dirname "$LOG_FILE")"

# Marques et gammes pour auto parts
BRANDS=("renault" "peugeot" "citroen" "volkswagen" "bmw" "mercedes" "audi" "ford" "opel" "toyota" "nissan" "honda")
GAMMES=("clio" "208" "c3" "golf" "serie-3" "classe-a" "a3" "fiesta" "corsa" "yaris" "qashqai" "civic")
CATEGORIES=("freins" "embrayage" "distribution" "suspensions" "echappement" "filtres" "amortisseurs" "plaquettes")
COUNTRIES=("FR" "BE" "CH" "LU" "CA" "MC")
BOTS=("" "" "" "" "" "googlebot" "bingbot" "yandexbot" "baiduspider" "duckduckbot")
USER_AGENTS=(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36"
    "Googlebot/2.1 (+http://www.google.com/bot.html)"
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
)
REFERERS=(
    "https://www.google.com/search?q=pieces+auto"
    "https://www.google.fr/search?q=plaquettes+frein+renault+clio"
    "https://automecanik.fr/"
    "https://automecanik.fr/catalog"
    ""
    ""
)

# Fonction pour générer un log JSON
generate_log() {
    local brand=${BRANDS[$RANDOM % ${#BRANDS[@]}]}
    local gamme=${GAMMES[$RANDOM % ${#GAMMES[@]}]}
    local category=${CATEGORIES[$RANDOM % ${#CATEGORIES[@]}]}
    local country=${COUNTRIES[$RANDOM % ${#COUNTRIES[@]}]}
    local bot=${BOTS[$RANDOM % ${#BOTS[@]}]}
    local ua=${USER_AGENTS[$RANDOM % ${#USER_AGENTS[@]}]}
    local referer=${REFERERS[$RANDOM % ${#REFERERS[@]}]}
    local status=$((RANDOM % 100 < 95 ? 200 : (RANDOM % 100 < 80 ? 404 : 500)))
    local latency=$((RANDOM % 800 + 50))
    local bytes=$((RANDOM % 50000 + 1000))
    local method="GET"
    
    # Générer différents types de chemins
    local path_type=$((RANDOM % 10))
    local uri=""
    
    if [ $path_type -lt 6 ]; then
        # 60% - URLs de pièces auto
        uri="/pieces/$brand/$gamme/$category"
    elif [ $path_type -lt 8 ]; then
        # 20% - Autres pages
        local pages=("/" "/catalog" "/search" "/contact" "/about")
        uri=${pages[$RANDOM % ${#pages[@]}]}
    else
        # 20% - API ou assets
        local apis=("/api/products" "/api/vehicles" "/build/app.js" "/public/logo.png")
        uri=${apis[$RANDOM % ${#apis[@]}]}
    fi
    
    # Timestamp actuel
    local ts=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    # Construire le JSON Caddy
    cat <<EOF
{"level":"info","ts":"$ts","logger":"http.log.access","msg":"handled request","request":{"remote_ip":"185.24.${RANDOM:0:2}.${RANDOM:0:3}","remote_port":"${RANDOM:10000:55000}","client_ip":"185.24.${RANDOM:0:2}.${RANDOM:0:3}","proto":"HTTP/2.0","method":"$method","host":"automecanik.fr","uri":"$uri","headers":{"User-Agent":["$ua"],"Accept-Encoding":["gzip, deflate, br"],"Accept-Language":["fr-FR,fr;q=0.9,en;q=0.8"],"Referer":["$referer"],"Cookie":[""]}},"user_id":"","duration":${latency}e-3,"size":$bytes,"status":$status,"resp_headers":{"Server":["Caddy"],"Content-Type":["text/html; charset=utf-8"]}}
EOF
}

# Générer les logs
for i in $(seq 1 $NUM_LOGS); do
    generate_log >> "$LOG_FILE"
    
    # Progression
    if [ $((i % 10)) -eq 0 ]; then
        echo "  ✅ $i/$NUM_LOGS logs générés..."
    fi
    
    # Petit délai pour simuler des logs réalistes
    sleep 0.05
done

echo ""
echo "✅ $NUM_LOGS logs générés avec succès dans $LOG_FILE"
echo ""
echo "📊 Statistiques:"
echo "  - Fichier: $LOG_FILE"
echo "  - Taille: $(du -h "$LOG_FILE" 2>/dev/null | cut -f1 || echo 'N/A')"
echo "  - Lignes: $(wc -l < "$LOG_FILE" 2>/dev/null || echo '0')"
echo ""
echo "🔍 Aperçu (3 premières lignes):"
head -3 "$LOG_FILE" | jq -r '"\(.ts) [\(.status)] \(.request.method) \(.request.uri) - \(.duration*1000)ms"' 2>/dev/null || head -3 "$LOG_FILE"
echo ""
echo "💡 Pour tester Vector:"
echo "  docker logs vector-seo-pipeline --tail 50"
echo ""
echo "💡 Pour vérifier Meilisearch:"
echo "  source .env.vector && curl -s \"http://localhost:7700/indexes/access_logs/stats\" -H \"Authorization: Bearer \$MEILISEARCH_API_KEY\""
