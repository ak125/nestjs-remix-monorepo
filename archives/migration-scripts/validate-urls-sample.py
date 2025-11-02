#!/usr/bin/env python3
"""
🧪 VALIDATION URLs - Test d'échantillon
Teste un échantillon d'URLs du sitemap en appelant l'API de validation
"""

import os
import sys
import time
import requests
from collections import defaultdict

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Module supabase non installé")
    print("📦 Installation: pip install supabase requests")
    sys.exit(1)


class URLValidator:
    def __init__(self, api_base_url="http://localhost:3000"):
        """Initialisation du validateur d'URLs"""
        self.api_base = api_base_url
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.key:
            raise ValueError("❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises")
        
        self.supabase: Client = create_client(self.url, self.key)
        self.results = {
            "total_tested": 0,
            "valid": 0,
            "invalid": 0,
            "errors": 0,
            "by_status": defaultdict(int),
            "failed_urls": []
        }
    
    def test_url_via_api(self, type_id: int, gamme_id: int) -> dict:
        """Teste une URL via l'API de validation"""
        try:
            url = f"{self.api_base}/api/catalog/integrity/validate/{type_id}/{gamme_id}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "valid": data.get("data", {}).get("valid", False),
                    "http_status": data.get("data", {}).get("http_status", 500),
                    "relations_count": data.get("data", {}).get("relations_count", 0),
                    "recommendation": data.get("data", {}).get("recommendation", "")
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def validate_sample(self, sample_size=100):
        """Valide un échantillon d'URLs"""
        print(f"\n🧪 Validation de {sample_size} URLs aléatoires...")
        print("="*60)
        
        # Récupérer un échantillon aléatoire
        try:
            result = self.supabase.table("__sitemap_p_link")\
                .select("map_type_id, map_pg_id, map_has_item, map_pg_alias, map_type_alias")\
                .limit(sample_size)\
                .execute()
            
            if not result.data:
                print("❌ Aucune donnée récupérée")
                return
            
            print(f"✅ {len(result.data)} URLs récupérées\n")
            
            # Tester chaque URL
            for i, row in enumerate(result.data, 1):
                type_id = int(row["map_type_id"])
                gamme_id = int(row["map_pg_id"])
                has_item = int(row.get("map_has_item", 0))
                
                print(f"[{i}/{len(result.data)}] Test type_id={type_id}, gamme_id={gamme_id}, has_item={has_item}...", end=" ")
                
                # Tester via API
                test_result = self.test_url_via_api(type_id, gamme_id)
                
                self.results["total_tested"] += 1
                
                if test_result.get("success"):
                    if test_result.get("valid"):
                        self.results["valid"] += 1
                        status = test_result.get("http_status", 200)
                        self.results["by_status"][status] += 1
                        print(f"✅ {status} ({test_result.get('relations_count', 0)} pièces)")
                    else:
                        self.results["invalid"] += 1
                        status = test_result.get("http_status", 410)
                        self.results["by_status"][status] += 1
                        print(f"❌ {status} - {test_result.get('recommendation', 'Invalid')}")
                        
                        self.results["failed_urls"].append({
                            "type_id": type_id,
                            "gamme_id": gamme_id,
                            "has_item": has_item,
                            "status": status,
                            "reason": test_result.get("recommendation", "Unknown")
                        })
                else:
                    self.results["errors"] += 1
                    print(f"⚠️ Erreur: {test_result.get('error', 'Unknown')}")
                
                # Petite pause pour ne pas surcharger l'API
                time.sleep(0.1)
            
            # Afficher les résultats
            self.print_results()
            
        except Exception as e:
            print(f"\n❌ Erreur: {str(e)}")
    
    def print_results(self):
        """Affiche les résultats de validation"""
        print("\n" + "="*60)
        print("📊 RÉSULTATS DE VALIDATION")
        print("="*60)
        
        total = self.results["total_tested"]
        valid = self.results["valid"]
        invalid = self.results["invalid"]
        errors = self.results["errors"]
        
        print(f"\n  Total testé: {total}")
        print(f"  ✅ Valide: {valid} ({valid/total*100:.1f}%)")
        print(f"  ❌ Invalide: {invalid} ({invalid/total*100:.1f}%)")
        print(f"  ⚠️ Erreurs: {errors} ({errors/total*100:.1f}%)")
        
        print(f"\n  📈 Répartition par code HTTP:")
        for status, count in sorted(self.results["by_status"].items()):
            print(f"    - {status}: {count} ({count/total*100:.1f}%)")
        
        if self.results["failed_urls"]:
            print(f"\n  🔍 Exemples d'URLs invalides:")
            for fail in self.results["failed_urls"][:5]:
                print(f"    - type_id={fail['type_id']}, gamme_id={fail['gamme_id']}, has_item={fail['has_item']}")
                print(f"      → {fail['status']}: {fail['reason']}")
    
    def check_api_health(self):
        """Vérifie que l'API est accessible"""
        try:
            response = requests.get(f"{self.api_base}/health", timeout=5)
            if response.status_code == 200:
                print(f"✅ API accessible: {self.api_base}")
                return True
            else:
                print(f"⚠️ API répond avec status {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ API non accessible: {str(e)}")
            return False


if __name__ == "__main__":
    print("="*60)
    print("🧪 VALIDATION URLs - Test d'échantillon")
    print("="*60)
    
    # Vérifier les arguments
    sample_size = 100
    if len(sys.argv) > 1:
        try:
            sample_size = int(sys.argv[1])
        except ValueError:
            print(f"⚠️ Argument invalide, utilisation de {sample_size} par défaut")
    
    try:
        validator = URLValidator()
        
        # Vérifier que l'API est accessible
        if not validator.check_api_health():
            print("\n❌ L'API doit être lancée (npm run dev)")
            sys.exit(1)
        
        # Lancer la validation
        validator.validate_sample(sample_size)
        
        print("\n✅ Validation terminée!")
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Validation interrompue par l'utilisateur")
    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        sys.exit(1)
