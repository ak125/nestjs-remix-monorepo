#!/bin/bash

# 🚀 TESTS CURL RAPIDES - Dashboard Commercial
# Tests essentiels des endpoints critiques

API_BASE="http://127.0.0.1:3000"

echo "🧪 Tests Rapides Dashboard Commercial"
echo "======================================"

# Test 1: Dashboard Stats (critique)
echo -n "📊 Dashboard Stats... "
if curl -s -H "internal-call: true" "$API_BASE/api/dashboard/stats" | grep -q "totalUsers"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

# Test 2: Commandes récentes (critique)
echo -n "🛒 Commandes récentes... "
if curl -s -H "internal-call: true" "$API_BASE/api/dashboard/orders/recent" | grep -q "orders"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

# Test 3: Fournisseurs (critique)
echo -n "🏪 Fournisseurs... "
if curl -s -H "internal-call: true" "$API_BASE/api/suppliers" | grep -q "suppliers"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

# Test 4: Stock Stats (critique)
echo -n "📦 Stock Stats... "
if curl -s -H "internal-call: true" "$API_BASE/api/admin/working-stock/stats" | grep -q "success"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

# Test 5: Serveur vivant
echo -n "💚 Server Health... "
if curl -s "$API_BASE/api/health" >/dev/null 2>&1 || curl -s "$API_BASE/health" >/dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ FAILED"
fi

echo ""
echo "🎯 Tests terminés !"
