#!/usr/bin/env python3
"""
🎨 Batch 19 - Migration Icon Containers bg-50 → Styled divs
Cible les divs bg-*-50 qui contiennent des icônes/contenu simple
Exemple: <div className="bg-blue-50 p-3 rounded-lg">
       → <div className="bg-muted p-3 rounded-lg"> (ou conservé selon contexte)
       
Note: Pour l'instant on cible les patterns simples et évidents
"""

import re
from pathlib import Path

def migrate_icon_containers(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les icon containers avec bg-50
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    containers_migrated = 0
    
    # Pattern 1: Divs simples avec bg-*-50 p-3 rounded-lg (souvent pour icônes)
    # <div className="bg-blue-50 p-3 rounded-lg">
    pattern1 = r'<div\s+className="bg-(blue|green|yellow|red|purple|orange)-50\s+p-3\s+rounded-lg">'
    
    def replace_container(match):
        nonlocal containers_migrated
        color = match.group(1)
        containers_migrated += 1
        
        # Mapping contextuel
        if color in ['blue', 'purple']:
            return '<div className="bg-muted p-3 rounded-lg">'
        elif color == 'green':
            return '<div className="bg-success/10 p-3 rounded-lg">'
        elif color == 'yellow':
            return '<div className="bg-warning/10 p-3 rounded-lg">'
        elif color == 'red':
            return '<div className="bg-destructive/10 p-3 rounded-lg">'
        else:
            return '<div className="bg-muted p-3 rounded-lg">'
    
    content = re.sub(pattern1, replace_container, content)
    
    # Pattern 2: Divs avec bg-*-100 p-X rounded (sans border)
    # <div className="bg-blue-100 rounded-lg flex items-center">
    pattern2 = r'<div\s+className="(.*?)bg-(blue|green|yellow|red|purple|orange)-100(.*?)rounded'
    
    def replace_100_container(match):
        nonlocal containers_migrated
        before = match.group(1)
        color = match.group(2)
        after = match.group(3)
        
        # Vérifier si c'est vraiment un container (pas un badge)
        if 'text-' + color not in after and 'text-' + color not in before:
            containers_migrated += 1
            
            # Mapping contextuel
            if color in ['blue', 'purple']:
                return f'<div className="{before}bg-muted{after}rounded'
            elif color == 'green':
                return f'<div className="{before}bg-success/10{after}rounded'
            elif color == 'yellow':
                return f'<div className="{before}bg-warning/10{after}rounded'
            elif color == 'red':
                return f'<div className="{before}bg-destructive/10{after}rounded'
            else:
                return f'<div className="{before}bg-muted{after}rounded'
        
        return match.group(0)  # Pas touché si c'est un badge
    
    content = re.sub(pattern2, replace_100_container, content)
    
    # Pattern 3: Divs simples w-X h-X bg-*-100 (icônes carrés)
    # <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
    pattern3 = r'<div\s+className="w-(\d+)\s+h-\1\s+bg-(blue|green|yellow|red|purple|orange)-100\s+rounded'
    
    def replace_square_icon(match):
        nonlocal containers_migrated
        size = match.group(1)
        color = match.group(2)
        containers_migrated += 1
        
        # Mapping contextuel pour icônes
        if color in ['blue', 'purple']:
            return f'<div className="w-{size} h-{size} bg-muted rounded'
        elif color == 'green':
            return f'<div className="w-{size} h-{size} bg-success/10 rounded'
        elif color == 'yellow':
            return f'<div className="w-{size} h-{size} bg-warning/10 rounded'
        elif color == 'red':
            return f'<div className="w-{size} h-{size} bg-destructive/10 rounded'
        else:
            return f'<div className="w-{size} h-{size} bg-muted rounded'
    
    content = re.sub(pattern3, replace_square_icon, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'containers': containers_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🎨 Batch 19 - Icon Containers bg-50/100 → Muted/Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_containers = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_icon_containers(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Containers: {result['containers']}")
            total_containers += result['containers']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:          {files_modified}")
    print(f"  Containers migrated:     {total_containers}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
