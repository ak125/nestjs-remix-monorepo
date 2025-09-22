#!/bin/bash

echo "🧪 Test de l'optimisation de performance"
echo "========================================"

echo ""
echo "📊 Test de l'API homepage optimisée:"
echo "------------------------------------"

echo "Appel à l'API /api/catalog/hierarchy/homepage..."
curl -s "http://localhost:3000/api/catalog/hierarchy/homepage" | jq -r '.message, .display_count, .total_available' 2>/dev/null || echo "Réponse reçue (jq non disponible)"

echo ""
echo "✅ Test terminé. Vérifiez les logs du serveur pour voir l'optimisation."
echo ""
echo "Points à vérifier dans les logs:"
echo "- 🔍 Un seul appel à 'Construction hiérarchie Familles → Gammes' au lieu de deux"
echo "- ⚡ Réduction du temps de réponse"
echo "- 🎯 Message 'Données homepage: X familles affichées'"