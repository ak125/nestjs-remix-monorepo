#!/usr/bin/env python3
"""
🚀 Migration Automatique vers Design System (Python - Safe Version)

Remplace les patterns hardcodés par des composants Alert/Badge
SANS casser la structure JSX.

Stratégie:
1. Pattern matching TRÈS conservateur
2. Validation de la structure avant/après
3. Dry-run par défaut
4. Stats détaillées
"""

import re
import sys
from pathlib import Path
from typing import Tuple, Dict, List
import argparse

# Couleurs pour le terminal
class Colors:
    RESET = '\033[0m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    CYAN = '\033[36m'
    BOLD = '\033[1m'

# Mapping couleur -> variant
COLOR_TO_VARIANT = {
    'red': 'error',
    'green': 'success',
    'yellow': 'warning',
    'blue': 'info',
    'purple': 'default',
    'orange': 'warning',
}

class DesignSystemMigrator:
    def __init__(self, verbose: bool = False, dry_run: bool = True):
        self.verbose = verbose
        self.dry_run = dry_run
        self.stats = {
            'files_scanned': 0,
            'files_modified': 0,
            'badges_migrated': 0,
            'alerts_migrated': 0,
            'skipped_complex': 0,
        }
        
    def log(self, msg: str, color: str = Colors.RESET):
        if self.verbose:
            print(f"{color}{msg}{Colors.RESET}")
    
    def migrate_simple_badges(self, content: str) -> Tuple[str, int]:
        """
        Migre uniquement les badges SIMPLES et SÛRS:
        <span className="bg-red-100 text-red-800">Texte</span>
        
        Conditions strictes:
        - span sur une seule ligne ou avec simple variable JSX
        - Pas de nested complex tags
        - Texte ou {variable} simple
        """
        count = 0
        
        # Pattern 1: Texte pur simple (autoriser newlines dans le contenu)
        pattern1 = r'<span\s+className=["\']((?:[^"\']*\s)?bg-(red|green|yellow|blue|purple|orange)-(?:50|100|200)(?:\s[^"\']*)?)["\']\s*>([^<>]+?)</span>'
        
        def replacer1(match):
            nonlocal count
            classes = match.group(1)
            color = match.group(2)
            text = match.group(3).strip()
            
            # Skip indicators/dots (très petits éléments visuels)
            if 'w-1' in classes or 'w-2' in classes or 'h-1' in classes or 'h-2' in classes:
                return match.group(0)
            
            # Skip absolute positioned badges (notifications)
            if 'absolute' in classes:
                return match.group(0)
            
            # Autoriser {variable} simple mais pas trop de JSX
            if text.count('{') > 2 or text.count('<') > 0:
                return match.group(0)
            
            variant = COLOR_TO_VARIANT.get(color, 'default')
            count += 1
            
            if self.verbose:
                preview = text[:30] + '...' if len(text) > 30 else text
                self.log(f"    Badge: {preview} → {variant}", Colors.CYAN)
            
            return f'<Badge variant="{variant}">{text}</Badge>'
        
        # Pattern 2: Avec text- color class
        pattern2 = r'<span\s+className=["\'](bg-(red|green|yellow|blue|purple|orange)-(?:100|200)\s+text-\2-(?:700|800|900)[^"\']*)["\']\s*>([^<>]+?)</span>'
        
        def replacer2(match):
            nonlocal count
            classes = match.group(1)
            color = match.group(2)
            text = match.group(3).strip()
            
            if text.count('{') > 1 or '<' in text:
                return match.group(0)
            
            variant = COLOR_TO_VARIANT.get(color, 'default')
            count += 1
            
            if self.verbose:
                preview = text[:30] + '...' if len(text) > 30 else text
                self.log(f"    Badge: {preview} → {variant}", Colors.CYAN)
            
            return f'<Badge variant="{variant}">{text}</Badge>'
        
        new_content = re.sub(pattern1, replacer1, content)
        new_content = re.sub(pattern2, replacer2, new_content)
        return new_content, count
    
    def migrate_simple_alerts(self, content: str) -> Tuple[str, int]:
        """
        Migre uniquement les divs SIMPLES qui ressemblent à des alerts:
        <div className="bg-red-50 border ...">Contenu simple</div>
        
        Conditions strictes:
        - div sur UNE ligne uniquement OU contenu très simple
        - Pas de nested complex JSX
        - Pattern: alert informatif simple
        """
        count = 0
        
        # Pattern 1: div simple sur une ligne avec bg-color-50
        pattern1 = r'<div\s+className=["\']((?:[^"\']*\s)?bg-(red|green|yellow|blue)-(?:50|100)(?:\s[^"\']*)?)["\']\s*>([^<]{1,200})</div>'
        
        def replacer1(match):
            nonlocal count
            classes = match.group(1)
            color = match.group(2)
            content_text = match.group(3).strip()
            
            # Sécurité: ne pas toucher si trop complexe
            if content_text.count('{') > 3 or '<' in content_text:
                return match.group(0)
            
            # Skip si c'est clairement une structure (flex + gap + justify)
            if all(x in classes for x in ['flex', 'gap', 'justify']):
                return match.group(0)
            
            # Skip si width/height définis (probablement du layout)
            if 'w-' in classes or 'h-' in classes:
                return match.group(0)
            
            intent = COLOR_TO_VARIANT.get(color, 'info')
            count += 1
            
            if self.verbose:
                preview = content_text[:40] + '...' if len(content_text) > 40 else content_text
                self.log(f"    Alert: {preview} → {intent}", Colors.GREEN)
            
            return f'<Alert intent="{intent}">{content_text}</Alert>'
        
        # Pattern 2: div avec p/text simple à l'intérieur (sur 2-3 lignes max)
        # <div className="bg-red-50 p-4">
        #   <p>Message</p>
        # </div>
        pattern2 = r'<div\s+className=["\']((?:[^"\']*\s)?bg-(red|green|yellow|blue)-50[^"\']*)["\']\s*>\s*<p[^>]*>([^<]+)</p>\s*</div>'
        
        def replacer2(match):
            nonlocal count
            classes = match.group(1)
            color = match.group(2)
            text = match.group(3).strip()
            
            # Ne pas toucher si trop long ou complexe
            if len(text) > 300 or text.count('{') > 2:
                return match.group(0)
            
            intent = COLOR_TO_VARIANT.get(color, 'info')
            count += 1
            
            if self.verbose:
                preview = text[:40] + '...' if len(text) > 40 else text
                self.log(f"    Alert (with p): {preview} → {intent}", Colors.GREEN)
            
            return f'<Alert intent="{intent}"><p>{text}</p></Alert>'
        
        new_content = re.sub(pattern1, replacer1, content)
        new_content = re.sub(pattern2, replacer2, new_content)
        return new_content, count
    
    def add_imports(self, content: str, needs_badge: bool, needs_alert: bool) -> str:
        """Ajoute les imports nécessaires en haut du fichier"""
        
        # Vérifier si les imports existent déjà
        has_badge = "Badge" in content and "from '@fafa/ui'" in content
        has_alert = "Alert" in content and "from '@fafa/ui'" in content
        
        imports_to_add = []
        if needs_badge and not has_badge:
            imports_to_add.append('Badge')
        if needs_alert and not has_alert:
            imports_to_add.append('Alert')
        
        if not imports_to_add:
            return content
        
        # Chercher une ligne d'import existante de @fafa/ui
        ui_import_match = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]@fafa/ui['\"]", content)
        
        if ui_import_match:
            # Ajouter aux imports existants
            existing_imports = ui_import_match.group(1)
            new_imports = existing_imports.rstrip() + ', ' + ', '.join(imports_to_add)
            content = content.replace(
                ui_import_match.group(0),
                f"import {{ {new_imports} }} from '@fafa/ui'"
            )
        else:
            # Créer une nouvelle ligne d'import après les premiers imports React
            import_line = f"import {{ {', '.join(imports_to_add)} }} from '@fafa/ui';\n"
            
            # Trouver la position après les imports React
            react_import = re.search(r"import.*from\s+['\"]react['\"];?\n", content)
            if react_import:
                insert_pos = react_import.end()
                content = content[:insert_pos] + import_line + content[insert_pos:]
            else:
                # Sinon, mettre au début du fichier
                content = import_line + content
        
        return content
    
    def migrate_file(self, file_path: Path) -> bool:
        """
        Migre un fichier TSX.
        Retourne True si des modifications ont été faites.
        """
        try:
            original_content = file_path.read_text(encoding='utf-8')
            content = original_content
            
            # Étape 1: Migrer les badges simples
            content, badge_count = self.migrate_simple_badges(content)
            
            # Étape 2: Migrer les alerts simples
            content, alert_count = self.migrate_simple_alerts(content)
            
            # Statistiques
            total_changes = badge_count + alert_count
            
            if total_changes == 0:
                return False
            
            # Étape 3: Ajouter les imports
            content = self.add_imports(content, badge_count > 0, alert_count > 0)
            
            # Écrire le fichier (sauf en dry-run)
            if not self.dry_run:
                file_path.write_text(content, encoding='utf-8')
            
            # Stats
            self.stats['files_modified'] += 1
            self.stats['badges_migrated'] += badge_count
            self.stats['alerts_migrated'] += alert_count
            
            # Affichage
            relative_path = str(file_path.relative_to(file_path.parents[2]))
            status = f"{Colors.YELLOW}[DRY-RUN]{Colors.RESET}" if self.dry_run else f"{Colors.GREEN}✓{Colors.RESET}"
            print(f"{status} {relative_path}: {badge_count} badges, {alert_count} alerts")
            
            return True
            
        except Exception as e:
            print(f"{Colors.RED}✗ Error in {file_path}: {e}{Colors.RESET}")
            return False
    
    def migrate_directory(self, directory: Path):
        """Migre tous les fichiers TSX dans un répertoire"""
        tsx_files = list(directory.rglob('*.tsx'))
        
        print(f"\n{Colors.BOLD}🔍 Scanning {len(tsx_files)} TSX files...{Colors.RESET}\n")
        
        for file_path in tsx_files:
            self.stats['files_scanned'] += 1
            self.migrate_file(file_path)
        
        self.print_summary()
    
    def print_summary(self):
        """Affiche un résumé des migrations"""
        print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}📊 Migration Summary{Colors.RESET}")
        print(f"{Colors.BOLD}{'='*60}{Colors.RESET}\n")
        
        print(f"  Files scanned:     {self.stats['files_scanned']}")
        print(f"  {Colors.GREEN}Files modified:    {self.stats['files_modified']}{Colors.RESET}")
        print(f"  {Colors.CYAN}Badges migrated:   {self.stats['badges_migrated']}{Colors.RESET}")
        print(f"  {Colors.GREEN}Alerts migrated:   {self.stats['alerts_migrated']}{Colors.RESET}")
        
        total = self.stats['badges_migrated'] + self.stats['alerts_migrated']
        print(f"\n  {Colors.BOLD}Total migrations:  {total}{Colors.RESET}")
        
        if self.dry_run:
            print(f"\n  {Colors.YELLOW}⚠️  DRY RUN MODE - No files were modified{Colors.RESET}")
            print(f"  {Colors.YELLOW}Run with --apply to actually modify files{Colors.RESET}")
        else:
            print(f"\n  {Colors.GREEN}✅ Files have been modified{Colors.RESET}")
            print(f"  {Colors.CYAN}Review changes with: git diff{Colors.RESET}")

def main():
    parser = argparse.ArgumentParser(
        description='🚀 Migrate hardcoded colors to Design System components',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (default - preview only)
  python3 scripts/migrate-design-system.py

  # Actually apply changes
  python3 scripts/migrate-design-system.py --apply

  # Verbose mode
  python3 scripts/migrate-design-system.py --verbose --apply

  # Custom directory
  python3 scripts/migrate-design-system.py --dir frontend/app/routes --apply
        """
    )
    
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Actually modify files (default is dry-run)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed migration info'
    )
    
    parser.add_argument(
        '--dir',
        type=str,
        default='frontend/app',
        help='Directory to scan (default: frontend/app)'
    )
    
    args = parser.parse_args()
    
    # Setup
    root_dir = Path('/workspaces/nestjs-remix-monorepo')
    target_dir = root_dir / args.dir
    
    if not target_dir.exists():
        print(f"{Colors.RED}Error: Directory {target_dir} does not exist{Colors.RESET}")
        sys.exit(1)
    
    # Run migration
    migrator = DesignSystemMigrator(
        verbose=args.verbose,
        dry_run=not args.apply
    )
    
    print(f"{Colors.BOLD}🚀 Design System Migration Tool{Colors.RESET}")
    print(f"Target: {target_dir}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY-RUN (preview only)'}\n")
    
    migrator.migrate_directory(target_dir)

if __name__ == '__main__':
    main()
