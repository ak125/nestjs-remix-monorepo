#!/usr/bin/env python3
"""
🔧 Cleanup - Remove duplicate Alert imports
"""

import re
from pathlib import Path

def cleanup_duplicate_imports(filepath: str) -> bool:
    """Supprime les imports Alert dupliqués"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Supprimer l'import Alert ajouté si Alert est déjà dans @fafa/ui
    if "from '@fafa/ui'" in content or 'from "@fafa/ui"' in content:
        # Supprimer la ligne import { Alert } from '~/components/ui/alert';
        content = re.sub(r'\nimport\s+\{\s*Alert\s*\}\s+from\s+[\'"]~/components/ui/alert[\'"];?\n?', '\n', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def scan_and_cleanup():
    """Scanne et nettoie tous les fichiers"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    print(f"🔧 Cleanup Duplicate Imports\n")
    
    cleaned = 0
    for filepath in tsx_files:
        if cleanup_duplicate_imports(str(filepath)):
            cleaned += 1
            print(f"✓ {filepath.name}")
    
    print(f"\n📊 Cleaned {cleaned} files")

if __name__ == '__main__':
    scan_and_cleanup()
