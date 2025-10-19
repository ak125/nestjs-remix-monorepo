#!/usr/bin/env python3
"""
Agent A2 - Massive Files Detector
Détecte les fichiers trop volumineux selon les seuils configurés

Équivalent Python de chasseur-fichiers-massifs.agent.ts
"""

import os
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class MassiveFileResult:
    """Résultat pour un fichier massif détecté"""
    file_path: str
    lines: int
    category: str  # 'tsx_component', 'route_file', 'backend_service', etc.
    threshold: int
    severity: str  # 'warning', 'critical'
    suggestions: List[str]
    last_modified: datetime


class MassiveFilesDetector:
    """
    Détecte les fichiers trop volumineux
    
    Thresholds depuis config.yaml:
    - TSX components: 500 lignes
    - Route files: 400 lignes
    - Backend services: 600 lignes
    - Autres TS/JS: 350 lignes
    """
    
    def __init__(self, config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
        self.thresholds = config.thresholds.massive_files
    
    def analyze(self) -> List[Dict[str, Any]]:
        """
        Détecte tous les fichiers massifs
        
        Returns:
            Liste de MassiveFileResult sérialisés
        """
        print("🔍 A2 - Détection fichiers massifs...")
        
        results = []
        
        # Patterns de fichiers à analyser
        patterns = [
            ('frontend/**/*.tsx', 'tsx_component', self.thresholds.tsx_component),
            ('frontend/**/routes/**/*.tsx', 'route_file', self.thresholds.route_file),
            ('backend/**/services/**/*.ts', 'backend_service', self.thresholds.backend_service),
            ('**/*.ts', 'typescript', self.thresholds.typescript),
            ('**/*.js', 'javascript', self.thresholds.javascript),
        ]
        
        for pattern, category, threshold in patterns:
            files = self._find_files(pattern)
            
            for file_path in files:
                # Ignorer exclusions
                if self.config.should_exclude(str(file_path)):
                    continue
                
                lines = self._count_lines(file_path)
                
                if lines > threshold:
                    # Déterminer sévérité
                    severity = self._calculate_severity(lines, threshold)
                    
                    # Générer suggestions
                    suggestions = self._generate_suggestions(file_path, lines, category)
                    
                    result = MassiveFileResult(
                        file_path=str(file_path.relative_to(self.workspace_root)),
                        lines=lines,
                        category=category,
                        threshold=threshold,
                        severity=severity,
                        suggestions=suggestions,
                        last_modified=datetime.fromtimestamp(file_path.stat().st_mtime)
                    )
                    
                    results.append(result)
        
        # Trier par nombre de lignes (décroissant)
        results.sort(key=lambda r: r.lines, reverse=True)
        
        # Sérialiser pour JSON
        return [self._serialize(r) for r in results]
    
    def _find_files(self, pattern: str) -> List[Path]:
        """Trouve tous les fichiers matchant le pattern"""
        results = []
        
        # Convertir pattern en glob
        for file_path in self.workspace_root.rglob(pattern.split('/')[-1]):
            # Vérifier que le path complet matche
            if self._matches_pattern(file_path, pattern):
                results.append(file_path)
        
        return results
    
    def _matches_pattern(self, file_path: Path, pattern: str) -> bool:
        """Vérifie si un path matche un pattern glob"""
        import fnmatch
        rel_path = str(file_path.relative_to(self.workspace_root))
        return fnmatch.fnmatch(rel_path, pattern)
    
    def _count_lines(self, file_path: Path) -> int:
        """Compte les lignes de code (hors commentaires et lignes vides)"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            # Compter lignes non vides et non commentaires
            code_lines = 0
            in_block_comment = False
            
            for line in lines:
                stripped = line.strip()
                
                # Ignorer lignes vides
                if not stripped:
                    continue
                
                # Gérer commentaires bloc
                if stripped.startswith('/*'):
                    in_block_comment = True
                if '*/' in stripped:
                    in_block_comment = False
                    continue
                
                if in_block_comment:
                    continue
                
                # Ignorer commentaires ligne
                if stripped.startswith('//') or stripped.startswith('#'):
                    continue
                
                code_lines += 1
            
            return code_lines
        
        except Exception as e:
            print(f"⚠️  Erreur lecture {file_path}: {e}")
            return 0
    
    def _calculate_severity(self, lines: int, threshold: int) -> str:
        """Calcule la sévérité basée sur le dépassement"""
        ratio = lines / threshold
        
        if ratio >= 2.0:
            return 'critical'  # 2x le threshold
        elif ratio >= 1.5:
            return 'high'
        elif ratio >= 1.2:
            return 'medium'
        else:
            return 'warning'
    
    def _generate_suggestions(self, file_path: Path, lines: int, category: str) -> List[str]:
        """Génère des suggestions de refactoring"""
        suggestions = []
        
        if category == 'tsx_component':
            suggestions.append("Extraire des sous-composants")
            suggestions.append("Séparer logique métier dans des hooks custom")
            suggestions.append("Déplacer types/interfaces dans fichier séparé")
        
        elif category == 'route_file':
            suggestions.append("Extraire loaders dans fichiers séparés")
            suggestions.append("Créer des composants pour chaque section")
            suggestions.append("Déplacer validation dans utils")
        
        elif category == 'backend_service':
            suggestions.append("Diviser en plusieurs services spécialisés")
            suggestions.append("Extraire méthodes privées dans helpers")
            suggestions.append("Créer des sous-classes pour domaines métier")
        
        else:
            suggestions.append("Diviser en plusieurs modules")
            suggestions.append("Extraire fonctions utilitaires")
        
        # Suggestion générique basée sur la taille
        if lines > 1000:
            suggestions.append(f"⚠️ URGENT: {lines} lignes, cible < {lines//2}")
        
        return suggestions
    
    def _serialize(self, result: MassiveFileResult) -> Dict[str, Any]:
        """Sérialise un résultat en dict JSON-compatible"""
        return {
            'file_path': result.file_path,
            'lines': result.lines,
            'category': result.category,
            'threshold': result.threshold,
            'severity': result.severity,
            'suggestions': result.suggestions,
            'last_modified': result.last_modified.isoformat(),
            'overage_percent': int(((result.lines / result.threshold) - 1) * 100)
        }


# Test standalone
if __name__ == '__main__':
    from pathlib import Path
    import sys
    
    # Ajouter le parent au path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    
    from core.config import Config
    
    workspace = Path.cwd()
    while not (workspace / 'package.json').exists() and workspace != workspace.parent:
        workspace = workspace.parent
    
    config = Config.load(workspace / 'ai-agents-python' / 'config.yaml')
    
    detector = MassiveFilesDetector(config, workspace)
    results = detector.analyze()
    
    print(f"\n📊 Résultats: {len(results)} fichier(s) massif(s)")
    
    for result in results[:10]:  # Top 10
        severity_emoji = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'warning': '⚠️'
        }
        emoji = severity_emoji.get(result['severity'], '❓')
        
        print(f"\n{emoji} {result['file_path']}")
        print(f"   Lignes: {result['lines']} (threshold: {result['threshold']}, +{result['overage_percent']}%)")
        print(f"   Suggestions:")
        for suggestion in result['suggestions'][:2]:
            print(f"      - {suggestion}")
