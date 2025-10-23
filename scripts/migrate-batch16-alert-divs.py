#!/usr/bin/env python3
"""
🔥 Batch 16 - Migration Alerts bg-50
Cible les divs avec bg-{color}-50 qui sont des Alerts non migrés
"""

import re
from pathlib import Path

def ensure_alert_import(content: str) -> str:
    """Assure que Alert est importé"""
    # Vérifier si Alert est déjà importé (de n'importe où)
    if re.search(r'\bAlert\b', content) and re.search(r"import\s+.*?\bAlert\b.*?from", content):
        return content
    
    import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
    if import_match:
        insert_pos = import_match.end()
        new_import = "\nimport { Alert } from '~/components/ui/alert';"
        return content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def migrate_alert_divs(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les divs avec bg-50 + border vers Alert
    
    Pattern:
      <div className="... bg-blue-50 border border-blue-200 ...">...</div>
    → <Alert variant="info">...</Alert>
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    alerts = 0
    
    color_map = {
        'green': 'success',
        'red': 'error',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'default',
        'orange': 'warning',
    }
    
    # Pattern 1: bg-color-50 avec border border-color-200
    # <div className="... bg-blue-50 border border-blue-200 ...">Content</div>
    pattern1 = r'<div\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-50([^"\']*?)border([^"\']*?)border-\2-(?:200|400)([^"\']*?)["\']([^>]*)>(.*?)</div>'
    
    def replace_alert1(match):
        nonlocal alerts
        before = match.group(1).strip()
        color = match.group(2)
        middle1 = match.group(3).strip()
        middle2 = match.group(4).strip()
        after = match.group(5).strip()
        attrs = match.group(6).strip()
        inner = match.group(7)
        
        # Nettoyer les classes
        classes = f"{before} {middle1} {middle2} {after}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(bg-\w+-\d+|border-\w+-\d+|border(?!\-))\b', '', classes).strip()
        
        variant = color_map.get(color, 'default')
        class_attr = f' className="{classes}"' if classes else ''
        attrs_str = f' {attrs}' if attrs else ''
        
        alerts += 1
        return f'<Alert{class_attr} variant="{variant}"{attrs_str}>{inner}</Alert>'
    
    content = re.sub(pattern1, replace_alert1, content, flags=re.DOTALL)
    
    # Pattern 2: bg-color-50 avec border-l-4
    # <div className="bg-blue-50 border-l-4 border-blue-400 ...">
    pattern2 = r'<div\s+className=["\']([^"\']*?)bg-(blue|green|red|yellow|purple|orange)-50([^"\']*?)border-l-4([^"\']*?)border-\2-(?:400|500)([^"\']*?)["\']([^>]*)>(.*?)</div>'
    
    def replace_alert2(match):
        nonlocal alerts
        before = match.group(1).strip()
        color = match.group(2)
        middle1 = match.group(3).strip()
        middle2 = match.group(4).strip()
        after = match.group(5).strip()
        attrs = match.group(6).strip()
        inner = match.group(7)
        
        classes = f"{before} {middle1} {middle2} {after}".strip()
        classes = re.sub(r'\s+', ' ', classes)
        classes = re.sub(r'\b(bg-\w+-\d+|border-l-\d+|border-\w+-\d+)\b', '', classes).strip()
        
        variant = color_map.get(color, 'default')
        class_attr = f' className="{classes}"' if classes else ''
        attrs_str = f' {attrs}' if attrs else ''
        
        alerts += 1
        return f'<Alert{class_attr} variant="{variant}"{attrs_str}>{inner}</Alert>'
    
    content = re.sub(pattern2, replace_alert2, content, flags=re.DOTALL)
    
    # Pattern 3: DÉSACTIVÉ - trop dangereux, capture des divs imbriquées
    # On se limite aux patterns 1 et 2 qui sont plus sûrs
    
    if alerts > 0:
        content = ensure_alert_import(content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {'alerts': alerts, 'modified': content != original}

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 16 - Alert bg-50 Migration\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_alerts = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_alert_divs(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Alerts: {result['alerts']}")
            total_alerts += result['alerts']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:    {files_modified}")
    print(f"  Alerts migrated:   {total_alerts}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
