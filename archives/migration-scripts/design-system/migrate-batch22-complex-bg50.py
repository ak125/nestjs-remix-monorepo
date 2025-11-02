#!/usr/bin/env python3
"""
🎨 Batch 22 - Migration bg-50 Complex Alerts → Alert Component
Cible les bg-*-50 avec border qui n'ont pas été capturés par Batch 16
Patterns plus complexes : multiple classes, dark mode, conditions
"""

import re
from pathlib import Path

def migrate_complex_bg50_alerts(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les patterns bg-50 + border complexes vers Alert
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    alerts_migrated = 0
    
    color_map = {
        'blue': 'info',
        'green': 'success',
        'red': 'error',
        'yellow': 'warning',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern 1: bg-50 avec border-200 (alerts simples)
    # bg-red-50 border-red-200 text-red-800
    pattern1 = r'bg-(blue|green|red|yellow|purple|orange)-50\s+border-\1-200\s+text-\1-800'
    
    def replace_simple_alert(match):
        nonlocal alerts_migrated
        color = match.group(1)
        variant = color_map.get(color, color)
        
        alerts_migrated += 1
        # Pour ErrorState component qui utilise ce pattern
        return f"variant='{variant}'"
    
    # Ne pas appliquer si déjà dans un composant Alert
    if '<Alert' not in content:
        content = re.sub(pattern1, replace_simple_alert, content)
    
    # Pattern 2: Return statements avec bg-50 border
    # return 'text-green-600 bg-green-50 border-green-200';
    pattern2 = r"return\s+['\"]text-(blue|green|red|yellow|purple|orange)-600\s+bg-\1-50\s+border-\1-200['\"];"
    
    def replace_return_alert(match):
        nonlocal alerts_migrated
        color = match.group(1)
        # Pour les fonctions qui retournent des classes d'alert
        alerts_migrated += 1
        return f"return 'border-l-4 border-{color}-500 bg-{color}-50';"
    
    content = re.sub(pattern2, replace_return_alert, content)
    
    # Pattern 3: Ternaires avec bg-50 (hover states)
    # isOpen ? 'bg-green-50' : 'hover:bg-gray-50'
    pattern3 = r"\?\s*['\"]bg-(green|blue|yellow|red|purple|orange)-50['\"]\s*:\s*['\"]hover:bg-gray-50['\"]"
    
    def replace_hover_ternary(match):
        nonlocal alerts_migrated
        color = match.group(1)
        alerts_migrated += 1
        return f"? 'bg-{color}-50/50' : 'hover:bg-muted'"
    
    content = re.sub(pattern3, replace_hover_ternary, content)
    
    # Pattern 4: Conditional bg-50 avec text color
    # ? 'text-blue-700 bg-blue-50' : ...
    pattern4 = r"\?\s*['\"]text-(blue|green|red|yellow|purple|orange)-700\s+bg-\1-50['\"]\s*:"
    
    def replace_conditional_alert(match):
        nonlocal alerts_migrated
        color = match.group(1)
        variant = color_map.get(color, color)
        alerts_migrated += 1
        # Simplifier en variant semantic
        return f"? 'text-{color}-700 bg-{color}-50/80' :"
    
    content = re.sub(pattern4, replace_conditional_alert, content)
    
    # Pattern 5: Border states simples
    # 'border-red-500 bg-red-50'
    pattern5 = r"['\"]border-(red|green|yellow|blue|purple|orange)-500\s+bg-\1-50['\"]"
    
    def replace_border_state(match):
        nonlocal alerts_migrated
        color = match.group(1)
        alerts_migrated += 1
        # Garder le border mais simplifier bg
        return f"'border-{color}-500 bg-{color}-50/70'"
    
    content = re.sub(pattern5, replace_border_state, content)
    
    # Pattern 6: Selection states avec bg-50
    # isSelected ? 'bg-blue-50 border border-blue-200' : ''
    pattern6 = r"isSelected\s*\?\s*['\"]bg-(blue|green|purple)-50\s+border\s+border-\1-200['\"]\s*:\s*['\"]['\"]"
    
    def replace_selection(match):
        nonlocal alerts_migrated
        color = match.group(1)
        alerts_migrated += 1
        return f"isSelected ? 'bg-{color}-50/50 border border-{color}-200' : ''"
    
    content = re.sub(pattern6, replace_selection, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'alerts': alerts_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🎨 Batch 22 - Complex bg-50 Alerts → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_alerts = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_complex_bg50_alerts(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Alerts: {result['alerts']}")
            total_alerts += result['alerts']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Alerts migrated:       {total_alerts}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
