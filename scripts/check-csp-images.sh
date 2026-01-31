#!/bin/bash
# Vérifie que les domaines d'images sont cohérents entre frontend et CSP
# Ce script échoue si un domaine image n'est pas dans la config CSP

set -e

echo "🔍 Vérification cohérence CSP/Images..."

CSP_CONFIG="backend/src/config/csp.config.ts"
IMAGE_OPTIMIZER="frontend/app/utils/image-optimizer.ts"

# Vérifier que les fichiers existent
if [ ! -f "$CSP_CONFIG" ]; then
    echo "❌ ERREUR: $CSP_CONFIG non trouvé"
    exit 1
fi

if [ ! -f "$IMAGE_OPTIMIZER" ]; then
    echo "❌ ERREUR: $IMAGE_OPTIMIZER non trouvé"
    exit 1
fi

# Extraire le domaine DOMAIN depuis image-optimizer.ts
FRONTEND_DOMAIN=$(grep -oP 'DOMAIN:\s*["'"'"']([^"'"'"']+)' "$IMAGE_OPTIMIZER" | head -1 | grep -oP 'https://[^"'"'"']+' || echo "")

if [ -z "$FRONTEND_DOMAIN" ]; then
    echo "⚠️  WARN: Impossible d'extraire DOMAIN depuis $IMAGE_OPTIMIZER"
else
    # Vérifier qu'il existe dans csp.config.ts
    if ! grep -q "$FRONTEND_DOMAIN" "$CSP_CONFIG" 2>/dev/null; then
        echo "❌ ERREUR: $FRONTEND_DOMAIN n'est pas dans CSP_CONFIG"
        echo "   Ajouter à: $CSP_CONFIG → IMAGE_DOMAINS"
        exit 1
    fi
    echo "✅ Domaine $FRONTEND_DOMAIN présent dans CSP"
fi

# Vérifier SUPABASE_URL par défaut
SUPABASE_DEFAULT="https://cxpojprgwgubzjyqzmoq.supabase.co"
if ! grep -q "$SUPABASE_DEFAULT" "$CSP_CONFIG" 2>/dev/null; then
    echo "⚠️  WARN: Supabase URL par défaut ($SUPABASE_DEFAULT) non trouvée dans CSP"
else
    echo "✅ Supabase URL présente dans CSP"
fi

# Vérifier que IMAGE_DOMAINS est utilisé dans imgSrc
if ! grep -q "Object.values(IMAGE_DOMAINS)" "$CSP_CONFIG" 2>/dev/null; then
    echo "⚠️  WARN: IMAGE_DOMAINS n'est pas utilisé dans imgSrc (vérifier la construction)"
else
    echo "✅ IMAGE_DOMAINS utilisé pour construire imgSrc"
fi

echo "🎉 Validation CSP réussie!"
