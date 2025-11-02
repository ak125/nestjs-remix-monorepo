#!/usr/bin/env python3
"""
🎯 Batch 24 v2 - Migration Conditional bg-50 → Semantic
Cible les bg-*-50 dans des conditions/ternaires complexes
Exemple: isActive ? 'bg-blue-50 text-blue-600' : '' → isActive ? 'bg-primary/10 text-primary' : ''
"""

import re
from pathlib import Path

def migrate_conditional_bg50(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les bg-50 dans des conditions complexes
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    conditionals_migrated = 0
    
    # Pattern 1: isActive/isSelected ? 'bg-blue-50 ...' : ''
    # Plus spécifique pour éviter les faux positifs
    pattern1 = r"\?\s*['\"]bg-(blue|green|red|yellow|purple|orange)-50(?:/\d+)?\s+(.*?)text-\1-\d+([^'\"]*?)['\"]"
    
    def replace_conditional(match):
        nonlocal conditionals_migrated
        color = match.group(1)
        middle = match.group(2)
        after = match.group(3)
        
        color_map = {
            'blue': ('bg-primary/10', 'text-primary'),
            'green': ('bg-success/10', 'text-success'),
            'red': ('bg-destructive/10', 'text-destructive'),
            'yellow': ('bg-warning/10', 'text-warning'),
            'purple': ('bg-purple-50', 'text-purple-600'),
            'orange': ('bg-orange-50', 'text-orange-600'),
        }
        
        bg_new, text_new = color_map.get(color, (f'bg-{color}-50', f'text-{color}-600'))
        
        conditionals_migrated += 1
        return f"? '{bg_new} {middle}{text_new}{after}'"
    
    content = re.sub(pattern1, replace_conditional, content)
    
    # Pattern 2: Simples bg-*-50/70 ou bg-*-50/80 (opacités)
    # bg-blue-50/70 → bg-primary/10
    pattern2 = r'bg-(blue|green|red|yellow|purple|orange)-50/\d+'
    
    def replace_opacity(match):
        nonlocal conditionals_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-primary/10',
            'green': 'bg-success/10',
            'red': 'bg-destructive/10',
            'yellow': 'bg-warning/10',
            'purple': 'bg-purple-50/70',
            'orange': 'bg-orange-50/70',
        }
        
        conditionals_migrated += 1
        return color_map.get(color, f'bg-{color}-50/70')
    
    content = re.sub(pattern2, replace_opacity, content)
    
    # Pattern 3: border-*-500 bg-*-50 (ensemble)
    # border-blue-500 bg-blue-50 → border-primary bg-primary/10
    pattern3 = r'border-(blue|green|red|yellow|purple|orange)-\d+\s+bg-\1-50'
    
    def replace_border_bg(match):
        nonlocal conditionals_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'border-primary bg-primary/10',
            'green': 'border-success bg-success/10',
            'red': 'border-destructive bg-destructive/10',
            'yellow': 'border-warning bg-warning/10',
            'purple': 'border-purple-500 bg-purple-50',
            'orange': 'border-orange-500 bg-orange-50',
        }
        
        conditionals_migrated += 1
        return color_map.get(color, f'border-{color}-500 bg-{color}-50')
    
    content = re.sub(pattern3, replace_border_bg, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'conditionals': conditionals_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🎯 Batch 24 v2 - Conditional bg-50 → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_conditionals = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_conditional_bg50(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Conditionals: {result['conditionals']}")
            total_conditionals += result['conditionals']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:           {files_modified}")
    print(f"  Conditionals migrated:    {total_conditionals}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
