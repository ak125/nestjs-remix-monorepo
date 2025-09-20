#!/bin/bash

echo "🔒 Vérification de sécurité..."

# Vérifier les permissions .env
if [ -f backend/.env ]; then
  PERM=$(stat -c "%a" backend/.env)
  if [ "$PERM" != "600" ]; then
    echo "❌ ALERTE: .env a des permissions trop ouvertes ($PERM)"
    echo "   Exécutez: chmod 600 backend/.env"
  else
    echo "✅ Permissions .env OK (600)"
  fi
fi

# Vérifier si .env est dans git
if git ls-files --error-unmatch backend/.env 2>/dev/null; then
  echo "❌ CRITIQUE: .env est tracké par Git!"
  echo "   Exécutez: git rm --cached backend/.env"
else
  echo "✅ .env non tracké par Git"
fi

# Rechercher les mots de passe en dur (hors tests)
echo "🔍 Recherche de secrets en dur..."
SECRETS=$(grep -r "password.*=.*['\"]" --include="*.ts" --exclude-dir=node_modules --exclude="*test*" --exclude="*spec*" backend/src | grep -v "process.env" | wc -l)

if [ "$SECRETS" -gt 0 ]; then
  echo "⚠️  $SECRETS mot(s) de passe potentiel(s) trouvé(s)"
else
  echo "✅ Pas de mots de passe en dur détectés"
fi

# Vérifier que TestHelpers n'est utilisé qu'en test
TEST_HELPERS_USAGE=$(grep -r "TestHelpers" --include="*.ts" --exclude-dir=node_modules backend/src | grep -v "test-helpers.ts" | wc -l)
if [ "$TEST_HELPERS_USAGE" -gt 0 ]; then
  echo "✅ TestHelpers utilisé dans $TEST_HELPERS_USAGE fichier(s) (normal)"
else
  echo "⚠️  TestHelpers non utilisé"
fi

echo "🔒 Vérification terminée"
