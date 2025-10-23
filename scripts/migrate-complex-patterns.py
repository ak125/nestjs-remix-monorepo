#!/usr/bin/env python3
"""
🎯 Batch Migration - Patterns Complexes mais Sûrs

Cible les patterns plus avancés :
- Badges avec className dynamique
- Alerts avec nested <p>, <strong>, etc.
- Mais TOUJOURS avec validation stricte
"""

import re
from pathlib import Path
from typing import Tuple

class Colors:
    RESET = '\033[0m'
    GREEN = '\033[32m'
    CYAN = '\033[36m'
    BOLD = '\033[1m'

COLOR_MAP = {
    'red': 'error',
    'green': 'success',
    'yellow': 'warning',
    'blue': 'info',
    'purple': 'default',
    'orange': 'warning',
}

def migrate_badges_with_padding(content: str) -> Tuple[str, int]:
    """
    Badge avec padding/rounded explicites:
    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Active</span>
    """
    count = 0
    
    # Pattern: span avec px/py + bg-color + text-color + rounded
    pattern = r'<span\s+className=["\']((?:px-[0-9]\s+)?(?:py-[0-9]\s+)?(?:[^"\']*\s)?bg-(red|green|yellow|blue|purple|orange)-100\s+text-\2-[789]00[^"\']*)["\']\s*>\s*([^<>]+?)\s*</span>'
    
    def replacer(match):
        nonlocal count
        classes = match.group(1)
        color = match.group(2)
        text = match.group(3).strip()
        
        # Skip si trop de JSX
        if text.count('{') > 2 or '<' in text:
            return match.group(0)
        
        # Skip indicators
        if any(x in classes for x in ['w-1', 'w-2', 'h-1', 'h-2', 'absolute']):
            return match.group(0)
        
        variant = COLOR_MAP.get(color, 'default')
        count += 1
        
        return f'<Badge variant="{variant}">{text}</Badge>'
    
    return re.sub(pattern, replacer, content), count

def migrate_alerts_with_strong(content: str) -> Tuple[str, int]:
    """
    Alert avec <strong> ou <p> à l'intérieur:
    <div className="bg-red-50 p-4"><strong>Erreur:</strong> Message</div>
    """
    count = 0
    
    # Pattern: div bg-X-50 avec <strong> ou <p>
    pattern = r'<div\s+className=["\']((?:[^"\']*\s)?bg-(red|green|yellow|blue)-50[^"\']*)["\']\s*>\s*(<(?:strong|p)[^>]*>[^<]+</(?:strong|p)>(?:[^<]|<(?:strong|p)[^>]*>[^<]+</(?:strong|p)>)*?)\s*</div>'
    
    def replacer(match):
        nonlocal count
        classes = match.group(1)
        color = match.group(2)
        inner_html = match.group(3).strip()
        
        # Skip si layout complexe
        if any(x in classes for x in ['grid', 'absolute', 'flex-col', 'space-y']):
            return match.group(0)
        
        # Skip si trop de nested tags
        if inner_html.count('<') > 4:
            return match.group(0)
        
        intent = COLOR_MAP.get(color, 'info')
        count += 1
        
        return f'<Alert intent="{intent}">{inner_html}</Alert>'
    
    return re.sub(pattern, replacer, content), count

def migrate_inline_flex_badges(content: str) -> Tuple[str, int]:
    """
    Badge avec inline-flex:
    <span className="inline-flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded">
    """
    count = 0
    
    pattern = r'<span\s+className=["\'](inline-flex\s+[^"\']*bg-(red|green|yellow|blue|purple|orange)-100[^"\']*)["\']\s*>\s*([^<>]+?)\s*</span>'
    
    def replacer(match):
        nonlocal count
        classes = match.group(1)
        color = match.group(2)
        text = match.group(3).strip()
        
        if text.count('{') > 2 or '<' in text:
            return match.group(0)
        
        if any(x in classes for x in ['w-1', 'w-2', 'absolute']):
            return match.group(0)
        
        variant = COLOR_MAP.get(color, 'default')
        count += 1
        
        return f'<Badge variant="{variant}">{text}</Badge>'
    
    return re.sub(pattern, replacer, content), count

def add_imports(content: str, needs_badge: bool, needs_alert: bool) -> str:
    """Ajoute les imports nécessaires"""
    imports_to_add = []
    
    if needs_badge and 'Badge' not in content:
        imports_to_add.append('Badge')
    if needs_alert and 'Alert' not in content:
        imports_to_add.append('Alert')
    
    if not imports_to_add:
        return content
    
    # Chercher import existant de @fafa/ui
    ui_import = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]@fafa/ui['\"]", content)
    
    if ui_import:
        existing = ui_import.group(1)
        new_imports = existing.rstrip() + ', ' + ', '.join(imports_to_add)
        content = content.replace(
            ui_import.group(0),
            f"import {{ {new_imports} }} from '@fafa/ui'"
        )
    else:
        # Nouvelle ligne d'import
        import_line = f"import {{ {', '.join(imports_to_add)} }} from '@fafa/ui';\n"
        react_import = re.search(r"import.*from\s+['\"]react['\"];?\n", content)
        if react_import:
            content = content[:react_import.end()] + import_line + content[react_import.end():]
        else:
            content = import_line + content
    
    return content

def migrate_file(file_path: Path) -> Tuple[int, int]:
    """Migre un fichier. Retourne (badges_count, alerts_count)"""
    try:
        original = file_path.read_text(encoding='utf-8')
        content = original
        
        # Appliquer les migrations
        content, badge1 = migrate_badges_with_padding(content)
        content, badge2 = migrate_inline_flex_badges(content)
        content, alert1 = migrate_alerts_with_strong(content)
        
        badge_count = badge1 + badge2
        alert_count = alert1
        total = badge_count + alert_count
        
        if total == 0:
            return 0, 0
        
        # Ajouter imports
        content = add_imports(content, badge_count > 0, alert_count > 0)
        
        # Écrire
        file_path.write_text(content, encoding='utf-8')
        
        rel_path = str(file_path.relative_to(file_path.parents[2]))
        print(f"{Colors.GREEN}✓{Colors.RESET} {rel_path}: {badge_count} badges, {alert_count} alerts")
        
        return badge_count, alert_count
        
    except Exception as e:
        print(f"✗ Error in {file_path}: {e}")
        return 0, 0

def main():
    root = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(root.rglob('*.tsx'))
    
    print(f"{Colors.BOLD}🎯 Batch Migration - Complex Patterns{Colors.RESET}\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_badges = 0
    total_alerts = 0
    files_modified = 0
    
    for file_path in tsx_files:
        badge_count, alert_count = migrate_file(file_path)
        if badge_count + alert_count > 0:
            files_modified += 1
            total_badges += badge_count
            total_alerts += alert_count
    
    print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}📊 Summary{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*60}{Colors.RESET}\n")
    print(f"  Files modified:    {files_modified}")
    print(f"  {Colors.CYAN}Badges migrated:   {total_badges}{Colors.RESET}")
    print(f"  {Colors.GREEN}Alerts migrated:   {total_alerts}{Colors.RESET}")
    print(f"  {Colors.BOLD}Total:             {total_badges + total_alerts}{Colors.RESET}")

if __name__ == '__main__':
    main()
