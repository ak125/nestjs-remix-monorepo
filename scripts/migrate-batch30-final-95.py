#!/usr/bin/env python3
"""
🎯 Batch 30 - Final Semantic Push to 95%+ 
Migre les DERNIERS bg-50/100 très contextuels
Purple/Orange restent intentionnellement pour le branding
"""

import re
from pathlib import Path

def migrate_final_semantics(filepath: str, dry_run: bool = True) -> dict:
    """
    Migre les derniers bg-50/100 restants
    """
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    patterns_migrated = 0
    
    # Pattern 1: bg-red-50 restants (alerts/errors contextuels)
    # On doit être TRÈS prudent avec le contexte
    pattern1 = r'\bbg-red-50\b'
    
    def replace_red50_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        # Vérifier si c'est dans une paire text-red-*
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        # Si on trouve text-red-XXX dans le contexte, on skip
        if re.search(r'text-red-\d{3}', context):
            return full_match
        
        # Si on trouve border-red dans le contexte proche, probable Alert
        if 'border-red' in context:
            return full_match  # Déjà géré par Alert component
        
        patterns_migrated += 1
        return 'bg-destructive/5'
    
    content = re.sub(pattern1, replace_red50_contextual, content)
    
    # Pattern 2: bg-blue-50 restants
    pattern2 = r'\bbg-blue-50\b'
    
    def replace_blue50_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        if re.search(r'text-blue-\d{3}', context):
            return full_match
        
        if 'border-blue' in context:
            return full_match
        
        patterns_migrated += 1
        return 'bg-primary/5'
    
    content = re.sub(pattern2, replace_blue50_contextual, content)
    
    # Pattern 3: bg-green-50 restants
    pattern3 = r'\bbg-green-50\b'
    
    def replace_green50_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        if re.search(r'text-green-\d{3}', context):
            return full_match
        
        if 'border-green' in context:
            return full_match
        
        patterns_migrated += 1
        return 'bg-success/5'
    
    content = re.sub(pattern3, replace_green50_contextual, content)
    
    # Pattern 4: bg-yellow-50 restants
    pattern4 = r'\bbg-yellow-50\b'
    
    def replace_yellow50_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        if re.search(r'text-yellow-\d{3}', context):
            return full_match
        
        if 'border-yellow' in context:
            return full_match
        
        patterns_migrated += 1
        return 'bg-warning/5'
    
    content = re.sub(pattern4, replace_yellow50_contextual, content)
    
    # Pattern 5: bg-red-100 restants
    pattern5 = r'\bbg-red-100\b'
    
    def replace_red100_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        if re.search(r'text-red-\d{3}', context):
            return full_match
        
        patterns_migrated += 1
        return 'bg-destructive/15'
    
    content = re.sub(pattern5, replace_red100_contextual, content)
    
    # Pattern 6: bg-yellow-100 restants
    pattern6 = r'\bbg-yellow-100\b'
    
    def replace_yellow100_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        if re.search(r'text-yellow-\d{3}', context):
            return full_match
        
        patterns_migrated += 1
        return 'bg-warning/15'
    
    content = re.sub(pattern6, replace_yellow100_contextual, content)
    
    # Pattern 7: bg-green-100 restants
    pattern7 = r'\bbg-green-100\b'
    
    def replace_green100_contextual(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 60)
        end_pos = min(len(content), match.end() + 60)
        context = content[start_pos:end_pos]
        
        if re.search(r'text-green-\d{3}', context):
            return full_match
        
        patterns_migrated += 1
        return 'bg-success/15'
    
    content = re.sub(pattern7, replace_green100_contextual, content)
    
    # Pattern 8: Le dernier bg-blue-600 !
    pattern8 = r'\bbg-blue-600\b'
    
    def replace_final_blue600(match):
        nonlocal patterns_migrated
        full_match = match.group(0)
        
        start_pos = max(0, match.start() - 20)
        context_before = content[start_pos:match.start()]
        
        # Si hover context, skip
        if 'hover:' in context_before or 'group-hover:' in context_before:
            return full_match
        
        patterns_migrated += 1
        return 'bg-primary'
    
    content = re.sub(pattern8, replace_final_blue600, content)
    
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
    
    print(f"🎯 Batch 30 - Final Semantic Push to 95%+\n")
    print(f"Scanning {len(tsx_files)} files...\n")
    
    total_patterns = 0
    files_modified = 0
    
    for filepath in tsx_files:
        result = migrate_final_semantics(str(filepath), dry_run=False)
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
    print(f"\n💡 Remaining are mostly purple/orange (custom branding)")
    print()

if __name__ == '__main__':
    scan_and_migrate()
