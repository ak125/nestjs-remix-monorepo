#!/usr/bin/env python3
"""
🔥 Batch 11 - Migration vers Button component
Cible les patterns bg-blue-600/700, bg-green-600/700, etc. dans des <button> ou className
"""

import re
from pathlib import Path

def ensure_button_import(content: str) -> str:
    """Assure que Button est importé"""
    if 'Button' in content and 'from' in content and 'ui/button' in content:
        return content
    
    # Trouver la première ligne d'import React/Remix
    import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
    
    if import_match:
        insert_pos = import_match.end()
        new_import = "\nimport { Button } from '~/components/ui/button';"
        return content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def migrate_button_patterns(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les patterns button avec bg-600/700 vers <Button variant="color">
    
    Patterns ciblés:
    1. <button className="... bg-blue-600 ... hover:bg-blue-700 ...">
    2. className="bg-blue-600 hover:bg-blue-700" (sans <button>)
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    buttons = 0
    
    # Mapper couleurs bg-600/700 vers variants Button
    color_map = {
        'blue': 'blue',
        'green': 'green',
        'red': 'red',
        'yellow': 'yellow',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern 1: <button> avec bg-color-600 et hover:bg-color-700
    # Capture: classe avant, couleur, classe après, contenu
    pattern1 = r'<button\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\2-700([^"\']*?)["\']([^>]*)>\s*([^<]+?)\s*</button>'
    
    def replace1(match):
        nonlocal buttons
        prefix_classes = match.group(1).strip()
        color = match.group(2)
        middle_classes = match.group(3).strip()
        suffix_classes = match.group(4).strip()
        extra_attrs = match.group(5).strip()
        content_text = match.group(6).strip()
        
        variant = color_map.get(color, color)
        
        # Nettoyer les classes (enlever text-white et transition-colors qui sont dans Button)
        all_classes = f"{prefix_classes} {middle_classes} {suffix_classes}".strip()
        all_classes = re.sub(r'\s+', ' ', all_classes)
        all_classes = re.sub(r'\b(text-white|transition-colors?)\b', '', all_classes).strip()
        
        # Construction du Button
        class_attr = f' className="{all_classes}"' if all_classes else ''
        attrs = f' {extra_attrs}' if extra_attrs else ''
        
        buttons += 1
        return f'<Button{class_attr} variant="{variant}"{attrs}>\\n  {content_text}\\n</Button>'
    
    content = re.sub(pattern1, replace1, content, flags=re.DOTALL)
    
    # Pattern 2: <button type="..." className="..."> avec multilignes
    pattern2 = r'<button\s+type=["\']([^"\']+)["\']\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\3-700([^"\']*?)["\']([^>]*)>\s*([^<]+?)\s*</button>'
    
    def replace2(match):
        nonlocal buttons
        button_type = match.group(1)
        prefix_classes = match.group(2).strip()
        color = match.group(3)
        middle_classes = match.group(4).strip()
        suffix_classes = match.group(5).strip()
        extra_attrs = match.group(6).strip()
        content_text = match.group(7).strip()
        
        variant = color_map.get(color, color)
        
        # Nettoyer les classes
        all_classes = f"{prefix_classes} {middle_classes} {suffix_classes}".strip()
        all_classes = re.sub(r'\s+', ' ', all_classes)
        all_classes = re.sub(r'\b(text-white|transition-colors?)\b', '', all_classes).strip()
        
        class_attr = f' className="{all_classes}"' if all_classes else ''
        attrs = f' type="{button_type}"'
        if extra_attrs:
            attrs += f' {extra_attrs}'
        
        buttons += 1
        return f'<Button{class_attr} variant="{variant}"{attrs}>\\n  {content_text}\\n</Button>'
    
    content = re.sub(pattern2, replace2, content, flags=re.DOTALL)
    
    # Pattern 3: Boutons avec disabled et onClick
    pattern3 = r'<button\s+([^>]*?)className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\3-700([^"\']*?)["\']([^>]*)>\s*([^<]+?)\s*</button>'
    
    def replace3(match):
        nonlocal buttons
        attrs_before = match.group(1).strip()
        prefix_classes = match.group(2).strip()
        color = match.group(3)
        middle_classes = match.group(4).strip()
        suffix_classes = match.group(5).strip()
        attrs_after = match.group(6).strip()
        content_text = match.group(7).strip()
        
        variant = color_map.get(color, color)
        
        # Nettoyer les classes
        all_classes = f"{prefix_classes} {middle_classes} {suffix_classes}".strip()
        all_classes = re.sub(r'\s+', ' ', all_classes)
        all_classes = re.sub(r'\b(text-white|transition-colors?)\b', '', all_classes).strip()
        
        class_attr = f' className="{all_classes}"' if all_classes else ''
        all_attrs = f' {attrs_before} {attrs_after}'.strip()
        
        buttons += 1
        return f'<Button{class_attr} variant="{variant}" {all_attrs}>\\n  {content_text}\\n</Button>'
    
    content = re.sub(pattern3, replace3, content, flags=re.DOTALL)
    
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
    
    print(f"🔥 Batch 11 - Button Component Migration\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_buttons = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_button_patterns(str(filepath), dry_run=False)
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
