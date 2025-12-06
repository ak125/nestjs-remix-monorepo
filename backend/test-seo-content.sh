#!/bin/bash
# Test API SEO marque - versions HTML et texte

echo "🧪 Test SEO marque Renault"
echo "=========================="
echo ""

RESPONSE=$(curl -s "http://localhost:3000/api/brands/brand/renault")

if [ -z "$RESPONSE" ]; then
  echo "❌ Serveur non disponible"
  exit 1
fi

echo "✅ Réponse reçue"
echo ""

echo "$RESPONSE" | python3 << 'PYEOF'
import sys, json

try:
    data = json.load(sys.stdin)
    seo = data['data']['seo']
    
    print("📋 Title:")
    print(f"  {seo['title']}\n")
    
    print("📝 Content HTML (200 premiers caractères):")
    print(f"  {seo['content'][:200]}...\n")
    
    print("📄 Content Text (200 premiers caractères):")
    print(f"  {seo['contentText'][:200]}...\n")
    
    # Vérifier absence de balises HTML dans contentText
    if '<' in seo['contentText'] or '>' in seo['contentText']:
        print("⚠️  ATTENTION: Des balises HTML restent dans contentText")
    else:
        print("✅ Content text propre (sans HTML)")
        
except Exception as e:
    print(f"❌ Erreur: {e}")
    
PYEOF
