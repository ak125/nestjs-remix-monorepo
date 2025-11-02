#!/usr/bin/env python3
"""
🔥 Batch 12 - Migration Avancée Button/Link
Cible les patterns bg-600/700 dans <button>, <Link>, className inline
"""

import re
from pathlib import Path

def ensure_imports(content: str) -> str:
    """Assure que Button est importé"""
    has_button = 'Button' in content and 'ui/button' in content
    
    if not has_button:
        import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
        if import_match:
            insert_pos = import_match.end()
            new_import = "\nimport { Button } from '~/components/ui/button';"
            content = content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def migrate_buttons_advanced(filepath: str, dry_run: bool = True) -> dict:
    """Migre les patterns button/Link avancés"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    buttons_migrated = 0
    links_migrated = 0
    
    color_map = {
        'blue': 'blue',
        'green': 'green', 
        'red': 'red',
        'yellow': 'yellow',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # ========== PATTERN 1: <button> simple ==========
    # <button className="... bg-blue-600 ... hover:bg-blue-700 ...">Text</button>
    pattern1 = r'<button\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\2-700([^"\']*?)["\']([^>]*)>\s*\n?\s*([^<]+?)\s*\n?\s*</button>'
    
    def replace_button1(match):
        nonlocal buttons_migrated
        before = match.group(1).strip()
        color = match.group(2)
        middle = match.group(3).strip()
        after = match.group(4).strip()
        attrs = match.group(5).strip()
        text = match.group(6).strip()
        
        # Nettoyer les classes redondantes
        classes = f"{before} {middle} {after}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(text-white|transition-colors?|font-medium|items-center|justify-center|inline-flex|flex)\b', '', classes).strip()
        
        variant = color_map.get(color, color)
        class_attr = f' className="{classes}"' if classes else ''
        attrs_str = f' {attrs}' if attrs else ''
        
        buttons_migrated += 1
        return f'<Button{class_attr} variant="{variant}"{attrs_str}>{text}</Button>'
    
    content = re.sub(pattern1, replace_button1, content, flags=re.DOTALL)
    
    # ========== PATTERN 2: <button> avec attributs avant className ==========
    # <button onClick={...} className="... bg-blue-600 ...">
    pattern2 = r'<button\s+([^>]*?)\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\3-700([^"\']*?)["\']([^>]*)>\s*\n?\s*([^<]+?)\s*\n?\s*</button>'
    
    def replace_button2(match):
        nonlocal buttons_migrated
        before_attrs = match.group(1).strip()
        before_class = match.group(2).strip()
        color = match.group(3)
        middle = match.group(4).strip()
        after_class = match.group(5).strip()
        after_attrs = match.group(6).strip()
        text = match.group(7).strip()
        
        classes = f"{before_class} {middle} {after_class}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(text-white|transition-colors?|font-medium|items-center|justify-center|inline-flex|flex)\b', '', classes).strip()
        
        variant = color_map.get(color, color)
        class_attr = f' className="{classes}"' if classes else ''
        all_attrs = f'{before_attrs} {after_attrs}'.strip()
        attrs_str = f' {all_attrs}' if all_attrs else ''
        
        buttons_migrated += 1
        return f'<Button{class_attr} variant="{variant}"{attrs_str}>{text}</Button>'
    
    content = re.sub(pattern2, replace_button2, content, flags=re.DOTALL)
    
    # ========== PATTERN 3: <Link> avec bg-600/700 ==========
    # <Link to="..." className="... bg-blue-600 ... hover:bg-blue-700 ...">
    pattern3 = r'<Link\s+to=["\']([^"\']+)["\']\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)hover:bg-\3-700([^"\']*?)["\']([^>]*)>\s*\n?\s*([^<]+?)\s*\n?\s*</Link>'
    
    def replace_link(match):
        nonlocal links_migrated
        to = match.group(1)
        before_class = match.group(2).strip()
        color = match.group(3)
        middle = match.group(4).strip()
        after_class = match.group(5).strip()
        attrs = match.group(6).strip()
        text = match.group(7).strip()
        
        classes = f"{before_class} {middle} {after_class}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(text-white|transition-colors?|font-medium|items-center|justify-center|inline-flex|flex)\b', '', classes).strip()
        
        variant = color_map.get(color, color)
        class_attr = f' className="{classes}"' if classes else ''
        attrs_str = f' {attrs}' if attrs else ''
        
        links_migrated += 1
        return f'<Button{class_attr} variant="{variant}" asChild{attrs_str}><Link to="{to}">{text}</Link></Button>'
    
    content = re.sub(pattern3, replace_link, content, flags=re.DOTALL)
    
    # ========== PATTERN 4: Ternaires dans className ==========
    # className={active ? "bg-blue-600 ..." : "bg-gray-600 ..."}
    pattern4 = r'className=\{([^}]+?)\s*\?\s*["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-600([^"\']*?)["\']([^}]+?)\}'
    
    def replace_ternary(match):
        nonlocal buttons_migrated
        condition = match.group(1).strip()
        before_class = match.group(2).strip()
        color = match.group(3)
        after_class = match.group(4).strip()
        false_branch = match.group(5).strip()
        
        # Ne remplacer que si c'est simple (pas de nested ternaries)
        if '?' in false_branch:
            return match.group(0)  # Skip nested
        
        variant = color_map.get(color, color)
        buttons_migrated += 1
        
        # Garder le ternaire mais utiliser le variant
        return f'variant={{{condition} ? "{variant}" : "default"}}'
    
    # Appliquer pattern4 avec prudence
    # content = re.sub(pattern4, replace_ternary, content)
    
    if buttons_migrated > 0 or links_migrated > 0:
        content = ensure_imports(content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'buttons': buttons_migrated,
        'links': links_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 12 - Advanced Button/Link Migration\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_buttons = 0
    total_links = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_buttons_advanced(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            if result['buttons'] > 0:
                print(f"   Buttons: {result['buttons']}")
            if result['links'] > 0:
                print(f"   Links: {result['links']}")
            total_buttons += result['buttons']
            total_links += result['links']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:    {files_modified}")
    print(f"  Buttons migrated:  {total_buttons}")
    print(f"  Links migrated:    {total_links}")
    print(f"  Total:             {total_buttons + total_links}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
