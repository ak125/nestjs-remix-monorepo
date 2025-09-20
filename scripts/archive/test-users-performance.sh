#!/bin/bash

echo "🚀 TEST D'OPTIMISATION PAGE UTILISATEURS - 59k Utilisateurs"
echo "============================================================"

# Test de l'API legacy-users
echo "📊 Test API - Legacy Users:"
echo "- Pagination 1-50:"
start_time=$(date +%s%3N)
curl -s "http://localhost:3000/api/legacy-users?page=1&limit=50" > /tmp/users_test1.json
end_time=$(date +%s%3N)
duration1=$((end_time - start_time))
echo "  ✅ Durée: ${duration1}ms"

# Test avec recherche
echo "- Recherche 'test':"
start_time=$(date +%s%3N)
curl -s "http://localhost:3000/api/legacy-users?page=1&limit=25&search=test" > /tmp/users_search.json
end_time=$(date +%s%3N)
duration2=$((end_time - start_time))
echo "  ✅ Durée: ${duration2}ms"

# Afficher les statistiques
echo ""
echo "📊 RÉSULTATS:"
total_users=$(jq -r '.total // .pagination.total // 0' /tmp/users_test1.json 2>/dev/null || echo "Erreur JSON")
users_returned=$(jq -r '.data | length' /tmp/users_test1.json 2>/dev/null || echo "0")
echo "  📈 Total utilisateurs: $total_users"
echo "  📋 Utilisateurs retournés: $users_returned"
echo "  ⚡ Performance API: ${duration1}ms"
echo "  🔍 Performance recherche: ${duration2}ms"

# Test de la page frontend
echo ""
echo "🖥️  Test Frontend - Page Utilisateurs:"
echo "- Temps de réponse page principale:"
start_time=$(date +%s%3N)
curl -s -o /dev/null -w "%{time_total}s\n" "http://localhost:3000/admin/users"
end_time=$(date +%s%3N)

echo ""
echo "✅ PERFORMANCE GLOBALE:"
if [ $duration1 -lt 100 ]; then
  echo "  🎯 API Ultra-rapide: ${duration1}ms (Excellent)"
elif [ $duration1 -lt 500 ]; then
  echo "  ⚡ API Rapide: ${duration1}ms (Bon)"
else
  echo "  🐌 API Lente: ${duration1}ms (À améliorer)"
fi

echo ""
echo "🎉 Test d'optimisation terminé!"
