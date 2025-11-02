#!/usr/bin/env python3
"""
🎯 Batch 28 - Final Push to 80% (bg-50 + bg-700)
Cible les bg-50 simples et bg-700 pour franchir les 80%
Exemple: bg-blue-50 → bg-primary/5
        bg-blue-700 → bg-primary/90
"""

import re
from pathlib import Path

def migrate_final_push(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les bg-50 et bg-700 simples restants
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    patterns_migrated = 0
    
    # Pattern 1: bg-*-50 simple (pas dans des paires text-* bg-*)
    # On cherche bg-50 suivi d'espace ou guillemet (fin de classe)
    pattern1 = r'\bbg-(blue|green|red|yellow|purple|orange)-50\b'
    
    def replace_bg50_smart(match):
        nonlocal patterns_migrated
        color = match.group(1)
        full_match = match.group(0)
        
        # Vérifier si c'est dans une paire "text-X-... bg-X-50"
        # On regarde 30 caractères avant
        start_pos = max(0, match.start() - 30)
        context_before = content[start_pos:match.start()]
        
        # Si on trouve "text-{color}-" juste avant, on skip
        if f'text-{color}-' in context_before:
            return full_match  # Pas de changement
        
        color_map = {
            'blue': 'bg-primary/5',
            'green': 'bg-success/5',
            'red': 'bg-destructive/5',
            'yellow': 'bg-warning/5',
            'purple': 'bg-purple-50',
            'orange': 'bg-orange-50',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-50')
    
    content = re.sub(pattern1, replace_bg50_smart, content)
    
    # Pattern 2: bg-*-700 (hover states, dark backgrounds)
    pattern2 = r'\bbg-(blue|green|red|yellow|purple|orange)-700\b'
    
    def replace_bg700(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-primary/90',
            'green': 'bg-success/90',
            'red': 'bg-destructive/90',
            'yellow': 'bg-warning/90',
            'purple': 'bg-purple-700',
            'orange': 'bg-orange-700',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-700')
    
    content = re.sub(pattern2, replace_bg700, content)
    
    # Pattern 3: bg-*-500 standalone (badges/pills restants)
    pattern3 = r'\bbg-(green|blue|red|yellow)-500\b'
    
    def replace_bg500_standalone(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'bg-success',
            'blue': 'bg-primary',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-500')
    
    content = re.sub(pattern3, replace_bg500_standalone, content)
    
    # Pattern 4: bg-*-600 restants (non traités par batch 27)
    pattern4 = r'\bbg-(green|red|yellow)-600\b'
    
    def replace_bg600_remaining(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-600')
    
    content = re.sub(pattern4, replace_bg600_remaining, content)
    
    # Pattern 5: bg-*-100 restants (non capturés précédemment)
    pattern5 = r'\bbg-(blue|green)-100\b'
    
    def replace_bg100_smart(match):
        nonlocal patterns_migrated
        color = match.group(1)
        full_match = match.group(0)
        
        # Vérifier contexte
        start_pos = max(0, match.start() - 30)
        context_before = content[start_pos:match.start()]
        
        # Si on trouve "text-{color}-" juste avant, on skip
        if f'text-{color}-' in context_before:
            return full_match
        
        color_map = {
            'blue': 'bg-primary/15',
            'green': 'bg-success/15',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-100')
    
    content = re.sub(pattern5, replace_bg100_smart, content)
    
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
    
    print(f"🎯 Batch 28 - Final Push to 80%\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_patterns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_final_push(str(filepath), dry_run=False)
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
