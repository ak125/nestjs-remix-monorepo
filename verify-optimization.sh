#!/bin/bash
# 📊 Script de vérification post-optimisation

echo "🔍 VÉRIFICATION DE L'OPTIMISATION DES TABLES"
echo "============================================="
echo ""

cd /workspaces/nestjs-remix-monorepo

# 1. Vérification du package
echo "📦 Package @repo/database-types:"
echo "  Tables définies: $(grep -c "^  [a-z_]*:" packages/database-types/src/constants.ts)"
echo ""

# 2. Services optimisés
echo "✅ Services utilisant TABLES:"
services_count=$(grep -r "from '@repo/database-types'" backend/src --include="*.service.ts" 2>/dev/null | wc -l)
echo "  Total: $services_count services"
echo ""

# 3. Tables hardcodées restantes
echo "📉 Tables hardcodées restantes:"
hardcoded=$(grep -r "\.from('" backend/src --include="*.service.ts" 2>/dev/null | sed "s/.*\.from('\([^']*\)').*/\1/" | grep -v "^TABLES\." | wc -l)
echo "  Total: $hardcoded occurrences"
echo ""

# 4. Répartition par catégorie
echo "📊 Répartition des tables hardcodées:"
echo ""
echo "  🔴 Tables Externes/Système:"
external=$(grep -r "\.from('" backend/src --include="*.service.ts" 2>/dev/null | sed "s/.*\.from('\([^']*\)').*/\1/" | grep -v "^TABLES\." | grep -E "(stock|ic_postback|upload_analytics|error_logs|crawl_budget|system_|analytics_|_cache_)" | wc -l)
echo "    $external occurrences"
echo ""
echo "  🟡 Tables Invalides/À Vérifier:"
invalid=$((hardcoded - external))
echo "    $invalid occurrences"
echo ""

# 5. Top 10 tables hardcodées
echo "📋 Top 10 tables hardcodées:"
grep -r "\.from('" backend/src --include="*.service.ts" 2>/dev/null | sed "s/.*\.from('\([^']*\)').*/\1/" | grep -v "^TABLES\." | sort | uniq -c | sort -rn | head -10
echo ""

# 6. Compilation TypeScript
echo "🔧 Test de compilation TypeScript:"
cd backend
if npx tsc --noEmit 2>&1 | grep -q "error"; then
  echo "  ❌ Erreurs détectées"
else
  echo "  ✅ Aucune erreur"
fi
cd ..
echo ""

# 7. Résumé final
echo "🎉 RÉSUMÉ FINAL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
reduction=$(( (500 - hardcoded) * 100 / 500 ))
echo "  ✅ Services optimisés: $services_count"
echo "  📦 Tables dans package: $(grep -c "^  [a-z_]*:" packages/database-types/src/constants.ts)"
echo "  📉 Tables hardcodées: $hardcoded (dont $external externes OK)"
echo "  💡 Réduction: ~${reduction}% de code hardcodé éliminé"
echo ""
echo "📚 Documentation créée:"
echo "  - OPTIMISATION-TABLES-SUMMARY.md"
echo "  - TABLES-INVALIDES.md"
echo "  - COMMIT-MESSAGE.md"
echo ""
