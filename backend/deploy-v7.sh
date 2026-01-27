#!/bin/bash
cd /opt/automecanik/app/backend

# Read SQL and convert to JSON
python3 << 'PYEOF'
import json
import urllib.request

sql = open('sql/fix-rpc-v3-integer-cast.sql').read()
payload = json.dumps({"query": sql}).encode('utf-8')

req = urllib.request.Request(
    'https://api.supabase.com/v1/projects/cxpojprgwgubzjyqzmoq/database/query',
    data=payload,
    headers={
        'Authorization': 'Bearer sbp_3985705a56e1f265447aed1ef6ff51e4e6c1c091',
        'Content-Type': 'application/json'
    }
)

try:
    with urllib.request.urlopen(req) as response:
        result = response.read().decode('utf-8')
        print("SUCCESS:", result[:200])
except urllib.error.HTTPError as e:
    print("ERROR:", e.code, e.read().decode('utf-8')[:500])
PYEOF
