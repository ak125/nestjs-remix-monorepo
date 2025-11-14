import os
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

# Test auto_type
result = supabase.table("auto_type").select("type_id, type_modele_id").limit(1).execute()
if result.data:
    row = result.data[0]
    print(f"auto_type.type_modele_id = {type(row['type_modele_id']).__name__} (valeur: {row['type_modele_id']})")

# Test auto_modele
result = supabase.table("auto_modele").select("modele_id").limit(1).execute()
if result.data:
    row = result.data[0]
    print(f"auto_modele.modele_id = {type(row['modele_id']).__name__} (valeur: {row['modele_id']})")
