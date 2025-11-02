#!/usr/bin/env python3
"""
🔘 Batch 21 - Migration Button bg-600/700 → Button Component
Cible les divs/buttons avec bg-*-600 et hover:bg-*-700
Exemple: bg-green-600 hover:bg-green-700 → Button variant="success"
Note: Ce sont souvent des CTA ou boutons d'action
"""

import re
from pathlib import Path

def migrate_button_600_patterns(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les patterns de boutons bg-600 avec hover 700
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    buttons_migrated = 0
    
    # Pattern 1: Boutons explicites avec bg-600 text-white hover:bg-700
    # className="... bg-green-600 text-white ... hover:bg-green-700"
    pattern1 = r'className="([^"]*?)bg-(green|red|blue|purple|orange|yellow)-600\s+text-white\s+(.*?)hover:bg-\2-700([^"]*?)"'
    
    def replace_button(match):
        nonlocal buttons_migrated
        before = match.group(1)
        color = match.group(2)
        middle = match.group(3)
        after = match.group(4)
        
        # Mapping vers Button variants
        color_map = {
            'green': 'bg-success hover:bg-success/90 text-success-foreground',
            'red': 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
            'blue': 'bg-primary hover:bg-primary/90 text-primary-foreground',
            'purple': 'bg-purple-600 hover:bg-purple-700 text-white',
            'orange': 'bg-orange-600 hover:bg-orange-700 text-white',
            'yellow': 'bg-yellow-600 hover:bg-yellow-700 text-white',
        }
        
        buttons_migrated += 1
        new_colors = color_map.get(color, f'bg-{color}-600 hover:bg-{color}-700 text-white')
        
        # Nettoyer le middle pour éviter les doublons
        middle_clean = middle.replace('text-white', '').strip()
        
        return f'className="{before}{new_colors} {middle_clean}{after}"'
    
    content = re.sub(pattern1, replace_button, content)
    
    # Pattern 2: Boutons sans hover explicite mais avec bg-600
    # className="px-4 py-2 bg-green-600 text-white rounded-md"
    pattern2 = r'className="([^"]*?)bg-(green|red|blue|purple|orange)-600\s+text-white\s+rounded(-\w+)?([^"]*?)"'
    
    def replace_simple_button(match):
        nonlocal buttons_migrated
        before = match.group(1)
        color = match.group(2)
        rounded = match.group(3) or ''
        after = match.group(4)
        
        # Éviter si déjà traité par pattern1
        if 'hover:' in after or 'hover:' in before:
            return match.group(0)
        
        color_map = {
            'green': 'bg-success hover:bg-success/90 text-success-foreground',
            'red': 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
            'blue': 'bg-primary hover:bg-primary/90 text-primary-foreground',
            'purple': 'bg-purple-600 hover:bg-purple-700 text-white',
            'orange': 'bg-orange-600 hover:bg-orange-700 text-white',
        }
        
        buttons_migrated += 1
        new_colors = color_map.get(color, f'bg-{color}-600 hover:bg-{color}-700 text-white')
        
        return f'className="{before}{new_colors} rounded{rounded}{after}"'
    
    content = re.sub(pattern2, replace_simple_button, content)
    
    # Pattern 3: Divs avec bg-600 utilisés comme boutons (peu recommandé mais existe)
    # <div className="bg-red-600 text-white px-3 py-1 rounded">
    pattern3 = r'<div\s+className="bg-(green|red|blue|purple|orange)-600\s+text-white\s+px-\d+\s+py-\d+\s+rounded'
    
    def replace_div_button(match):
        nonlocal buttons_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'bg-success text-success-foreground',
            'red': 'bg-destructive text-destructive-foreground',
            'blue': 'bg-primary text-primary-foreground',
            'purple': 'bg-purple-600 text-white',
            'orange': 'bg-orange-600 text-white',
        }
        
        buttons_migrated += 1
        new_colors = color_map.get(color, f'bg-{color}-600 text-white')
        
        return f'<div className="{new_colors} px-3 py-1 rounded'
    
    content = re.sub(pattern3, replace_div_button, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'buttons': buttons_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔘 Batch 21 - Button bg-600/700 → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_buttons = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_button_600_patterns(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Buttons: {result['buttons']}")
            total_buttons += result['buttons']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Buttons migrated:      {total_buttons}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
