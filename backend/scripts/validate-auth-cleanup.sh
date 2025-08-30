#!/bin/bash

# 🧪 Script de validation post-nettoyage
# Objectif: Vérifier que l'authentification fonctionne après nettoyage

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧪 VALIDATION POST-NETTOYAGE"
echo "============================="
echo "📅 Date: $(date)"
echo ""

cd "$PROJECT_ROOT"

# Fonction pour tester un endpoint
test_endpoint() {
    local method="$1"
    local url="$2"
    local headers="$3"
    local expected_status="$4"
    local description="$5"
    
    echo "🔍 Test: $description"
    echo "   URL: $method $url"
    
    local response
    local status_code
    
    if [[ -n "$headers" ]]; then
        response=$(curl -s -X "$method" "$url" -H "$headers" -w "\\n%{http_code}" || echo -e "\\n000")
    else
        response=$(curl -s -X "$method" "$url" -w "\\n%{http_code}" || echo -e "\\n000")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo "   ✅ Status: $status_code (attendu: $expected_status)"
        return 0
    else
        echo "   ❌ Status: $status_code (attendu: $expected_status)"
        echo "   📝 Réponse: $body"
        return 1
    fi
}

# Attendre que le serveur soit prêt
echo "⏳ Vérification que le serveur est démarré..."
max_attempts=10
attempt=0

while [[ $attempt -lt $max_attempts ]]; do
    if curl -s "http://localhost:3000/api/blog/jwt/test-health" > /dev/null 2>&1; then
        echo "✅ Serveur prêt"
        break
    else
        echo "   Tentative $((attempt + 1))/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    fi
done

if [[ $attempt -eq $max_attempts ]]; then
    echo "❌ Serveur non accessible après $max_attempts tentatives"
    echo "   Assurez-vous que le serveur est démarré: npm run dev"
    exit 1
fi

echo ""
echo "1️⃣ TESTS DE BASE"
echo "================="

# Test 1: Health check
test_endpoint "GET" "http://localhost:3000/api/blog/jwt/test-health" "" "200" "Health check"

echo ""
echo "2️⃣ TESTS D'AUTHENTIFICATION JWT"
echo "==============================="

# Test 2: Génération de token
echo "🔑 Génération d'un token de test..."
token_response=$(curl -s -X POST "http://localhost:3000/api/blog/jwt/test-generate")
token=$(echo "$token_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [[ -n "$token" ]]; then
    echo "✅ Token généré: ${token:0:50}..."
else
    echo "❌ Échec de génération du token"
    echo "📝 Réponse: $token_response"
    exit 1
fi

# Test 3: Accès endpoint protégé avec token valide
test_endpoint "GET" "http://localhost:3000/api/blog/jwt/test-protected" "Authorization: Bearer $token" "200" "Endpoint protégé avec token valide"

# Test 4: Accès endpoint protégé sans token
test_endpoint "GET" "http://localhost:3000/api/blog/jwt/test-protected" "" "401" "Endpoint protégé sans token"

# Test 5: Accès endpoint protégé avec token invalide
test_endpoint "GET" "http://localhost:3000/api/blog/jwt/test-protected" "Authorization: Bearer token-invalide" "401" "Endpoint protégé avec token invalide"

echo ""
echo "3️⃣ TESTS DE STRUCTURE"
echo "====================="

# Vérifier que les fichiers principaux existent
echo "📁 Vérification des fichiers principaux..."
required_files=(
    "src/auth/auth.module.ts"
    "src/auth/auth.controller.ts"
    "src/auth/auth.service.ts"
    "src/auth/jwt.strategy.ts"
)

all_files_present=true
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "   ✅ $file"
    else
        echo "   ❌ MANQUANT: $file"
        all_files_present=false
    fi
done

if [[ "$all_files_present" == "false" ]]; then
    echo "❌ Des fichiers principaux sont manquants"
    exit 1
fi

# Vérifier qu'aucun fichier redondant n'existe
echo ""
echo "🗑️  Vérification que les fichiers redondants ont été supprimés..."
redundant_files=(
    "src/auth/auth-minimal.module.ts"
    "src/auth/auth-clean.module.ts"
    "src/auth/jwt-test.controller.ts"
    "src/auth/jwt-fix.controller.ts"
    "src/auth/jwt-minimal.strategy.ts"
)

redundant_found=false
for file in "${redundant_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "   ⚠️  ENCORE PRÉSENT: $file"
        redundant_found=true
    else
        echo "   ✅ Supprimé: $file"
    fi
done

if [[ "$redundant_found" == "true" ]]; then
    echo "⚠️  Certains fichiers redondants sont encore présents"
fi

echo ""
echo "4️⃣ TESTS DE COMPILATION"
echo "======================="

echo "🔧 Test de compilation TypeScript..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Compilation réussie"
else
    echo "❌ Erreurs de compilation"
    echo "🔧 Détails des erreurs:"
    npm run build
    exit 1
fi

echo ""
echo "5️⃣ TESTS D'IMPORTS"
echo "=================="

# Vérifier qu'aucun import vers des fichiers supprimés n'existe
echo "🔍 Recherche d'imports vers des fichiers supprimés..."
problematic_imports=0

# Chercher des imports vers les fichiers supprimés
grep -r "from.*auth-minimal" src/ 2>/dev/null && problematic_imports=$((problematic_imports + 1))
grep -r "from.*auth-clean" src/ 2>/dev/null && problematic_imports=$((problematic_imports + 1))
grep -r "from.*jwt-test" src/ 2>/dev/null && problematic_imports=$((problematic_imports + 1))
grep -r "from.*jwt-fix" src/ 2>/dev/null && problematic_imports=$((problematic_imports + 1))

if [[ $problematic_imports -eq 0 ]]; then
    echo "✅ Aucun import problématique trouvé"
else
    echo "⚠️  $problematic_imports import(s) problématique(s) trouvé(s)"
    echo "   Vérifiez les imports dans les fichiers ci-dessus"
fi

echo ""
echo "6️⃣ RÉSUMÉ DE VALIDATION"
echo "======================="

# Compter les fichiers dans le répertoire auth
total_files=$(find src/auth -name "*.ts" | wc -l)
echo "📊 Fichiers TypeScript dans src/auth: $total_files"

# Lister la structure finale
echo ""
echo "📁 Structure finale:"
tree src/auth/ 2>/dev/null || find src/auth -type f -name "*.ts" | sort | sed 's/^/  /'

echo ""
if [[ "$all_files_present" == "true" && $problematic_imports -eq 0 ]]; then
    echo "🎉 VALIDATION RÉUSSIE"
    echo "===================="
    echo "✅ Tous les tests d'authentification passent"
    echo "✅ Structure des fichiers correcte"
    echo "✅ Compilation réussie"
    echo "✅ Aucun import problématique"
    echo ""
    echo "🧹 Le nettoyage a été effectué avec succès !"
    echo "🚀 Le système d'authentification est optimisé et fonctionnel"
else
    echo "⚠️  VALIDATION PARTIELLE"
    echo "========================"
    echo "🔧 Quelques problèmes détectés mais l'authentification fonctionne"
    echo "📝 Vérifiez les points mentionnés ci-dessus"
fi
