#!/usr/bin/env python3
"""
🎯 Batch 29 - Purple & Orange + Intermediate Colors (Target 95%)
Migre les bg-purple-*, bg-orange-* et couleurs intermédiaires restantes
"""

import re
from pathlib import Path

def migrate_purple_orange(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre purple, orange et couleurs intermédiaires
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    patterns_migrated = 0
    
    # Pattern 1: bg-purple-* (conserver telles quelles, pas de semantic)
    # Purple reste purple mais on peut nettoyer les variants
    
    # Pattern 2: bg-orange-* (conserver telles quelles)
    # Orange reste orange
    
    # Pattern 3: bg-*-200 (couleurs intermédiaires claires)
    pattern3 = r'\bbg-(blue|green|red|yellow)-200\b'
    
    def replace_bg200(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-primary/30',
            'green': 'bg-success/30',
            'red': 'bg-destructive/30',
            'yellow': 'bg-warning/30',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-200')
    
    content = re.sub(pattern3, replace_bg200, content)
    
    # Pattern 4: bg-*-400 (couleurs intermédiaires moyennes)
    pattern4 = r'\bbg-(blue|green|red|yellow)-400\b'
    
    def replace_bg400(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-primary/60',
            'green': 'bg-success/60',
            'red': 'bg-destructive/60',
            'yellow': 'bg-warning/60',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-400')
    
    content = re.sub(pattern4, replace_bg400, content)
    
    # Pattern 5: bg-*-800 (couleurs très sombres)
    pattern5 = r'\bbg-(blue|green|red)-800\b'
    
    def replace_bg800(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-primary/95',
            'green': 'bg-success/95',
            'red': 'bg-destructive/95',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-800')
    
    content = re.sub(pattern5, replace_bg800, content)
    
    # Pattern 6: bg-*-900 (couleurs ultra-sombres)
    pattern6 = r'\bbg-(blue|green)-900\b'
    
    def replace_bg900(match):
        nonlocal patterns_migrated
        color = match.group(1)
        
        color_map = {
            'blue': 'bg-primary/98',
            'green': 'bg-success/98',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-900')
    
    content = re.sub(pattern6, replace_bg900, content)
    
    # Pattern 7: Derniers bg-50 restants (avec contexte smart)
    pattern7 = r'\bbg-(red|yellow|blue)-50\b'
    
    def replace_bg50_remaining(match):
        nonlocal patterns_migrated
        color = match.group(1)
        full_match = match.group(0)
        
        # Vérifier contexte
        start_pos = max(0, match.start() - 40)
        context_before = content[start_pos:match.start()]
        
        # Si on trouve "text-{color}-" juste avant, on skip
        if f'text-{color}-' in context_before:
            return full_match
        
        color_map = {
            'red': 'bg-destructive/5',
            'yellow': 'bg-warning/5',
            'blue': 'bg-primary/5',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-50')
    
    content = re.sub(pattern7, replace_bg50_remaining, content)
    
    # Pattern 8: Derniers bg-100 restants
    pattern8 = r'\bbg-(red|yellow)-100\b'
    
    def replace_bg100_remaining(match):
        nonlocal patterns_migrated
        color = match.group(1)
        full_match = match.group(0)
        
        # Vérifier contexte
        start_pos = max(0, match.start() - 40)
        context_before = content[start_pos:match.start()]
        
        if f'text-{color}-' in context_before:
            return full_match
        
        color_map = {
            'red': 'bg-destructive/15',
            'yellow': 'bg-warning/15',
        }
        
        patterns_migrated += 1
        return color_map.get(color, f'bg-{color}-100')
    
    content = re.sub(pattern8, replace_bg100_remaining, content)
    
    # Pattern 9: bg-blue-600 restants (derniers)
    pattern9 = r'\bbg-blue-600\b'
    
    def replace_blue600_final(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        # Vérifier si c'est un hover: ou group-hover:
        start_pos = max(0, match.start() - 15)
        context_before = content[start_pos:match.start()]
        
        if 'hover:' in context_before or 'group-hover:' in context_before:
            return full_match  # Laissé pour contexte hover complexe
        
        patterns_migrated += 1
        return 'bg-primary'
    
    content = re.sub(pattern9, replace_blue600_final, content)
    
    # Pattern 10: bg-green-100 restants
    pattern10 = r'\bbg-green-100\b'
    
    def replace_green100_final(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 40)
        context_before = content[start_pos:match.start()]
        
        if 'text-green-' in context_before:
            return full_match
        
        patterns_migrated += 1
        return 'bg-success/15'
    
    content = re.sub(pattern10, replace_green100_final, content)
    
    # Pattern 11: bg-gray-300 (le seul gray!)
    pattern11 = r'\bbg-gray-300\b'
    
    def replace_gray300(match):
        nonlocal patterns_migrated
        patterns_migrated += 1
        return 'bg-muted/50'
    
    content = re.sub(pattern11, replace_gray300, content)
    
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
    
    print(f"🎯 Batch 29 - Purple & Orange + Intermediate Colors\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_patterns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_purple_orange(str(filepath), dry_run=False)
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
