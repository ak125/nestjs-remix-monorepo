#!/bin/bash

# Script de test pour la page de détail utilisateur améliorée
# Ce script teste les nouveaux endpoints et fonctionnalités

echo "🧪 Test des améliorations de la page de détail utilisateur"
echo "==========================================================="
echo ""

USER_ID="81512"  # ID utilisateur de test (viviane.ega@gmail.com)

echo "1️⃣ Test de l'endpoint utilisateur existant"
echo "-------------------------------------------"
curl -s "http://localhost:3000/api/legacy-users/${USER_ID}" \
  -H "Cookie: $(cat cookies.txt 2>/dev/null || echo '')" | jq '.' || echo "❌ Erreur API"
echo ""

echo "2️⃣ Test du NOUVEAU endpoint de statistiques"
echo "--------------------------------------------"
curl -s "http://localhost:3000/api/legacy-users/${USER_ID}/stats" \
  -H "Cookie: $(cat cookies.txt 2>/dev/null || echo '')" | jq '.' || echo "❌ Erreur API stats"
echo ""

echo "3️⃣ Test de l'endpoint des commandes"
echo "------------------------------------"
curl -s "http://localhost:3000/api/legacy-users/${USER_ID}/orders" \
  -H "Cookie: $(cat cookies.txt 2>/dev/null || echo '')" | jq '.data | length' || echo "❌ Erreur API orders"
echo ""

echo "✅ Tests terminés !"
echo ""
echo "📋 Résumé des améliorations apportées :"
echo "--------------------------------------"
echo "✓ Nouvel endpoint /api/legacy-users/:id/stats avec :"
echo "  - Nombre total de commandes"
echo "  - Commandes payées vs en attente"
echo "  - Total dépensé et panier moyen"
echo "  - Taux de paiement"
echo "  - Date première/dernière commande"
echo "  - Ancienneté du compte"
echo ""
echo "✓ Page frontend améliorée avec :"
echo "  - 4 grandes cartes de statistiques colorées"
echo "  - Affichage du SIRET et raison sociale pour les entreprises"
echo "  - Niveau client affiché avec des étoiles"
echo "  - Section activité avec dates importantes"
echo "  - Tableau des 5 dernières commandes avec liens"
echo "  - Design moderne avec gradients et icônes"
echo "  - Meilleure organisation en grille responsive"
echo ""
echo "🔗 Pour tester visuellement :"
echo "   http://localhost:5173/admin/users/${USER_ID}"
