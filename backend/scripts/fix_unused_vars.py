#!/usr/bin/env python3
"""
Script pour corriger automatiquement les variables non utilisées
en les préfixant avec _ selon la convention ESLint
"""

import re
import subprocess
import sys
from pathlib import Path
from collections import defaultdict

def run_lint():
    """Exécute npm run lint et capture la sortie"""
    try:
        result = subprocess.run(
            ['npm', 'run', 'lint'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        return result.stdout + result.stderr
    except Exception as e:
        print(f"❌ Erreur lors de l'exécution du lint: {e}")
        sys.exit(1)

def parse_warnings(lint_output):
    """Parse la sortie du lint pour extraire les warnings"""
    warnings = defaultdict(list)
    current_file = None
    
    for line in lint_output.split('\n'):
        # Détecte le fichier
        if line.startswith('/'):
            current_file = line.strip()
            continue
        
        # Détecte les warnings de variables non utilisées
        match = re.match(r'^\s+(\d+):(\d+)\s+warning\s+\'([^\']+)\' is (assigned a value but never used|defined but never used)', line)
        
        if match and current_file:
            line_num, col, var_name, _ = match.groups()
            
            # Ignorer si déjà préfixé avec _
            if not var_name.startswith('_'):
                warnings[current_file].append({
                    'line': int(line_num),
                    'col': int(col),
                    'var': var_name
                })
    
    return warnings

def fix_file(filepath, file_warnings):
    """Corrige un fichier donné"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        
        modified = False
        
        # Trier par ligne décroissante pour éviter les décalages
        for warning in sorted(file_warnings, key=lambda w: w['line'], reverse=True):
            line_idx = warning['line'] - 1
            if line_idx < 0 or line_idx >= len(lines):
                continue
            
            line = lines[line_idx]
            var_name = warning['var']
            
            # catch (error) → catch (_error)
            if f'catch ({var_name})' in line or f'catch({var_name})' in line:
                line = re.sub(rf'\bcatch\s*\(\s*{re.escape(var_name)}\s*\)', f'catch (_{{var_name}})', line)
                lines[line_idx] = line
                modified = True
                continue
            
            # const varName = → const _varName =
            if re.search(rf'\bconst\s+{re.escape(var_name)}\s*[=:]', line):
                line = re.sub(rf'\bconst\s+{re.escape(var_name)}\b', f'const _{var_name}', line)
                lines[line_idx] = line
                modified = True
                continue
            
            # let varName = → let _varName =
            if re.search(rf'\blet\s+{re_name}\s*=', line):
                line = re.sub(rf'\blet\s+{re.escape(var_name)}\b', f'let _{var_name}', line)
                lines[line_idx] = line
                modified = True
                continue
            
            # { data: varName, ... } → { data: _varName, ... }
            if re.search(rf':\s*{re.escape(var_name)}\s*[,}}]', line):
                line = re.sub(rf'(:\s*){re.escape(var_name)}(\s*[,}}])', rf'\1_{var_name}\2', line)
                lines[line_idx] = line
                modified = True
                continue
            
            # Import type { VarName } → Import type { VarName as _VarName }
            if 'import' in line.lower() and var_name in line:
                # Import simple: import { VarName } → import { type VarName as _VarName }
                if re.search(rf'\{[^}}]*\b{re.escape(var_name)}\b', line):
                    # Vérifier si c'est déjà un type import
                    if not re.search(rf'type\s+{re.escape(var_name)}\s+as\s+_', line):
                        line = re.sub(
                            rf'(\{{[^}}]*?)\b{re.escape(var_name)}\b([,\s]*[^}}]*\}})',
                            rf'\1type {var_name} as _{var_name}\2',
                            line
                        )
                        lines[line_idx] = line
                        modified = True
                        continue
            
            # Paramètres de fonction: functionName(varName: Type) → functionName(_varName: Type)
            if re.search(rf'\b{re.escape(var_name)}\s*:', line):
                # S'assurer que c'est bien un paramètre (dans une signature de fonction)
                if '(' in line or 'function' in line or '=>' in line:
                    line = re.sub(rf'\b{re.escape(var_name)}(\s*:)', rf'_{var_name}\1', line)
                    lines[line_idx] = line
                    modified = True
                    continue
        
        if modified:
            new_content = '\n'.join(lines)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return len(file_warnings)
        
        return 0
        
    except Exception as e:
        print(f"❌ Erreur avec {filepath}: {e}")
        return 0

def main():
    print("🔧 Correction automatique des variables non utilisées...\n")
    
    # Exécuter le lint
    print("📊 Analyse des warnings...")
    lint_output = run_lint()
    
    # Parser les warnings
    warnings = parse_warnings(lint_output)
    
    total_warnings = sum(len(w) for w in warnings.values())
    print(f"📊 Trouvé {total_warnings} warnings dans {len(warnings)} fichiers\n")
    
    if total_warnings == 0:
        print("✅ Aucun warning à corriger!")
        return
    
    # Corriger chaque fichier
    total_fixed = 0
    for filepath, file_warnings in warnings.items():
        if Path(filepath).exists():
            fixed = fix_file(filepath, file_warnings)
            if fixed > 0:
                print(f"✅ {filepath}: {fixed} corrections")
                total_fixed += fixed
    
    print(f"\n📊 Résumé: {total_fixed} warnings corrigés")
    print("🔍 Relancez 'npm run lint' pour vérifier\n")

if __name__ == '__main__':
    main()
