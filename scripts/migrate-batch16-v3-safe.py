#!/usr/bin/env python3
"""
🔥 Batch 16 v3 - Migration Alerts bg-50 (Safe avec compteur de balises)
Utilise une approche ligne par ligne pour éviter les divs imbriquées
"""

import re
from pathlib import Path

def ensure_alert_import(content: str) -> str:
    """Assure que Alert est importé"""
    # Vérifier si Alert est déjà importé
    if re.search(r'\bAlert\b', content) and re.search(r"import\s+.*?\bAlert\b.*?from", content):
        return content
    
    import_match = re.search(r"^import\s+.*?from\s+['\"](?:react|@remix-run).*?['\"];?$", content, re.MULTILINE)
    if import_match:
        insert_pos = import_match.end()
        new_import = "\nimport { Alert } from '~/components/ui/alert';"
        return content[:insert_pos] + new_import + content[insert_pos:]
    
    return content

def find_alert_candidates(content: str) -> list:
    """
    Trouve les divs candidates pour Alert en comptant les balises
    Retourne une liste de (start_pos, end_pos, inner_content, color, classes)
    """
    candidates = []
    lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Chercher une div avec bg-{color}-50 et border
        match = re.search(
            r'<div\s+className=["\']([^"\']*?bg-(blue|green|red|yellow|purple|orange)-50[^"\']*?border[^"\']*?)["\']([^>]*)>',
            line
        )
        
        if match:
            full_class = match.group(1)
            color = match.group(2)
            extra_attrs = match.group(3)
            
            # Vérifier que c'est pas un hover state
            if 'hover:bg-' in full_class and f'hover:bg-{color}' in full_class:
                i += 1
                continue
            
            # Compter les balises pour trouver le </div> correspondant
            div_count = 1
            start_line = i
            content_lines = [line[match.end():]]  # Contenu après l'ouverture
            
            i += 1
            while i < len(lines) and div_count > 0:
                current = lines[i]
                
                # Compter les <div> ouvrants
                div_count += len(re.findall(r'<div\b', current))
                # Compter les </div> fermants
                div_count -= len(re.findall(r'</div>', current))
                
                if div_count > 0:
                    content_lines.append(current)
                elif div_count == 0:
                    # Trouver où est le </div> sur cette ligne
                    close_match = re.search(r'(.*?)</div>', current)
                    if close_match:
                        content_lines.append(close_match.group(1))
                    break
                
                i += 1
            
            if div_count == 0:  # On a trouvé le closing tag correspondant
                inner = '\n'.join(content_lines)
                
                # Vérifier que le contenu n'a pas de structures trop complexes
                # Si moins de 3 divs imbriquées, c'est OK
                nested_divs = len(re.findall(r'<div\b', inner))
                if nested_divs <= 2:  # Max 2 divs imbriquées = safe
                    candidates.append({
                        'start_line': start_line,
                        'end_line': i,
                        'opening': line,
                        'inner': inner,
                        'color': color,
                        'classes': full_class,
                        'attrs': extra_attrs
                    })
        
        i += 1
    
    return candidates

def migrate_alert_divs_safe(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les divs Alert en utilisant le comptage de balises
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    lines = content.split('\n')
    
    candidates = find_alert_candidates(content)
    
    if not candidates:
        return {'alerts': 0, 'modified': False}
    
    color_map = {
        'green': 'success',
        'red': 'error',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'default',
        'orange': 'warning',
    }
    
    # Appliquer les remplacements en ordre inverse pour ne pas décaler les indices
    candidates.reverse()
    
    alerts = 0
    for candidate in candidates:
        start = candidate['start_line']
        end = candidate['end_line']
        color = candidate['color']
        inner = candidate['inner']
        full_classes = candidate['classes']
        attrs = candidate['attrs']
        
        # Nettoyer les classes
        classes = re.sub(r'\s+', ' ', full_classes)
        classes = re.sub(r'\b(bg-\w+-\d+|border-\w+-\d+|border(?!\-))\b', '', classes).strip()
        
        variant = color_map.get(color, 'default')
        
        # Construire le nouvel Alert
        class_attr = f' className="{classes}"' if classes else ''
        attrs_str = f' {attrs}' if attrs else ''
        
        new_content = f'<Alert{class_attr} variant="{variant}"{attrs_str}>{inner}</Alert>'
        
        # Remplacer les lignes
        lines[start:end+1] = [new_content]
        alerts += 1
    
    if alerts > 0:
        new_content = '\n'.join(lines)
        new_content = ensure_alert_import(new_content)
        
        if not dry_run:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
        
        return {'alerts': alerts, 'modified': True}
    
    return {'alerts': 0, 'modified': False}

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 16 v3 - Safe Alert Migration (Tag Counter)\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_alerts = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_alert_divs_safe(str(filepath), dry_run=False)
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
