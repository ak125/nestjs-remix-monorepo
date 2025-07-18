#!/bin/bash

# Guide de connexion pour les tests
echo "🔐 Guide de connexion - Comptes de test"
echo "======================================="

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}📋 Comptes de test disponibles:${NC}"
echo ""

echo -e "${GREEN}✅ Compte 1 (Validé):${NC}"
echo "   Email: chris2.naul@gmail.com"
echo "   Nom: Daniel BOSCOURNU"
echo "   Statut: Actif"
echo ""

echo -e "${GREEN}✅ Compte 2 (Utilisé dans les tests):${NC}"
echo "   Email: patrick.bardais@yahoo.fr"
echo "   Nom: PATRICK BARDAIS"
echo "   ID: 81561"
echo "   Statut: Actif"
echo ""

echo -e "${YELLOW}⚠️  Mots de passe:${NC}"
echo "   Les mots de passe sont chiffrés dans la base"
echo "   Pour les tests, essayez des mots de passe simples"
echo "   comme: 123, password, test, admin"
echo ""

echo -e "${BLUE}🌐 URL de connexion:${NC}"
echo "   https://psychic-robot-rp6rj9vxw9r3xxr7-3000.app.github.dev/login"
echo ""

echo -e "${BLUE}🔧 Tests API:${NC}"
echo "   • API Orders: http://localhost:3000/api/orders"
echo "   • Interface admin: /admin/orders"
echo "   • Détails commande: /admin/orders/280042"
echo ""

echo -e "${BLUE}📊 Données disponibles:${NC}"
echo "   • 1417 commandes réelles"
echo "   • Adresses de facturation et livraison"
echo "   • Statuts de commandes"
echo "   • Lignes de commande détaillées"
echo ""

echo "======================================="
echo -e "${GREEN}🎯 Système prêt pour les tests !${NC}"
echo "======================================="
