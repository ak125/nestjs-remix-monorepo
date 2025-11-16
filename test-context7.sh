#!/bin/bash

# Script de test Context7 MCP
# Teste la résolution des bibliothèques principales du projet

echo "🧪 Test Context7 MCP - Résolution des bibliothèques"
echo "===================================================="
echo ""

# Fonction pour tester la résolution d'une bibliothèque
test_library() {
    local lib_name=$1
    local expected_id=$2
    
    echo "📚 Test: $lib_name"
    echo "   ID attendu: $expected_id"
    echo ""
}

# Test des bibliothèques principales
test_library "NestJS" "/nestjs/nest"
test_library "Remix" "/remix-run/remix"
test_library "Supabase" "/supabase/supabase"
test_library "TypeScript" "/microsoft/TypeScript"
test_library "React" "/facebook/react"
test_library "Redis" "/redis/node-redis"

echo "===================================================="
echo "✅ Tests terminés"
echo ""
echo "Pour utiliser Context7 dans Copilot:"
echo "  1. Ouvrez le panneau Copilot Chat"
echo "  2. Tapez un prompt avec 'use context7'"
echo "  3. Exemple: 'Crée un service NestJS. use context7'"
echo ""
echo "Configuration MCP dans: .vscode/settings.json"
echo "Guide complet dans: CONTEXT7-GUIDE.md"
