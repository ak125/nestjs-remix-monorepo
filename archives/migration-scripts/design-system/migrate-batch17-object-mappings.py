#!/usr/bin/env python3
"""
🔥 Batch 17 - Migration Object Mappings → Badge Variants
Cible les objets qui mappent des valeurs vers des classes bg-*
Exemple: { 1: 'bg-yellow-100 text-yellow-800', 2: 'bg-red-100 text-red-800' }
       → { 1: 'warning', 2: 'error' }
"""

import re
from pathlib import Path

def migrate_object_mappings(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les object mappings qui contiennent des classes de couleur
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    mappings_migrated = 0
    
    color_map = {
        'red': 'error',
        'green': 'success',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern 1: Object property avec bg-color-100 text-color-800
    # Ex: 1: 'bg-yellow-100 text-yellow-800',
    pattern1 = r"(\s+)(\w+):\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\3-800['\"],?"
    
    def replace_mapping(match):
        nonlocal mappings_migrated
        indent = match.group(1)
        key = match.group(2)
        color = match.group(3)
        
        variant = color_map.get(color, color)
        mappings_migrated += 1
        
        return f"{indent}{key}: '{variant}',"
    
    content = re.sub(pattern1, replace_mapping, content)
    
    # Pattern 2: Dans les objets TypeScript avec types
    # red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    pattern2 = r"(\s+)(\w+):\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\3-800[^'\"]*['\"],?"
    
    def replace_mapping_complex(match):
        nonlocal mappings_migrated
        indent = match.group(1)
        key = match.group(2)
        color = match.group(3)
        
        variant = color_map.get(color, color)
        mappings_migrated += 1
        
        return f"{indent}{key}: '{variant}',"
    
    content = re.sub(pattern2, replace_mapping_complex, content)
    
    # Pattern 3: return statements dans switch/if
    # return 'bg-yellow-100 text-yellow-800';
    pattern3 = r"return\s+['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\1-800['\"];"
    
    def replace_return(match):
        nonlocal mappings_migrated
        color = match.group(1)
        
        variant = color_map.get(color, color)
        mappings_migrated += 1
        
        return f"return '{variant}';"
    
    content = re.sub(pattern3, replace_return, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'mappings': mappings_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 17 - Object Mappings → Variants\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_mappings = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_object_mappings(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Mappings: {result['mappings']}")
            total_mappings += result['mappings']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Mappings migrated:     {total_mappings}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
