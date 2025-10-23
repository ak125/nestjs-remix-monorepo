#!/usr/bin/env python3
"""
🎯 Batch 30 v2 - Paired Migrations (text-* bg-* pairs)
Migre les paires text-color-X bg-color-Y ensemble
"""

import re
from pathlib import Path

def migrate_color_pairs(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les paires text-*/bg-* ensemble
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    patterns_migrated = 0
    
    # Pattern 1: "text-red-500 bg-red-50" ou "text-red-600 bg-red-50"
    pattern1 = r'text-red-[567]00\s+bg-red-50'
    
    def replace_red_pair(match):
        nonlocal patterns_migrated
        patterns_migrated += 1
        return 'text-destructive bg-destructive/10'
    
    content = re.sub(pattern1, replace_red_pair, content)
    
    # Pattern 2: "text-green-500 bg-green-50" etc
    pattern2 = r'text-green-[567]00\s+bg-green-50'
    
    def replace_green_pair(match):
        nonlocal patterns_migrated
        patterns_migrated += 1
        return 'text-success bg-success/10'
    
    content = re.sub(pattern2, replace_green_pair, content)
    
    # Pattern 3: "text-blue-500 bg-blue-50" etc
    pattern3 = r'text-blue-[567]00\s+bg-blue-50'
    
    def replace_blue_pair(match):
        nonlocal patterns_migrated
        patterns_migrated += 1
        return 'text-primary bg-primary/10'
    
    content = re.sub(pattern3, replace_blue_pair, content)
    
    # Pattern 4: "text-yellow-500 bg-yellow-50" etc
    pattern4 = r'text-yellow-[567]00\s+bg-yellow-50'
    
    def replace_yellow_pair(match):
        nonlocal patterns_migrated
        patterns_migrated += 1
        return 'text-warning bg-warning/10'
    
    content = re.sub(pattern4, replace_yellow_pair, content)
    
    # Pattern 5: hover:bg-red-50 dans contexte text-red
    pattern5 = r'(text-red-[567]00[^"\']*?)hover:bg-red-50'
    
    def replace_red_hover(match):
        nonlocal patterns_migrated
        base = match.group(1)
        # Remplacer aussi le text-red
        base_new = re.sub(r'text-red-[567]00', 'text-destructive', base)
        patterns_migrated += 1
        return f'{base_new}hover:bg-destructive/10'
    
    content = re.sub(pattern5, replace_red_hover, content)
    
    # Pattern 6: hover:bg-blue-50 dans contexte text-blue
    pattern6 = r'(text-blue-[567]00[^"\']*?)hover:bg-blue-50'
    
    def replace_blue_hover(match):
        nonlocal patterns_migrated
        base = match.group(1)
        base_new = re.sub(r'text-blue-[567]00', 'text-primary', base)
        patterns_migrated += 1
        return f'{base_new}hover:bg-primary/10'
    
    content = re.sub(pattern6, replace_blue_hover, content)
    
    # Pattern 7: return statements "text-X-500 bg-X-50"
    # Déjà fait dans les patterns 1-4
    
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
    
    print(f"🎯 Batch 30 v2 - Paired Color Migrations\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_patterns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_color_pairs(str(filepath), dry_run=False)
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
