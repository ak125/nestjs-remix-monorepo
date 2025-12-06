#!/usr/bin/env python3
"""
🔧 SEO CONTENT FIXER - Correction automatique des contenus SEO

Vérifie et corrige le contenu de toutes les tables SEO:
- __seo_gamme_car (templates principaux)
- __seo_gamme_car_switch (switches de gamme)
- __seo_item_switch (switches d'items)

Usage:
    python seo-content-fixer.py                    # Audit uniquement (dry-run)
    python seo-content-fixer.py --fix              # Appliquer les corrections
    python seo-content-fixer.py --pg-id 402        # Cibler une gamme
    python seo-content-fixer.py --report out.json  # Générer rapport JSON
    python seo-content-fixer.py --validate         # Tester via API après fix

Exemples:
    python seo-content-fixer.py --fix --validate   # Fix + test API
    python seo-content-fixer.py --pg-id 402 --fix  # Fix gamme 402 uniquement
"""

import argparse
import json
import sys
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Rich pour affichage console (optionnel mais recommandé)
try:
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich import print as rprint
    RICH_AVAILABLE = True
    console = Console()
except ImportError:
    RICH_AVAILABLE = False
    console = None

# Import des modules locaux
from lib.supabase_client import get_supabase_client
from lib.fix_rules import apply_fixes, detect_issues, get_stats_by_category, FIX_RULES

# ============================================
# CONFIGURATION
# ============================================

BACKUP_DIR = Path(__file__).parent / 'backups'
BACKEND_URL = "http://localhost:3000"

# ============================================
# TOUTES LES TABLES SEO + BLOG À AUDITER (15 tables)
# ============================================

TABLES_CONFIG = {
    # ========== TABLES SEO PRINCIPALES ==========
    '__seo_gamme_car': {
        'id_field': 'sgc_pg_id',
        'text_fields': ['sgc_h1', 'sgc_content', 'sgc_preview', 'sgc_descrip', 'sgc_title'],
        'description': '📄 Templates principaux (gamme+véhicule)',
        'priority': 1
    },
    '__seo_gamme': {
        'id_field': 'sg_pg_id',
        'text_fields': ['sg_h1', 'sg_content', 'sg_preview', 'sg_descrip', 'sg_title'],
        'description': '📄 SEO générique gamme (sans véhicule)',
        'priority': 1
    },
    '__seo_marque': {
        'id_field': 'sm_marque_id',
        'text_fields': ['sm_h1', 'sm_content', 'sm_preview', 'sm_descrip', 'sm_title'],
        'description': '📄 SEO par marque constructeur',
        'priority': 1
    },
    
    # ========== TABLES DE SWITCHES ==========
    '__seo_gamme_car_switch': {
        'id_field': 'sgcs_id',
        'pg_field': 'sgcs_pg_id',
        'text_fields': ['sgcs_content'],
        'description': '🔀 Switches gamme/véhicule',
        'priority': 2
    },
    '__seo_item_switch': {
        'id_field': 'sis_id',
        'pg_field': 'sis_pg_id',
        'text_fields': ['sis_content'],
        'description': '🔀 Switches d\'items',
        'priority': 2
    },
    '__seo_family_gamme_car_switch': {
        'id_field': 'sfgcs_id',
        'pg_field': 'sfgcs_pg_id',
        'text_fields': ['sfgcs_content'],
        'description': '🔀 Switches par famille',
        'priority': 2
    },
    '__seo_type_switch': {
        'id_field': 'sts_id',
        'text_fields': ['sts_content'],
        'description': '🔀 Switches par type',
        'priority': 2
    },
    
    # ========== TABLES SEO COMPLÉMENTAIRES ==========
    '__seo_gamme_car_conseil': {
        'id_field': 'sgcc_id',
        'pg_field': 'sgcc_pg_id',
        'text_fields': ['sgcc_content', 'sgcc_title'],
        'description': '💡 Conseils par gamme',
        'priority': 3
    },
    '__seo_gamme_car_info': {
        'id_field': 'sgci_id',
        'pg_field': 'sgci_pg_id',
        'text_fields': ['sgci_content'],
        'description': 'ℹ️ Infos additionnelles',
        'priority': 3
    },
    
    # ========== TABLES BLOG ==========
    '__blog_advice': {
        'id_field': 'ba_id',
        'text_fields': ['ba_title', 'ba_descrip', 'ba_h1', 'ba_h2', 'ba_preview', 'ba_content'],
        'description': '📰 Articles conseils blog (principal)',
        'priority': 4
    },
    '__blog_guide': {
        'id_field': 'bg_id',
        'text_fields': ['bg_title', 'bg_descrip', 'bg_h1', 'bg_h2', 'bg_preview', 'bg_content'],
        'description': '📖 Guides blog',
        'priority': 4
    },
    '__blog_advice_h2': {
        'id_field': 'ba2_id',
        'text_fields': ['ba2_h2', 'ba2_content'],
        'description': '📝 Sections H2 des articles blog',
        'priority': 5
    },
    '__blog_advice_h3': {
        'id_field': 'ba3_id',
        'text_fields': ['ba3_h3', 'ba3_content'],
        'description': '📝 Sections H3 des articles blog',
        'priority': 5
    },
}

# ============================================
# CLASSE PRINCIPALE
# ============================================

class SeoContentFixer:
    def __init__(self, fix_mode: bool = False, pg_id: Optional[int] = None, validate: bool = False):
        self.fix_mode = fix_mode
        self.pg_id = pg_id
        self.validate = validate
        self.supabase = get_supabase_client()
        
        # Statistiques
        self.stats = {
            'tables_processed': 0,
            'tables_found': 0,
            'tables_missing': [],
            'records_scanned': 0,
            'issues_found': 0,
            'issues_fixed': 0,
            'by_category': {},
            'by_table': {},
            'errors': [],
            'validation_results': []
        }
        
        # Backup des données originales
        self.backup_data = {}
    
    def log(self, msg: str, style: str = None):
        """Affiche un message (avec Rich si disponible)"""
        if RICH_AVAILABLE and style:
            console.print(msg, style=style)
        else:
            print(msg)
    
    def log_success(self, msg: str):
        self.log(f"✅ {msg}", "green")
    
    def log_warning(self, msg: str):
        self.log(f"⚠️  {msg}", "yellow")
    
    def log_error(self, msg: str):
        self.log(f"❌ {msg}", "red bold")
    
    def log_info(self, msg: str):
        self.log(f"ℹ️  {msg}", "blue")

    # ============================================
    # VÉRIFICATION DES TABLES
    # ============================================
    
    def check_table_exists(self, table_name: str) -> bool:
        """Vérifie si une table existe dans Supabase"""
        try:
            result = self.supabase.table(table_name).select('*').limit(1).execute()
            return True
        except Exception as e:
            if 'does not exist' in str(e) or '42P01' in str(e) or 'relation' in str(e).lower():
                return False
            # Autre erreur, on considère que la table existe
            return True

    # ============================================
    # BACKUP
    # ============================================
    
    def create_backup(self, table_name: str, data: List[Dict]) -> Path:
        """Sauvegarde les données originales en JSON"""
        BACKUP_DIR.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y-%m-%d_%Hh%M')
        filename = f"{timestamp}_{table_name}.json"
        filepath = BACKUP_DIR / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                'table': table_name,
                'timestamp': timestamp,
                'count': len(data),
                'data': data
            }, f, ensure_ascii=False, indent=2)
        
        self.log_info(f"Backup créé: {filepath.name} ({len(data)} enregistrements)")
        return filepath

    # ============================================
    # TRAITEMENT DES TABLES
    # ============================================
    
    def process_table(self, table_name: str) -> Dict[str, Any]:
        """Traite une table SEO complète"""
        config = TABLES_CONFIG[table_name]
        self.log(f"\n{'='*60}", "cyan")
        self.log(f"📋 {table_name} - {config['description']}", "cyan bold")
        self.log('='*60, "cyan")
        
        # Vérifier si la table existe
        if not self.check_table_exists(table_name):
            self.log_warning(f"Table non trouvée dans Supabase - ignorée")
            self.stats['tables_missing'].append(table_name)
            return {'scanned': 0, 'issues': 0, 'fixed': 0, 'exists': False}
        
        self.stats['tables_found'] += 1
        
        # Récupérer les données avec pagination (Supabase limite à 1000 par défaut)
        try:
            all_records = []
            page_size = 1000
            offset = 0
            
            while True:
                query = self.supabase.table(table_name).select('*').range(offset, offset + page_size - 1)
                
                # Filtrer par pg_id si spécifié
                if self.pg_id:
                    pg_field = config.get('pg_field', config['id_field'])
                    query = query.eq(pg_field, self.pg_id)
                
                result = query.execute()
                batch = result.data or []
                
                if not batch:
                    break
                    
                all_records.extend(batch)
                
                if len(batch) < page_size:
                    break
                    
                offset += page_size
                
            records = all_records
        except Exception as e:
            self.log_error(f"Erreur lecture: {str(e)}")
            self.stats['errors'].append(f"{table_name}: {str(e)}")
            return {'scanned': 0, 'issues': 0, 'fixed': 0, 'exists': True, 'error': str(e)}
        
        if not records:
            self.log_warning(f"Aucun enregistrement trouvé")
            return {'scanned': 0, 'issues': 0, 'fixed': 0, 'exists': True}
        
        self.log_info(f"📊 {len(records)} enregistrements à analyser")
        
        # Backup avant modification
        if self.fix_mode and records:
            self.create_backup(table_name, records)
        
        # Traitement
        table_stats = {'scanned': 0, 'issues': 0, 'fixed': 0, 'exists': True, 'details': []}
        id_field = config['id_field']
        text_fields = config['text_fields']
        
        for record in records:
            table_stats['scanned'] += 1
            record_id = record.get(id_field)
            record_issues = []
            updates = {}
            
            # Analyser chaque champ texte
            for field in text_fields:
                text = record.get(field)
                if not text:
                    continue
                
                # Détecter les problèmes
                issues = detect_issues(text, field)
                fixable_issues = [i for i in issues if i.get('can_fix')]
                
                if fixable_issues:
                    record_issues.extend(fixable_issues)
                    
                    # Appliquer corrections si mode fix
                    if self.fix_mode:
                        fixed_text, applied = apply_fixes(text)
                        if fixed_text != text:
                            updates[field] = fixed_text
            
            # Comptabiliser
            if record_issues:
                table_stats['issues'] += len(record_issues)
                table_stats['details'].append({
                    'id': record_id,
                    'issues': [i['desc'] for i in record_issues]
                })
                
                # Afficher les 10 premiers
                if len(table_stats['details']) <= 10:
                    self.log_warning(f"  ID {record_id}: {len(record_issues)} problème(s)")
                    for issue in record_issues[:3]:
                        print(f"      → {issue['desc']}")
            
            # Appliquer les updates
            if self.fix_mode and updates:
                try:
                    self.supabase.table(table_name).update(updates).eq(id_field, record_id).execute()
                    table_stats['fixed'] += len(updates)
                except Exception as e:
                    self.stats['errors'].append(f"{table_name} ID {record_id}: {str(e)}")
        
        # Résumé
        if table_stats['details'] and len(table_stats['details']) > 10:
            self.log(f"  ... et {len(table_stats['details']) - 10} autres enregistrements avec problèmes")
        
        self.log_info(f"📈 Résultat: {table_stats['issues']} problèmes trouvés, {table_stats['fixed']} corrigés")
        
        return table_stats

    # ============================================
    # VALIDATION API
    # ============================================
    
    def validate_api(self, sample_pg_ids: List[int] = None):
        """Teste le rendu API après corrections"""
        self.log(f"\n{'='*60}", "magenta")
        self.log("🧪 VALIDATION API", "magenta bold")
        self.log('='*60, "magenta")
        
        # Récupérer des pg_id à tester
        if not sample_pg_ids:
            result = self.supabase.table('__seo_gamme_car').select('sgc_pg_id').limit(10).execute()
            sample_pg_ids = [r['sgc_pg_id'] for r in (result.data or [])]
        
        if not sample_pg_ids:
            self.log_warning("Aucune gamme à tester")
            return
        
        self.log_info(f"Test de {len(sample_pg_ids)} gammes via API...")
        
        # Type_id par défaut (peut être paramétré)
        type_id = 27534
        errors = []
        success = 0
        
        for pg_id in sample_pg_ids:
            try:
                response = requests.post(
                    f"{BACKEND_URL}/api/catalog/gammes/{pg_id}/seo",
                    json={"type_id": type_id},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get('content', '')
                    
                    # Vérifier problèmes résiduels
                    issues = []
                    if ' .' in content:
                        issues.append('espace avant point')
                    if ',,' in content:
                        issues.append('double virgule')
                    if 'qui doit être' in content.lower():
                        issues.append('grammaire')
                    
                    if issues:
                        errors.append(f"pg={pg_id}: {', '.join(issues)}")
                        self.log_warning(f"  Gamme {pg_id}: {', '.join(issues)}")
                    else:
                        success += 1
                        self.log_success(f"  Gamme {pg_id}: OK")
                else:
                    errors.append(f"pg={pg_id}: HTTP {response.status_code}")
                    
            except requests.exceptions.RequestException as e:
                errors.append(f"pg={pg_id}: {str(e)}")
        
        self.stats['validation_results'] = {
            'tested': len(sample_pg_ids),
            'success': success,
            'errors': errors
        }
        
        self.log_info(f"📈 Validation: {success}/{len(sample_pg_ids)} gammes OK")
        if errors:
            self.log_error(f"   {len(errors)} gamme(s) avec problèmes résiduels")

    # ============================================
    # FLUSH CACHE REDIS
    # ============================================
    
    def flush_redis_cache(self):
        """Vide le cache Redis après corrections"""
        import subprocess
        try:
            result = subprocess.run(
                ['docker', 'exec', 'redis-dev', 'redis-cli', 'FLUSHDB'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                self.log_success("Cache Redis vidé")
            else:
                self.log_warning(f"Erreur flush Redis: {result.stderr}")
        except Exception as e:
            self.log_warning(f"Impossible de vider le cache Redis: {e}")

    # ============================================
    # EXÉCUTION PRINCIPALE
    # ============================================
    
    def run(self) -> Dict[str, Any]:
        """Exécute l'audit/correction complet"""
        start_time = datetime.now()
        
        self.log("\n" + "="*60, "bold")
        mode_str = "🔧 MODE CORRECTION" if self.fix_mode else "🔍 MODE AUDIT (dry-run)"
        self.log(f"  SEO CONTENT FIXER - {mode_str}", "bold")
        if self.pg_id:
            self.log(f"  📌 Ciblage: pg_id = {self.pg_id}", "bold")
        self.log(f"  📋 Tables configurées: {len(TABLES_CONFIG)}", "bold")
        self.log("="*60 + "\n", "bold")
        
        # Trier les tables par priorité
        sorted_tables = sorted(TABLES_CONFIG.items(), key=lambda x: x[1].get('priority', 99))
        
        # Traiter chaque table
        for table_name, config in sorted_tables:
            table_stats = self.process_table(table_name)
            self.stats['tables_processed'] += 1
            self.stats['records_scanned'] += table_stats['scanned']
            self.stats['issues_found'] += table_stats['issues']
            self.stats['issues_fixed'] += table_stats['fixed']
            self.stats['by_table'][table_name] = table_stats
        
        # Flush cache si corrections appliquées
        if self.fix_mode and self.stats['issues_fixed'] > 0:
            self.flush_redis_cache()
        
        # Validation API si demandée
        if self.validate:
            self.validate_api()
        
        # Durée
        duration = (datetime.now() - start_time).total_seconds()
        self.stats['duration_seconds'] = round(duration, 2)
        
        # Résumé final
        self.print_summary()
        
        return self.stats
    
    def print_summary(self):
        """Affiche le résumé final"""
        self.log("\n" + "="*60, "bold")
        self.log("  📊 RÉSUMÉ COMPLET", "bold")
        self.log("="*60, "bold")
        
        stats = self.stats
        
        if RICH_AVAILABLE:
            table = Table(show_header=True, header_style="bold cyan")
            table.add_column("Métrique", style="dim")
            table.add_column("Valeur", justify="right")
            
            table.add_row("Tables configurées", str(len(TABLES_CONFIG)))
            table.add_row("Tables trouvées", str(stats['tables_found']))
            table.add_row("Tables manquantes", str(len(stats['tables_missing'])))
            table.add_row("Enregistrements scannés", str(stats['records_scanned']))
            table.add_row("Problèmes trouvés", str(stats['issues_found']))
            table.add_row("Problèmes corrigés", str(stats['issues_fixed']))
            table.add_row("Durée", f"{stats['duration_seconds']}s")
            
            console.print(table)
            
            # Détails par table
            if stats['by_table']:
                self.log("\n📋 DÉTAILS PAR TABLE:", "bold")
                detail_table = Table(show_header=True, header_style="bold blue")
                detail_table.add_column("Table")
                detail_table.add_column("Scannés", justify="right")
                detail_table.add_column("Problèmes", justify="right")
                detail_table.add_column("Corrigés", justify="right")
                detail_table.add_column("Status")
                
                for tbl, tbl_stats in stats['by_table'].items():
                    status = "✅" if tbl_stats.get('exists', True) else "❌ Non trouvée"
                    if tbl_stats.get('error'):
                        status = "⚠️ Erreur"
                    detail_table.add_row(
                        tbl,
                        str(tbl_stats['scanned']),
                        str(tbl_stats['issues']),
                        str(tbl_stats['fixed']),
                        status
                    )
                console.print(detail_table)
        else:
            print(f"  Tables configurées:      {len(TABLES_CONFIG)}")
            print(f"  Tables trouvées:         {stats['tables_found']}")
            print(f"  Tables manquantes:       {len(stats['tables_missing'])}")
            print(f"  Enregistrements scannés: {stats['records_scanned']}")
            print(f"  Problèmes trouvés:       {stats['issues_found']}")
            print(f"  Problèmes corrigés:      {stats['issues_fixed']}")
            print(f"  Durée:                   {stats['duration_seconds']}s")
        
        if stats['tables_missing']:
            self.log(f"\n⚠️  Tables non trouvées: {', '.join(stats['tables_missing'])}", "yellow")
        
        if stats['errors']:
            self.log_error(f"\n❌ {len(stats['errors'])} erreur(s) lors du traitement")
            for err in stats['errors'][:5]:
                print(f"   • {err}")
        
        if not self.fix_mode and stats['issues_found'] > 0:
            self.log("\n💡 Pour appliquer les corrections: python seo-content-fixer.py --fix", "yellow")


def save_report(stats: Dict, filepath: Path):
    """Sauvegarde le rapport en JSON"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2, default=str)
    print(f"📄 Rapport sauvegardé: {filepath}")


# ============================================
# POINT D'ENTRÉE
# ============================================

def main():
    parser = argparse.ArgumentParser(
        description='🔧 SEO Content Fixer - Correction automatique de TOUTES les tables SEO + BLOG',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
📋 TABLES AUDITÉES (13 au total):

  🔵 TABLES SEO:
  • __seo_gamme_car           Templates principaux (gamme+véhicule)
  • __seo_gamme               SEO générique gamme
  • __seo_marque              SEO par marque constructeur
  • __seo_gamme_car_switch    Switches gamme/véhicule
  • __seo_item_switch         Switches d'items
  • __seo_family_gamme_car_switch  Switches par famille
  • __seo_type_switch         Switches par type
  • __seo_gamme_car_conseil   Conseils par gamme
  • __seo_gamme_car_info      Infos additionnelles

  🟢 TABLES BLOG:
  • __blog_advice             Articles conseils (85)
  • __blog_guide              Guides blog (1)
  • __blog_advice_h2          Sections H2 (451)
  • __blog_advice_h3          Sections H3 (200)

Exemples:
  python seo-content-fixer.py                    # Audit seul
  python seo-content-fixer.py --fix              # Appliquer corrections
  python seo-content-fixer.py --fix --validate   # Fix + test API
  python seo-content-fixer.py --pg-id 402 --fix  # Fix gamme 402
        """
    )
    
    parser.add_argument('--fix', action='store_true',
                        help='Appliquer les corrections (sinon audit seul)')
    parser.add_argument('--pg-id', type=int, metavar='ID',
                        help='Cibler une gamme spécifique par son pg_id')
    parser.add_argument('--validate', action='store_true',
                        help='Tester le rendu API après corrections')
    parser.add_argument('--report', type=str, metavar='FILE',
                        help='Sauvegarder le rapport en JSON')
    parser.add_argument('--rules', action='store_true',
                        help='Afficher les règles de correction')
    parser.add_argument('--tables', action='store_true',
                        help='Afficher la liste des tables auditées')
    
    args = parser.parse_args()
    
    # Afficher les tables si demandé
    if args.tables:
        print("\n📋 TABLES SEO AUDITÉES (9 tables)\n")
        for i, (name, config) in enumerate(TABLES_CONFIG.items(), 1):
            print(f"  {i:2}. {name:35} {config['description']}")
        print()
        return
    
    # Afficher les règles si demandé
    if args.rules:
        print("\n📏 RÈGLES DE CORRECTION\n")
        for i, rule in enumerate(FIX_RULES, 1):
            print(f"  {i:2}. [{rule['category']:12}] {rule['desc']}")
        print()
        return
    
    # Exécuter
    try:
        fixer = SeoContentFixer(
            fix_mode=args.fix,
            pg_id=args.pg_id,
            validate=args.validate
        )
        stats = fixer.run()
        
        # Sauvegarder rapport si demandé
        if args.report:
            save_report(stats, Path(args.report))
        
        # Code de sortie
        sys.exit(0 if stats['issues_fixed'] > 0 or stats['issues_found'] == 0 else 1)
        
    except Exception as e:
        print(f"❌ Erreur fatale: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()