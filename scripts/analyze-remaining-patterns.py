#!/usr/bin/env python3
"""
📊 Analyze Remaining Color Patterns
Shows where the 102 remaining purple/orange patterns are used
"""

import re
from pathlib import Path
from collections import defaultdict

def analyze_remaining_patterns():
    """Analyse les patterns purple/orange restants"""
    
    app_dir = Path('/workspaces/nestjs-remix-monorepo/frontend/app')
    tsx_files = list(app_dir.rglob('*.tsx'))
    
    pattern = r'bg-(purple|orange)-(\d{2,3})'
    
    patterns_by_file = defaultdict(list)
    patterns_by_color = defaultdict(int)
    
    for filepath in tsx_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            matches = re.finditer(pattern, content)
            for match in matches:
                color = match.group(1)
                shade = match.group(2)
                full_pattern = f'bg-{color}-{shade}'
                
                patterns_by_file[filepath.relative_to(app_dir)].append(full_pattern)
                patterns_by_color[full_pattern] += 1
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
    
    print("=" * 70)
    print("📊 REMAINING PURPLE/ORANGE PATTERNS ANALYSIS")
    print("=" * 70)
    print()
    
    print("📈 BY PATTERN:")
    print("-" * 70)
    for pattern, count in sorted(patterns_by_color.items(), key=lambda x: x[1], reverse=True):
        print(f"  {pattern:20} {count:3} occurrences")
    
    total = sum(patterns_by_color.values())
    print(f"\n  {'TOTAL':20} {total:3} occurrences")
    print()
    
    print("📁 BY FILE (Top 20):")
    print("-" * 70)
    files_with_counts = [(f, len(patterns)) for f, patterns in patterns_by_file.items()]
    files_with_counts.sort(key=lambda x: x[1], reverse=True)
    
    for filepath, count in files_with_counts[:20]:
        print(f"  {count:2}x  {filepath}")
    
    print()
    print("=" * 70)
    print(f"Total files with purple/orange: {len(patterns_by_file)}")
    print(f"Total patterns: {total}")
    print("=" * 70)
    print()
    
    # Catégoriser par type d'utilisation
    print("🎯 USAGE CATEGORIES:")
    print("-" * 70)
    
    routes = [f for f in patterns_by_file.keys() if str(f).startswith('routes/')]
    components = [f for f in patterns_by_file.keys() if str(f).startswith('components/')]
    
    print(f"  Routes:     {len(routes):3} files")
    print(f"  Components: {len(components):3} files")
    print()

if __name__ == '__main__':
    analyze_remaining_patterns()
