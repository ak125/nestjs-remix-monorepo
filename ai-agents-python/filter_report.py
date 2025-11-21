#!/usr/bin/env python3
"""
Filtre intelligent pour rapport AI Agents
Exclut le bruit (.venv, node_modules, etc.) et ne garde que le code applicatif
"""
import json
from pathlib import Path

# Patterns à exclure (code tiers / généré)
EXCLUDE_PATTERNS = [
    '.venv/',
    'venv/',
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '__pycache__/',
    '*.pyc',
    '*.min.js',
    '*.d.ts',
    '.test.ts',
    '.test.tsx',
    '.spec.ts',
    '.spec.tsx',
    'migrations/',
    'fixtures/',
    'tsconfig.tsbuildinfo',
    'package-lock.json',
]

def should_exclude(file_path: str) -> bool:
    """Vérifie si un fichier doit être exclu."""
    for pattern in EXCLUDE_PATTERNS:
        if pattern in file_path:
            return True
    return False

def filter_results():
    """Filtre les résultats JSON des agents."""
    results_dir = Path(__file__).parent
    total_before = 0
    total_after = 0
    
    print("🔍 Filtrage des résultats AI Agents...\n")
    
    for json_file in results_dir.glob("*_results.json"):
        if json_file.name.startswith('filtered_'):
            continue
            
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        findings_before = len(data.get('findings', []))
        total_before += findings_before
        
        # Filtrer les findings
        filtered_findings = []
        for finding in data.get('findings', []):
            # Extraire le chemin du fichier
            file_path = ''
            if isinstance(finding, dict):
                file_path = finding.get('file_path', finding.get('path', ''))
            elif hasattr(finding, '__dict__'):
                file_path = getattr(finding, 'file_path', getattr(finding, 'path', ''))
            
            # Garder seulement si pas exclu
            if file_path and not should_exclude(file_path):
                filtered_findings.append(finding)
        
        findings_after = len(filtered_findings)
        total_after += findings_after
        
        # Sauvegarder version filtrée
        data['findings'] = filtered_findings
        output_file = results_dir / f"filtered_{json_file.name}"
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        reduction = findings_before - findings_after
        pct = (reduction / findings_before * 100) if findings_before > 0 else 0
        
        print(f"✅ {json_file.stem}")
        print(f"   Avant: {findings_before:,} | Après: {findings_after:,} | "
              f"Réduit: {reduction:,} (-{pct:.1f}%)")
    
    print(f"\n📊 TOTAL")
    print(f"   Avant: {total_before:,} problèmes")
    print(f"   Après: {total_after:,} problèmes")
    print(f"   Gain: {total_before - total_after:,} (-{(total_before-total_after)/total_before*100:.1f}%)")
    print(f"\n💾 Fichiers filtrés: filtered_*_results.json")

if __name__ == "__main__":
    filter_results()
