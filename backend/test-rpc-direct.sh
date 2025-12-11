#!/bin/bash
set -e

echo "ðŸ” TEST DIRECT DE LA FONCTION RPC DANS SUPABASE"
echo ""

source .env

# Test 1: Appeler la fonction via l'API REST Supabase directement
echo "ðŸ“¡ Test 1: Appel RPC direct via API Supabase..."
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/get_gamme_page_data_optimized" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_pg_id": 10}' \
  | jq -c 'if .message then {error: .message, code: .code, hint: .hint, details: .details} else {success: true, has_catalog: (.catalog != null)} end'

echo ""
echo ""

# Test 2: VÃ©rifier si la fonction existe
echo "ðŸ” Test 2: VÃ©rification existence de la fonction..."
PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h "${SUPABASE_DB_HOST}" \
  -p 6543 \
  -U "postgres.cxpojprgwgubzjyqzmoq" \
  -d "postgres" \
  -t -c "SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_gamme_page_data_optimized' LIMIT 1;" \
  2>&1 | head -20

echo ""
echo "âœ… Tests terminÃ©s"
