#!/bin/bash

echo "🚀 TEST DE PERFORMANCE CACHE REDIS"
echo "=================================="

echo ""
echo "🔥 PREMIER APPEL (Cache MISS attendu):"
time curl -s "http://127.0.0.1:3000/api/dashboard/stats" > /dev/null

echo ""
echo "⚡ DEUXIÈME APPEL (Cache HIT attendu):"  
time curl -s "http://127.0.0.1:3000/api/dashboard/stats" > /dev/null

echo ""
echo "⚡ TROISIÈME APPEL (Cache HIT attendu):"
time curl -s "http://127.0.0.1:3000/api/dashboard/stats" > /dev/null

echo ""
echo "🎯 RÉSULTAT:"
echo "- Premier appel: Calcul des stats depuis la DB"
echo "- Appels suivants: Récupération depuis le cache Redis"
echo "- Amélioration attendue: 70-90% de réduction du temps de réponse"
