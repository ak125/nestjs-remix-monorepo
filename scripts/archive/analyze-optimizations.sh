#!/bin/bash

echo "=== Analyse des optimisations de la branche optimisation ==="
echo ""

# Créer un dossier pour les rapports
mkdir -p optimization-analysis

# 1. Lister tous les fichiers modifiés
echo "📁 Fichiers modifiés entre blog et optimisation:"
git diff blog..optimisation --name-only > optimization-analysis/modified-files.txt
cat optimization-analysis/modified-files.txt

echo ""
echo "=== Catégorisation des changements ==="

# 2. Identifier les changements par catégorie
echo "" > optimization-analysis/auth-related.txt
echo "" > optimization-analysis/ui-components.txt
echo "" > optimization-analysis/services.txt
echo "" > optimization-analysis/others.txt

while IFS= read -r file; do
  if [[ $file == *"auth"* ]] || [[ $file == *"guard"* ]] || [[ $file == *"jwt"* ]] || [[ $file == *"login"* ]] || [[ $file == *"register"* ]]; then
    echo "$file" >> optimization-analysis/auth-related.txt
  elif [[ $file == *"components"* ]] || [[ $file == *"styles"* ]] || [[ $file == *".css"* ]]; then
    echo "$file" >> optimization-analysis/ui-components.txt
  elif [[ $file == *"service"* ]] || [[ $file == *"controller"* ]] || [[ $file == *"module"* ]]; then
    echo "$file" >> optimization-analysis/services.txt
  else
    echo "$file" >> optimization-analysis/others.txt
  fi
done < optimization-analysis/modified-files.txt

echo ""
echo "⚠️  Fichiers liés à l'authentification (À ÉVITER):"
cat optimization-analysis/auth-related.txt

echo ""
echo "✅ Composants UI (SÛRS À RÉCUPÉRER):"
cat optimization-analysis/ui-components.txt

echo ""
echo "📦 Services et contrôleurs (À VÉRIFIER):"
cat optimization-analysis/services.txt

echo ""
echo "📄 Autres fichiers:"
cat optimization-analysis/others.txt

# 3. Créer un rapport des commits
echo ""
echo "=== Historique des commits sur optimisation ==="
git log blog..optimisation --oneline > optimization-analysis/commits.txt
cat optimization-analysis/commits.txt
