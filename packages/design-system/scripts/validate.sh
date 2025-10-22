#!/bin/bash
# 🔍 Validation complète du Design System
# Usage: ./scripts/validate.sh

echo "🔍 Validation du Design System"
echo "================================"
echo ""

# Compteurs
PASSED=0
FAILED=0

# Fonction de validation simple
check_file() {
  if [ -f "$1" ]; then
    echo "  ✅ $2"
    ((PASSED++))
  else
    echo "  ❌ $2 (manquant: $1)"
    ((FAILED++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo "  ✅ $2"
    ((PASSED++))
  else
    echo "  ❌ $2 (manquant: $1)"
    ((FAILED++))
  fi
}

echo "📦 1. Structure des fichiers"
echo "─────────────────────────────"
check_file "package.json" "package.json"
check_file "tsconfig.json" "tsconfig.json"
check_file "tsup.config.ts" "tsup.config.ts"
check_file "src/index.ts" "src/index.ts"
check_file "src/tokens/index.ts" "src/tokens/index.ts"
check_file "src/themes/index.ts" "src/themes/index.ts"
echo ""

echo "🎨 2. Design Tokens"
echo "─────────────────────────────"
check_file "src/tokens/design-tokens.json" "design-tokens.json"
check_file "src/styles/tokens.css" "tokens.css généré"
check_file "src/tokens/generated.ts" "generated.ts"
echo ""

echo "🏗️  3. Build Output"
echo "─────────────────────────────"
check_dir "dist" "dist/"
check_file "dist/index.cjs" "index.cjs"
check_file "dist/index.mjs" "index.mjs"
check_file "dist/index.d.ts" "index.d.ts"
check_file "dist/tokens/index.cjs" "tokens/index.cjs"
check_file "dist/themes/index.cjs" "themes/index.cjs"
echo ""

echo "📚 4. Documentation"
echo "─────────────────────────────"
check_file "README.md" "README.md"
check_file "CONTRIBUTING.md" "CONTRIBUTING.md"
check_file "QUICKSTART.md" "QUICKSTART.md"
check_file "CHANGELOG.md" "CHANGELOG.md"
echo ""

echo "================================"
echo "📊 Résultats"
echo "================================"
TOTAL=$((PASSED + FAILED))
if [ $TOTAL -eq 0 ]; then
  echo "Aucun test exécuté"
  exit 1
fi

PERCENTAGE=$((PASSED * 100 / TOTAL))

echo "  ✅ Réussis: $PASSED"
echo "  ❌ Échoués: $FAILED"
echo "  📈 Score: $PERCENTAGE%"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 Tous les tests sont passés !"
  echo "Le Design System est prêt à l'emploi."
  exit 0
else
  echo "⚠️  Certaines vérifications ont échoué."
  echo "Veuillez corriger les erreurs avant de continuer."
  exit 1
fi
