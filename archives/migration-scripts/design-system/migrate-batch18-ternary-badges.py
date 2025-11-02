#!/usr/bin/env python3
"""
🎯 Batch 18 - Migration Ternaires Conditionnels → Badge
Cible les ternaires qui retournent des classes bg-*-100 text-*-800
Exemple: condition ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
       → condition ? 'success' : 'error'
"""

import re
from pathlib import Path

def migrate_ternary_badges(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les ternaires qui retournent des classes badge-like
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    ternaries_migrated = 0
    
    color_map = {
        'red': 'error',
        'green': 'success',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern 1: Ternaire simple dans className
    # ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    pattern1 = r"\?\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\1-800['\"]\s*:\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\2-800['\"]"
    
    def replace_ternary(match):
        nonlocal ternaries_migrated
        color1 = match.group(1)
        color2 = match.group(2)
        
        variant1 = color_map.get(color1, color1)
        variant2 = color_map.get(color2, color2)
        
        ternaries_migrated += 1
        return f"? '{variant1}' : '{variant2}'"
    
    content = re.sub(pattern1, replace_ternary, content)
    
    # Pattern 2: Ternaire avec métrique (delivered, shipped, etc.)
    # order.status === 'delivered' ? 'bg-green-100 text-green-800' :
    pattern2 = r"===\s*['\"](\w+)['\"]\s*\?\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\2-800['\"]\s*:"
    
    def replace_status_ternary(match):
        nonlocal ternaries_migrated
        status = match.group(1)
        color = match.group(2)
        
        variant = color_map.get(color, color)
        ternaries_migrated += 1
        
        return f"=== '{status}' ? '{variant}' :"
    
    content = re.sub(pattern2, replace_status_ternary, content)
    
    # Pattern 3: Ternaires avec condition négative
    # !condition ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
    pattern3 = r"!\w+\s*\?\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\1-800['\"]\s*:\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\2-800['\"]"
    
    content = re.sub(pattern3, lambda m: f"!condition ? '{color_map.get(m.group(1), m.group(1))}' : '{color_map.get(m.group(2), m.group(2))}'", content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'ternaries': ternaries_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🎯 Batch 18 - Ternary Badges → Variants\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_ternaries = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_ternary_badges(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Ternaries: {result['ternaries']}")
            total_ternaries += result['ternaries']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Ternaries migrated:    {total_ternaries}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
