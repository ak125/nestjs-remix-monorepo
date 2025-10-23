#!/usr/bin/env python3
"""
🔥 Batch 13 - Migration Buttons Multilignes
Gère les buttons avec JSX enfants, icons, etc.
"""

import re
from pathlib import Path

def ensure_button_import(content: str) -> str:
    """Assure que Button est importé"""
    if 'Button' in content and 'ui/button' in content:
        return content
    
    import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
    if import_match:
        insert_pos = import_match.end()
        new_import = "\nimport { Button } from '~/components/ui/button';"
        return content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def migrate_multiline_buttons(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les buttons multilignes avec contenu complexe
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    buttons = 0
    
    color_map = {
        'blue': 'blue',
        'green': 'green',
        'red': 'red',
        'yellow': 'yellow',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern: <button avec bg-600 et hover:bg-700 (capture jusqu'au </button>)
    # Utilise .*? pour capture non-greedy du contenu
    pattern = r'<button\s+([^>]*?)className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\3-700([^"\']*?)["\']([^>]*)>(.*?)</button>'
    
    def replace_button(match):
        nonlocal buttons
        before_attrs = match.group(1).strip()
        before_class = match.group(2).strip()
        color = match.group(3)
        middle_class = match.group(4).strip()
        after_class = match.group(5).strip()
        after_attrs = match.group(6).strip()
        inner_content = match.group(7)
        
        # Nettoyer les classes
        classes = f"{before_class} {middle_class} {after_class}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        # Supprimer les classes déjà dans Button
        classes = re.sub(r'\b(bg-\w+-\d+|hover:bg-\w+-\d+|text-white|transition-colors?|font-medium)\b', '', classes).strip()
        
        variant = color_map.get(color, color)
        
        # Construire les attributs
        all_attrs = f'{before_attrs} {after_attrs}'.strip()
        
        class_attr = f' className="{classes}"' if classes else ''
        attrs_str = f' {all_attrs}' if all_attrs else ''
        
        buttons += 1
        return f'<Button{class_attr} variant="{variant}"{attrs_str}>{inner_content}</Button>'
    
    content = re.sub(pattern, replace_button, content, flags=re.DOTALL)
    
    if buttons > 0:
        content = ensure_button_import(content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {'buttons': buttons, 'modified': content != original}

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 13 - Multiline Button Migration\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_buttons = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_multiline_buttons(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Buttons: {result['buttons']}")
            total_buttons += result['buttons']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:    {files_modified}")
    print(f"  Buttons migrated:  {total_buttons}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
