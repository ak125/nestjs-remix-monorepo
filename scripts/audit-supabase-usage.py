#!/usr/bin/env python3
"""
Audit complet de tous les services backend qui utilisent Supabase
Vérifie que toutes les colonnes utilisées existent réellement
"""

import json
import re
import os
from pathlib import Path
from collections import defaultdict

# Charger le schéma
schema_path = '/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json'
with open(schema_path, 'r') as f:
    schema = json.load(f)

# Backend path
backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Regex patterns pour détecter les requêtes Supabase
PATTERNS = {
    'from': r"\.from\(['\"](\w+)['\"]\)",
    'select': r"\.select\(['\"]([^'\"]+)['\"]\)",
    'eq': r"\.eq\(['\"](\w+)['\"]",
    'neq': r"\.neq\(['\"](\w+)['\"]",
    'filter': r"\.filter\(['\"](\w+)['\"]",
    'order': r"\.order\(['\"](\w+)['\"]",
}

class SupabaseAuditor:
    def __init__(self):
        self.tables = schema['tables']
        self.issues = []
        self.stats = defaultdict(int)
        self.files_scanned = 0
        
    def check_table_exists(self, table_name):
        """Vérifie qu'une table existe"""
        return table_name in self.tables
    
    def check_column_exists(self, table_name, column_name):
        """Vérifie qu'une colonne existe dans une table"""
        if table_name not in self.tables:
            return False
        columns = self.tables[table_name]
        return column_name in columns
    
    def parse_select(self, select_str):
        """Parse une chaîne select pour extraire les colonnes"""
        if '*' in select_str:
            return ['*']
        
        # Nettoyer et extraire les colonnes
        columns = []
        # Supprimer les espaces
        select_str = select_str.replace(' ', '')
        
        # Gérer les cas simples: col1,col2,col3
        if '(' not in select_str:
            columns = select_str.split(',')
        else:
            # Cas complexes avec jointures (ex: "id,name,relation(field)")
            # Pour l'instant, on extrait juste les colonnes simples
            parts = re.split(r',(?![^()]*\))', select_str)
            for part in parts:
                # Extraire le nom de la colonne (avant toute parenthèse)
                col = part.split('(')[0]
                if col:
                    columns.append(col)
        
        return [c.strip() for c in columns if c.strip()]
    
    def audit_file(self, file_path):
        """Audit un fichier TypeScript"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return
        
        self.files_scanned += 1
        
        # Trouver tous les .from()
        from_matches = re.finditer(PATTERNS['from'], content)
        current_table = None
        
        for match in from_matches:
            table_name = match.group(1)
            current_table = table_name
            line_num = content[:match.start()].count('\n') + 1
            
            # Vérifier que la table existe
            if not self.check_table_exists(table_name):
                self.issues.append({
                    'type': 'TABLE_NOT_FOUND',
                    'file': str(file_path.relative_to(backend_path)),
                    'line': line_num,
                    'table': table_name,
                    'message': f"Table '{table_name}' n'existe pas dans Supabase"
                })
                self.stats['tables_not_found'] += 1
            else:
                self.stats['tables_found'] += 1
                
                # Trouver le .select() qui suit ce .from()
                # Chercher dans les 500 caractères suivants
                snippet = content[match.end():match.end()+500]
                select_match = re.search(PATTERNS['select'], snippet)
                
                if select_match:
                    select_str = select_match.group(1)
                    columns = self.parse_select(select_str)
                    
                    # Vérifier chaque colonne
                    for col in columns:
                        if col == '*':
                            continue
                        
                        if not self.check_column_exists(table_name, col):
                            rel_line = line_num + snippet[:select_match.start()].count('\n')
                            self.issues.append({
                                'type': 'COLUMN_NOT_FOUND',
                                'file': str(file_path.relative_to(backend_path)),
                                'line': rel_line,
                                'table': table_name,
                                'column': col,
                                'message': f"Colonne '{col}' n'existe pas dans '{table_name}'"
                            })
                            self.stats['columns_not_found'] += 1
                        else:
                            self.stats['columns_found'] += 1
    
    def audit_directory(self, directory):
        """Audit récursif d'un répertoire"""
        for ts_file in directory.rglob('*.ts'):
            # Ignorer node_modules et dist
            if 'node_modules' in str(ts_file) or 'dist' in str(ts_file):
                continue
            self.audit_file(ts_file)
    
    def print_report(self):
        """Affiche le rapport d'audit"""
        print("=" * 100)
        print("📊 AUDIT COMPLET DES SERVICES SUPABASE")
        print("=" * 100)
        print()
        
        print(f"📁 Fichiers scannés: {self.files_scanned}")
        print(f"✅ Tables trouvées: {self.stats['tables_found']}")
        print(f"❌ Tables non trouvées: {self.stats['tables_not_found']}")
        print(f"✅ Colonnes trouvées: {self.stats['columns_found']}")
        print(f"❌ Colonnes non trouvées: {self.stats['columns_not_found']}")
        print()
        
        if self.issues:
            print("=" * 100)
            print(f"⚠️  {len(self.issues)} PROBLÈMES DÉTECTÉS")
            print("=" * 100)
            print()
            
            # Grouper par type
            by_type = defaultdict(list)
            for issue in self.issues:
                by_type[issue['type']].append(issue)
            
            # Tables non trouvées
            if 'TABLE_NOT_FOUND' in by_type:
                print(f"🔴 TABLES NON TROUVÉES ({len(by_type['TABLE_NOT_FOUND'])})")
                print("-" * 100)
                for issue in by_type['TABLE_NOT_FOUND'][:10]:  # Top 10
                    print(f"   📄 {issue['file']}:{issue['line']}")
                    print(f"      ❌ Table: {issue['table']}")
                    print()
                if len(by_type['TABLE_NOT_FOUND']) > 10:
                    print(f"   ... et {len(by_type['TABLE_NOT_FOUND']) - 10} autres")
                print()
            
            # Colonnes non trouvées
            if 'COLUMN_NOT_FOUND' in by_type:
                print(f"🟡 COLONNES NON TROUVÉES ({len(by_type['COLUMN_NOT_FOUND'])})")
                print("-" * 100)
                for issue in by_type['COLUMN_NOT_FOUND'][:20]:  # Top 20
                    print(f"   📄 {issue['file']}:{issue['line']}")
                    print(f"      Table: {issue['table']}")
                    print(f"      ❌ Colonne: {issue['column']}")
                    print()
                if len(by_type['COLUMN_NOT_FOUND']) > 20:
                    print(f"   ... et {len(by_type['COLUMN_NOT_FOUND']) - 20} autres")
                print()
        else:
            print("=" * 100)
            print("✅ AUCUN PROBLÈME DÉTECTÉ - TOUT EST CONFORME !")
            print("=" * 100)
        
        # Sauvegarder le rapport
        report_path = '/workspaces/nestjs-remix-monorepo/scripts/supabase-audit-report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'stats': dict(self.stats),
                'issues': self.issues,
                'files_scanned': self.files_scanned
            }, f, indent=2)
        
        print()
        print("=" * 100)
        print(f"📄 Rapport détaillé sauvegardé: {report_path}")
        print("=" * 100)

# Exécuter l'audit
auditor = SupabaseAuditor()
auditor.audit_directory(backend_path)
auditor.print_report()
