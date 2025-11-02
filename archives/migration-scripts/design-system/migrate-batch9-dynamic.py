#!/usr/bin/env python3
"""
🔥 Batch 9 - Patterns Conditionnels et Dynamiques

Cible :
- Ternaires : {status ? 'bg-green-100' : 'bg-red-100'}
- Template literals : `bg-${color}-100`
- Mapping simple : items.map(item => <span className="bg-blue-100">...)
- Inline conditions : {isActive && <span className="bg-green-100">Active</span>}
"""

import re
from pathlib import Path
from typing import Tuple

class Colors:
    RESET = '\033[0m'
    GREEN = '\033[32m'
    CYAN = '\033[36m'
    YELLOW = '\033[33m'
    BOLD = '\033[1m'

def migrate_ternary_badges(content: str) -> Tuple[str, int]:
    """
    Badge conditionnel ternaire simple:
    <span className={status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
    
    Stratégie conservative : seulement 2 options, couleurs opposées claires
    """
    count = 0
    
    # Pattern: ternaire avec 2 couleurs opposées (green/red, blue/red, etc.)
    pattern = r'<span\s+className=\{([^}]+)\s+\?\s+["\']([^"\']*bg-(green|blue)-100[^"\']*)["\']\\s*:\\s*["\']([^"\']*bg-(red|yellow)-100[^"\']*)["\'][^}]*\}\s*>\s*([^<>]+?)\s*</span>'
    
    def replacer(match):
        nonlocal count
        condition = match.group(1).strip()
        success_classes = match.group(2)
        success_color = match.group(3)
        error_classes = match.group(4)
        error_color = match.group(5)
        text = match.group(6).strip()
        
        # Skip si trop complexe
        if len(condition) > 80 or text.count('{') > 1:
            return match.group(0)
        
        # Mapping simple
        success_variant = 'success' if success_color == 'green' else 'info'
        error_variant = 'error' if error_color == 'red' else 'warning'
        
        count += 1
        
        # Générer Badge conditionnel
        return f'<Badge variant={{{condition} ? "{success_variant}" : "{error_variant}"}}>{text}</Badge>'
    
    return re.sub(pattern, replacer, content), count

def migrate_conditional_inline_badge(content: str) -> Tuple[str, int]:
    """
    Badge avec condition inline :
    {isActive && <span className="bg-green-100 text-green-800">Active</span>}
    """
    count = 0
    
    pattern = r'\{([^}]+)\s+&&\s+<span\s+className=["\']([^"\']*bg-(red|green|yellow|blue)-100[^"\']*)["\']>\s*([^<>]+?)\s*</span>\s*\}'
    
    def replacer(match):
        nonlocal count
        condition = match.group(1).strip()
        classes = match.group(2)
        color = match.group(3)
        text = match.group(4).strip()
        
        if len(condition) > 60 or text.count('{') > 1:
            return match.group(0)
        
        variant_map = {'red': 'error', 'green': 'success', 'yellow': 'warning', 'blue': 'info'}
        variant = variant_map.get(color, 'default')
        
        count += 1
        return f'{{{condition} && <Badge variant="{variant}">{text}</Badge>}}'
    
    return re.sub(pattern, replacer, content), count

def migrate_simple_map_badge(content: str) -> Tuple[str, int]:
    """
    Map avec badge simple (une ligne):
    {items.map(item => <span className="bg-blue-100 text-blue-800">{item.name}</span>)}
    """
    count = 0
    
    # Pattern: .map avec span bg-color sur une ligne
    pattern = r'\{([^}]+)\.map\(([^)]+)\s*=>\s*<span\s+className=["\']([^"\']*bg-(red|green|yellow|blue)-100[^"\']*)["\']>\s*\{([^}]+)\}\s*</span>\s*\)\}'
    
    def replacer(match):
        nonlocal count
        array = match.group(1).strip()
        param = match.group(2).strip()
        classes = match.group(3)
        color = match.group(4)
        inner = match.group(5).strip()
        
        # Skip si array ou inner trop complexe
        if array.count('.') > 2 or len(inner) > 40:
            return match.group(0)
        
        variant_map = {'red': 'error', 'green': 'success', 'yellow': 'warning', 'blue': 'info'}
        variant = variant_map.get(color, 'default')
        
        count += 1
        return f'{{{array}.map({param} => <Badge variant="{variant}" key={{{inner}}}>{{{inner}}}</Badge>)}}'
    
    return re.sub(pattern, replacer, content), count

def migrate_px_py_rounded_badges(content: str) -> Tuple[str, int]:
    """
    Badges avec style explicite px-X py-X rounded:
    <span className="px-2 py-1 rounded bg-green-100 text-green-800">...</span>
    """
    count = 0
    
    # Pattern plus flexible pour px/py n'importe où dans className
    pattern = r'<span\s+className=["\']([^"\']*\bpx-[0-9][^"\']*\bpy-[0-9][^"\']*\bbg-(red|green|yellow|blue|purple|orange)-100[^"\']*)["\']>\s*([^<>]+?)\s*</span>'
    
    def replacer(match):
        nonlocal count
        classes = match.group(1)
        color = match.group(2)
        text = match.group(3).strip()
        
        # Skip indicators, absolute, etc.
        if any(x in classes for x in ['w-1', 'w-2', 'h-1', 'h-2', 'absolute', 'fixed']):
            return match.group(0)
        
        # Skip si trop de JSX
        if text.count('{') > 2 or '<' in text:
            return match.group(0)
        
        variant_map = {'red': 'error', 'green': 'success', 'yellow': 'warning', 'blue': 'info', 'purple': 'default', 'orange': 'warning'}
        variant = variant_map.get(color, 'default')
        
        count += 1
        return f'<Badge variant="{variant}">{text}</Badge>'
    
    return re.sub(pattern, replacer, content), count

def migrate_text_color_only_badges(content: str) -> Tuple[str, int]:
    """
    Badges avec pattern : bg-X-100 text-X-800/900 (ordre variable)
    """
    count = 0
    
    pattern = r'<span\s+className=["\']([^"\']*\b(?:text-(red|green|yellow|blue|purple|orange)-[789]00[^"\']*\bbg-\2-100|bg-(red|green|yellow|blue|purple|orange)-100[^"\']*\btext-\3-[789]00)[^"\']*)["\']>\s*([^<>]+?)\s*</span>'
    
    def replacer(match):
        nonlocal count
        classes = match.group(1)
        color = match.group(2) or match.group(3)
        text = match.group(4).strip()
        
        if any(x in classes for x in ['w-1', 'w-2', 'absolute', 'fixed']):
            return match.group(0)
        
        if text.count('{') > 2 or '<' in text:
            return match.group(0)
        
        variant_map = {'red': 'error', 'green': 'success', 'yellow': 'warning', 'blue': 'info', 'purple': 'default', 'orange': 'warning'}
        variant = variant_map.get(color, 'default')
        
        count += 1
        return f'<Badge variant="{variant}">{text}</Badge>'
    
    return re.sub(pattern, replacer, content), count

def add_imports(content: str, needs_badge: bool) -> str:
    """Ajoute import Badge si nécessaire"""
    if not needs_badge or 'Badge' in content:
        return content
    
    ui_import = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]@fafa/ui['\"]", content)
    
    if ui_import:
        existing = ui_import.group(1)
        if 'Badge' not in existing:
            new_imports = existing.rstrip() + ', Badge'
            content = content.replace(ui_import.group(0), f"import {{ {new_imports} }} from '@fafa/ui'")
    else:
        import_line = "import { Badge } from '@fafa/ui';\n"
        react_import = re.search(r"import.*from\s+['\"]react['\"];?\n", content)
        if react_import:
            content = content[:react_import.end()] + import_line + content[react_import.end():]
        else:
            content = import_line + content
    
    return content

def migrate_file(file_path: Path) -> int:
    """Migre un fichier. Retourne le nombre de migrations."""
    try:
        original = file_path.read_text(encoding='utf-8')
        content = original
        
        # Appliquer toutes les migrations
        content, count1 = migrate_px_py_rounded_badges(content)
        content, count2 = migrate_text_color_only_badges(content)
        content, count3 = migrate_conditional_inline_badge(content)
        content, count4 = migrate_ternary_badges(content)
        content, count5 = migrate_simple_map_badge(content)
        
        total = count1 + count2 + count3 + count4 + count5
        
        if total == 0:
            return 0
        
        # Ajouter imports
        content = add_imports(content, total > 0)
        
        # Écrire
        file_path.write_text(content, encoding='utf-8')
        
        rel_path = str(file_path.relative_to(file_path.parents[2]))
        details = []
        if count1 > 0: details.append(f"{count1} px/py")
        if count2 > 0: details.append(f"{count2} text-color")
        if count3 > 0: details.append(f"{count3} conditional")
        if count4 > 0: details.append(f"{count4} ternary")
        if count5 > 0: details.append(f"{count5} map")
        
        print(f"{Colors.GREEN}✓{Colors.RESET} {rel_path}: {total} badges ({', '.join(details)})")
        
        return total
        
    except Exception as e:
        print(f"{Colors.YELLOW}⚠{Colors.RESET} Error in {file_path.name}: {str(e)[:60]}")
        return 0

def main():
    root = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(root.rglob('*.tsx'))
    
    print(f"{Colors.BOLD}🔥 Batch 9 - Conditional & Dynamic Patterns{Colors.RESET}\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total = 0
    files_modified = 0
    
    for file_path in tsx_files:
        count = migrate_file(file_path)
        if count > 0:
            files_modified += 1
            total += count
    
    print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}📊 Summary{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*60}{Colors.RESET}\n")
    print(f"  Files modified:    {files_modified}")
    print(f"  {Colors.CYAN}Badges migrated:   {total}{Colors.RESET}")
    print(f"  {Colors.BOLD}Total:             {total}{Colors.RESET}")
    
    if total > 0:
        print(f"\n{Colors.GREEN}✅ Migration complete!{Colors.RESET}")
        print(f"{Colors.CYAN}Next: Run build to verify{Colors.RESET}")

if __name__ == '__main__':
    main()
