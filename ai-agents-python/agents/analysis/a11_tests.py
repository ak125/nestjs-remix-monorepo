"""
A11 - Tests Coverage Agent
Analyse la couverture de tests et détecte les fichiers sans tests.
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Set
from dataclasses import dataclass


@dataclass
class TestCoverageFinding:
    """Résultat d'analyse de couverture de tests."""
    file_path: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # NO_TEST, LOW_COVERAGE, MISSING_CRITICAL_PATH
    description: str
    recommendation: str
    lines_of_code: int


class A11TestsAgent:
    """
    Agent A11 - Analyse de couverture de tests.
    
    Détecte:
    - Fichiers sans tests associés
    - Fonctions critiques non testées
    - Fichiers de services sans tests
    - Composants sans tests
    - API endpoints sans tests
    """
    
    # Patterns de fichiers critiques nécessitant des tests
    CRITICAL_PATTERNS = {
        'services': {
            'pattern': r'(services?|repositories?)/.*\.(ts|js)$',
            'severity': 'HIGH',
            'reason': 'Service critique sans tests',
        },
        'api_routes': {
            'pattern': r'(routes?|controllers?)/.*\.(ts|js)$',
            'severity': 'HIGH',
            'reason': 'Route API sans tests',
        },
        'utils': {
            'pattern': r'(utils?|helpers?)/.*\.(ts|js)$',
            'severity': 'MEDIUM',
            'reason': 'Utilitaire sans tests',
        },
        'components': {
            'pattern': r'components?/.*\.(tsx|jsx)$',
            'severity': 'MEDIUM',
            'reason': 'Composant sans tests',
        },
        'hooks': {
            'pattern': r'hooks?/.*\.(ts|tsx)$',
            'severity': 'MEDIUM',
            'reason': 'Hook React sans tests',
        },
    }
    
    # Extensions de fichiers de code
    CODE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx'}
    
    # Extensions de fichiers de test
    TEST_EXTENSIONS = {'.test.ts', '.test.tsx', '.test.js', '.test.jsx',
                       '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx'}
    
    IGNORE_PATTERNS = [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '__pycache__',
        '.git',
        'migrations',
        '.d.ts',
        'index.ts',  # Souvent juste des exports
        'types.ts',  # Types uniquement
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A11.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[TestCoverageFinding] = []
        self.test_files: Set[str] = set()
        self.code_files: Set[Path] = set()
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        # Ignorer certains patterns
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        return file_path.suffix in self.CODE_EXTENSIONS
    
    def is_test_file(self, file_path: Path) -> bool:
        """Vérifie si un fichier est un fichier de test."""
        return any(str(file_path).endswith(ext) for ext in self.TEST_EXTENSIONS)
    
    def find_test_file(self, code_file: Path) -> Path:
        """Cherche le fichier de test correspondant à un fichier de code."""
        # Patterns possibles pour les fichiers de test
        base_name = code_file.stem
        parent = code_file.parent
        
        # Patterns de recherche
        test_patterns = [
            # Même dossier
            parent / f"{base_name}.test{code_file.suffix}",
            parent / f"{base_name}.spec{code_file.suffix}",
            # Dossier __tests__
            parent / '__tests__' / f"{base_name}.test{code_file.suffix}",
            parent / '__tests__' / f"{base_name}.spec{code_file.suffix}",
            # Dossier tests/
            parent / 'tests' / f"{base_name}.test{code_file.suffix}",
            parent / 'tests' / f"{base_name}.spec{code_file.suffix}",
            # À la racine du projet
            self.root_dir / 'tests' / code_file.relative_to(self.root_dir).parent / f"{base_name}.test{code_file.suffix}",
        ]
        
        for test_path in test_patterns:
            if test_path.exists():
                return test_path
        
        return None
    
    def count_lines_of_code(self, file_path: Path) -> int:
        """Compte les lignes de code (sans commentaires ni lignes vides)."""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            loc = 0
            in_block_comment = False
            
            for line in lines:
                stripped = line.strip()
                
                # Gérer les commentaires de bloc
                if '/*' in stripped:
                    in_block_comment = True
                if '*/' in stripped:
                    in_block_comment = False
                    continue
                
                if in_block_comment:
                    continue
                
                # Ignorer les lignes vides et commentaires simples
                if not stripped or stripped.startswith('//') or stripped.startswith('#'):
                    continue
                
                loc += 1
            
            return loc
        
        except Exception:
            return 0
    
    def get_file_category(self, file_path: Path) -> tuple:
        """Détermine la catégorie d'un fichier."""
        path_str = str(file_path)
        
        for category, info in self.CRITICAL_PATTERNS.items():
            if re.search(info['pattern'], path_str, re.IGNORECASE):
                return (category, info['severity'], info['reason'])
        
        return (None, 'LOW', 'Fichier sans tests')
    
    def collect_files(self):
        """Collecte tous les fichiers de code et de test."""
        for file_path in self.root_dir.rglob('*'):
            if not file_path.is_file():
                continue
            
            if self.is_test_file(file_path):
                self.test_files.add(str(file_path))
            elif self.should_analyze(file_path):
                self.code_files.add(file_path)
    
    def analyze_coverage(self):
        """Analyse la couverture de tests."""
        for code_file in self.code_files:
            # Chercher le fichier de test correspondant
            test_file = self.find_test_file(code_file)
            
            if test_file is None:
                # Pas de test trouvé
                loc = self.count_lines_of_code(code_file)
                
                # Ignorer les très petits fichiers (< 10 LOC)
                if loc < 10:
                    continue
                
                category, severity, reason = self.get_file_category(code_file)
                
                # Ajuster la sévérité selon la taille
                if loc > 200:
                    if severity == 'MEDIUM':
                        severity = 'HIGH'
                    elif severity == 'HIGH':
                        severity = 'CRITICAL'
                
                finding = TestCoverageFinding(
                    file_path=str(code_file.relative_to(self.root_dir)),
                    severity=severity,
                    category='NO_TEST',
                    description=f'{reason} ({loc} LOC)',
                    recommendation='Créer un fichier de test avec au moins les cas critiques',
                    lines_of_code=loc,
                )
                
                self.findings.append(finding)
    
    def analyze(self) -> Dict[str, Any]:
        """Lance l'analyse complète du projet."""
        self.findings = []
        self.test_files = set()
        self.code_files = set()
        
        # Collecter les fichiers
        self.collect_files()
        
        # Analyser la couverture
        self.analyze_coverage()
        
        # Calculer les métriques
        severity_counts = {
            'CRITICAL': 0,
            'HIGH': 0,
            'MEDIUM': 0,
            'LOW': 0,
        }
        
        total_loc = 0
        untested_loc = 0
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            untested_loc += finding.lines_of_code
        
        for code_file in self.code_files:
            total_loc += self.count_lines_of_code(code_file)
        
        coverage_percent = 0
        if total_loc > 0:
            coverage_percent = ((total_loc - untested_loc) / total_loc) * 100
        
        return {
            'total_code_files': len(self.code_files),
            'total_test_files': len(self.test_files),
            'files_without_tests': len(self.findings),
            'severity_counts': severity_counts,
            'total_lines_of_code': total_loc,
            'untested_lines_of_code': untested_loc,
            'estimated_coverage_percent': round(coverage_percent, 2),
            'findings': [
                {
                    'file': f.file_path,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
                    'lines_of_code': f.lines_of_code,
                }
                for f in sorted(self.findings, key=lambda x: (
                    {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}[x.severity],
                    -x.lines_of_code
                ))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        results = self.analyze()
        
        if results['files_without_tests'] == 0:
            return "✅ Tous les fichiers critiques ont des tests"
        
        severity = results['severity_counts']
        coverage = results['estimated_coverage_percent']
        
        summary = [
            f"🧪 A11 - Tests Coverage: {results['files_without_tests']} fichiers sans tests",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
            f"\n   Statistiques:",
            f"   - Fichiers de code: {results['total_code_files']}",
            f"   - Fichiers de test: {results['total_test_files']}",
            f"   - Couverture estimée: {coverage:.1f}%",
            f"   - LOC non testées: {results['untested_lines_of_code']:,}",
        ]
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    import json
    from datetime import datetime
    
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print(f"🔍 A11 - Tests Coverage Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A11TestsAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a11_tests_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
