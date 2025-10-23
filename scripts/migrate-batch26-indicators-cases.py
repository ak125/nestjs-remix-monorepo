#!/usr/bin/env python3
"""
🔴 Batch 26 - Migration Indicators & Case Statements → Semantic
Cible les petits dots/indicators et case statements
Exemple: w-2 h-2 bg-green-500 → w-2 h-2 bg-success
        case 'SUCCESS': return 'bg-green-500' → case 'SUCCESS': return 'bg-success'
"""

import re
from pathlib import Path

def migrate_indicators_cases(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les indicators et case statements
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    patterns_migrated = 0
    
    # Pattern 1: Petits dots/indicators (w-1.5 h-1.5, w-2 h-2)
    # w-1.5 h-1.5 bg-green-500 rounded-full
    pattern1 = r'w-(1\.5|2)\s+h-\1\s+bg-(green|red|yellow|blue|purple|orange)-500\s+rounded-full'
    
    def replace_dot(match):
        nonlocal patterns_migrated
        size = match.group(1)
        color = match.group(2)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
            'blue': 'bg-primary',
            'purple': 'bg-purple-600',
            'orange': 'bg-orange-600',
        }
        
        patterns_migrated += 1
        return f'w-{size} h-{size} {color_map.get(color, f"bg-{color}-500")} rounded-full'
    
    content = re.sub(pattern1, replace_dot, content)
    
    # Pattern 2: Case statements avec return bg-500
    # case 'SUCCESS': return 'bg-green-500 text-white';
    pattern2 = r"(case\s+['\"][^'\"]+['\"]\s*:\s*return\s+['\"])bg-(green|red|yellow|blue|purple|orange)-500(\s+text-white['\"];)"
    
    def replace_case(match):
        nonlocal patterns_migrated
        before = match.group(1)
        color = match.group(2)
        after = match.group(3)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
            'blue': 'bg-primary',
            'purple': 'bg-purple-600',
            'orange': 'bg-orange-600',
        }
        
        patterns_migrated += 1
        return f'{before}{color_map.get(color, f"bg-{color}-500")}{after}'
    
    content = re.sub(pattern2, replace_case, content)
    
    # Pattern 3: baseStyles = 'bg-green-500 text-white';
    pattern3 = r"(baseStyles\s*=\s*['\"])bg-(green|red|yellow|blue|purple|orange)-500\s+text-white(['\"];)"
    
    def replace_base_styles(match):
        nonlocal patterns_migrated
        before = match.group(1)
        color = match.group(2)
        after = match.group(3)
        
        color_map = {
            'green': 'bg-success text-success-foreground',
            'red': 'bg-destructive text-destructive-foreground',
            'yellow': 'bg-warning text-warning-foreground',
            'blue': 'bg-primary text-primary-foreground',
            'purple': 'bg-purple-600 text-white',
            'orange': 'bg-orange-600 text-white',
        }
        
        patterns_migrated += 1
        return f'{before}{color_map.get(color, f"bg-{color}-500 text-white")}{after}'
    
    content = re.sub(pattern3, replace_base_styles, content)
    
    # Pattern 4: Ternaires simples environment === 'production' ? 'bg-green-500' : 
    # environment === 'production' ? 'bg-green-500' :
    pattern4 = r"===\s+['\"](\w+)['\"]\s+\?\s+['\"]bg-(green|red|yellow|blue|purple|orange)-500['\"]\s+:"
    
    def replace_env_ternary(match):
        nonlocal patterns_migrated
        env = match.group(1)
        color = match.group(2)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
            'blue': 'bg-primary',
            'purple': 'bg-purple-600',
            'orange': 'bg-orange-600',
        }
        
        patterns_migrated += 1
        return f"=== '{env}' ? '{color_map.get(color, f"bg-{color}-500")}' :"
    
    content = re.sub(pattern4, replace_env_ternary, content)
    
    # Pattern 5: Object literals avec bg-500
    # 'critical': 'bg-red-500 text-white ...'
    pattern5 = r"(['\"](?:critical|high|medium|low|success|error|warning|info)['\"]\s*:\s*['\"])bg-(green|red|yellow|blue|purple|orange)-500(\s+text-white[^'\"]*['\"])"
    
    def replace_object_literal(match):
        nonlocal patterns_migrated
        before = match.group(1)
        color = match.group(2)
        after = match.group(3)
        
        color_map = {
            'green': 'bg-success',
            'red': 'bg-destructive',
            'yellow': 'bg-warning',
            'blue': 'bg-primary',
            'purple': 'bg-purple-600',
            'orange': 'bg-orange-600',
        }
        
        patterns_migrated += 1
        return f'{before}{color_map.get(color, f"bg-{color}-500")}{after}'
    
    content = re.sub(pattern5, replace_object_literal, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'patterns': patterns_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔴 Batch 26 - Indicators & Cases → Semantic\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_patterns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_indicators_cases(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Patterns: {result['patterns']}")
            total_patterns += result['patterns']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Patterns migrated:     {total_patterns}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
