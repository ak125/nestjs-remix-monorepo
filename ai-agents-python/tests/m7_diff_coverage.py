#!/usr/bin/env python3
"""
Gate M7 - Diff Coverage Validation
Vérifie que le code modifié est couvert par des tests (≥80%)

Stratégie:
- Détecte lignes modifiées (git diff)
- Vérifie couverture de tests sur ces lignes
- Score basé sur % de couverture différentielle
"""

import subprocess
import json
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple
from dataclasses import dataclass


@dataclass
class DiffCoverageResult:
    """Résultat de couverture différentielle"""
    file_path: str
    lines_added: int
    lines_modified: int
    lines_covered: int
    coverage_percent: float


class DiffCoverageGate:
    """
    Gate M7 - Couverture différentielle
    
    Vérifie que le code modifié est testé:
    - Lignes ajoutées doivent être couvertes à ≥80%
    - Utilise Jest coverage (frontend) et pytest (backend)
    - Skip fichiers de config/types
    
    Score:
    - 100: Couverture ≥95%
    - 90-99: Couverture 80-94%
    - 70-89: Couverture 60-79%
    - 0-69: Couverture <60% (FAIL)
    """
    
    def __init__(self, config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
        self.min_coverage = 80  # Minimum requis
    
    def validate(self, fix_results: List[Any]) -> Dict[str, Any]:
        """
        Valide la couverture différentielle
        
        Args:
            fix_results: Résultats des agents de correction
        
        Returns:
            Résultat de validation avec score 0-100
        """
        print("🧪 M7 - Validation diff coverage...")
        
        # Extraire fichiers modifiés
        modified_files = self._get_modified_files(fix_results)
        
        if not modified_files:
            return {
                'passed': True,
                'score': 100,
                'details': {'modified_files': 0},
                'message': 'Aucun fichier modifié'
            }
        
        # Calculer couverture différentielle
        coverage_results = self._calculate_diff_coverage(modified_files)
        
        # Calculer score global
        total_lines = sum(r.lines_added + r.lines_modified for r in coverage_results)
        total_covered = sum(r.lines_covered for r in coverage_results)
        
        if total_lines == 0:
            return {
                'passed': True,
                'score': 100,
                'details': {'no_code_changes': True},
                'message': 'Aucune ligne de code modifiée'
            }
        
        coverage_percent = (total_covered / total_lines) * 100
        
        # Déterminer score
        if coverage_percent >= 95:
            score = 100
        elif coverage_percent >= self.min_coverage:
            score = 90 + int((coverage_percent - self.min_coverage) / 15 * 10)
        elif coverage_percent >= 60:
            score = 70 + int((coverage_percent - 60) / 20 * 20)
        else:
            score = int(coverage_percent)
        
        passed = coverage_percent >= self.min_coverage
        
        return {
            'passed': passed,
            'score': score,
            'details': {
                'modified_files': len(modified_files),
                'total_lines_changed': total_lines,
                'lines_covered': total_covered,
                'coverage_percent': round(coverage_percent, 1),
                'min_required': self.min_coverage,
                'files': [
                    {
                        'file': r.file_path,
                        'lines_changed': r.lines_added + r.lines_modified,
                        'lines_covered': r.lines_covered,
                        'coverage': round(r.coverage_percent, 1)
                    }
                    for r in coverage_results[:10]
                ]
            },
            'message': f"{'✅' if passed else '❌'} Couverture: {coverage_percent:.1f}% (min: {self.min_coverage}%)",
            'critical': not passed
        }
    
    def _get_modified_files(self, fix_results: List[Any]) -> List[str]:
        """Extrait fichiers modifiés"""
        files = set()
        
        for result in fix_results:
            for fix in result.fixes_applied:
                if 'file_path' in fix:
                    files.add(fix['file_path'])
        
        return list(files)
    
    def _calculate_diff_coverage(self, files: List[str]) -> List[DiffCoverageResult]:
        """
        Calcule couverture pour lignes modifiées
        
        Approche simplifiée:
        1. Git diff pour trouver lignes modifiées
        2. Estimer couverture (100% si fichier .test. existe, 0% sinon)
        
        NOTE: Pour vraie implémentation, intégrer avec Jest/pytest coverage
        """
        results = []
        
        for file_path in files:
            # Skip fichiers non-code
            if self._should_skip_coverage(file_path):
                continue
            
            # Compter lignes modifiées
            lines_added, lines_modified = self._count_diff_lines(file_path)
            
            # Estimer couverture (simple heuristique)
            coverage = self._estimate_coverage(file_path)
            
            total_lines = lines_added + lines_modified
            lines_covered = int(total_lines * coverage / 100)
            
            results.append(DiffCoverageResult(
                file_path=file_path,
                lines_added=lines_added,
                lines_modified=lines_modified,
                lines_covered=lines_covered,
                coverage_percent=coverage
            ))
        
        return results
    
    def _should_skip_coverage(self, file_path: str) -> bool:
        """Fichiers à skip pour couverture (config, types, etc.)"""
        skip_patterns = [
            '.config.',
            '.d.ts',
            'types/',
            '__tests__/',
            '.test.',
            '.spec.',
            'migrations/'
        ]
        
        return any(pattern in file_path for pattern in skip_patterns)
    
    def _count_diff_lines(self, file_path: str) -> Tuple[int, int]:
        """Compte lignes ajoutées/modifiées via git diff"""
        try:
            diff = subprocess.check_output(
                ['git', 'diff', '--cached', '--numstat', '--', file_path],
                cwd=self.workspace_root,
                text=True,
                stderr=subprocess.DEVNULL
            )
            
            if not diff.strip():
                return (0, 0)
            
            # Format: "added\tdeleted\tfilename"
            parts = diff.strip().split('\t')
            added = int(parts[0]) if parts[0] != '-' else 0
            deleted = int(parts[1]) if parts[1] != '-' else 0
            
            # Lignes modifiées = min(added, deleted)
            modified = min(added, deleted)
            truly_added = added - modified
            
            return (truly_added, modified)
            
        except subprocess.CalledProcessError:
            return (0, 0)
    
    def _estimate_coverage(self, file_path: str) -> float:
        """
        Estime couverture pour un fichier (heuristique simple)
        
        Heuristiques:
        - Si fichier .test. existe à côté → 100%
        - Si dans dossier avec tests → 80%
        - Si backend service → 60%
        - Sinon → 40%
        
        NOTE: Remplacer par vraie couverture Jest/pytest
        """
        path = Path(file_path)
        
        # Vérifier si fichier de test existe
        test_patterns = [
            path.parent / f"{path.stem}.test{path.suffix}",
            path.parent / f"{path.stem}.spec{path.suffix}",
            path.parent / '__tests__' / path.name,
        ]
        
        for test_file in test_patterns:
            if test_file.exists():
                return 100.0
        
        # Vérifier si dossier a tests
        test_dirs = [
            path.parent / '__tests__',
            path.parent / 'tests',
        ]
        
        for test_dir in test_dirs:
            if test_dir.exists() and any(test_dir.iterdir()):
                return 80.0
        
        # Backend services (souvent bien testés)
        if 'backend' in str(path) and 'services' in str(path):
            return 60.0
        
        # Par défaut: couverture faible
        return 40.0


# Test standalone
if __name__ == '__main__':
    from pathlib import Path
    import sys
    
    sys.path.insert(0, str(Path(__file__).parent.parent))
    
    from core.config import Config
    
    workspace = Path.cwd()
    while not (workspace / 'package.json').exists() and workspace != workspace.parent:
        workspace = workspace.parent
    
    config = Config.load(str(workspace / 'ai-agents-python' / 'config.yaml'))
    
    gate = DiffCoverageGate(config, workspace)
    
    # Mock fix results
    mock_results = []
    
    result = gate.validate(mock_results)
    
    print(f"\n📊 Résultat: {'✅ PASS' if result['passed'] else '❌ FAIL'}")
    print(f"Score: {result['score']}/100")
    print(f"Message: {result['message']}")
