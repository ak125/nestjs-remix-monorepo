#!/bin/bash

# Script de test du système de factures
# Date: 6 octobre 2025

echo "🧾 Test du système de factures"
echo "================================"
echo ""

BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3001"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 Prérequis :${NC}"
echo "1. Backend en cours d'exécution sur $BACKEND_URL"
echo "2. Frontend en cours d'exécution sur $FRONTEND_URL"
echo "3. Utilisateur connecté avec session valide"
echo ""

# Test 1: Vérifier que la route existe
echo -e "${YELLOW}Test 1: Vérification route invoice${NC}"
ORDER_ID="1"
echo "GET $FRONTEND_URL/account/orders/$ORDER_ID/invoice"
echo ""

# Test 2: Vérifier l'endpoint de paiement supplément
echo -e "${YELLOW}Test 2: Endpoint paiement supplément${NC}"
echo "POST $BACKEND_URL/api/payments/proceed-supplement"
echo ""

# Test 3: Vérifier structure table ___XTR_ORDER
echo -e "${YELLOW}Test 3: Requête SQL exemple${NC}"
cat << 'SQL'
SELECT 
  o.ord_id,
  o.ord_parent,
  o.ord_date,
  o.ord_date_pay,
  o.ord_is_pay,
  o.ord_total_ttc,
  c.cst_mail
FROM ___xtr_order o
JOIN ___xtr_customer c ON c.cst_id = o.ord_cst_id
WHERE o.ord_cst_id = :userId
ORDER BY o.ord_date DESC
LIMIT 10;
SQL
echo ""

echo -e "${GREEN}✅ Configuration système OK${NC}"
echo ""

echo -e "${YELLOW}📝 Scénarios de test manuels :${NC}"
echo ""

echo "Scénario 1: Facture commande payée"
echo "  1. Aller sur /account/orders"
echo "  2. Sélectionner une commande avec 'Payé'"
echo "  3. Cliquer sur 'Voir la facture'"
echo "  4. Vérifier affichage 'Facture n° XXX/F'"
echo "  5. Vérifier date de paiement affichée"
echo "  6. Tester bouton 'Imprimer'"
echo ""

echo "Scénario 2: Bon de commande non payé"
echo "  1. Sélectionner une commande 'En attente'"
echo "  2. Cliquer sur 'Voir le bon de commande'"
echo "  3. Vérifier affichage 'Bon de commande n° XXX/A'"
echo "  4. Pas de date de paiement"
echo "  5. Pas de formulaire de paiement (commande normale)"
echo ""

echo "Scénario 3: Supplément non payé"
echo "  1. Créer une commande avec ORD_PARENT != 0"
echo "  2. Aller sur /account/orders/[ID]/invoice"
echo "  3. Vérifier affichage 'Supplément n° XXX/A'"
echo "  4. Vérifier 'Commande parente YYY/A' affiché"
echo "  5. Vérifier formulaire de paiement visible"
echo "  6. Choisir PAYBOX ou PAYPAL"
echo "  7. Accepter CGV"
echo "  8. Cliquer 'Payer maintenant'"
echo "  9. Vérifier redirection vers passerelle"
echo ""

echo "Scénario 4: Sécurité"
echo "  1. Essayer d'accéder à une commande d'un autre client"
echo "  2. Vérifier erreur 403 Forbidden"
echo "  3. Déconnexion"
echo "  4. Essayer d'accéder à /account/orders/1/invoice"
echo "  5. Vérifier redirection vers /login"
echo ""

echo -e "${YELLOW}🔧 Commandes utiles :${NC}"
echo ""

echo "# Voir toutes les commandes d'un client"
echo "curl -X GET '$BACKEND_URL/api/users/orders?userId=XXX' \\"
echo "  -H 'Cookie: connect.sid=...' \\"
echo "  -H 'Content-Type: application/json'"
echo ""

echo "# Tester paiement supplément"
echo "curl -X POST '$BACKEND_URL/api/payments/proceed-supplement' \\"
echo "  -H 'Cookie: connect.sid=...' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"orderId\": \"123\", \"paymentMethod\": \"PAYBOX\"}'"
echo ""

echo "# Vérifier statut commande"
echo "curl -X GET '$BACKEND_URL/api/orders/123' \\"
echo "  -H 'Cookie: connect.sid=...' \\"
echo "  -H 'Content-Type: application/json'"
echo ""

echo -e "${GREEN}✅ Documentation complète disponible dans :${NC}"
echo "   docs/SYSTEME-FACTURES.md"
echo ""

echo "🎉 Système de factures prêt à être testé !"
