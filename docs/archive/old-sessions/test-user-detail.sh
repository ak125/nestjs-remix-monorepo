#!/bin/bash
echo "=== TEST PAGE DETAIL UTILISATEUR ==="
echo ""

# 1. Connexion admin
echo "1️⃣ Connexion admin..."
curl -s -c /tmp/test-session.txt -b /tmp/test-session.txt \
  -L "http://localhost:3000/authenticate" \
  -d "email=superadmin@autoparts.com&password=SuperAdmin2025!" \
  -H "Content-Type: application/x-www-form-urlencoded" > /dev/null

echo "✅ Session créée"
echo ""

# 2. Test page détail
echo "2️⃣ Test page détail monia123..."
RESPONSE=$(curl -s -b /tmp/test-session.txt -L "http://localhost:3000/admin/users/usr_1759774640723_njikmiz59")

# Vérifier si on a les bonnes données
if echo "$RESPONSE" | grep -q "monia123@gmail.com"; then
  echo "✅ Email trouvé: monia123@gmail.com"
else
  echo "❌ Email monia123 NON trouvé"
fi

if echo "$RESPONSE" | grep -q '"firstName":"monia"'; then
  echo "✅ Prénom trouvé: monia"
else
  echo "❌ Prénom monia NON trouvé"
fi

if echo "$RESPONSE" | grep -q '"lastName":"diff"'; then
  echo "✅ Nom trouvé: diff"
else
  echo "❌ Nom diff NON trouvé"
fi

echo ""
echo "3️⃣ Données JSON extraites:"
echo "$RESPONSE" | grep -o '"user":{[^}]*}' | head -1 | python3 -m json.tool 2>/dev/null || echo "$RESPONSE" | grep -o '"user":{[^}]*}' | head -1

