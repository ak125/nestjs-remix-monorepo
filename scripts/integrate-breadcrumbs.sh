#!/bin/bash

# 🚀 Script d'intégration rapide du Breadcrumb dans toutes les pages admin
# Utilise le composant AdminBreadcrumb pour une intégration cohérente et rapide

echo "🎯 Intégration du Breadcrumb dans les pages admin..."

# Définir les pages à traiter avec leurs titres
declare -A pages=(
  ["admin.suppliers._index.tsx"]="Gestion des fournisseurs"
  ["admin.products._index.tsx"]="Gestion des produits"
  ["admin.config._index.tsx"]="Configuration"
  ["admin.invoices._index.tsx"]="Gestion des factures"
  ["admin.payments._index.tsx"]="Gestion des paiements"
  ["admin.seo.tsx"]="SEO & Référencement"
)

for file in "${!pages[@]}"; do
  title="${pages[$file]}"
  filepath="frontend/app/routes/$file"
  
  if [ -f "$filepath" ]; then
    echo "✅ Traitement: $file -> \"$title\""
    echo "   Fichier: $filepath"
  else
    echo "⚠️  Fichier non trouvé: $filepath"
  fi
done

echo ""
echo "📝 Instructions manuelles pour chaque fichier:"
echo ""
echo "1. Ajouter l'import:"
echo "   import { AdminBreadcrumb } from '~/components/admin/AdminBreadcrumb';"
echo ""
echo "2. Remplacer le breadcrumb manuel (si existant) ou ajouter après le container:"
echo "   <AdminBreadcrumb currentPage=\"Titre de la page\" />"
echo ""
echo "3. Optionnel - Ajouter des Separators entre sections:"
echo "   <Separator className=\"my-6\" />"
echo ""
echo "✨ Temps estimé avec le composant: ~2 min par page vs 5 min manuellement"
