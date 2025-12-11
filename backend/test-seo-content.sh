#!/bin/bash
# Test API SEO marque - versions HTML et texte

echo "ðŸ§ª Test SEO marque Renault"
echo "=========================="
echo ""

RESPONSE=$(curl -s "http://localhost:3000/api/brands/brand/renault")

if [ -z "$RESPONSE" ]; then
  echo "âŒ Serveur non disponible"
  exit 1
fi

echo "âœ… RÃ©ponse reÃ§ue"
echo ""

echo "$RESPONSE" | python3 << 'PYEOF'
import sys, json

try:
    data = json.load(sys.stdin)
    seo = data['data']['seo']
    
    print("ðŸ“‹ Title:")
    print(f"  {seo['title']}\n")
    
    print("ðŸ“ Content HTML (200 premiers caractÃ¨res):")
    print(f"  {seo['content'][:200]}...\n")
    
    print("ðŸ“„ Content Text (200 premiers caractÃ¨res):")
    print(f"  {seo['contentText'][:200]}...\n")
    
    # VÃ©rifier absence de balises HTML dans contentText
    if '<' in seo['contentText'] or '>' in seo['contentText']:
        print("âš ï¸  ATTENTION: Des balises HTML restent dans contentText")
    else:
        print("âœ… Content text propre (sans HTML)")
        
except Exception as e:
    print(f"âŒ Erreur: {e}")
    
PYEOF
