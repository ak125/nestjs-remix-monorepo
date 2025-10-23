#!/usr/bin/env python3
"""
🔵 Batch 27 - Migration bg-blue-600 Buttons → Primary
Cible les bg-blue-600 utilisés comme boutons/backgrounds primaires
Exemple: bg-blue-600 hover:bg-blue-700 → bg-primary hover:bg-primary/90
"""

import re
from pathlib import Path

def migrate_blue600(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les bg-blue-600 vers bg-primary
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    blue600_migrated = 0
    
    # Pattern 1: bg-blue-600 hover:bg-blue-700 text-white (boutons)
    pattern1 = r'bg-blue-600\s+hover:bg-blue-700\s+text-white'
    
    def replace_button(match):
        nonlocal blue600_migrated
        blue600_migrated += 1
        return 'bg-primary hover:bg-primary/90 text-primary-foreground'
    
    content = re.sub(pattern1, replace_button, content)
    
    # Pattern 2: bg-blue-600 text-white (sans hover)
    pattern2 = r'bg-blue-600\s+text-white'
    
    def replace_simple(match):
        nonlocal blue600_migrated
        blue600_migrated += 1
        return 'bg-primary text-primary-foreground'
    
    content = re.sub(pattern2, replace_simple, content)
    
    # Pattern 3: Ternaires avec bg-blue-600
    # ? 'bg-blue-600 text-white' : 'bg-white'
    pattern3 = r"\?\s+['\"]bg-blue-600\s+text-white['\"]"
    
    def replace_ternary(match):
        nonlocal blue600_migrated
        blue600_migrated += 1
        return "? 'bg-primary text-primary-foreground'"
    
    content = re.sub(pattern3, replace_ternary, content)
    
    # Pattern 4: Petits éléments w-X h-X bg-blue-600
    # w-8 h-8 bg-blue-600 rounded-full
    pattern4 = r'w-(\d+)\s+h-\1\s+bg-blue-600\s+rounded-full'
    
    def replace_circle(match):
        nonlocal blue600_migrated
        size = match.group(1)
        blue600_migrated += 1
        return f'w-{size} h-{size} bg-primary rounded-full'
    
    content = re.sub(pattern4, replace_circle, content)
    
    # Pattern 5: bg-blue-600/95 ou bg-blue-600/90 (avec opacité)
    pattern5 = r'bg-blue-600/\d+'
    
    def replace_opacity(match):
        nonlocal blue600_migrated
        blue600_migrated += 1
        return 'bg-primary/95'
    
    content = re.sub(pattern5, replace_opacity, content)
    
    # Pattern 6: return statements
    # return "bg-blue-600 hover:bg-blue-700 text-white";
    pattern6 = r'(return\s+["\'])bg-blue-600\s+hover:bg-blue-700\s+text-white(["\'];)'
    
    def replace_return(match):
        nonlocal blue600_migrated
        before = match.group(1)
        after = match.group(2)
        blue600_migrated += 1
        return f'{before}bg-primary hover:bg-primary/90 text-primary-foreground{after}'
    
    content = re.sub(pattern6, replace_return, content)
    
    # Pattern 7: group-hover:bg-blue-700
    pattern7 = r'group-hover:bg-blue-700'
    
    def replace_group_hover(match):
        nonlocal blue600_migrated
        blue600_migrated += 1
        return 'group-hover:bg-primary/90'
    
    content = re.sub(pattern7, replace_group_hover, content)
    
    # Pattern 8: bg-blue-600 dans divs/spans (sans text-white déjà traité)
    # Cible les backgrounds seuls
    pattern8 = r'(\s)bg-blue-600(\s)'
    
    def replace_bg_only(match):
        nonlocal blue600_migrated
        before = match.group(1)
        after = match.group(2)
        blue600_migrated += 1
        return f'{before}bg-primary{after}'
    
    content = re.sub(pattern8, replace_bg_only, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'blue600': blue600_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔵 Batch 27 - bg-blue-600 → Primary\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_blue600 = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_blue600(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   bg-blue-600: {result['blue600']}")
            total_blue600 += result['blue600']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  bg-blue-600 migrated:  {total_blue600}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
