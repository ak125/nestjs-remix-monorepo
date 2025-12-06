"""
🔌 Connexion Supabase
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Charger .env depuis backend/
env_path = Path(__file__).parent.parent.parent.parent / '.env'
load_dotenv(env_path)

_client: Client = None

def get_supabase_client() -> Client:
    """Retourne un client Supabase singleton"""
    global _client
    
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            raise ValueError(
                "❌ Variables d'environnement manquantes!\n"
                f"   SUPABASE_URL: {'✅' if url else '❌'}\n"
                f"   SUPABASE_SERVICE_ROLE_KEY: {'✅' if key else '❌'}\n"
                f"   Fichier .env: {env_path}"
            )
        
        _client = create_client(url, key)
    
    return _client
