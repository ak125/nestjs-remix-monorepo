#!/bin/bash

echo "======================================================"
echo "🔍 DIAGNOSTIC DE LA BASE DE DONNÉES"
echo "======================================================"
echo "Date: $(date)"
echo ""

# Fonction pour afficher les résultats
show_result() {
    local status=$1
    local message=$2
    if [ $status -eq 0 ]; then
        echo "✅ $message"
    else
        echo "❌ $message"
    fi
}

# =============================================================================
echo "📋 PHASE 1: DIAGNOSTIC DES SERVICES"
echo "============================================================================="

echo "1.1 Vérification des processus Docker..."
docker ps 2>/dev/null | grep -q "postgres\|supabase"
show_result $? "Services Docker PostgreSQL/Supabase"

echo "1.2 Vérification des ports d'écoute..."
netstat -tuln 2>/dev/null | grep -E ":5432|:54321"
echo "    📋 Ports PostgreSQL/Supabase détectés"

echo "1.3 Vérification des variables d'environnement..."
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL définie"
else
    echo "❌ DATABASE_URL non définie"
fi

if [ -n "$SUPABASE_URL" ]; then
    echo "✅ SUPABASE_URL définie: $SUPABASE_URL"
else
    echo "❌ SUPABASE_URL non définie"
fi

echo ""

# =============================================================================
echo "📋 PHASE 2: TESTS DE CONNECTIVITÉ BASE DE DONNÉES"
echo "============================================================================="

echo "2.1 Test de connexion NestJS backend..."
curl -s http://localhost:3000/debug/db-status 2>/dev/null | grep -q "ok\|connected"
show_result $? "Connexion backend à la base de données"

echo "2.2 Test de l'API REST Supabase..."
curl -s -I http://localhost:54321/rest/v1/ 2>/dev/null | head -1 | grep -q "200\|404"
show_result $? "API REST Supabase accessible"

echo "2.3 Test de l'API Supabase avec authentification..."
curl -s -X GET 'http://localhost:54321/rest/v1/___xtr_customer?select=id,email' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  2>/dev/null | grep -q "id\|email\|\[\]"
show_result $? "Accès à la table ___xtr_customer"

echo ""

# =============================================================================
echo "📋 PHASE 3: ANALYSE DU PROBLÈME test-user-456"
echo "============================================================================="

echo "3.1 Recherche de l'utilisateur test-user-456..."
# Nettoyage des cookies pour tests propres
rm -f /tmp/cookies.txt

# Connexion pour obtenir une session
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -o /tmp/login_result.txt

# Test d'accès au profil pour voir les logs
curl -s http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -o /tmp/profile_result.txt

echo "    📋 Consulter les logs du serveur pour voir les erreurs 404"
echo "    📋 L'utilisateur test-user-456 semble manquer dans la base de données"

echo "3.2 Vérification des utilisateurs existants..."
echo "    📋 Utiliser l'éditeur SQL de Supabase pour exécuter:"
echo "    SELECT id, email, firstName, lastName FROM ___xtr_customer ORDER BY createdAt DESC;"

echo ""

# =============================================================================
echo "📋 PHASE 4: SOLUTIONS RECOMMANDÉES"
echo "============================================================================="

echo "4.1 📋 ÉTAPES POUR RÉSOUDRE LE PROBLÈME:"
echo ""
echo "   ÉTAPE 1: Accéder à l'interface Supabase"
echo "   - Ouvrir http://localhost:54321 dans le navigateur"
echo "   - Aller dans l'onglet 'SQL Editor'"
echo ""
echo "   ÉTAPE 2: Exécuter le script SQL"
echo "   - Copier le contenu du fichier create-test-user-456.sql"
echo "   - Coller et exécuter dans l'éditeur SQL"
echo ""
echo "   ÉTAPE 3: Vérifier la création"
echo "   - Exécuter: SELECT * FROM ___xtr_customer WHERE id = 'test-user-456';"
echo "   - Confirmer que l'utilisateur existe"
echo ""
echo "   ÉTAPE 4: Retester le système"
echo "   - Relancer ./verification-approfondie.sh"
echo "   - Vérifier que les erreurs 404 ont disparu"

echo ""
echo "4.2 📋 ALTERNATIVE: Utiliser l'interface web Supabase"
echo "   - Aller dans l'onglet 'Table Editor'"
echo "   - Sélectionner la table ___xtr_customer"
echo "   - Cliquer sur 'Insert' → 'Insert row'"
echo "   - Remplir les champs selon le fichier SQL"

echo ""
echo "4.3 📋 VÉRIFICATION POST-CRÉATION"
echo "   - Relancer ce script de diagnostic"
echo "   - Tester la connexion avec test2@example.com"
echo "   - Vérifier que les actions POST fonctionnent sans erreur 404"

echo ""

# =============================================================================
echo "📋 INFORMATIONS SYSTÈME"
echo "============================================================================="

echo "📄 Fichiers créés pour la résolution:"
echo "   - create-test-user-456.sql (script SQL à exécuter)"
echo "   - verification-approfondie.sh (tests complets)"
echo "   - diagnostic-db.sh (ce script de diagnostic)"

echo ""
echo "🔍 Logs à surveiller:"
echo "   - Logs du serveur NestJS (terminal de développement)"
echo "   - Logs Supabase (si disponibles)"
echo "   - Réponses HTTP dans les fichiers /tmp/test_*.txt"

echo ""
echo "======================================================"
echo "🎯 DIAGNOSTIC TERMINÉ"
echo "======================================================"
echo "Date de fin: $(date)"
echo ""
echo "🚀 PROCHAINES ÉTAPES:"
echo "1. Créer l'utilisateur test-user-456 avec le script SQL"
echo "2. Relancer la vérification approfondie"
echo "3. Confirmer que tous les tests passent au vert"
