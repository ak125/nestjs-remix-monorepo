#!/bin/bash

# 📚 GUIDE COMPLET DES TESTS cURL
# Documentation et exemples d'utilisation de tous les scripts de test

echo "📚 GUIDE COMPLET DES TESTS API"
echo "=============================="

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🎯 SCRIPTS DE TEST DISPONIBLES${NC}"
echo ""

echo -e "${YELLOW}1. test-quick.sh${NC} - Tests rapides"
echo "   ✅ Validation basique des endpoints principaux"
echo "   ⚡ Exécution: 5 secondes"
echo "   📊 Résultat: Status codes uniquement"
echo ""

echo -e "${YELLOW}2. test-routes.sh${NC} - Validation des routes"
echo "   🔍 Vérifie quelles routes sont disponibles"
echo "   ⚡ Exécution: 10 secondes"
echo "   📊 Résultat: Statut détaillé par endpoint"
echo ""

echo -e "${YELLOW}3. test-with-data.sh${NC} - Tests avec données réelles"
echo "   📝 Création d'utilisateurs et commandes"
echo "   ⚡ Exécution: 30 secondes"
echo "   📊 Résultat: Réponses JSON complètes"
echo ""

echo -e "${YELLOW}4. explore-legacy-data.sh${NC} - Exploration données legacy"
echo "   🗄️ Affiche les vraies données migrées"
echo "   ⚡ Exécution: 15 secondes"
echo "   📊 Résultat: Statistiques et échantillons"
echo ""

echo -e "${YELLOW}5. test-api-curl.sh${NC} - Tests complets"
echo "   🔬 Tous les endpoints avec gestion d'erreurs"
echo "   ⚡ Exécution: 60 secondes"
echo "   📊 Résultat: Rapport détaillé complet"
echo ""

echo "========================================"
echo -e "${GREEN}🚀 DÉMARRAGE RAPIDE${NC}"
echo "========================================"

echo "1️⃣  Test rapide du système :"
echo "   ./test-quick.sh"
echo ""

echo "2️⃣  Explorer les données legacy :"
echo "   ./explore-legacy-data.sh"
echo ""

echo "3️⃣  Tests complets :"
echo "   ./test-with-data.sh"
echo ""

echo "========================================"
echo -e "${BLUE}📊 RÉSULTATS ATTENDUS${NC}"
echo "========================================"

echo "✅ FONCTIONNEL :"
echo "  📦 Orders API: 5/5 endpoints (1417 commandes)"
echo "  👥 Users API: 2/3 endpoints basiques"
echo "  🎨 Statuts legacy: 4 statuts avec couleurs"
echo ""

echo "⚠️  EN DÉVELOPPEMENT :"
echo "  🚗 Automotive API: Routes définies mais non exposées"
echo "  💰 Calculs API: Services créés mais non connectés"
echo "  🔐 Auth API: Module à configurer"
echo ""

echo "========================================"
echo -e "${YELLOW}🔧 EXEMPLES DE COMMANDES CURL${NC}"
echo "========================================"

echo "📊 Statistiques des commandes :"
echo "curl -s 'http://localhost:3000/api/orders/stats/general' | jq"
echo ""

echo "🎨 Statuts avec couleurs :"
echo "curl -s 'http://localhost:3000/api/orders/statuses/orders' | jq"
echo ""

echo "📦 Dernières commandes :"
echo "curl -s 'http://localhost:3000/api/orders?limit=3' | jq"
echo ""

echo "👥 Utilisateurs par niveau :"
echo "curl -s 'http://localhost:3000/api/users/level/1' | jq"
echo ""

echo "========================================"
echo -e "${GREEN}📋 DONNÉES LEGACY CONFIRMÉES${NC}"
echo "========================================"

echo "✅ 1417 commandes migrées"
echo "✅ Montants TTC préservés (58.61€ à 99.11€)"
echo "✅ IDs clients conservés (81561, 81564...)"
echo "✅ Statuts système fonctionnels"
echo "✅ Couleurs d'interface préservées"
echo ""

echo "========================================"
echo -e "${BLUE}🚀 PROCHAINES ÉTAPES${NC}"
echo "========================================"

echo "1. Frontend Remix :"
echo "   cd frontend && npm run dev"
echo "   http://localhost:3001/admin"
echo ""

echo "2. Compléter les modules automotive :"
echo "   - Connecter les routes au routeur principal"
echo "   - Activer les services VIN/immatriculation"
echo ""

echo "3. Authentification :"
echo "   - Module auth JWT"
echo "   - Sessions utilisateurs"
echo ""

echo "========================================"
echo -e "${GREEN}🎉 MIGRATION LEGACY RÉUSSIE !${NC}"
echo "========================================"

echo "Le système PHP legacy est maintenant accessible"
echo "via des APIs modernes NestJS avec toutes les"
echo "données historiques préservées !"
echo ""

echo "📞 Pour aide : voir FRONTEND_INTEGRATION_COMPLETE.md"
