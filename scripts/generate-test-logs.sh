#!/bin/bash

# Script pour gÃ©nÃ©rer des logs Caddy test pour Vector
# ==================================================

LOG_FILE=${1:-"/var/log/caddy/access.json"}
NUM_LOGS=${2:-50}

echo "ðŸ§ª GÃ©nÃ©ration de $NUM_LOGS logs test dans $LOG_FILE"

# CrÃ©er le dossier si nÃ©cessaire
mkdir -p "$(dirname "$LOG_FILE")"

# Paires cohÃ©rentes marque/modÃ¨le pour auto parts
# Format: "marque|modele1,modele2,modele3"
MARQUES_MODELES=(
    "renault|clio,megane,captur,scenic,twingo,kadjar"
    "peugeot|208,308,3008,5008,2008,partner"
    "citroen|c3,c4,c5,berlingo,spacetourer,c3-aircross"
    "volkswagen|golf,polo,tiguan,passat,t-roc,up"
    "bmw|serie-1,serie-3,serie-5,x1,x3,x5"
    "mercedes|classe-a,classe-c,classe-e,gla,glc,gle"
    "audi|a3,a4,a6,q3,q5,q7"
    "ford|fiesta,focus,puma,kuga,mustang,ranger"
    "opel|corsa,astra,crossland,grandland,mokka,combo"
    "toyota|yaris,corolla,rav4,c-hr,aygo,highlander"
    "nissan|micra,qashqai,juke,x-trail,leaf,navara"
    "honda|civic,jazz,cr-v,hr-v,e,accord"
)
PIECES_CATEGORIES=("freins" "embrayage" "distribution" "suspensions" "echappement" "filtres" "amortisseurs" "plaquettes")
MOTORISATIONS=("1-5-dci" "2-0-hdi" "1-6-hdi" "2-0-tdi" "1-5-bluehdi" "1-2-tce" "1-0-tsi" "2-0-tfsi" "1-5-tdci" "2-0-cdti")
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

# Fonction pour gÃ©nÃ©rer un log JSON
generate_log() {
    # Choisir une paire marque/modÃ¨le cohÃ©rente
    local pair=${MARQUES_MODELES[$RANDOM % ${#MARQUES_MODELES[@]}]}
    local marque=$(echo "$pair" | cut -d'|' -f1)
    local modeles=$(echo "$pair" | cut -d'|' -f2)
    IFS=',' read -ra modele_array <<< "$modeles"
    local modele=${modele_array[$RANDOM % ${#modele_array[@]}]}
    
    local pieces_category=${PIECES_CATEGORIES[$RANDOM % ${#PIECES_CATEGORIES[@]}]}
    local motorisation=${MOTORISATIONS[$RANDOM % ${#MOTORISATIONS[@]}]}
    local country=${COUNTRIES[$RANDOM % ${#COUNTRIES[@]}]}
    local bot=${BOTS[$RANDOM % ${#BOTS[@]}]}
    local ua=${USER_AGENTS[$RANDOM % ${#USER_AGENTS[@]}]}
    local referer=${REFERERS[$RANDOM % ${#REFERERS[@]}]}
    local status=$((RANDOM % 100 < 95 ? 200 : (RANDOM % 100 < 80 ? 404 : 500)))
    local latency=$((RANDOM % 800 + 50))
    local bytes=$((RANDOM % 50000 + 1000))
    local method="GET"
    
    # GÃ©nÃ©rer diffÃ©rents types de chemins
    local path_type=$((RANDOM % 10))
    local uri=""
    
    if [ $path_type -lt 6 ]; then
        # 60% - URLs de piÃ¨ces auto (structure: /pieces/{category}/{marque}/{modele}/{type})
        uri="/pieces/$pieces_category/$marque/$modele/$motorisation"
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

# GÃ©nÃ©rer les logs
for i in $(seq 1 $NUM_LOGS); do
    generate_log >> "$LOG_FILE"
    
    # Progression
    if [ $((i % 10)) -eq 0 ]; then
        echo "  âœ… $i/$NUM_LOGS logs gÃ©nÃ©rÃ©s..."
    fi
    
    # Petit dÃ©lai pour simuler des logs rÃ©alistes
    sleep 0.05
done

echo ""
echo "âœ… $NUM_LOGS logs gÃ©nÃ©rÃ©s avec succÃ¨s dans $LOG_FILE"
echo ""
echo "ðŸ“Š Statistiques:"
echo "  - Fichier: $LOG_FILE"
echo "  - Taille: $(du -h "$LOG_FILE" 2>/dev/null | cut -f1 || echo 'N/A')"
echo "  - Lignes: $(wc -l < "$LOG_FILE" 2>/dev/null || echo '0')"
echo ""
echo "ðŸ” AperÃ§u (3 premiÃ¨res lignes):"
head -3 "$LOG_FILE" | jq -r '"\(.ts) [\(.status)] \(.request.method) \(.request.uri) - \(.duration*1000)ms"' 2>/dev/null || head -3 "$LOG_FILE"
echo ""
echo "ðŸ’¡ Pour tester Vector:"
echo "  docker logs vector-seo-pipeline --tail 50"
echo ""
echo "ðŸ’¡ Pour vÃ©rifier Meilisearch:"
echo "  source .env.vector && curl -s \"http://localhost:7700/indexes/access_logs/stats\" -H \"Authorization: Bearer \$MEILISEARCH_API_KEY\""
