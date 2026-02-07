#!/bin/bash
# Deploy RPC V6 fix to Supabase

TOKEN="sbp_3985705a56e1f265447aed1ef6ff51e4e6c1c091"
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
