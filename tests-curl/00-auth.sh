#!/bin/bash
# Login admin et sauvegarde cookie pour les tests suivants
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/.cookies"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_FILE" \
  -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@autoparts.com","password":"SuperAdmin2025!"}')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: auth-login (HTTP $HTTP_CODE, cookie saved)"
else
  echo "FAIL: auth-login (HTTP $HTTP_CODE)"
  exit 1
fi
