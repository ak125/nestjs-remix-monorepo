#!/usr/bin/env python3
"""
🔥 Batch 10 - Patterns Ternaires dans <span>
Cible les <span> avec ternaires bg-color dans className.
"""

import re
from pathlib import Path

def ensure_badge_import(content: str) -> str:
    """Assure que Badge est importé"""
    if 'Badge' in content and 'from' in content and 'ui/badge' in content:
        return content
    
    # Trouver la première ligne d'import React/Remix
    import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
    
    if import_match:
        insert_pos = import_match.end()
        new_import = "\nimport { Badge } from '~/components/ui/badge';"
        return content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def migrate_ternary_spans(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les <span> avec ternaires bg-color.
    
    Pattern:
      <span className={`... ${cond ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {content}
      </span>
    
    Vers:
      <Badge variant={cond ? 'success' : 'error'}>
        {content}
      </Badge>
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    badges = 0
    
    # Mapper couleurs vers variants
    color_map = {
        'green': 'success',
        'red': 'error',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'purple',
        'orange': 'orange'
    }
    
    # Pattern 1: <span className={`fixed ${ternary}`}>
    # Capture: condition, color1, color2, content
    pattern1 = r'<span\s+className=\{\s*`([^`]*)\$\{\s*([^}]+?)\s*\?\s*[\'"]bg-(green|red|yellow|blue|purple|orange)-(?:50|100|200)\s+text-\3-(?:700|800)["\']\s*:\s*[\'"]bg-(green|red|yellow|blue|purple|orange)-(?:50|100|200)\s+text-\4-(?:700|800)["\']\s*\}([^`]*)`\s*\}>\s*([^<]+?)\s*</span>'
    
    def replace1(match):
        nonlocal badges
        prefix_classes = match.group(1).strip()
        condition = match.group(2).strip()
        color_true = match.group(3)
        color_false = match.group(4)
        suffix_classes = match.group(5).strip()
        text_content = match.group(6).strip()
        
        variant_true = color_map.get(color_true, color_true)
        variant_false = color_map.get(color_false, color_false)
        
        # Construction du Badge
        extra_classes = f' className="{prefix_classes} {suffix_classes}"' if (prefix_classes or suffix_classes) else ''
        
        badges += 1
        return f'<Badge{extra_classes} variant={{{condition} ? \'{variant_true}\' : \'{variant_false}\'}}>\\n  {text_content}\\n</Badge>'
    
    content = re.sub(pattern1, replace1, content, flags=re.DOTALL)
    
    # Pattern 2: <span className={ternary direct}>
    pattern2 = r'<span\s+className=\{\s*([^}]+?)\s*\?\s*[\'"]bg-(green|red|yellow|blue|purple|orange)-(?:50|100|200)\s+text-\2-(?:700|800)["\']\s*:\s*[\'"]bg-(green|red|yellow|blue|purple|orange)-(?:50|100|200)\s+text-\3-(?:700|800)["\']\s*\}>\s*([^<]+?)\s*</span>'
    
    def replace2(match):
        nonlocal badges
        condition = match.group(1).strip()
        color_true = match.group(2)
        color_false = match.group(3)
        text_content = match.group(4).strip()
        
        variant_true = color_map.get(color_true, color_true)
        variant_false = color_map.get(color_false, color_false)
        
        badges += 1
        return f'<Badge variant={{{condition} ? \'{variant_true}\' : \'{variant_false}\'}}>\\n  {text_content}\\n</Badge>'
    
    content = re.sub(pattern2, replace2, content, flags=re.DOTALL)
    
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
    
    print(f"🔥 Batch 10 - Ternary <span> Patterns\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_badges = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_ternary_spans(str(filepath), dry_run=False)
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
