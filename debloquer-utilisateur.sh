#!/bin/bash

# 🔧 SCRIPT POUR DÉBLOQUER L'UTILISATEUR
echo "🔧 DÉBLOCAGE DE L'UTILISATEUR test456@example.com"
echo "==============================================="

# Méthode 1: Nettoyer le cache Redis
echo "1. Tentative de nettoyage du cache Redis..."

# Si redis-cli est disponible
if command -v redis-cli &> /dev/null; then
    echo "🔍 Recherche des clés Redis pour test456@example.com..."
    redis-cli KEYS "*test456@example.com*" 2>/dev/null || echo "Redis-cli disponible mais pas de connexion"
    
    echo "🧹 Nettoyage des clés de rate limiting..."
    redis-cli DEL "rate_limit:test456@example.com" 2>/dev/null || echo "Clé rate_limit non trouvée"
    redis-cli DEL "login_attempts:test456@example.com" 2>/dev/null || echo "Clé login_attempts non trouvée"
    redis-cli DEL "blocked:test456@example.com" 2>/dev/null || echo "Clé blocked non trouvée"
    
    echo "🔍 Nettoyage général des clés contenant l'email..."
    redis-cli --scan --pattern "*test456@example.com*" | xargs redis-cli DEL 2>/dev/null || echo "Pas de clés trouvées"
    
else
    echo "❌ redis-cli non disponible"
fi

# Méthode 2: Attendre que le rate limit expire
echo ""
echo "2. Alternative: Attendre l'expiration du rate limit..."
echo "⏱️  Le rate limit expire généralement après 5-15 minutes"

# Méthode 3: Redémarrer le serveur (solution radicale)
echo ""
echo "3. Solution radicale: Redémarrer le serveur..."
echo "💡 Cela effacera tous les rate limits en mémoire"

echo ""
echo "🔄 TESTS APRÈS DÉBLOCAGE:"
echo "========================"
echo "curl -s -X POST \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"email\":\"test456@example.com\",\"password\":\"password123\"}' \\"
echo "    \"http://localhost:3000/auth/login\""

echo ""
echo "🎯 SI LE PROBLÈME PERSISTE:"
echo "==========================="
echo "1. Vérifier les logs du serveur pour voir les détails du rate limiting"
echo "2. Identifier le service de cache utilisé (Redis/mémoire)"
echo "3. Ajuster la configuration du rate limiting"
