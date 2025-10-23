#!/usr/bin/env python3
"""
🏷️ Batch 23 - Migration Small Buttons/Badges bg-100 + hover:bg-200
Cible les petits boutons/badges avec bg-*-100 hover:bg-*-200
Exemple: bg-red-100 hover:bg-red-200 text-red-800 → Badge component ready
"""

import re
from pathlib import Path

def migrate_small_buttons_hover(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les petits boutons et badges avec hover states
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    items_migrated = 0
    
    # Pattern 1: bg-100 hover:bg-200 text-800 (badges interactifs)
    # bg-red-100 hover:bg-red-200 text-red-800
    pattern1 = r'bg-(red|green|yellow|blue|purple|orange)-100\s+hover:bg-\1-200\s+text-\1-800'
    
    def replace_hover_badge(match):
        nonlocal items_migrated
        color = match.group(1)
        
        # Mapping vers Badge hover-ready
        color_map = {
            'red': 'bg-destructive/90 hover:bg-destructive text-destructive-foreground',
            'green': 'bg-success/90 hover:bg-success text-success-foreground',
            'yellow': 'bg-warning/90 hover:bg-warning text-warning-foreground',
            'blue': 'bg-info/90 hover:bg-info text-info-foreground',
            'purple': 'bg-purple-100 hover:bg-purple-200 text-purple-800',
            'orange': 'bg-orange-100 hover:bg-orange-200 text-orange-800',
        }
        
        items_migrated += 1
        return color_map.get(color, f'bg-{color}-100 hover:bg-{color}-200 text-{color}-800')
    
    content = re.sub(pattern1, replace_hover_badge, content)
    
    # Pattern 2: Buttons px-3 py-1 bg-*-100 text-*-800 rounded-full (pill buttons)
    # <button className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
    pattern2 = r'<button\s+className="px-3\s+py-1\s+bg-(blue|green|red|yellow|purple|orange)-100\s+text-\1-800\s+rounded-full'
    
    def replace_pill_button(match):
        nonlocal items_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-info/90 text-info-foreground hover:bg-info',
            'green': 'bg-success/90 text-success-foreground hover:bg-success',
            'red': 'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
            'yellow': 'bg-warning/90 text-warning-foreground hover:bg-warning',
            'purple': 'bg-purple-100 text-purple-800 hover:bg-purple-200',
            'orange': 'bg-orange-100 text-orange-800 hover:bg-orange-200',
        }
        
        items_migrated += 1
        return f'<button className="px-3 py-1 {color_map.get(color, f"bg-{color}-100 text-{color}-800")} rounded-full'
    
    content = re.sub(pattern2, replace_pill_button, content)
    
    # Pattern 3: Buttons export avec bg-*-100 text-*-700
    # bg-green-100 text-green-700 ... hover:bg-green-200
    pattern3 = r'bg-(green|blue|purple|orange)-100\s+text-\1-700\s+([^"]*?)hover:bg-\1-200'
    
    def replace_export_button(match):
        nonlocal items_migrated
        color = match.group(1)
        middle = match.group(2)
        
        color_map = {
            'green': 'bg-success/80 text-success-foreground hover:bg-success',
            'blue': 'bg-info/80 text-info-foreground hover:bg-info',
            'purple': 'bg-purple-100 text-purple-700 hover:bg-purple-200',
            'orange': 'bg-orange-100 text-orange-700 hover:bg-orange-200',
        }
        
        items_migrated += 1
        return f'{color_map.get(color, f"bg-{color}-100 text-{color}-700")} {middle}'
    
    content = re.sub(pattern3, replace_export_button, content)
    
    # Pattern 4: hover states sur bg-blue-50 (selections)
    # hover:bg-blue-50
    pattern4 = r'hover:bg-(blue|green|purple)-50(?!\w)'
    
    def replace_hover_selection(match):
        nonlocal items_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'hover:bg-info/20',
            'green': 'hover:bg-success/20',
            'purple': 'hover:bg-purple-50',
        }
        
        items_migrated += 1
        return color_map.get(color, f'hover:bg-{color}-50')
    
    content = re.sub(pattern4, replace_hover_selection, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'items': items_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🏷️ Batch 23 - Small Buttons/Badges with Hover\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_items = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_small_buttons_hover(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Items: {result['items']}")
            total_items += result['items']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Items migrated:        {total_items}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
