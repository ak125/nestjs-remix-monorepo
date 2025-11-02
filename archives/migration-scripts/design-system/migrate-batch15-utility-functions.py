#!/usr/bin/env python3
"""
🔥 Batch 15 - Migration Functions → Variant Getters
Cible les fonctions qui retournent des classes bg-* basées sur des conditions
Les transforme en fonctions retournant des variants Badge
"""

import re
from pathlib import Path

def migrate_utility_functions(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les fonctions utilitaires qui retournent des classes de couleur
    
    Pattern:
      if (level >= 9) return 'bg-red-100 text-red-800';
    → if (level >= 9) return 'error';
    
    Puis utilisation:
      <div className={getColorClass(level)}>
    → <Badge variant={getVariant(level)}>
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    functions_migrated = 0
    
    color_map = {
        'red': 'error',
        'green': 'success',
        'yellow': 'warning',
        'blue': 'info',
        'purple': 'purple',
        'orange': 'orange',
    }
    
    # Pattern 1: if (condition) return 'bg-color-100 text-color-800';
    # Remplacer par: if (condition) return 'variant';
    pattern1 = r"if\s*\(([^)]+)\)\s*return\s+['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\2-800([^'\"]*?)['\"];"
    
    def replace_return(match):
        nonlocal functions_migrated
        condition = match.group(1)
        color = match.group(2)
        extra = match.group(3).strip()
        
        # Ne garder que les classes non-couleur (border si présent)
        variant = color_map.get(color, color)
        
        # Si il y a border-color-200 aussi, on le gère
        if 'border' in extra:
            # Garder border mais supprimer la couleur
            extra_clean = re.sub(r'border-\w+-\d+', '', extra).strip()
            if extra_clean:
                functions_migrated += 1
                return f"if ({condition}) return '{variant}'; // Note: border classes need manual handling"
        
        functions_migrated += 1
        return f"if ({condition}) return '{variant}';"
    
    content = re.sub(pattern1, replace_return, content)
    
    # Pattern 2: Ternaire dans return
    # return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    pattern2 = r"return\s+([^?]+)\s*\?\s*['\"]bg-(green|red|yellow|blue|purple|orange)-100\s+text-\2-800([^'\"]*?)['\"]([^:]*?):\s*['\"]bg-(red|green|yellow|blue|purple|orange)-100\s+text-\5-800([^'\"]*?)['\"];"
    
    def replace_ternary(match):
        nonlocal functions_migrated
        condition = match.group(1).strip()
        color_true = match.group(2)
        extra_true = match.group(3).strip()
        between = match.group(4).strip()
        color_false = match.group(5)
        extra_false = match.group(6).strip()
        
        variant_true = color_map.get(color_true, color_true)
        variant_false = color_map.get(color_false, color_false)
        
        functions_migrated += 1
        return f"return {condition} ? '{variant_true}' : '{variant_false}';"
    
    content = re.sub(pattern2, replace_ternary, content)
    
    if not dry_run and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return {
        'functions': functions_migrated,
        'modified': content != original
    }

def scan_and_migrate():
    """Scanne tous les fichiers TSX"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔥 Batch 15 - Utility Functions → Variants\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_functions = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_utility_functions(str(filepath), dry_run=False)
        if result['modified']:
            print(f"📄 {filepath.name}")
            print(f"   Functions: {result['functions']}")
            total_functions += result['functions']
            files_modified += 1
    
    print("\n" + "="*60)
    print("📊 Summary")
    print("="*60)
    print(f"  Files modified:        {files_modified}")
    print(f"  Functions migrated:    {total_functions}")
    print()

if __name__ == '__main__':
    scan_and_migrate()
