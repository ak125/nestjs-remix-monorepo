"""
F0 - Auto Import Agent
Ajoute automatiquement les imports manquants.
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Set, Tuple
from dataclasses import dataclass


@dataclass
class ImportFix:
    """Correction d'import à appliquer."""
    file_path: str
    line_number: int
    symbol: str
    import_statement: str
    category: str  # MISSING, UNUSED, DUPLICATE


class F0AutoImportAgent:
    """
    Agent F0 - Gestion automatique des imports.
    
    Fonctionnalités:
    - Détecte les imports manquants
    - Ajoute les imports appropriés
    - Supprime les imports inutilisés
    - Organise les imports
    """
    
    # Map de symboles vers leurs imports (TypeScript/JavaScript)
    COMMON_IMPORTS = {
        # React
        'useState': "import { useState } from 'react';",
        'useEffect': "import { useEffect } from 'react';",
        'useCallback': "import { useCallback } from 'react';",
        'useMemo': "import { useMemo } from 'react';",
        'useRef': "import { useRef } from 'react';",
        'useContext': "import { useContext } from 'react';",
        'useReducer': "import { useReducer } from 'react';",
        'FC': "import { FC } from 'react';",
        'ReactNode': "import { ReactNode } from 'react';",
        
        # Remix
        'useLoaderData': "import { useLoaderData } from '@remix-run/react';",
        'useActionData': "import { useActionData } from '@remix-run/react';",
        'useFetcher': "import { useFetcher } from '@remix-run/react';",
        'useNavigate': "import { useNavigate } from '@remix-run/react';",
        'useSearchParams': "import { useSearchParams } from '@remix-run/react';",
        'json': "import { json } from '@remix-run/node';",
        'redirect': "import { redirect } from '@remix-run/node';",
        'LoaderFunction': "import type { LoaderFunction } from '@remix-run/node';",
        'ActionFunction': "import type { ActionFunction } from '@remix-run/node';",
        
        # NestJS
        'Injectable': "import { Injectable } from '@nestjs/common';",
        'Controller': "import { Controller } from '@nestjs/common';",
        'Get': "import { Get } from '@nestjs/common';",
        'Post': "import { Post } from '@nestjs/common';",
        'Put': "import { Put } from '@nestjs/common';",
        'Delete': "import { Delete } from '@nestjs/common';",
        'Patch': "import { Patch } from '@nestjs/common';",
        'Body': "import { Body } from '@nestjs/common';",
        'Param': "import { Param } from '@nestjs/common';",
        'Query': "import { Query } from '@nestjs/common';",
        'Req': "import { Req } from '@nestjs/common';",
        'Res': "import { Res } from '@nestjs/common';",
        
        # Common utilities
        'clsx': "import clsx from 'clsx';",
        'cn': "import { cn } from '@/lib/utils';",
    }
    
    # Extensions à traiter
    EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx'}
    
    IGNORE_PATTERNS = [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '.git',
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent F0.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.fixes: List[ImportFix] = []
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        return file_path.suffix in self.EXTENSIONS
    
    def extract_existing_imports(self, content: str) -> Set[str]:
        """Extrait les symboles déjà importés."""
        imported_symbols = set()
        
        # Pattern pour les imports nommés: import { A, B } from '...'
        named_imports = re.findall(r'import\s*\{([^}]+)\}\s*from', content)
        for imports in named_imports:
            symbols = [s.strip().split(' as ')[0] for s in imports.split(',')]
            imported_symbols.update(symbols)
        
        # Pattern pour les imports default: import A from '...'
        default_imports = re.findall(r'import\s+(\w+)\s+from', content)
        imported_symbols.update(default_imports)
        
        # Pattern pour les imports type: import type { A } from '...'
        type_imports = re.findall(r'import\s+type\s*\{([^}]+)\}', content)
        for imports in type_imports:
            symbols = [s.strip().split(' as ')[0] for s in imports.split(',')]
            imported_symbols.update(symbols)
        
        return imported_symbols
    
    def extract_used_symbols(self, content: str) -> Set[str]:
        """Extrait les symboles utilisés dans le code."""
        used_symbols = set()
        
        # Supprimer les imports et commentaires pour analyser uniquement le code
        code_without_imports = re.sub(r'import\s+.*?;', '', content)
        code_without_comments = re.sub(r'//.*?$|/\*.*?\*/', '', code_without_imports, flags=re.MULTILINE | re.DOTALL)
        
        # Chercher les symboles connus
        for symbol in self.COMMON_IMPORTS.keys():
            # Utiliser word boundaries pour éviter les faux positifs
            pattern = r'\b' + re.escape(symbol) + r'\b'
            if re.search(pattern, code_without_comments):
                used_symbols.add(symbol)
        
        return used_symbols
    
    def find_missing_imports(self, file_path: Path) -> List[ImportFix]:
        """Trouve les imports manquants dans un fichier."""
        fixes = []
        
        try:
            content = file_path.read_text(encoding='utf-8')
            
            # Extraire les imports existants et les symboles utilisés
            existing = self.extract_existing_imports(content)
            used = self.extract_used_symbols(content)
            
            # Trouver les symboles manquants
            missing = used - existing
            
            for symbol in missing:
                if symbol in self.COMMON_IMPORTS:
                    fix = ImportFix(
                        file_path=str(file_path.relative_to(self.root_dir)),
                        line_number=1,  # Les imports vont en haut
                        symbol=symbol,
                        import_statement=self.COMMON_IMPORTS[symbol],
                        category='MISSING',
                    )
                    fixes.append(fix)
        
        except Exception as e:
            pass
        
        return fixes
    
    def find_unused_imports(self, file_path: Path) -> List[ImportFix]:
        """Trouve les imports inutilisés dans un fichier."""
        fixes = []
        
        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            # Extraire les imports avec leurs numéros de ligne
            for i, line in enumerate(lines, 1):
                # Import nommé
                match = re.search(r'import\s*\{([^}]+)\}\s*from', line)
                if match:
                    imports = match.group(1)
                    symbols = [s.strip().split(' as ')[0] for s in imports.split(',')]
                    
                    # Vérifier si chaque symbole est utilisé
                    code_without_imports = '\n'.join(lines[i:])  # Code après l'import
                    
                    for symbol in symbols:
                        pattern = r'\b' + re.escape(symbol) + r'\b'
                        if not re.search(pattern, code_without_imports):
                            fix = ImportFix(
                                file_path=str(file_path.relative_to(self.root_dir)),
                                line_number=i,
                                symbol=symbol,
                                import_statement=line.strip(),
                                category='UNUSED',
                            )
                            fixes.append(fix)
        
        except Exception as e:
            pass
        
        return fixes
    
    def apply_fixes(self, file_path: Path, fixes: List[ImportFix]) -> bool:
        """
        Applique les corrections d'imports à un fichier.
        
        Returns:
            True si des modifications ont été apportées
        """
        if not fixes:
            return False
        
        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            # Ajouter les imports manquants
            missing_imports = [f for f in fixes if f.category == 'MISSING']
            if missing_imports:
                # Trouver la position d'insertion (après les derniers imports)
                last_import_line = 0
                for i, line in enumerate(lines):
                    if line.strip().startswith('import '):
                        last_import_line = i
                
                # Insérer les nouveaux imports
                insert_pos = last_import_line + 1 if last_import_line > 0 else 0
                
                for fix in missing_imports:
                    # Vérifier si l'import n'existe pas déjà
                    if fix.import_statement not in content:
                        lines.insert(insert_pos, fix.import_statement)
                        insert_pos += 1
            
            # Supprimer les imports inutilisés (à implémenter avec plus de prudence)
            # Pour l'instant, on les signale seulement
            
            # Écrire le fichier modifié
            new_content = '\n'.join(lines)
            if new_content != content:
                file_path.write_text(new_content, encoding='utf-8')
                return True
        
        except Exception as e:
            return False
        
        return False
    
    def analyze(self, dry_run: bool = True) -> Dict[str, Any]:
        """
        Lance l'analyse complète.
        
        Args:
            dry_run: Si True, ne modifie pas les fichiers
            
        Returns:
            Résultats de l'analyse
        """
        self.fixes = []
        files_modified = 0
        
        # Parcourir tous les fichiers
        for file_path in self.root_dir.rglob('*'):
            if file_path.is_file() and self.should_analyze(file_path):
                # Trouver les imports manquants
                missing = self.find_missing_imports(file_path)
                self.fixes.extend(missing)
                
                # Trouver les imports inutilisés
                unused = self.find_unused_imports(file_path)
                self.fixes.extend(unused)
                
                # Appliquer les corrections si pas en dry-run
                if not dry_run and (missing or unused):
                    if self.apply_fixes(file_path, missing + unused):
                        files_modified += 1
        
        # Calculer les métriques
        category_counts = {
            'MISSING': 0,
            'UNUSED': 0,
            'DUPLICATE': 0,
        }
        
        for fix in self.fixes:
            category_counts[fix.category] += 1
        
        return {
            'total_fixes': len(self.fixes),
            'files_modified': files_modified,
            'category_counts': category_counts,
            'dry_run': dry_run,
            'fixes': [
                {
                    'file': f.file_path,
                    'line': f.line_number,
                    'symbol': f.symbol,
                    'import': f.import_statement,
                    'category': f.category,
                }
                for f in sorted(self.fixes, key=lambda x: (x.file_path, x.line_number))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        if not self.fixes:
            return "✅ Tous les imports sont corrects"
        
        results = self.analyze()
        counts = results['category_counts']
        
        summary = [
            f"📦 F0 - Auto Import: {len(self.fixes)} corrections possibles",
            f"   ➕ Imports manquants: {counts['MISSING']}",
            f"   ➖ Imports inutilisés: {counts['UNUSED']}",
            f"   🔄 Imports dupliqués: {counts['DUPLICATE']}",
        ]
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    import json
    from datetime import datetime
    
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    dry_run = '--apply' not in sys.argv
    
    print(f"🔍 F0 - Auto Import")
    print(f"📁 Root: {root}")
    print(f"🔧 Mode: {'DRY RUN' if dry_run else 'APPLY'}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = F0AutoImportAgent(root)
    results = agent.analyze(dry_run=dry_run)
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    if dry_run:
        print("\n💡 Use --apply to actually modify files")
    
    output_file = Path('f0_autoimport_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
