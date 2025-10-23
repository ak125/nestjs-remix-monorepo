#!/usr/bin/env python3
"""
🎨 Batch 24 - Migration Return Statements bg-50 → Semantic
Cible les fonctions qui retournent des classes bg-*-50
Exemple: return 'bg-red-50 border-red-500' → return 'bg-destructive/10 border-destructive'
"""

import re
from pathlib import Path

def migrate_return_bg50(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les return statements avec bg-50
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    returns_migrated = 0
    
    # Pattern 1: return avec bg-*-50 et border-*-500
    # return 'border-red-500 bg-red-50';
    pattern1 = r"return\s+['\"](?:border-(red|green|yellow|blue|purple|orange)-\d+\s+)?bg-(red|green|yellow|blue|purple|orange)-50(?:\s+border-\2-\d+)?['\"];"
    
    def replace_return_bg50(match):
        nonlocal returns_migrated
        border_color = match.group(1)
        bg_color = match.group(2)
        
        # Utiliser la couleur de border si présente, sinon bg
        color = border_color if border_color else bg_color
        
        color_map = {
            'red': 'bg-destructive/10 border-destructive',
            'green': 'bg-success/10 border-success',
            'yellow': 'bg-warning/10 border-warning',
            'blue': 'bg-info/10 border-info',
            'purple': 'bg-purple-50 border-purple-500',
            'orange': 'bg-orange-50 border-orange-500',
        }
        
        returns_migrated += 1
        return f"return '{color_map.get(color, f'bg-{color}-50 border-{color}-500')}';"
    
    content = re.sub(pattern1, replace_return_bg50, content)
    
    # Pattern 2: return avec text-*-600 bg-*-50 border-*-200
    # return 'text-green-600 bg-green-50 border-green-200';
    pattern2 = r"return\s+['\"]text-(red|green|yellow|blue|purple|orange)-\d+\s+bg-\1-50\s+border-\1-\d+['\"];"
    
    def replace_return_full(match):
        nonlocal returns_migrated
        color = match.group(1)
        
        color_map = {
            'red': 'text-destructive bg-destructive/10 border-destructive',
            'green': 'text-success bg-success/10 border-success',
            'yellow': 'text-warning bg-warning/10 border-warning',
            'blue': 'text-info bg-info/10 border-info',
            'purple': 'text-purple-600 bg-purple-50 border-purple-200',
            'orange': 'text-orange-600 bg-orange-50 border-orange-200',
        }
        
        returns_migrated += 1
        return f"return '{color_map.get(color, f'text-{color}-600 bg-{color}-50 border-{color}-200')}';"
    
    content = re.sub(pattern2, replace_return_full, content)
    
    # Pattern 3: Ternaires avec ? 'bg-*-50' : 'bg-*-50'
    # severity === 'high' ? 'bg-red-50' : 'bg-blue-50'
    pattern3 = r"\?\s*['\"]bg-(red|green|yellow|blue|purple|orange)-50['\"]\s*:\s*['\"]bg-(red|green|yellow|blue|purple|orange)-50['\"]"
    
    def replace_ternary_bg50(match):
        nonlocal returns_migrated
        color1 = match.group(1)
        color2 = match.group(2)
        
        color_map = {
            'red': 'bg-destructive/10',
            'green': 'bg-success/10',
            'yellow': 'bg-warning/10',
            'blue': 'bg-info/10',
            'purple': 'bg-purple-50',
            'orange': 'bg-orange-50',
        }
        
        returns_migrated += 1
        return f"? '{color_map.get(color1, f'bg-{color1}-50')}' : '{color_map.get(color2, f'bg-{color2}-50')}'"
    
    content = re.sub(pattern3, replace_ternary_bg50, content)
    
    # Pattern 4: Case statements retournant bg-50
    # case 'error': return 'bg-red-50';
    pattern4 = r"case\s+['\"](\w+)['\"]\s*:\s*return\s+['\"]bg-(red|green|yellow|blue|purple|orange)-50['\"];"
    
    def replace_case_return(match):
        nonlocal returns_migrated
        case_val = match.group(1)
        color = match.group(2)
        
        color_map = {
            'red': 'bg-destructive/10',
            'green': 'bg-success/10',
            'yellow': 'bg-warning/10',
            'blue': 'bg-info/10',
            'purple': 'bg-purple-50',
            'orange': 'bg-orange-50',
        }
        
        returns_migrated += 1
        return f"case '{case_val}': return '{color_map.get(color, f'bg-{color}-50')}';"
    
    content = re.sub(pattern4, replace_case_return, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'returns': returns_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🎨 Batch 24 - Return Statements bg-50 → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_returns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_return_bg50(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Returns: {result['returns']}")
            total_returns += result['returns']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Returns migrated:      {total_returns}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
