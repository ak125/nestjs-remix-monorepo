#!/bin/bash

# 🧪 Tests CURL pour ConfigService Amélioré
# ==========================================

echo "🚀 Tests du ConfigService Amélioré - $(date)"
echo "=============================================="

BASE_URL="http://localhost:3000"
ADMIN_URL="$BASE_URL/api/admin"
CONFIG_URL="$ADMIN_URL/configuration"

# Couleurs pour les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction d'aide pour les tests
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    echo -e "\n${BLUE}🔍 Test:${NC} $description"
    echo -e "${YELLOW}📡 $method $url${NC}"
    
    if [ -n "$data" ]; then
        echo -e "${YELLOW}📄 Data: $data${NC}"
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            "$url")
    fi
    
    # Séparer le body et le status code
    body=$(echo "$response" | head -n -1)
    status_code=$(echo "$response" | tail -n 1)
    
    if [[ $status_code -ge 200 && $status_code -lt 300 ]]; then
        echo -e "${GREEN}✅ Success ($status_code)${NC}"
        echo -e "${GREEN}Response:${NC} $body" | jq . 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ Failed ($status_code)${NC}"
        echo -e "${RED}Response:${NC} $body"
    fi
    
    sleep 1
}

echo -e "\n${BLUE}🔧 1. TESTS DE CONFIGURATION BASIQUE${NC}"
echo "======================================"

# Test 1: Récupérer une configuration existante
test_endpoint "GET" "$CONFIG_URL/database.url" "" "Récupérer configuration database.url"

# Test 2: Créer une nouvelle configuration
test_endpoint "POST" "$CONFIG_URL" '{
    "key": "test.simple_string",
    "value": "Hello World",
    "category": "test",
    "description": "Test de configuration simple"
}' "Créer configuration string simple"

# Test 3: Créer configuration avec validation Zod
test_endpoint "POST" "$CONFIG_URL" '{
    "key": "test.number_config",
    "value": 42,
    "type": "number",
    "category": "test",
    "description": "Test de configuration numérique"
}' "Créer configuration numérique"

# Test 4: Créer configuration JSON complexe
test_endpoint "POST" "$CONFIG_URL" '{
    "key": "test.json_config",
    "value": {
        "enabled": true,
        "timeout": 5000,
        "endpoints": ["api1", "api2"],
        "settings": {
            "debug": false,
            "level": "info"
        }
    },
    "type": "json",
    "category": "test",
    "description": "Test de configuration JSON complexe"
}' "Créer configuration JSON complexe"

echo -e "\n${BLUE}🔐 2. TESTS DE SÉCURITÉ ET CHIFFREMENT${NC}"
echo "======================================"

# Test 5: Configuration sensible (chiffrée)
test_endpoint "POST" "$CONFIG_URL" '{
    "key": "test.secret_key",
    "value": "super_secret_password_123",
    "category": "security",
    "isSensitive": true,
    "description": "Test de configuration sensible chiffrée"
}' "Créer configuration sensible (chiffrée)"

# Test 6: Récupérer la configuration sensible (doit être déchiffrée)
test_endpoint "GET" "$CONFIG_URL/test.secret_key" "" "Récupérer configuration sensible"

echo -e "\n${BLUE}📊 3. TESTS D'ANALYTICS ET CACHE${NC}"
echo "================================="

# Test 7: Récupérer les statistiques du cache
test_endpoint "GET" "$CONFIG_URL/cache/stats" "" "Statistiques du cache"

# Test 8: Vider le cache
test_endpoint "DELETE" "$CONFIG_URL/cache" "" "Vider le cache"

# Test 9: Réchauffer le cache
test_endpoint "POST" "$CONFIG_URL/cache/warmup" "" "Réchauffer le cache"

echo -e "\n${BLUE}🔍 4. TESTS DE RECHERCHE ET FILTRAGE${NC}"
echo "====================================="

# Test 10: Récupérer toutes les configurations de test
test_endpoint "GET" "$CONFIG_URL?category=test" "" "Configurations de catégorie 'test'"

# Test 11: Recherche par pattern
test_endpoint "GET" "$CONFIG_URL?search=test" "" "Recherche configurations contenant 'test'"

# Test 12: Configurations publiques seulement
test_endpoint "GET" "$CONFIG_URL/public" "" "Configurations publiques"

echo -e "\n${BLUE}🚫 5. TESTS DE VALIDATION ET ERREURS${NC}"
echo "===================================="

# Test 13: Validation échouée - clé vide
test_endpoint "POST" "$CONFIG_URL" '{
    "key": "",
    "value": "test",
    "category": "test"
}' "Test validation clé vide (doit échouer)"

# Test 14: Validation échouée - type invalide
test_endpoint "POST" "$CONFIG_URL" '{
    "key": "test.invalid_type",
    "value": "not_a_number",
    "type": "number",
    "category": "test"
}' "Test validation type invalide (doit échouer)"

# Test 15: Configuration inexistante
test_endpoint "GET" "$CONFIG_URL/nonexistent.key" "" "Configuration inexistante (doit retourner 404)"

echo -e "\n${BLUE}🔄 6. TESTS DE MISE À JOUR${NC}"
echo "=========================="

# Test 16: Mettre à jour une configuration existante
test_endpoint "PUT" "$CONFIG_URL/test.simple_string" '{
    "value": "Hello World Updated!",
    "description": "Configuration mise à jour"
}' "Mettre à jour configuration existante"

# Test 17: Vérifier la mise à jour
test_endpoint "GET" "$CONFIG_URL/test.simple_string" "" "Vérifier mise à jour"

echo -e "\n${BLUE}🗑️ 7. TESTS DE SUPPRESSION${NC}"
echo "=========================="

# Test 18: Supprimer une configuration
test_endpoint "DELETE" "$CONFIG_URL/test.number_config" "" "Supprimer configuration"

# Test 19: Vérifier suppression
test_endpoint "GET" "$CONFIG_URL/test.number_config" "" "Vérifier suppression (doit retourner 404)"

echo -e "\n${BLUE}📈 8. TESTS DE MÉTRIQUES ET MONITORING${NC}"
echo "======================================"

# Test 20: Métriques d'utilisation
test_endpoint "GET" "$CONFIG_URL/metrics" "" "Métriques d'utilisation"

# Test 21: Historique des changements
test_endpoint "GET" "$CONFIG_URL/audit-trail?key=test.simple_string" "" "Historique des changements"

echo -e "\n${BLUE}⚙️ 9. TESTS DE CONFIGURATIONS SYSTÈME${NC}"
echo "===================================="

# Test 22: Configuration de base de données
test_endpoint "GET" "$CONFIG_URL/system/database" "" "Configuration de base de données"

# Test 23: Configuration email
test_endpoint "GET" "$CONFIG_URL/system/email" "" "Configuration email"

# Test 24: Toutes les configurations système
test_endpoint "GET" "$CONFIG_URL/system/all" "" "Toutes les configurations système"

echo -e "\n${BLUE}🧹 10. NETTOYAGE${NC}"
echo "================"

# Test 25: Supprimer les configurations de test
test_endpoint "DELETE" "$CONFIG_URL/test.simple_string" "" "Supprimer test.simple_string"
test_endpoint "DELETE" "$CONFIG_URL/test.json_config" "" "Supprimer test.json_config"
test_endpoint "DELETE" "$CONFIG_URL/test.secret_key" "" "Supprimer test.secret_key"

echo -e "\n${GREEN}🎉 Tests terminés !${NC}"
echo -e "${YELLOW}📊 Résumé:${NC}"
echo "- Tests de CRUD sur les configurations"
echo "- Validation Zod intégrée"
echo "- Chiffrement/déchiffrement sécurisé"
echo "- Cache intelligent avec TTL"
echo "- Analytics et métriques"
echo "- Gestion d'erreurs robuste"

echo -e "\n${BLUE}💡 Pour des tests plus avancés:${NC}"
echo "curl -X GET '$CONFIG_URL?limit=10&page=1' # Pagination"
echo "curl -X GET '$CONFIG_URL?category=ui&sensitive=false' # Filtres combinés"
echo "curl -X POST '$CONFIG_URL/bulk' -d '{\"configs\": [...]}' # Création en lot"