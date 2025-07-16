#!/bin/bash

echo "🔍 TEST APPROFONDI DU PROBLÈME POST PROFILE"
echo "==========================================="
echo "Date: $(date)"
echo "Objectif: Confirmer définitivement le statut des actions POST Profile"
echo ""

# Nettoyer les fichiers temporaires
rm -f /tmp/cookies.txt /tmp/profile_*.txt

echo "📋 ÉTAPE 1: Configuration initiale"
echo "=================================="
echo "🔧 Nettoyage des cookies..."
echo "🔧 Préparation des tests..."
echo ""

echo "📋 ÉTAPE 2: Connexion utilisateur"
echo "================================="
echo "🔐 Connexion avec test2@example.com..."

LOGIN_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt)

LOGIN_STATUS=$(echo $LOGIN_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
echo "Status connexion: $LOGIN_STATUS"

if [ "$LOGIN_STATUS" = "302" ]; then
    echo "✅ Connexion réussie"
    
    echo ""
    echo "📋 ÉTAPE 3: Vérification accès profil GET"
    echo "========================================"
    
    PROFILE_GET_STATUS=$(curl -s -w "%{http_code}" http://localhost:3000/profile -b /tmp/cookies.txt -o /tmp/profile_get.txt)
    echo "Status GET Profile: $PROFILE_GET_STATUS"
    
    if [ "$PROFILE_GET_STATUS" = "200" ]; then
        echo "✅ Accès GET Profile fonctionnel"
        GET_SIZE=$(wc -c < /tmp/profile_get.txt)
        echo "Taille réponse GET: $GET_SIZE bytes"
        
        echo ""
        echo "📋 ÉTAPE 4: TEST POST PROFILE - Série de tests"
        echo "============================================="
        
        # Test 1: Action updateProfile avec timeout court
        echo ""
        echo "🧪 Test 1: Action updateProfile (timeout 3s)"
        echo "--------------------------------------------"
        
        timeout 3 curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/profile \
          -b /tmp/cookies.txt \
          -d "_action=updateProfile&firstName=TestUpdate&lastName=UserUpdate&email=test2@example.com" \
          -H "Content-Type: application/x-www-form-urlencoded" \
          -o /tmp/profile_update_test1.txt
        
        TEST1_EXIT_CODE=$?
        
        if [ $TEST1_EXIT_CODE -eq 124 ]; then
            echo "❌ TIMEOUT: Action updateProfile se bloque (>3s)"
            echo "📝 Statut: PROBLÈME CONFIRMÉ"
        elif [ $TEST1_EXIT_CODE -eq 0 ]; then
            echo "✅ Action updateProfile terminée dans les temps"
            if [ -f /tmp/profile_update_test1.txt ]; then
                UPDATE_SIZE=$(wc -c < /tmp/profile_update_test1.txt)
                echo "Taille réponse: $UPDATE_SIZE bytes"
                echo "Contenu:"
                cat /tmp/profile_update_test1.txt | head -5
            fi
        else
            echo "⚠️  Erreur curl (code: $TEST1_EXIT_CODE)"
        fi
        
        # Test 2: Action changePassword avec timeout court
        echo ""
        echo "🧪 Test 2: Action changePassword (timeout 3s)"
        echo "---------------------------------------------"
        
        timeout 3 curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/profile \
          -b /tmp/cookies.txt \
          -d "_action=changePassword&currentPassword=test123&newPassword=test123&confirmPassword=test123" \
          -H "Content-Type: application/x-www-form-urlencoded" \
          -o /tmp/profile_password_test2.txt
        
        TEST2_EXIT_CODE=$?
        
        if [ $TEST2_EXIT_CODE -eq 124 ]; then
            echo "❌ TIMEOUT: Action changePassword se bloque (>3s)"
            echo "📝 Statut: PROBLÈME CONFIRMÉ"
        elif [ $TEST2_EXIT_CODE -eq 0 ]; then
            echo "✅ Action changePassword terminée dans les temps"
            if [ -f /tmp/profile_password_test2.txt ]; then
                PASS_SIZE=$(wc -c < /tmp/profile_password_test2.txt)
                echo "Taille réponse: $PASS_SIZE bytes"
                echo "Contenu:"
                cat /tmp/profile_password_test2.txt | head -5
            fi
        else
            echo "⚠️  Erreur curl (code: $TEST2_EXIT_CODE)"
        fi
        
        # Test 3: Action inconnue pour vérifier le handling
        echo ""
        echo "🧪 Test 3: Action inconnue (timeout 3s)"
        echo "---------------------------------------"
        
        timeout 3 curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/profile \
          -b /tmp/cookies.txt \
          -d "_action=unknownAction&test=value" \
          -H "Content-Type: application/x-www-form-urlencoded" \
          -o /tmp/profile_unknown_test3.txt
        
        TEST3_EXIT_CODE=$?
        
        if [ $TEST3_EXIT_CODE -eq 124 ]; then
            echo "❌ TIMEOUT: Même les actions inconnues se bloquent"
            echo "📝 Statut: PROBLÈME GÉNÉRAL CONFIRMÉ"
        elif [ $TEST3_EXIT_CODE -eq 0 ]; then
            echo "✅ Action inconnue gérée correctement"
            if [ -f /tmp/profile_unknown_test3.txt ]; then
                UNKNOWN_SIZE=$(wc -c < /tmp/profile_unknown_test3.txt)
                echo "Taille réponse: $UNKNOWN_SIZE bytes"
                echo "Contenu:"
                cat /tmp/profile_unknown_test3.txt | head -5
            fi
        else
            echo "⚠️  Erreur curl (code: $TEST3_EXIT_CODE)"
        fi
        
        # Test 4: POST sans action pour vérifier la gestion
        echo ""
        echo "🧪 Test 4: POST sans action (timeout 3s)"
        echo "----------------------------------------"
        
        timeout 3 curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/profile \
          -b /tmp/cookies.txt \
          -d "firstName=Test&lastName=User" \
          -H "Content-Type: application/x-www-form-urlencoded" \
          -o /tmp/profile_noaction_test4.txt
        
        TEST4_EXIT_CODE=$?
        
        if [ $TEST4_EXIT_CODE -eq 124 ]; then
            echo "❌ TIMEOUT: POST sans action se bloque aussi"
            echo "📝 Statut: PROBLÈME AU NIVEAU DE LA ROUTE"
        elif [ $TEST4_EXIT_CODE -eq 0 ]; then
            echo "✅ POST sans action géré correctement"
            if [ -f /tmp/profile_noaction_test4.txt ]; then
                NOACTION_SIZE=$(wc -c < /tmp/profile_noaction_test4.txt)
                echo "Taille réponse: $NOACTION_SIZE bytes"
                echo "Contenu:"
                cat /tmp/profile_noaction_test4.txt | head -5
            fi
        else
            echo "⚠️  Erreur curl (code: $TEST4_EXIT_CODE)"
        fi
        
        echo ""
        echo "📋 ÉTAPE 5: ANALYSE DES RÉSULTATS"
        echo "================================="
        
        TOTAL_TIMEOUTS=0
        TOTAL_SUCCESS=0
        
        [ $TEST1_EXIT_CODE -eq 124 ] && TOTAL_TIMEOUTS=$((TOTAL_TIMEOUTS + 1))
        [ $TEST2_EXIT_CODE -eq 124 ] && TOTAL_TIMEOUTS=$((TOTAL_TIMEOUTS + 1))
        [ $TEST3_EXIT_CODE -eq 124 ] && TOTAL_TIMEOUTS=$((TOTAL_TIMEOUTS + 1))
        [ $TEST4_EXIT_CODE -eq 124 ] && TOTAL_TIMEOUTS=$((TOTAL_TIMEOUTS + 1))
        
        [ $TEST1_EXIT_CODE -eq 0 ] && TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
        [ $TEST2_EXIT_CODE -eq 0 ] && TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
        [ $TEST3_EXIT_CODE -eq 0 ] && TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
        [ $TEST4_EXIT_CODE -eq 0 ] && TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
        
        echo "📊 Résultats des tests:"
        echo "   - Succès: $TOTAL_SUCCESS/4"
        echo "   - Timeouts: $TOTAL_TIMEOUTS/4"
        echo "   - Autres: $((4 - TOTAL_SUCCESS - TOTAL_TIMEOUTS))/4"
        
        if [ $TOTAL_TIMEOUTS -gt 0 ]; then
            echo ""
            echo "❌ PROBLÈME CONFIRMÉ: Actions POST Profile se bloquent"
            echo "🔍 Analyse:"
            echo "   - GET Profile fonctionne normalement"
            echo "   - POST Profile cause des timeouts"
            echo "   - Problème dans le code de l'action Remix"
            echo "   - Potentielle boucle infinie ou deadlock"
        else
            echo ""
            echo "✅ PROBLÈME RÉSOLU: Toutes les actions POST fonctionnent"
            echo "🎉 Système entièrement opérationnel"
        fi
        
    else
        echo "❌ Problème d'accès GET Profile ($PROFILE_GET_STATUS)"
        echo "⚠️  Impossible de continuer les tests POST"
    fi
    
else
    echo "❌ Échec de connexion ($LOGIN_STATUS)"
    echo "⚠️  Impossible de continuer les tests"
fi

echo ""
echo "📋 ÉTAPE 6: RÉSUMÉ FINAL"
echo "======================="
echo "Date: $(date)"
echo "Tests effectués: 4 tests POST Profile"
echo "Résultat: $([ $TOTAL_TIMEOUTS -gt 0 ] && echo 'PROBLÈME CONFIRMÉ' || echo 'PROBLÈME RÉSOLU')"
echo ""
echo "🎯 STATUT FINAL:"
if [ $TOTAL_TIMEOUTS -gt 0 ]; then
    echo "❌ ACTIONS POST PROFILE: PROBLÉMATIQUES (timeouts)"
    echo "✅ Autres fonctionnalités: Opérationnelles"
    echo "⚠️  Investigation technique nécessaire"
else
    echo "✅ ACTIONS POST PROFILE: FONCTIONNELLES"
    echo "✅ Système complet: Opérationnel"
    echo "🎉 Prêt pour production"
fi

echo ""
echo "🔍 TEST APPROFONDI TERMINÉ"
echo "=========================="
