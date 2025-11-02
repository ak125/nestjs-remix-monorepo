#!/usr/bin/env python3
"""
🔍 AUDIT COMPLET SEO - Module Sitemap & URLs
Analyse complète des tables sitemap, validation des URLs, et génération de rapports
"""

import os
import sys
from datetime import datetime
from collections import defaultdict
import json

# Vérifier si supabase est installé
try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Module supabase non installé")
    print("📦 Installation: pip install supabase")
    sys.exit(1)


class SEOAuditor:
    def __init__(self):
        """Initialisation de l'auditeur SEO"""
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.key:
            raise ValueError("❌ Variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises")
        
        self.supabase: Client = create_client(self.url, self.key)
        self.report = {
            "timestamp": datetime.now().isoformat(),
            "tables": {},
            "url_analysis": {},
            "issues": [],
            "recommendations": []
        }
    
    def audit_table_structure(self, table_name: str):
        """Audite la structure et le contenu d'une table"""
        print(f"\n📊 Audit de la table: {table_name}")
        
        try:
            # Compter le total de lignes
            result = self.supabase.table(table_name).select("*", count="exact").limit(1).execute()
            total_rows = result.count
            
            # Récupérer un échantillon
            sample = self.supabase.table(table_name).select("*").limit(10).execute()
            
            # Analyser les colonnes
            columns = []
            null_counts = {}
            
            if sample.data:
                columns = list(sample.data[0].keys())
                
                # Analyser les valeurs nulles
                for col in columns:
                    null_count = sum(1 for row in sample.data if row.get(col) is None or row.get(col) == '')
                    null_counts[col] = null_count
            
            table_info = {
                "total_rows": total_rows,
                "columns": columns,
                "sample_size": len(sample.data),
                "null_analysis": null_counts,
                "issues": []
            }
            
            # Détecter les problèmes
            if total_rows == 0:
                table_info["issues"].append("⚠️ Table vide")
            
            for col, null_count in null_counts.items():
                if null_count > len(sample.data) * 0.5:
                    table_info["issues"].append(f"⚠️ Colonne '{col}' avec {null_count}/{len(sample.data)} valeurs nulles")
            
            self.report["tables"][table_name] = table_info
            
            print(f"  ✅ Total: {total_rows:,} lignes")
            print(f"  📋 Colonnes: {', '.join(columns)}")
            
            if table_info["issues"]:
                for issue in table_info["issues"]:
                    print(f"  {issue}")
            
            return table_info
            
        except Exception as e:
            error_msg = f"❌ Erreur audit {table_name}: {str(e)}"
            print(error_msg)
            self.report["issues"].append(error_msg)
            return None
    
    def analyze_sitemap_p_link(self):
        """Analyse approfondie de __sitemap_p_link"""
        print("\n🔍 ANALYSE APPROFONDIE: __sitemap_p_link")
        
        try:
            # 1. Statistiques globales
            result = self.supabase.table("__sitemap_p_link").select("*", count="exact").limit(1).execute()
            total = result.count
            
            print(f"  📊 Total URLs: {total:,}")
            
            # 2. Analyse map_has_item (nombre de pièces disponibles)
            print("\n  📦 Analyse disponibilité des pièces...")
            sample = self.supabase.table("__sitemap_p_link").select("map_has_item").limit(1000).execute()
            
            has_items_count = sum(1 for row in sample.data if row.get("map_has_item") and int(row["map_has_item"]) > 0)
            zero_items_count = len(sample.data) - has_items_count
            
            print(f"    ✅ Avec pièces (map_has_item > 0): {has_items_count}/{len(sample.data)} ({has_items_count/len(sample.data)*100:.1f}%)")
            print(f"    ❌ Sans pièces (map_has_item = 0): {zero_items_count}/{len(sample.data)} ({zero_items_count/len(sample.data)*100:.1f}%)")
            
            # 3. Analyse des gammes uniques
            print("\n  🏷️ Analyse des gammes (pg_id)...")
            sample = self.supabase.table("__sitemap_p_link").select("map_pg_id, map_pg_alias").limit(5000).execute()
            
            unique_gammes = {}
            for row in sample.data:
                pg_id = row.get("map_pg_id")
                pg_alias = row.get("map_pg_alias")
                if pg_id:
                    unique_gammes[pg_id] = pg_alias
            
            print(f"    📦 Gammes uniques (échantillon 5000): {len(unique_gammes)}")
            print(f"    🔝 Top 5 gammes:")
            
            gamme_counts = defaultdict(int)
            for row in sample.data:
                pg_alias = row.get("map_pg_alias")
                if pg_alias:
                    gamme_counts[pg_alias] += 1
            
            for alias, count in sorted(gamme_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"       - {alias}: {count} URLs")
            
            # 4. Analyse des constructeurs
            print("\n  🚗 Analyse des constructeurs (marque_id)...")
            unique_marques = {}
            for row in sample.data:
                marque_id = row.get("map_marque_id")
                marque_alias = row.get("map_marque_alias")
                if marque_id:
                    unique_marques[marque_id] = marque_alias
            
            print(f"    🏭 Constructeurs uniques (échantillon): {len(unique_marques)}")
            
            # 5. Validation du format URL
            print("\n  🔗 Validation format URL...")
            sample = self.supabase.table("__sitemap_p_link").select("*").limit(100).execute()
            
            valid_urls = 0
            invalid_urls = []
            
            for row in sample.data:
                # Vérifier que tous les champs nécessaires sont présents
                required = ["map_pg_alias", "map_pg_id", "map_marque_alias", "map_marque_id", 
                           "map_modele_alias", "map_modele_id", "map_type_alias", "map_type_id"]
                
                if all(row.get(field) for field in required):
                    valid_urls += 1
                else:
                    missing = [f for f in required if not row.get(f)]
                    invalid_urls.append({
                        "map_id": row.get("map_id"),
                        "missing_fields": missing
                    })
            
            print(f"    ✅ URLs valides: {valid_urls}/{len(sample.data)} ({valid_urls/len(sample.data)*100:.1f}%)")
            
            if invalid_urls:
                print(f"    ⚠️ URLs invalides: {len(invalid_urls)}")
                for inv in invalid_urls[:3]:
                    print(f"       - ID {inv['map_id']}: champs manquants = {', '.join(inv['missing_fields'])}")
            
            # Stocker les résultats
            self.report["url_analysis"]["__sitemap_p_link"] = {
                "total": total,
                "sample_size": len(sample.data),
                "with_items_percent": has_items_count/len(sample.data)*100,
                "unique_gammes": len(unique_gammes),
                "unique_marques": len(unique_marques),
                "valid_url_percent": valid_urls/len(sample.data)*100,
                "invalid_urls_count": len(invalid_urls)
            }
            
        except Exception as e:
            error_msg = f"❌ Erreur analyse __sitemap_p_link: {str(e)}"
            print(error_msg)
            self.report["issues"].append(error_msg)
    
    def analyze_sitemap_p_xml(self):
        """Analyse de __sitemap_p_xml"""
        print("\n🔍 ANALYSE: __sitemap_p_xml")
        
        try:
            result = self.supabase.table("__sitemap_p_xml").select("*").execute()
            
            print(f"  📊 Total fichiers XML: {len(result.data)}")
            
            # Analyser les fichiers
            if result.data:
                print(f"  📄 Échantillon de fichiers:")
                for row in result.data[:5]:
                    print(f"    - {row.get('map_file')} (pg_id={row.get('map_pg_id')}, marque_id={row.get('map_marque_id')}, {row.get('map_has_link')} liens)")
            
            self.report["url_analysis"]["__sitemap_p_xml"] = {
                "total_files": len(result.data),
                "sample": result.data[:5]
            }
            
        except Exception as e:
            error_msg = f"❌ Erreur analyse __sitemap_p_xml: {str(e)}"
            print(error_msg)
            self.report["issues"].append(error_msg)
    
    def analyze_motorisation(self):
        """Analyse de __sitemap_motorisation"""
        print("\n🔍 ANALYSE: __sitemap_motorisation")
        
        try:
            result = self.supabase.table("__sitemap_motorisation").select("*", count="exact").limit(100).execute()
            
            print(f"  📊 Total motorisations: {result.count:,}")
            
            # Analyser la structure des URLs type
            if result.data:
                print(f"  🔗 Format URL type: /constructeurs/{result.data[0]['map_marque_alias']}-{result.data[0]['map_marque_id']}/{result.data[0]['map_modele_alias']}-{result.data[0]['map_modele_id']}/{result.data[0]['map_type_alias']}-{result.data[0]['map_type_id']}.html")
            
            self.report["url_analysis"]["__sitemap_motorisation"] = {
                "total": result.count,
                "sample": result.data[:3]
            }
            
        except Exception as e:
            error_msg = f"❌ Erreur analyse __sitemap_motorisation: {str(e)}"
            print(error_msg)
            self.report["issues"].append(error_msg)
    
    def generate_recommendations(self):
        """Génère des recommandations basées sur l'audit"""
        print("\n💡 RECOMMANDATIONS:")
        
        # Analyser __sitemap_p_link
        p_link = self.report["url_analysis"].get("__sitemap_p_link", {})
        
        if p_link.get("with_items_percent", 100) < 50:
            rec = "⚠️ Moins de 50% des URLs ont des pièces disponibles (map_has_item > 0) - Filtrer avant mise en sitemap"
            self.report["recommendations"].append(rec)
            print(f"  {rec}")
        
        if p_link.get("valid_url_percent", 100) < 95:
            rec = f"⚠️ {100 - p_link.get('valid_url_percent', 100):.1f}% des URLs ont des champs manquants - Nettoyer les données"
            self.report["recommendations"].append(rec)
            print(f"  {rec}")
        
        # Recommandation générale
        rec = "✅ Utiliser __sitemap_p_link pour génération des sitemaps (714k URLs)"
        self.report["recommendations"].append(rec)
        print(f"  {rec}")
        
        rec = "✅ Paginer les sitemaps à 1000 URLs/page max (limite Supabase)"
        self.report["recommendations"].append(rec)
        print(f"  {rec}")
        
        rec = "✅ Filtrer sur map_has_item > 0 pour exclure les URLs sans pièces"
        self.report["recommendations"].append(rec)
        print(f"  {rec}")
    
    def save_report(self, filename="seo-audit-report.json"):
        """Sauvegarde le rapport en JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.report, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Rapport sauvegardé: {filename}")
    
    def run_full_audit(self):
        """Exécute l'audit complet"""
        print("="*60)
        print("🔍 AUDIT COMPLET SEO - Module Sitemap")
        print("="*60)
        print(f"📅 Date: {self.report['timestamp']}")
        
        # Auditer toutes les tables sitemap
        tables = [
            "__sitemap_blog",
            "__sitemap_gamme",
            "__sitemap_marque",
            "__sitemap_motorisation",
            "__sitemap_p_link",
            "__sitemap_p_xml",
            "__sitemap_search_link"
        ]
        
        for table in tables:
            self.audit_table_structure(table)
        
        # Analyses approfondies
        self.analyze_sitemap_p_link()
        self.analyze_sitemap_p_xml()
        self.analyze_motorisation()
        
        # Générer recommandations
        self.generate_recommendations()
        
        # Résumé final
        print("\n" + "="*60)
        print("📊 RÉSUMÉ DE L'AUDIT")
        print("="*60)
        print(f"  Tables auditées: {len(self.report['tables'])}")
        print(f"  Problèmes détectés: {len(self.report['issues'])}")
        print(f"  Recommandations: {len(self.report['recommendations'])}")
        
        # Sauvegarder
        self.save_report()
        
        print("\n✅ Audit terminé avec succès!")
        return self.report


if __name__ == "__main__":
    try:
        auditor = SEOAuditor()
        report = auditor.run_full_audit()
        
        # Afficher un résumé compact
        print("\n" + "="*60)
        print("📈 STATISTIQUES CLÉS")
        print("="*60)
        
        if "__sitemap_p_link" in report["tables"]:
            p_link = report["tables"]["__sitemap_p_link"]
            print(f"  🔗 URLs pièces: {p_link['total_rows']:,}")
        
        if "__sitemap_motorisation" in report["tables"]:
            moto = report["tables"]["__sitemap_motorisation"]
            print(f"  🚗 Motorisations: {moto['total_rows']:,}")
        
        if "__sitemap_blog" in report["tables"]:
            blog = report["tables"]["__sitemap_blog"]
            print(f"  📝 Articles blog: {blog['total_rows']:,}")
        
        total_urls = sum(
            report["tables"][t]["total_rows"]
            for t in report["tables"]
            if "total_rows" in report["tables"][t]
        )
        print(f"\n  📊 TOTAL URLs: {total_urls:,}")
        
    except Exception as e:
        print(f"\n❌ ERREUR CRITIQUE: {str(e)}")
        sys.exit(1)
