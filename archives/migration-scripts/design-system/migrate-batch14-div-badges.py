#!/usr/bin/env python3
"""
🔥 Batch 14 - Migration Divs → Badges
Cible les <div> avec bg-{color}-100 et text-{color}-800 qui sont des badges non migrés
"""

import re
from pathlib import Path

def ensure_badge_import(content: str) -> str:
    """Assure que Badge est importé"""
    if 'Badge' in content and 'ui/badge' in content:
        return content
    
    import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
    if import_match:
        insert_pos = import_match.end()
        new_import = "\nimport { Badge } from '~/components/ui/badge';"
        return content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def migrate_div_badges(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les divs avec pattern badge vers <Badge>
    
    Pattern:
      <div className="... bg-{color}-100 text-{color}-800 ...">Text</div>
    → <Badge variant="{color}">Text</Badge>
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    badges = 0
    
    color_map = {
        'green': 'success',
        'red': 'error',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern 1: <div className="... bg-color-100 text-color-800 ...">Simple Text</div>
    pattern1 = r'<div\s+className=["\']([^"\']*?)bg-(green|red|yellow|blue|purple|orange)-100([^"\']*?)text-\2-800([^"\']*?)["\']([^>]*)>\s*\n?\s*([^<]+?)\s*\n?\s*</div>'
    
    def replace_div1(match):
        nonlocal badges
        before = match.group(1).strip()
        color = match.group(2)
        middle = match.group(3).strip()
        after = match.group(4).strip()
        attrs = match.group(5).strip()
        text = match.group(6).strip()
        
        # Nettoyer les classes (enlever bg/text, garder le reste)
        classes = f"{before} {middle} {after}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(bg-\w+-\d+|text-\w+-\d+|border-transparent|hover:bg-\w+-\d+/?\d*)\b', '', classes).strip()
        
        variant = color_map.get(color, color)
        class_attr = f' className="{classes}"' if classes else ''
        
        badges += 1
        return f'<Badge{class_attr} variant="{variant}">{text}</Badge>'
    
    content = re.sub(pattern1, replace_div1, content, flags=re.DOTALL)
    
    # Pattern 2: Ordre inversé text-color-800 PUIS bg-color-100
    pattern2 = r'<div\s+className=["\']([^"\']*?)text-(green|red|yellow|blue|purple|orange)-800([^"\']*?)bg-\2-100([^"\']*?)["\']([^>]*)>\s*\n?\s*([^<]+?)\s*\n?\s*</div>'
    
    def replace_div2(match):
        nonlocal badges
        before = match.group(1).strip()
        color = match.group(2)
        middle = match.group(3).strip()
        after = match.group(4).strip()
        attrs = match.group(5).strip()
        text = match.group(6).strip()
        
        classes = f"{before} {middle} {after}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(bg-\w+-\d+|text-\w+-\d+|border-transparent|hover:bg-\w+-\d+/?\d*)\b', '', classes).strip()
        
        variant = color_map.get(color, color)
        class_attr = f' className="{classes}"' if classes else ''
        
        badges += 1
        return f'<Badge{class_attr} variant="{variant}">{text}</Badge>'
    
    content = re.sub(pattern2, replace_div2, content, flags=re.DOTALL)
    
    if badges > 0:
        content = ensure_badge_import(content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {'badges': badges, 'modified': content != original}

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 14 - Div → Badge Migration\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_badges = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_div_badges(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Badges: {result['badges']}")
            total_badges += result['badges']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:    {files_modified}")
    print(f"  Badges migrated:   {total_badges}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
