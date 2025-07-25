#!/bin/bash

echo "🔍 Vérification de l'environnement Super Admin niveau 9"
echo "=================================================="
echo ""

# Vérifier les fichiers créés
echo "📁 Fichiers de création du Super Admin:"
files=("create-super-admin-level9.sql" "generate-super-admin-hash.js" "test-super-admin-auth.sh" "GUIDE-SUPER-ADMIN.md")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file manquant"
    fi
done
echo ""

# Vérifier que le backend a les bonnes méthodes
echo "🔍 Vérification du code backend:"

if grep -q "findAdminByEmail" backend/src/database/supabase-rest.service.ts; then
    echo "✅ Méthode findAdminByEmail présente"
else
    echo "❌ Méthode findAdminByEmail manquante"
fi

if grep -q "interface Admin" backend/src/database/supabase-rest.service.ts; then
    echo "✅ Interface Admin définie"
else
    echo "❌ Interface Admin manquante"
fi

if grep -q "cnfa_mail" backend/src/database/supabase-rest.service.ts; then
    echo "✅ Champs table ___config_admin configurés"
else
    echo "❌ Configuration table ___config_admin manquante"
fi
echo ""

# Vérifier la compilation
echo "🔨 Test de compilation TypeScript:"
cd backend
if npm run build > /dev/null 2>&1; then
    echo "✅ Compilation réussie"
else
    echo "❌ Erreurs de compilation"
fi
cd ..
echo ""

# Instructions finales
echo "📋 Prochaines étapes:"
echo "1. Exécuter le script SQL dans Supabase:"
echo "   📄 create-super-admin-level9.sql"
echo ""
echo "2. Démarrer le backend:"
echo "   cd backend && npm run start:dev"
echo ""
echo "3. Tester l'authentification:"
echo "   ./test-super-admin-auth.sh"
echo ""
echo "4. Consulter le guide complet:"
echo "   📖 GUIDE-SUPER-ADMIN.md"
echo ""
echo "🔐 Informations de connexion:"
echo "   Email: superadmin@autoparts.com"
echo "   Mot de passe: SuperAdmin2025!"
echo "   Niveau: 9 (Super Admin)"
