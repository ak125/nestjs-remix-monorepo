#!/usr/bin/env python3
"""
📊 META AUDIT - Vérification des meta title et description SEO

Règles SEO optimales:
- Title: 30-60 caractères (idéal), max 70 (Google tronque à ~60)
- Description: 70-155 caractères (idéal), max 160 (Google tronque à ~155)
- Pas d'entités HTML (&eacute; etc.)
- Pas d'espaces multiples ou de ponctuation incorrecte

Usage:
    python meta-audit.py                    # Audit complet
    python meta-audit.py --fix              # Corriger entités HTML
    python meta-audit.py --details          # Afficher détails
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import re

try:
    from rich.console import Console
    from rich.table import Table
    from rich import print as rprint
    RICH_AVAILABLE = True
    console = Console()
except ImportError:
    RICH_AVAILABLE = False
    console = None

from lib.supabase_client import get_supabase_client
from lib.fix_rules import apply_fixes, shorten_meta_title, shorten_meta_descrip, preview_shortening, SEO_LIMITS

# ============================================
# CONFIGURATION
# ============================================

# Limites SEO Google
SEO_LIMITS = {
    'title': {'min': 30, 'max': 60, 'hard_max': 70},
    'descrip': {'min': 70, 'max': 155, 'hard_max': 160}
}

# Tables et colonnes à auditer
META_TABLES = {
    '__seo_gamme_car': {
        'id_field': 'sgc_pg_id',
        'fields': {
            'title': 'sgc_title',
            'descrip': 'sgc_descrip',
            'h1': 'sgc_h1'
        },
        'description': 'SEO Gamme + Véhicule'
    },
    '__seo_gamme': {
        'id_field': 'sg_pg_id',
        'fields': {
            'title': 'sg_title',
            'descrip': 'sg_descrip',
            'h1': 'sg_h1'
        },
        'description': 'SEO Gamme générique'
    },
    '__seo_marque': {
        'id_field': 'sm_marque_id',
        'fields': {
            'title': 'sm_title',
            'descrip': 'sm_descrip',
            'h1': 'sm_h1'
        },
        'description': 'SEO Marque'
    },
    '__blog_advice': {
        'id_field': 'ba_id',
        'pg_id_field': 'ba_pg_id',  # Lien vers pieces_gamme pour affichage clair
        'fields': {
            'title': 'ba_title',
            'descrip': 'ba_descrip',
            'h1': 'ba_h1'
        },
        'description': 'Articles Blog'
    },
    '__blog_guide': {
        'id_field': 'bg_id',
        # Note: pas de bg_pg_id dans cette table
        'fields': {
            'title': 'bg_title',
            'descrip': 'bg_descrip',
            'h1': 'bg_h1'
        },
        'description': 'Guides Blog'
    }
}

# ============================================
# FONCTIONS DE VÉRIFICATION
# ============================================

def check_length(value: str, field_type: str) -> Dict[str, Any]:
    """Vérifie la longueur d'un champ meta"""
    if not value:
        return {'status': 'empty', 'length': 0, 'message': 'VIDE'}
    
    length = len(value)
    limits = SEO_LIMITS.get(field_type, {'min': 0, 'max': 100, 'hard_max': 200})
    
    if length < limits['min']:
        return {
            'status': 'too_short',
            'length': length,
            'message': f'Trop court ({length} < {limits["min"]})'
        }
    elif length > limits['hard_max']:
        return {
            'status': 'too_long',
            'length': length,
            'message': f'⚠️ TROP LONG ({length} > {limits["hard_max"]})'
        }
    elif length > limits['max']:
        return {
            'status': 'warning',
            'length': length,
            'message': f'Peut être tronqué ({length} > {limits["max"]})'
        }
    else:
        return {
            'status': 'ok',
            'length': length,
            'message': 'OK'
        }

def check_entities(value: str) -> List[str]:
    """Détecte les entités HTML non décodées"""
    if not value:
        return []
    
    patterns = [
        (r'&eacute;', 'é'),
        (r'&egrave;', 'è'),
        (r'&agrave;', 'à'),
        (r'&ccedil;', 'ç'),
        (r'&nbsp;', ' '),
        (r'&#39;', "'"),
        (r'&amp;', '&'),
        (r'&quot;', '"'),
        (r'&lt;', '<'),
        (r'&gt;', '>'),
    ]
    
    found = []
    for pattern, replacement in patterns:
        if re.search(pattern, value):
            found.append(f'{pattern} → {replacement}')
    
    return found

def check_quality(value: str) -> List[str]:
    """Vérifie la qualité du contenu"""
    if not value:
        return []
    
    issues = []
    
    # Espaces multiples
    if re.search(r'\s{2,}', value):
        issues.append('Espaces multiples')
    
    # Espace avant ponctuation
    if re.search(r'\s+[.,;:!?]', value):
        issues.append('Espace avant ponctuation')
    
    # Commence/termine par espace
    if value != value.strip():
        issues.append('Espaces en début/fin')
    
    # Double ponctuation
    if re.search(r'[.,;:!?]{2,}', value):
        issues.append('Double ponctuation')
    
    # Majuscules excessives (> 50% du texte)
    if len(value) > 10:
        upper_ratio = sum(1 for c in value if c.isupper()) / len(value)
        if upper_ratio > 0.5:
            issues.append('Trop de majuscules')
    
    return issues

# ============================================
# CLASSE PRINCIPALE
# ============================================

class MetaAuditor:
    def __init__(self, fix_mode: bool = False, show_details: bool = False):
        self.fix_mode = fix_mode
        self.show_details = show_details
        self.supabase = get_supabase_client()
        
        self.stats = {
            'tables_processed': 0,
            'records_scanned': 0,
            'by_table': {},
            'issues': {
                'empty': 0,
                'too_short': 0,
                'too_long': 0,
                'warning': 0,
                'entities': 0,
                'quality': 0
            },
            'fixed': 0
        }
    
    def log(self, msg: str, style: str = None):
        if RICH_AVAILABLE and style:
            console.print(msg, style=style)
        else:
            print(msg)

    def audit_table(self, table_name: str) -> Dict[str, Any]:
        """Audite une table pour les meta title/description"""
        config = META_TABLES[table_name]
        
        self.log(f"\n{'='*60}", "cyan")
        self.log(f"📋 {table_name} - {config['description']}", "cyan bold")
        self.log('='*60, "cyan")
        
        # Charger les données - inclure pg_id_field si présent
        fields_to_select = [config['id_field']] + list(config['fields'].values())
        pg_id_field = config.get('pg_id_field')  # Pour les tables blog, lien vers gamme
        if pg_id_field:
            fields_to_select.append(pg_id_field)
        
        try:
            result = self.supabase.table(table_name).select(','.join(fields_to_select)).execute()
            records = result.data or []
        except Exception as e:
            self.log(f"❌ Erreur: {e}", "red")
            return {'error': str(e)}
        
        if not records:
            self.log("⚠️ Aucun enregistrement", "yellow")
            return {'scanned': 0, 'issues': []}
        
        self.log(f"ℹ️ {len(records)} enregistrements à analyser", "blue")
        
        table_issues = []
        updates_to_apply = []
        
        for record in records:
            record_id = record.get(config['id_field'])
            record_issues = []
            updates = {}
            
            # Vérifier title
            title_field = config['fields'].get('title')
            if title_field:
                title_value = record.get(title_field, '')
                
                # Longueur
                length_check = check_length(title_value, 'title')
                if length_check['status'] in ['empty', 'too_short', 'too_long']:
                    record_issues.append({
                        'field': 'title',
                        'type': length_check['status'],
                        'message': length_check['message'],
                        'length': length_check['length']
                    })
                
                # Entités HTML
                entities = check_entities(title_value)
                if entities:
                    record_issues.append({
                        'field': 'title',
                        'type': 'entities',
                        'message': f"Entités HTML: {', '.join(entities)}"
                    })
                    if self.fix_mode:
                        fixed, _ = apply_fixes(title_value)
                        if fixed != title_value:
                            updates[title_field] = fixed
                
                # Qualité
                quality_issues = check_quality(title_value)
                if quality_issues:
                    record_issues.append({
                        'field': 'title',
                        'type': 'quality',
                        'message': ', '.join(quality_issues)
                    })
                    if self.fix_mode:
                        fixed, _ = apply_fixes(title_value)
                        if fixed != title_value:
                            updates[title_field] = fixed
            
            # Vérifier description
            descrip_field = config['fields'].get('descrip')
            if descrip_field:
                descrip_value = record.get(descrip_field, '')
                
                # Longueur
                length_check = check_length(descrip_value, 'descrip')
                if length_check['status'] in ['empty', 'too_short', 'too_long']:
                    record_issues.append({
                        'field': 'descrip',
                        'type': length_check['status'],
                        'message': length_check['message'],
                        'length': length_check['length']
                    })
                
                # Entités HTML
                entities = check_entities(descrip_value)
                if entities:
                    record_issues.append({
                        'field': 'descrip',
                        'type': 'entities',
                        'message': f"Entités HTML: {', '.join(entities)}"
                    })
                    if self.fix_mode:
                        fixed, _ = apply_fixes(descrip_value)
                        if fixed != descrip_value:
                            updates[descrip_field] = fixed
                
                # Qualité
                quality_issues = check_quality(descrip_value)
                if quality_issues:
                    record_issues.append({
                        'field': 'descrip',
                        'type': 'quality',
                        'message': ', '.join(quality_issues)
                    })
                    if self.fix_mode:
                        fixed, _ = apply_fixes(descrip_value)
                        if fixed != descrip_value:
                            updates[descrip_field] = fixed
            
            # Stocker les issues
            if record_issues:
                # Pour les tables blog, inclure pg_id pour clarté (ex: pg_id 82 = ID dans URL)
                issue_data = {
                    'id': record_id,
                    'issues': record_issues
                }
                if pg_id_field and record.get(pg_id_field):
                    issue_data['pg_id'] = record.get(pg_id_field)
                
                table_issues.append(issue_data)
                
                # Afficher les détails (premiers 5)
                if self.show_details and len(table_issues) <= 5:
                    # Afficher pg_id si disponible (plus clair pour les URLs)
                    if pg_id_field and record.get(pg_id_field):
                        pg_id = record.get(pg_id_field)
                        self.log(f"  pg_id {pg_id} (ba_id {record_id}):", "yellow")
                    else:
                        self.log(f"  ID {record_id}:", "yellow")
                    for issue in record_issues:
                        self.log(f"    - [{issue['field']}] {issue['message']}", "dim")
            
            # Appliquer les corrections
            if self.fix_mode and updates:
                try:
                    self.supabase.table(table_name).update(updates).eq(
                        config['id_field'], record_id
                    ).execute()
                    self.stats['fixed'] += len(updates)
                except Exception as e:
                    self.log(f"  ❌ Erreur update ID {record_id}: {e}", "red")
        
        # Résumé par type
        issue_counts = {}
        for item in table_issues:
            for issue in item['issues']:
                issue_type = issue['type']
                issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1
        
        # Afficher résumé
        if table_issues:
            self.log(f"\n📊 Résumé {table_name}:", "bold")
            for issue_type, count in sorted(issue_counts.items()):
                self.log(f"  - {issue_type}: {count}", "yellow")
        else:
            self.log("✅ Aucun problème détecté", "green")
        
        return {
            'scanned': len(records),
            'issues_count': len(table_issues),
            'by_type': issue_counts,
            'issues': table_issues if self.show_details else []
        }

    def run(self) -> Dict[str, Any]:
        """Exécute l'audit complet"""
        start_time = datetime.now()
        
        self.log("\n" + "="*60, "bold")
        mode_str = "🔧 MODE CORRECTION" if self.fix_mode else "🔍 MODE AUDIT"
        self.log(f"  META AUDIT - {mode_str}", "bold")
        self.log("="*60, "bold")
        
        total_issues = 0
        
        for table_name in META_TABLES:
            result = self.audit_table(table_name)
            self.stats['tables_processed'] += 1
            self.stats['records_scanned'] += result.get('scanned', 0)
            self.stats['by_table'][table_name] = result
            
            # Compter les issues
            by_type = result.get('by_type', {})
            for issue_type, count in by_type.items():
                self.stats['issues'][issue_type] = self.stats['issues'].get(issue_type, 0) + count
                total_issues += count
        
        duration = (datetime.now() - start_time).total_seconds()
        self.stats['duration'] = round(duration, 2)
        self.stats['total_issues'] = total_issues
        
        # Afficher résumé final
        self.print_summary()
        
        return self.stats

    def print_summary(self):
        """Affiche le résumé final"""
        self.log("\n" + "="*60, "bold")
        self.log("  📊 RÉSUMÉ AUDIT META", "bold")
        self.log("="*60, "bold")
        
        if RICH_AVAILABLE:
            # Tableau des issues par type
            table = Table(show_header=True, header_style="bold cyan")
            table.add_column("Type de problème", style="dim")
            table.add_column("Nombre", justify="right")
            table.add_column("Impact SEO")
            
            impact_map = {
                'empty': ('🔴', 'Critique'),
                'too_long': ('🟠', 'Élevé - sera tronqué'),
                'too_short': ('🟡', 'Moyen - peu informatif'),
                'warning': ('🟡', 'Moyen - peut être tronqué'),
                'entities': ('🟠', 'Élevé - affichage incorrect'),
                'quality': ('🟡', 'Moyen - qualité')
            }
            
            for issue_type, count in sorted(self.stats['issues'].items()):
                if count > 0:
                    icon, desc = impact_map.get(issue_type, ('⚪', 'Inconnu'))
                    table.add_row(issue_type, str(count), f"{icon} {desc}")
            
            console.print(table)
            
            # Tableau par table
            self.log("\n📋 Par table:", "bold")
            table2 = Table(show_header=True, header_style="bold blue")
            table2.add_column("Table")
            table2.add_column("Scannés", justify="right")
            table2.add_column("Problèmes", justify="right")
            table2.add_column("Status")
            
            for table_name, result in self.stats['by_table'].items():
                scanned = result.get('scanned', 0)
                issues = result.get('issues_count', 0)
                status = "✅" if issues == 0 else f"⚠️ {issues}"
                table2.add_row(table_name, str(scanned), str(issues), status)
            
            console.print(table2)
        else:
            print(f"\nProblèmes détectés:")
            for issue_type, count in self.stats['issues'].items():
                if count > 0:
                    print(f"  - {issue_type}: {count}")
        
        self.log(f"\n📈 Total: {self.stats['total_issues']} problèmes sur {self.stats['records_scanned']} enregistrements", "bold")
        
        if self.fix_mode:
            self.log(f"✅ Corrections appliquées: {self.stats['fixed']}", "green")
        
        self.log(f"⏱️ Durée: {self.stats['duration']}s", "dim")
        
        # Recommandations
        if self.stats['total_issues'] > 0:
            self.log("\n💡 RECOMMANDATIONS:", "yellow bold")
            
            if self.stats['issues'].get('too_long', 0) > 0:
                self.log("  • Raccourcir les titles > 60 car et descriptions > 155 car", "yellow")
            
            if self.stats['issues'].get('entities', 0) > 0:
                self.log("  • Lancer: python meta-audit.py --fix  (corrige entités HTML)", "yellow")
            
            if self.stats['issues'].get('too_short', 0) > 0:
                self.log("  • Enrichir les descriptions trop courtes (< 70 car)", "yellow")


# ============================================
# POINT D'ENTRÉE
# ============================================

def main():
    parser = argparse.ArgumentParser(
        description='📊 Audit des meta title et description SEO',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
📏 LIMITES SEO RECOMMANDÉES:
  • Title:       30-60 caractères (max 70, Google tronque à ~60)
  • Description: 70-155 caractères (max 160, Google tronque à ~155)

Exemples:
  python meta-audit.py                    # Audit simple
  python meta-audit.py --details          # Avec détails des erreurs
  python meta-audit.py --fix              # Corriger entités HTML
  python meta-audit.py --report too_long  # Rapport détaillé meta trop longs
  python meta-audit.py --shorten          # Prévisualiser raccourcissements
  python meta-audit.py --shorten --apply  # Appliquer raccourcissements
        """
    )
    
    parser.add_argument('--fix', action='store_true',
                        help='Corriger les entités HTML et problèmes de qualité')
    parser.add_argument('--details', action='store_true',
                        help='Afficher les détails des problèmes')
    parser.add_argument('--report', type=str, choices=['too_long', 'all'],
                        help='Générer rapport détaillé (too_long = meta trop longs)')
    parser.add_argument('--shorten', action='store_true',
                        help='Raccourcir automatiquement les meta trop longs')
    parser.add_argument('--apply', action='store_true',
                        help='Appliquer les raccourcissements (sinon preview)')
    
    args = parser.parse_args()
    
    # Mode raccourcissement
    if args.shorten:
        shorten_meta_too_long(apply_changes=args.apply)
        return 0
    
    # Mode rapport spécial
    if args.report:
        generate_report(args.report)
        return 0
    
    auditor = MetaAuditor(
        fix_mode=args.fix,
        show_details=args.details
    )
    
    stats = auditor.run()
    
    return 0 if stats['total_issues'] == 0 else 1


def generate_report(report_type: str):
    """Génère un rapport détaillé avec pg_id pour clarté"""
    supabase = get_supabase_client()
    
    print("\n" + "="*70)
    print(f"📋 RAPPORT META - {report_type.upper()}")
    print("="*70)
    
    if report_type == 'too_long':
        # Rapport articles avec meta trop longs
        print("\n🔴 ARTICLES BLOG AVEC META TROP LONGS")
        print("-"*70)
        print("(Limite: Title ≤ 70 car, Description ≤ 160 car)\n")
        
        # Récupérer tous les articles blog
        result = supabase.table('__blog_advice').select(
            'ba_id, ba_pg_id, ba_title, ba_descrip'
        ).execute()
        
        articles = result.data or []
        
        # Filtrer ceux avec meta trop longs
        too_long = []
        for art in articles:
            title_len = len(art.get('ba_title', '') or '')
            desc_len = len(art.get('ba_descrip', '') or '')
            
            if title_len > 70 or desc_len > 160:
                too_long.append({
                    'pg_id': art.get('ba_pg_id', 'N/A'),
                    'ba_id': art.get('ba_id'),
                    'title': art.get('ba_title', '')[:50] + '...' if art.get('ba_title') else '',
                    'title_len': title_len,
                    'desc_len': desc_len,
                    'title_excess': max(0, title_len - 70),
                    'desc_excess': max(0, desc_len - 160)
                })
        
        # Trier par excès total
        too_long.sort(key=lambda x: x['title_excess'] + x['desc_excess'], reverse=True)
        
        # Afficher
        for item in too_long:
            print(f"pg_id {str(item['pg_id']):>4}  (ba_id {item['ba_id']:>3})")
            print(f"  Title: {item['title_len']} car", end='')
            if item['title_excess'] > 0:
                print(f" ⚠️ +{item['title_excess']} à supprimer", end='')
            print()
            print(f"  Desc:  {item['desc_len']} car", end='')
            if item['desc_excess'] > 0:
                print(f" ⚠️ +{item['desc_excess']} à supprimer", end='')
            print()
            print(f"  → {item['title']}")
            print()
        
        print(f"\n📊 TOTAL: {len(too_long)} articles avec meta trop longs")
        
        # Résumé par type
        titles_long = sum(1 for x in too_long if x['title_excess'] > 0)
        descs_long = sum(1 for x in too_long if x['desc_excess'] > 0)
        print(f"   - Titles trop longs: {titles_long}")
        print(f"   - Descriptions trop longues: {descs_long}")


def shorten_meta_too_long(apply_changes: bool = False):
    """
    Raccourcit automatiquement les meta title et description trop longs.
    
    Args:
        apply_changes: Si True, applique les changements. Sinon, preview seulement.
    """
    supabase = get_supabase_client()
    
    mode = "🔧 APPLICATION" if apply_changes else "👁️ PREVIEW"
    
    print("\n" + "="*70)
    print(f"✂️ RACCOURCISSEMENT META - {mode}")
    print("="*70)
    print("\nRègles appliquées par priorité pour éviter les doublons:")
    print("  1. Suppression fins génériques (\"pour le bon fonctionnement...\")")
    print("  2. Simplification \"pour le bon fonctionnement de X\" → \"pour X\"")
    print("  3. Possessifs → articles (\"votre\" → \"le\")")
    print("  4. Prix filler (\"à un prix pas cher\" → \"pas cher\")")
    print("  5. Conditions simplifiées (\"s'il est usé\" → \"si usé\")")
    print("  6. Redondances véhicule")
    print("-"*70)
    
    # Stats
    stats = {
        'titles_processed': 0,
        'titles_shortened': 0,
        'titles_need_review': 0,
        'descrips_processed': 0,
        'descrips_shortened': 0,
        'descrips_need_review': 0,
        'total_chars_saved': 0
    }
    
    # ========================================
    # 1. BLOG ADVICE
    # ========================================
    print("\n📚 TABLE: __blog_advice")
    print("-"*50)
    
    result = supabase.table('__blog_advice').select(
        'ba_id, ba_pg_id, ba_title, ba_descrip'
    ).execute()
    
    articles = result.data or []
    
    for art in articles:
        ba_id = art.get('ba_id')
        pg_id = art.get('ba_pg_id', 'N/A')
        title = art.get('ba_title', '') or ''
        descrip = art.get('ba_descrip', '') or ''
        
        updates = {}
        
        # Raccourcir le title si > 60
        if len(title) > 60:
            stats['titles_processed'] += 1
            shortened, rules, success = shorten_meta_title(title)
            
            if rules:  # Des règles ont été appliquées
                chars_saved = len(title) - len(shortened)
                stats['total_chars_saved'] += chars_saved
                
                print(f"\npg_id {pg_id} (ba_id {ba_id}) - TITLE")
                print(f"  AVANT ({len(title)} car): {title[:70]}{'...' if len(title) > 70 else ''}")
                print(f"  APRÈS ({len(shortened)} car): {shortened[:70]}{'...' if len(shortened) > 70 else ''}")
                print(f"  Règles: {', '.join(rules)}")
                
                if success:
                    stats['titles_shortened'] += 1
                    updates['ba_title'] = shortened
                    print(f"  ✅ Raccourci de {chars_saved} caractères")
                else:
                    stats['titles_need_review'] += 1
                    print(f"  ⚠️ Nécessite révision manuelle (encore {len(shortened)} car)")
        
        # Raccourcir la description si > 155
        if len(descrip) > 155:
            stats['descrips_processed'] += 1
            shortened, rules, success = shorten_meta_descrip(descrip)
            
            if rules:
                chars_saved = len(descrip) - len(shortened)
                stats['total_chars_saved'] += chars_saved
                
                print(f"\npg_id {pg_id} (ba_id {ba_id}) - DESCRIPTION")
                print(f"  AVANT ({len(descrip)} car): {descrip[:80]}...")
                print(f"  APRÈS ({len(shortened)} car): {shortened[:80]}...")
                print(f"  Règles: {', '.join(rules)}")
                
                if success:
                    stats['descrips_shortened'] += 1
                    updates['ba_descrip'] = shortened
                    print(f"  ✅ Raccourci de {chars_saved} caractères")
                else:
                    stats['descrips_need_review'] += 1
                    print(f"  ⚠️ Nécessite révision manuelle (encore {len(shortened)} car)")
        
        # Appliquer si mode apply
        if apply_changes and updates:
            try:
                supabase.table('__blog_advice').update(updates).eq('ba_id', ba_id).execute()
                print(f"  💾 Sauvegardé!")
            except Exception as e:
                print(f"  ❌ Erreur: {e}")
    
    # ========================================
    # 2. BLOG GUIDE
    # ========================================
    print("\n\n📚 TABLE: __blog_guide")
    print("-"*50)
    
    result = supabase.table('__blog_guide').select(
        'bg_id, bg_title, bg_descrip'
    ).execute()
    
    guides = result.data or []
    
    for guide in guides:
        bg_id = guide.get('bg_id')
        title = guide.get('bg_title', '') or ''
        descrip = guide.get('bg_descrip', '') or ''
        
        updates = {}
        
        # Raccourcir le title si > 60
        if len(title) > 60:
            stats['titles_processed'] += 1
            shortened, rules, success = shorten_meta_title(title)
            
            if rules:
                chars_saved = len(title) - len(shortened)
                stats['total_chars_saved'] += chars_saved
                
                print(f"\nbg_id {bg_id} - TITLE")
                print(f"  AVANT ({len(title)} car): {title[:70]}{'...' if len(title) > 70 else ''}")
                print(f"  APRÈS ({len(shortened)} car): {shortened[:70]}{'...' if len(shortened) > 70 else ''}")
                print(f"  Règles: {', '.join(rules)}")
                
                if success:
                    stats['titles_shortened'] += 1
                    updates['bg_title'] = shortened
                    print(f"  ✅ Raccourci de {chars_saved} caractères")
                else:
                    stats['titles_need_review'] += 1
                    print(f"  ⚠️ Nécessite révision manuelle")
        
        # Raccourcir la description si > 155
        if len(descrip) > 155:
            stats['descrips_processed'] += 1
            shortened, rules, success = shorten_meta_descrip(descrip)
            
            if rules:
                chars_saved = len(descrip) - len(shortened)
                stats['total_chars_saved'] += chars_saved
                
                print(f"\nbg_id {bg_id} - DESCRIPTION")
                print(f"  AVANT ({len(descrip)} car): {descrip[:80]}...")
                print(f"  APRÈS ({len(shortened)} car): {shortened[:80]}...")
                print(f"  Règles: {', '.join(rules)}")
                
                if success:
                    stats['descrips_shortened'] += 1
                    updates['bg_descrip'] = shortened
                    print(f"  ✅ Raccourci de {chars_saved} caractères")
                else:
                    stats['descrips_need_review'] += 1
                    print(f"  ⚠️ Nécessite révision manuelle")
        
        # Appliquer si mode apply
        if apply_changes and updates:
            try:
                supabase.table('__blog_guide').update(updates).eq('bg_id', bg_id).execute()
                print(f"  💾 Sauvegardé!")
            except Exception as e:
                print(f"  ❌ Erreur: {e}")
    
    # ========================================
    # RÉSUMÉ FINAL
    # ========================================
    print("\n" + "="*70)
    print("📊 RÉSUMÉ RACCOURCISSEMENT")
    print("="*70)
    
    print(f"\n📝 TITLES:")
    print(f"   Analysés:        {stats['titles_processed']}")
    print(f"   Raccourcis:      {stats['titles_shortened']}")
    print(f"   Révision manuelle: {stats['titles_need_review']}")
    
    print(f"\n📝 DESCRIPTIONS:")
    print(f"   Analysées:       {stats['descrips_processed']}")
    print(f"   Raccourcies:     {stats['descrips_shortened']}")
    print(f"   Révision manuelle: {stats['descrips_need_review']}")
    
    print(f"\n💾 TOTAL CARACTÈRES ÉCONOMISÉS: {stats['total_chars_saved']}")
    
    if not apply_changes:
        print("\n" + "="*70)
        print("⚠️  MODE PREVIEW - Aucune modification appliquée")
        print("    Pour appliquer: python meta-audit.py --shorten --apply")
        print("="*70)
    else:
        print("\n✅ Modifications appliquées avec succès!")
    
    # Articles nécessitant révision manuelle
    if stats['titles_need_review'] > 0 or stats['descrips_need_review'] > 0:
        print(f"\n⚠️ {stats['titles_need_review'] + stats['descrips_need_review']} éléments nécessitent révision manuelle")
        print("   (Raccourcissement automatique insuffisant)")


if __name__ == '__main__':
    exit(main())
