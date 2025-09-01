#!/bin/bash

echo "🔄 Début de la récupération sélective des optimisations"
echo "⚠️  ATTENTION: Nous éviterons tous les fichiers liés à l'authentification"
echo ""

# Fonction pour récupérer un fichier avec confirmation
recover_file() {
    local file=$1
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📄 Fichier: $file"
    echo "📋 Aperçu des changements:"
    git diff blog..optimisation -- "$file" | head -20
    echo "..."
    echo ""
    echo "Voulez-vous récupérer ce fichier ? (y/n/q pour quitter)"
    read -r response
    case $response in
        y|Y) 
            git checkout optimisation -- "$file"
            echo "✅ Récupéré: $file"
            ;;
        q|Q)
            echo "🛑 Arrêt de la récupération"
            exit 0
            ;;
        *)
            echo "⏭️  Ignoré: $file"
            ;;
    esac
}

# PHASE 1: Composants UI sûrs
echo "=== PHASE 1: Composants UI (généralement sûrs) ==="
echo ""

# AdminSidebar est le seul composant UI modifié
if [ -f "optimization-analysis/ui-components.txt" ]; then
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            recover_file "$file"
        fi
    done < optimization-analysis/ui-components.txt
fi

# PHASE 2: Routes frontend (à vérifier mais souvent sûres)
echo ""
echo "=== PHASE 2: Routes frontend (optimisations d'interface) ==="
echo ""

# Routes frontend - éviter celles liées à l'auth
frontend_routes=(
    "frontend/app/routes/_index.tsx"
    "frontend/app/routes/admin.articles.\$id.edit.tsx" 
    "frontend/app/routes/admin.articles.new.tsx"
    "frontend/app/routes/admin.articles.tsx"
    "frontend/app/routes/admin.blog-simple.tsx"
    "frontend/app/routes/admin.blog.tsx"
    "frontend/app/routes/admin.performances.tsx"
    "frontend/app/routes/admin.system.tsx"
    "frontend/app/routes/admin.tsx"
    "frontend/app/routes/blog._index.tsx"
    "frontend/app/routes/blog.advice._index.tsx"
    "frontend/app/routes/blog.article.\$slug.tsx"
    "frontend/app/routes/blog.constructeurs._index.tsx"
    "frontend/app/routes/blog.glossaire._index.tsx"
    "frontend/app/routes/blog.word.\$word.tsx"
)

for file in "${frontend_routes[@]}"; do
    if git diff --name-only blog..optimisation | grep -q "^$file$"; then
        recover_file "$file"
    fi
done

# PHASE 3: Services API frontend (généralement sûrs)
echo ""
echo "=== PHASE 3: Services API frontend ==="
echo ""

frontend_services=(
    "frontend/app/services/api/constructeur.api.ts"
    "frontend/app/services/api/glossary.api.ts"
    "frontend/app/services/api/search.api.ts"
    "frontend/app/utils/api.ts"
    "frontend/app/config/monitoring.ts"
    "frontend/app/hooks/useAdvancedAnalytics.ts"
)

for file in "${frontend_services[@]}"; do
    if git diff --name-only blog..optimisation | grep -q "^$file$"; then
        recover_file "$file"
    fi
done

# PHASE 4: Services backend NON-AUTH (À VÉRIFIER SOIGNEUSEMENT)
echo ""
echo "=== PHASE 4: Services backend (ATTENTION: vérifier soigneusement) ==="
echo "⚠️  Ces fichiers peuvent affecter le fonctionnement du backend"
echo ""

backend_services=(
    "backend/src/modules/blog/cache/blog-cache.service.ts"
    "backend/src/modules/blog/cache/blog-performance.service.ts"
    "backend/src/modules/blog/controllers/admin.controller.ts"
    "backend/src/modules/blog/controllers/blog.controller.ts"
    "backend/src/modules/blog/services/advice.service.ts"
    "backend/src/modules/blog/services/blog.service.ts"
    "backend/src/modules/blog/blog.module.ts"
    "backend/src/modules/search/search.module.ts"
)

for file in "${backend_services[@]}"; do
    if git diff --name-only blog..optimisation | grep -q "^$file$"; then
        recover_file "$file"
    fi
done

# IGNORER COMPLÈTEMENT: app.module.ts et dashboard.service.ts car ils peuvent casser l'auth
echo ""
echo "🚫 FICHIERS IGNORÉS (trop risqués):"
echo "   - backend/src/app.module.ts (peut casser l'auth)"
echo "   - backend/src/modules/dashboard/dashboard.service.ts (déjà corrigé)"
echo "   - Tous les fichiers d'authentification"
echo ""

echo "✅ Récupération sélective terminée!"
echo ""
echo "📋 ÉTAPES SUIVANTES:"
echo "1. Testez l'application: cd backend && npm run dev"
echo "2. Testez le frontend: cd frontend && npm run dev" 
echo "3. Si tout fonctionne, committez: git add . && git commit -m 'feat: optimisations sélectives (UI + services non-auth)'"
echo "4. Si problème, restaurez: git reset --hard HEAD"
echo ""
