#!/usr/bin/env python3
"""
✨ Batch 25 - Migration Simple bg-100 → Semantic
Cible les bg-*-100 utilisés comme backgrounds simples
Exemple: bg-green-100 text-green-800 → bg-success/20 text-success
"""

import re
from pathlib import Path

def migrate_simple_bg100(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les bg-100 simples avec text-800
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    bg100_migrated = 0
    
    # Pattern 1: bg-*-100 text-*-800 (sans border)
    # bg-green-100 text-green-800
    pattern1 = r'bg-(green|blue|red|yellow|purple|orange)-100\s+text-\1-800'
    
    def replace_bg100(match):
        nonlocal bg100_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'bg-success/20 text-success',
            'blue': 'bg-info/20 text-info',
            'red': 'bg-destructive/20 text-destructive',
            'yellow': 'bg-warning/20 text-warning',
            'purple': 'bg-purple-100 text-purple-800',
            'orange': 'bg-orange-100 text-orange-800',
        }
        
        bg100_migrated += 1
        return color_map.get(color, f'bg-{color}-100 text-{color}-800')
    
    content = re.sub(pattern1, replace_bg100, content)
    
    # Pattern 2: text-*-700 bg-*-50 (variante avec text-700)
    # text-green-700 bg-green-50
    pattern2 = r'text-(green|blue|red|yellow|purple|orange)-700\s+bg-\1-50'
    
    def replace_text700(match):
        nonlocal bg100_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'text-success bg-success/10',
            'blue': 'text-info bg-info/10',
            'red': 'text-destructive bg-destructive/10',
            'yellow': 'text-warning bg-warning/10',
            'purple': 'text-purple-700 bg-purple-50',
            'orange': 'text-orange-700 bg-orange-50',
        }
        
        bg100_migrated += 1
        return color_map.get(color, f'text-{color}-700 bg-{color}-50')
    
    content = re.sub(pattern2, replace_text700, content)
    
    # Pattern 3: px-X py-X bg-*-100 text-*-700/800 rounded (inline badges)
    # px-3 py-1 bg-green-100 text-green-700 rounded
    pattern3 = r'px-\d+\s+py-\d+\s+bg-(green|blue|red|yellow|purple|orange)-100\s+text-\1-[78]00\s+rounded'
    
    def replace_inline_badge(match):
        nonlocal bg100_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'px-3 py-1 bg-success/20 text-success rounded',
            'blue': 'px-3 py-1 bg-info/20 text-info rounded',
            'red': 'px-3 py-1 bg-destructive/20 text-destructive rounded',
            'yellow': 'px-3 py-1 bg-warning/20 text-warning rounded',
            'purple': 'px-3 py-1 bg-purple-100 text-purple-700 rounded',
            'orange': 'px-3 py-1 bg-orange-100 text-orange-700 rounded',
        }
        
        bg100_migrated += 1
        return color_map.get(color, f'px-3 py-1 bg-{color}-100 text-{color}-700 rounded')
    
    content = re.sub(pattern3, replace_inline_badge, content)
    
    # Pattern 4: hover:bg-*-100 (hover states)
    # hover:bg-green-100
    pattern4 = r'hover:bg-(green|blue|red|yellow|purple|orange)-100'
    
    def replace_hover(match):
        nonlocal bg100_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'hover:bg-success/20',
            'blue': 'hover:bg-info/20',
            'red': 'hover:bg-destructive/20',
            'yellow': 'hover:bg-warning/20',
            'purple': 'hover:bg-purple-100',
            'orange': 'hover:bg-orange-100',
        }
        
        bg100_migrated += 1
        return color_map.get(color, f'hover:bg-{color}-100')
    
    content = re.sub(pattern4, replace_hover, content)
    
    # Pattern 5: Petits spans avec bg-100 (inline tags)
    # <span className="bg-blue-100 text-blue-800">
    pattern5 = r'<span\s+className="bg-(green|blue|red|yellow|purple|orange)-100\s+text-\1-800'
    
    def replace_span(match):
        nonlocal bg100_migrated
        color = match.group(1)
        
        color_map = {
            'green': '<span className="bg-success/20 text-success',
            'blue': '<span className="bg-info/20 text-info',
            'red': '<span className="bg-destructive/20 text-destructive',
            'yellow': '<span className="bg-warning/20 text-warning',
            'purple': '<span className="bg-purple-100 text-purple-800',
            'orange': '<span className="bg-orange-100 text-orange-800',
        }
        
        bg100_migrated += 1
        return color_map.get(color, f'<span className="bg-{color}-100 text-{color}-800')
    
    content = re.sub(pattern5, replace_span, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'bg100': bg100_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"✨ Batch 25 - Simple bg-100 → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_bg100 = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_simple_bg100(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   bg-100: {result['bg100']}")
            total_bg100 += result['bg100']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  bg-100 migrated:       {total_bg100}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
