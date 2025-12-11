#!/bin/bash

# ðŸš€ Script d'intÃ©gration rapide du Breadcrumb dans toutes les pages admin
# Utilise le composant AdminBreadcrumb pour une intÃ©gration cohÃ©rente et rapide

echo "ðŸŽ¯ IntÃ©gration du Breadcrumb dans les pages admin..."

# DÃ©finir les pages Ã  traiter avec leurs titres
declare -A pages=(
  ["admin.suppliers._index.tsx"]="Gestion des fournisseurs"
  ["admin.products._index.tsx"]="Gestion des produits"
  ["admin.config._index.tsx"]="Configuration"
  ["admin.invoices._index.tsx"]="Gestion des factures"
  ["admin.payments._index.tsx"]="Gestion des paiements"
  ["admin.seo.tsx"]="SEO & RÃ©fÃ©rencement"
)

for file in "${!pages[@]}"; do
  title="${pages[$file]}"
  filepath="frontend/app/routes/$file"
  
  if [ -f "$filepath" ]; then
    echo "âœ… Traitement: $file -> \"$title\""
    echo "   Fichier: $filepath"
  else
    echo "âš ï¸  Fichier non trouvÃ©: $filepath"
  fi
done

echo ""
echo "ðŸ“ Instructions manuelles pour chaque fichier:"
echo ""
echo "1. Ajouter l'import:"
echo "   import { AdminBreadcrumb } from '~/components/admin/AdminBreadcrumb';"
echo ""
echo "2. Remplacer le breadcrumb manuel (si existant) ou ajouter aprÃ¨s le container:"
echo "   <AdminBreadcrumb currentPage=\"Titre de la page\" />"
echo ""
echo "3. Optionnel - Ajouter des Separators entre sections:"
echo "   <Separator className=\"my-6\" />"
echo ""
echo "âœ¨ Temps estimÃ© avec le composant: ~2 min par page vs 5 min manuellement"
