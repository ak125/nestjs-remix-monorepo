#!/usr/bin/env python3
"""
💎 Batch 20 - Migration bg-500 Pills/Badges → Component props
Cible les bg-*-500 utilisés comme badges/pills colorés
Exemple: bg-green-500 text-white → Badge variant + className
Note: Patterns bg-500 sont souvent des status pills ou indicateurs
"""

import re
from pathlib import Path

def migrate_bg500_patterns(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les patterns bg-500 utilisés comme badges
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    patterns_migrated = 0
    
    # Pattern 1: Petits spans/divs ronds avec bg-500 (pills/badges)
    # <span className="bg-green-500 text-white ... rounded-full">
    pattern1 = r'<(span|div)\s+className="bg-(green|red|yellow|blue|purple|orange)-500\s+text-white\s+(.*?)rounded-full(.*?)">'
    
    def replace_pill(match):
        nonlocal patterns_migrated
        tag = match.group(1)
        color = match.group(2)
        before = match.group(3)
        after = match.group(4)
        
        # Mapping vers Badge-like styling
        color_map = {
            'green': 'bg-success text-success-foreground',
            'red': 'bg-destructive text-destructive-foreground',
            'yellow': 'bg-warning text-warning-foreground',
        'blue': 'bg-info text-info-foreground',
            'purple': 'bg-purple-600 text-white',
            'orange': 'bg-orange-600 text-white',
        }
        
        patterns_migrated += 1
        new_class = color_map.get(color, f'bg-{color}-600 text-white')
        return f'<{tag} className="{new_class} {before}rounded-full{after}">'
    
    content = re.sub(pattern1, replace_pill, content)
    
    # Pattern 2: Petits éléments carrés (w-X h-X) avec bg-500
    # <div className="w-2 h-2 bg-green-500 rounded-full">
    pattern2 = r'<div\s+className="w-(\d+)\s+h-\1\s+bg-(green|red|yellow|blue|purple|orange)-500\s+rounded-full'
    
    def replace_dot(match):
        nonlocal patterns_migrated
        size = match.group(1)
        color = match.group(2)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
            'blue': 'bg-info',
            'purple': 'bg-purple-600',
            'orange': 'bg-orange-600',
        }
        
        patterns_migrated += 1
        new_color = color_map.get(color, f'bg-{color}-600')
        return f'<div className="w-{size} h-{size} {new_color} rounded-full'
    
    content = re.sub(pattern2, replace_dot, content)
    
    # Pattern 3: Return statements avec bg-500
    # return 'bg-green-500 text-white';
    pattern3 = r"return\s+['\"]bg-(green|red|yellow|blue|purple|orange)-500\s+text-white['\"];"
    
    def replace_return(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'bg-success text-success-foreground',
            'red': 'bg-destructive text-destructive-foreground',
            'yellow': 'bg-warning text-warning-foreground',
            'blue': 'bg-info text-info-foreground',
            'purple': 'bg-purple-600 text-white',
            'orange': 'bg-orange-600 text-white',
        }
        
        patterns_migrated += 1
        return f"return '{color_map.get(color, f'bg-{color}-600 text-white')}';"
    
    content = re.sub(pattern3, replace_return, content)
    
    # Pattern 4: Ternaires avec bg-500
    # ? 'bg-green-500' : 'bg-yellow-500'
    pattern4 = r"\?\s*['\"]bg-(green|red|yellow|blue|purple|orange)-500['\"]\s*:\s*['\"]bg-(green|red|yellow|blue|purple|orange)-500['\"]"
    
    def replace_ternary(match):
        nonlocal patterns_migrated
        color1 = match.group(1)
        color2 = match.group(2)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
            'blue': 'bg-info',
            'purple': 'bg-purple-600',
            'orange': 'bg-orange-600',
        }
        
        patterns_migrated += 1
        new_color1 = color_map.get(color1, f'bg-{color1}-600')
        new_color2 = color_map.get(color2, f'bg-{color2}-600')
        return f"? '{new_color1}' : '{new_color2}'"
    
    content = re.sub(pattern4, replace_ternary, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'patterns': patterns_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"💎 Batch 20 - bg-500 Pills/Badges → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_patterns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_bg500_patterns(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Patterns: {result['patterns']}")
            total_patterns += result['patterns']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Patterns migrated:     {total_patterns}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
