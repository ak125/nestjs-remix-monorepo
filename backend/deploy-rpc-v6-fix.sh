#!/bin/bash
# Deploy RPC V6 fix to Supabase

TOKEN="${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis (personal access token Supabase, format sbp_…) — aucune valeur par défaut}"
PROJECT_ID="cxpojprgwgubzjyqzmoq"

# Read SQL file and create JSON payload
SQL_CONTENT=$(cat sql/fix-rpc-v3-integer-cast.sql)

# Create temp file with JSON payload
echo '{"query":' > /tmp/payload.json
echo "$SQL_CONTENT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' >> /tmp/payload.json
echo '}' >> /tmp/payload.json

# Send to Supabase API
curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json

echo ""
echo "Done"
