#!/usr/bin/env python3
"""
🔍 VÉRIFICATION ALIGNEMENT - Sitemap ↔️ URLs ↔️ DB
Vérifie que le format des URLs dans le sitemap correspond exactement
aux routes NestJS et aux données en base
"""

import os
import sys
import requests
import re

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Module supabase non installé")
    sys.exit(1)


class URLAlignmentChecker:
    def __init__(self, api_base="http://localhost:3000"):
        """Initialisation du vérificateur d'alignement"""
        self.api_base = api_base
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.key:
            raise ValueError("❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises")
        
        self.supabase: Client = create_client(self.url, self.key)
        self.issues = []
        self.success_count = 0
    
    def build_url_from_db(self, row: dict) -> str:
        """Construit l'URL à partir d'une ligne de la DB"""
        # Format attendu : /pieces/{pg_alias}-{pg_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
        return (
            f"/pieces/"
            f"{row['map_pg_alias']}-{row['map_pg_id']}/"
            f"{row['map_marque_alias']}-{row['map_marque_id']}/"
            f"{row['map_modele_alias']}-{row['map_modele_id']}/"
            f"{row['map_type_alias']}-{row['map_type_id']}.html"
        )
    
    def parse_url(self, url: str) -> dict:
        """Parse une URL pour extraire les IDs"""
        # Pattern : /pieces/{pg_alias}-{pg_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
        pattern = r'/pieces/([^/]+)-(\d+)/([^/]+)-(\d+)/([^/]+)-(\d+)/([^/]+)-(\d+)\.html'
        match = re.match(pattern, url)
        
        if not match:
            return None
        
        return {
            'pg_alias': match.group(1),
            'pg_id': int(match.group(2)),
            'marque_alias': match.group(3),
            'marque_id': int(match.group(4)),
            'modele_alias': match.group(5),
            'modele_id': int(match.group(6)),
            'type_alias': match.group(7),
            'type_id': int(match.group(8))
        }
    
    def check_url_in_api(self, parsed_url: dict) -> dict:
        """Vérifie que l'URL fonctionne dans l'API"""
        try:
            # Tester l'endpoint de validation
            url = f"{self.api_base}/api/catalog/integrity/validate/{parsed_url['type_id']}/{parsed_url['pg_id']}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "valid": data.get("data", {}).get("valid", False),
                    "status": data.get("data", {}).get("http_status", 500)
                }
            else:
                return {"success": False, "error": f"HTTP {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def verify_alignment(self, sample_size=20):
        """Vérifie l'alignement sur un échantillon"""
        print("="*70)
        print("🔍 VÉRIFICATION ALIGNEMENT - Sitemap ↔️ URLs ↔️ DB ↔️ API")
        print("="*70)
        print(f"\n📊 Échantillon: {sample_size} URLs\n")
        
        # 1. Récupérer des données de la DB
        print("📥 ÉTAPE 1: Récupération depuis __sitemap_p_link...")
        result = self.supabase.table("__sitemap_p_link")\
            .select("*")\
            .gt("map_has_item", 0)\
            .limit(sample_size)\
            .execute()
        
        if not result.data:
            print("❌ Aucune donnée récupérée")
            return
        
        print(f"✅ {len(result.data)} lignes récupérées\n")
        
        # 2. Pour chaque ligne, vérifier la cohérence
        print("🔗 ÉTAPE 2: Vérification de la cohérence...\n")
        
        for i, row in enumerate(result.data, 1):
            print(f"[{i}/{len(result.data)}] Vérification ID {row['map_id']}...")
            
            # 2.1 Construire l'URL depuis la DB
            url_from_db = self.build_url_from_db(row)
            print(f"  📋 URL DB: {url_from_db}")
            
            # 2.2 Parser l'URL pour vérifier le format
            parsed = self.parse_url(url_from_db)
            if not parsed:
                error = f"❌ URL mal formatée: {url_from_db}"
                print(f"  {error}")
                self.issues.append({"row_id": row['map_id'], "error": error})
                continue
            
            # 2.3 Vérifier que les IDs parsés correspondent aux IDs de la DB
            mismatches = []
            if parsed['pg_id'] != int(row['map_pg_id']):
                mismatches.append(f"pg_id: {parsed['pg_id']} != {row['map_pg_id']}")
            if parsed['marque_id'] != int(row['map_marque_id']):
                mismatches.append(f"marque_id: {parsed['marque_id']} != {row['map_marque_id']}")
            if parsed['modele_id'] != int(row['map_modele_id']):
                mismatches.append(f"modele_id: {parsed['modele_id']} != {row['map_modele_id']}")
            if parsed['type_id'] != int(row['map_type_id']):
                mismatches.append(f"type_id: {parsed['type_id']} != {row['map_type_id']}")
            
            if mismatches:
                error = f"❌ Mismatch IDs: {', '.join(mismatches)}"
                print(f"  {error}")
                self.issues.append({"row_id": row['map_id'], "error": error})
                continue
            
            print(f"  ✅ Format URL correct")
            
            # 2.4 Tester l'URL dans l'API
            api_result = self.check_url_in_api(parsed)
            
            if not api_result.get("success"):
                error = f"⚠️ API error: {api_result.get('error')}"
                print(f"  {error}")
                self.issues.append({"row_id": row['map_id'], "error": error})
                continue
            
            if not api_result.get("valid"):
                error = f"❌ API retourne invalid (status {api_result.get('status')})"
                print(f"  {error}")
                self.issues.append({"row_id": row['map_id'], "error": error})
                continue
            
            print(f"  ✅ API validation OK (HTTP {api_result.get('status')})")
            print(f"  ✅ ALIGNEMENT PARFAIT ✨\n")
            self.success_count += 1
        
        # 3. Résumé
        self.print_summary(len(result.data))
    
    def print_summary(self, total: int):
        """Affiche le résumé de la vérification"""
        print("="*70)
        print("📊 RÉSUMÉ DE LA VÉRIFICATION")
        print("="*70)
        
        success_rate = (self.success_count / total * 100) if total > 0 else 0
        
        print(f"\n  Total testé: {total}")
        print(f"  ✅ Alignement parfait: {self.success_count} ({success_rate:.1f}%)")
        print(f"  ❌ Problèmes détectés: {len(self.issues)} ({len(self.issues)/total*100:.1f}%)")
        
        if self.issues:
            print(f"\n  🔍 Détail des problèmes:")
            for issue in self.issues[:10]:  # Afficher max 10 problèmes
                print(f"    - ID {issue['row_id']}: {issue['error']}")
            
            if len(self.issues) > 10:
                print(f"    ... et {len(self.issues) - 10} autres problèmes")
        
        if success_rate == 100:
            print(f"\n  🎉 PARFAIT ! Alignement complet à 100% !")
            print(f"  ✅ DB ↔️ Sitemap ↔️ API ↔️ Routes sont synchronisés")
        elif success_rate >= 95:
            print(f"\n  ✅ Bon alignement ({success_rate:.1f}%)")
            print(f"  ⚠️ Quelques ajustements mineurs nécessaires")
        else:
            print(f"\n  ⚠️ ATTENTION: Taux d'alignement faible ({success_rate:.1f}%)")
            print(f"  🔧 Corrections nécessaires avant production")
    
    def test_sitemap_generation(self):
        """Teste que le sitemap génère les bonnes URLs"""
        print("\n" + "="*70)
        print("📄 TEST: Génération Sitemap")
        print("="*70 + "\n")
        
        try:
            # Récupérer la première page du sitemap
            url = f"{self.api_base}/api/sitemap/pieces-page-1.xml"
            print(f"🔗 Récupération: {url}")
            
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                print(f"❌ Erreur HTTP {response.status_code}")
                return
            
            # Parser le XML pour extraire les URLs
            urls = re.findall(r'<loc>https://automecanik\.com([^<]+)</loc>', response.text)
            
            if not urls:
                print("❌ Aucune URL trouvée dans le sitemap")
                return
            
            print(f"✅ {len(urls)} URLs trouvées dans le sitemap\n")
            
            # Vérifier le format des 5 premières URLs
            print("🔍 Vérification format (5 premières URLs):")
            for i, url in enumerate(urls[:5], 1):
                parsed = self.parse_url(url)
                if parsed:
                    print(f"  {i}. ✅ {url}")
                    print(f"      → pg={parsed['pg_alias']}, marque={parsed['marque_alias']}, type={parsed['type_alias']}")
                else:
                    print(f"  {i}. ❌ {url} (format invalide)")
            
            # Statistiques
            valid_format = sum(1 for url in urls if self.parse_url(url))
            print(f"\n📊 Format valide: {valid_format}/{len(urls)} ({valid_format/len(urls)*100:.1f}%)")
            
        except Exception as e:
            print(f"❌ Erreur: {str(e)}")


if __name__ == "__main__":
    print("🚀 Démarrage de la vérification d'alignement...\n")
    
    # Vérifier que l'API est accessible
    try:
        response = requests.get("http://localhost:3000/health", timeout=5)
        if response.status_code != 200:
            print("❌ API non accessible")
            sys.exit(1)
    except:
        print("❌ API non accessible (npm run dev)")
        sys.exit(1)
    
    try:
        checker = URLAlignmentChecker()
        
        # Vérifier l'alignement
        sample_size = int(sys.argv[1]) if len(sys.argv) > 1 else 20
        checker.verify_alignment(sample_size)
        
        # Tester le sitemap
        checker.test_sitemap_generation()
        
        print("\n✅ Vérification terminée!\n")
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrompu par l'utilisateur")
    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        sys.exit(1)
