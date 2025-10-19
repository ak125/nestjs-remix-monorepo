#!/usr/bin/env python3
"""
Gate M1 - API Contracts Validation
Vérifie que les contrats d'API ne sont pas cassés par les corrections

Stratégie:
- Analyse exports publics avant/après
- Vérifie signatures de fonctions/classes
- Détecte breaking changes dans interfaces TypeScript
"""

import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Set
from dataclasses import dataclass


@dataclass
class ContractChange:
    """Changement de contrat détecté"""
    file_path: str
    change_type: str  # 'added', 'removed', 'modified'
    symbol: str  # Nom de la fonction/classe/interface
    before: str
    after: str
    breaking: bool


class ContractsGate:
    """
    Gate M1 - Validation des contrats d'API
    
    Vérifie que les corrections n'ont pas cassé les contrats publics:
    - Exports de modules
    - Signatures de fonctions
    - Interfaces TypeScript
    - Props de composants React
    
    Score:
    - 100: Aucun breaking change
    - 80-99: Changements mineurs (ajouts seulement)
    - 50-79: Quelques modifications compatibles
    - 0-49: Breaking changes détectés
    """
    
    def __init__(self, config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
    
    def validate(self, fix_results: List[Any]) -> Dict[str, Any]:
        """
        Valide les contrats d'API
        
        Args:
            fix_results: Résultats des agents de correction
        
        Returns:
            {
                'passed': bool,
                'score': int (0-100),
                'details': {...},
                'message': str,
                'critical': bool
            }
        """
        print("🧪 M1 - Validation contrats API...")
        
        # Extraire fichiers modifiés
        modified_files = self._get_modified_files(fix_results)
        
        if not modified_files:
            return {
                'passed': True,
                'score': 100,
                'details': {'modified_files': 0},
                'message': 'Aucun fichier modifié'
            }
        
        # Analyser changements de contrats (via git diff)
        changes = self._analyze_contract_changes(modified_files)
        
        # Calculer score
        breaking_changes = [c for c in changes if c.breaking]
        safe_changes = [c for c in changes if not c.breaking]
        
        if breaking_changes:
            score = max(0, 40 - len(breaking_changes) * 10)
            passed = False
            message = f"❌ {len(breaking_changes)} breaking change(s) détecté(s)"
        elif safe_changes:
            score = max(80, 100 - len(safe_changes) * 5)
            passed = True
            message = f"✅ {len(safe_changes)} changement(s) compatible(s)"
        else:
            score = 100
            passed = True
            message = "✅ Aucun changement de contrat"
        
        return {
            'passed': passed,
            'score': score,
            'details': {
                'modified_files': len(modified_files),
                'total_changes': len(changes),
                'breaking_changes': len(breaking_changes),
                'safe_changes': len(safe_changes),
                'changes': [
                    {
                        'file': c.file_path,
                        'type': c.change_type,
                        'symbol': c.symbol,
                        'breaking': c.breaking
                    }
                    for c in changes[:10]  # Limiter pour lisibilité
                ]
            },
            'message': message,
            'critical': len(breaking_changes) > 0
        }
    
    def _get_modified_files(self, fix_results: List[Any]) -> List[str]:
        """Extrait fichiers modifiés des résultats de correction"""
        files = set()
        
        for result in fix_results:
            for fix in result.fixes_applied:
                if 'file_path' in fix:
                    files.add(fix['file_path'])
        
        return list(files)
    
    def _analyze_contract_changes(self, files: List[str]) -> List[ContractChange]:
        """
        Analyse changements de contrats (via git diff)
        
        Détecte:
        - export function/class/interface ajouté/supprimé/modifié
        - Signatures de fonctions changées
        - Props de composants modifiées
        """
        changes = []
        
        for file_path in files:
            # Git diff pour ce fichier
            try:
                diff = subprocess.check_output(
                    ['git', 'diff', '--cached', '--', file_path],
                    cwd=self.workspace_root,
                    text=True,
                    stderr=subprocess.DEVNULL
                )
                
                # Parser diff pour détecter changements d'exports
                file_changes = self._parse_export_changes(file_path, diff)
                changes.extend(file_changes)
                
            except subprocess.CalledProcessError:
                # Pas de diff (fichier nouveau ou non-git)
                continue
        
        return changes
    
    def _parse_export_changes(self, file_path: str, diff: str) -> List[ContractChange]:
        """
        Parse git diff pour détecter changements d'exports
        
        Recherche patterns:
        - export function/class/interface
        - export default
        - export { ... }
        """
        changes = []
        
        import re
        
        # Pattern pour exports
        export_pattern = re.compile(
            r'^[-+]\s*export\s+(default\s+)?(function|class|interface|const|type)\s+(\w+)',
            re.MULTILINE
        )
        
        for match in export_pattern.finditer(diff):
            line = match.group(0)
            symbol = match.group(3)
            
            # Déterminer si ajout ou suppression
            if line.startswith('+'):
                change_type = 'added'
                breaking = False
            elif line.startswith('-'):
                change_type = 'removed'
                breaking = True  # Suppression = breaking
            else:
                change_type = 'modified'
                breaking = True  # Modification = potentiellement breaking
            
            changes.append(ContractChange(
                file_path=file_path,
                change_type=change_type,
                symbol=symbol,
                before=line if line.startswith('-') else '',
                after=line if line.startswith('+') else '',
                breaking=breaking
            ))
        
        return changes


# Test standalone
if __name__ == '__main__':
    from pathlib import Path
    import sys
    
    sys.path.insert(0, str(Path(__file__).parent.parent))
    
    from core.config import Config
    from core.runner import AgentResult
    
    workspace = Path.cwd()
    while not (workspace / 'package.json').exists() and workspace != workspace.parent:
        workspace = workspace.parent
    
    config = Config.load(str(workspace / 'ai-agents-python' / 'config.yaml'))
    
    gate = ContractsGate(config, workspace)
    
    # Mock fix results
    mock_results = []
    
    result = gate.validate(mock_results)
    
    print(f"\n📊 Résultat: {'✅ PASS' if result['passed'] else '❌ FAIL'}")
    print(f"Score: {result['score']}/100")
    print(f"Message: {result['message']}")
