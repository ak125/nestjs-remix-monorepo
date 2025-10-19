"""
A7 - Performance Analysis Agent
Analyse les problèmes de performance du code.
"""

import re
import json
from pathlib import Path
from typing import List, Dict, Any, Set
from dataclasses import dataclass


@dataclass
class PerformanceFinding:
    """Résultat d'analyse de performance."""
    file_path: str
    line_number: int
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # BUNDLE_SIZE, MEMORY_LEAK, N_PLUS_1, BLOCKING_RENDER, etc.
    description: str
    recommendation: str
    impact: str  # Description de l'impact performance


class A7PerformanceAgent:
    """
    Agent A7 - Analyse de performance.
    
    Détecte:
    - Imports lourds (moment.js, lodash entier, etc.)
    - Boucles dans des boucles (N+1 queries)
    - Memory leaks potentiels (event listeners non nettoyés)
    - Blocking renders (synchronous operations in render)
    - Large dependencies
    - Console.log en production
    """
    
    # Bibliothèques lourdes à éviter
    HEAVY_IMPORTS = {
        'moment': {
            'size': '~232KB',
            'alternative': 'date-fns ou dayjs (~2KB)',
            'severity': 'HIGH',
        },
        'lodash': {
            'size': '~72KB',
            'alternative': 'lodash-es avec tree-shaking ou fonctions natives',
            'severity': 'MEDIUM',
        },
        'axios': {
            'size': '~14KB',
            'alternative': 'fetch native ou ky (~3KB)',
            'severity': 'LOW',
        },
    }
    
    # Patterns de problèmes de performance
    PERFORMANCE_PATTERNS = {
        'console_log': {
            'pattern': r'console\.(log|debug|info|warn|error)\s*\(',
            'severity': 'MEDIUM',
            'category': 'PRODUCTION_DEBUG',
            'description': 'console.log laissé en production',
            'recommendation': 'Utiliser un logger conditionnel ou supprimer les console.log',
            'impact': 'Ralentit l\'exécution et peut exposer des données sensibles',
        },
        'nested_loops': {
            'pattern': r'for\s*\([^)]+\)\s*{[^}]*for\s*\(',
            'severity': 'HIGH',
            'category': 'N_PLUS_1',
            'description': 'Boucles imbriquées détectées (complexité O(n²))',
            'recommendation': 'Utiliser des Map/Set pour recherches O(1) ou réorganiser la logique',
            'impact': 'Ralentissement exponentiel avec données volumineuses',
        },
        'synchronous_fs': {
            'pattern': r'fs\.(readFileSync|writeFileSync|existsSync)',
            'severity': 'CRITICAL',
            'category': 'BLOCKING_IO',
            'description': 'Opération filesystem synchrone (bloque le thread)',
            'recommendation': 'Utiliser les versions async (readFile, writeFile, exists)',
            'impact': 'Bloque le serveur entier pendant l\'I/O',
        },
        'json_parse_large': {
            'pattern': r'JSON\.parse\([^)]{100,}\)',
            'severity': 'MEDIUM',
            'category': 'BLOCKING_PARSE',
            'description': 'Parsing JSON potentiellement lourd de façon synchrone',
            'recommendation': 'Parser en streaming ou utiliser un worker',
            'impact': 'Peut bloquer le thread principal',
        },
        'settimeout_0': {
            'pattern': r'setTimeout\s*\([^,]+,\s*0\s*\)',
            'severity': 'LOW',
            'category': 'ANTI_PATTERN',
            'description': 'setTimeout(..., 0) utilisé (souvent anti-pattern)',
            'recommendation': 'Utiliser queueMicrotask() ou restructurer le code',
            'impact': 'Mauvaise pratique, préférer des solutions plus propres',
        },
        'multiple_renders': {
            'pattern': r'(useState|setState)\s*\([^)]+\)[^;]{0,50}(useState|setState)',
            'severity': 'MEDIUM',
            'category': 'MULTIPLE_RENDERS',
            'description': 'Multiples setState consécutifs (cause plusieurs re-renders)',
            'recommendation': 'Batching des updates ou utiliser useReducer',
            'impact': 'Plusieurs re-renders inutiles',
        },
        'inline_functions': {
            'pattern': r'(onClick|onChange|onSubmit)=\{[^}]*=>\s*',
            'severity': 'LOW',
            'category': 'INLINE_FUNCTION',
            'description': 'Fonction inline dans un handler (re-créée à chaque render)',
            'recommendation': 'Extraire dans useCallback ou définir hors du composant',
            'impact': 'Re-création de fonction à chaque render',
        },
        'unmemoized_computation': {
            'pattern': r'\.map\([^)]+\)\.filter\([^)]+\)\.map\(',
            'severity': 'MEDIUM',
            'category': 'CHAIN_OPERATIONS',
            'description': 'Chaîne de .map().filter().map() non optimisée',
            'recommendation': 'Combiner en une seule passe ou utiliser useMemo',
            'impact': 'Parcours multiple du même tableau',
        },
    }
    
    # Extensions à analyser
    EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx'}
    
    IGNORE_PATTERNS = [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '__pycache__',
        '.git',
        'test',
        'spec',
        '.test.',
        '.spec.',
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A7.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[PerformanceFinding] = []
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        # Ignorer certains patterns
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        return file_path.suffix in self.EXTENSIONS
    
    def check_heavy_imports(self, file_path: Path, content: str) -> List[PerformanceFinding]:
        """Détecte les imports de bibliothèques lourdes."""
        findings = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            for lib, info in self.HEAVY_IMPORTS.items():
                # Détection d'import complet (pas tree-shaken)
                patterns = [
                    rf'import\s+{lib}\s+from\s+["\']' + lib + r'["\']',
                    rf'require\s*\(\s*["\']' + lib + r'["\']\s*\)',
                ]
                
                for pattern in patterns:
                    if re.search(pattern, line):
                        finding = PerformanceFinding(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=i,
                            severity=info['severity'],
                            category='HEAVY_IMPORT',
                            description=f'Import lourd détecté: {lib} ({info["size"]})',
                            recommendation=f'Alternative: {info["alternative"]}',
                            impact=f'Ajoute {info["size"]} au bundle',
                        )
                        findings.append(finding)
        
        return findings
    
    def check_performance_patterns(self, file_path: Path, content: str) -> List[PerformanceFinding]:
        """Détecte les patterns de problèmes de performance."""
        findings = []
        lines = content.split('\n')
        
        for pattern_name, pattern_info in self.PERFORMANCE_PATTERNS.items():
            pattern = pattern_info['pattern']
            
            # Chercher dans le contenu complet pour les patterns multilignes
            if pattern_name in ['nested_loops']:
                matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
                for match in matches:
                    # Trouver le numéro de ligne
                    line_num = content[:match.start()].count('\n') + 1
                    
                    finding = PerformanceFinding(
                        file_path=str(file_path.relative_to(self.root_dir)),
                        line_number=line_num,
                        severity=pattern_info['severity'],
                        category=pattern_info['category'],
                        description=pattern_info['description'],
                        recommendation=pattern_info['recommendation'],
                        impact=pattern_info['impact'],
                    )
                    findings.append(finding)
            else:
                # Chercher ligne par ligne
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line):
                        # Ignorer les commentaires
                        if line.strip().startswith(('//','#', '/*', '*')):
                            continue
                        
                        finding = PerformanceFinding(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=i,
                            severity=pattern_info['severity'],
                            category=pattern_info['category'],
                            description=pattern_info['description'],
                            recommendation=pattern_info['recommendation'],
                            impact=pattern_info['impact'],
                        )
                        findings.append(finding)
        
        return findings
    
    def analyze_bundle_size(self) -> List[PerformanceFinding]:
        """Analyse la taille potentielle du bundle."""
        findings = []
        
        # Vérifier package.json pour détecter les dépendances lourdes
        package_files = list(self.root_dir.rglob('package.json'))
        
        for pkg_file in package_files:
            if 'node_modules' in str(pkg_file):
                continue
            
            try:
                with open(pkg_file, 'r', encoding='utf-8') as f:
                    pkg_data = json.load(f)
                
                deps = {**pkg_data.get('dependencies', {}), **pkg_data.get('devDependencies', {})}
                
                for dep, version in deps.items():
                    if dep in self.HEAVY_IMPORTS:
                        info = self.HEAVY_IMPORTS[dep]
                        finding = PerformanceFinding(
                            file_path=str(pkg_file.relative_to(self.root_dir)),
                            line_number=0,
                            severity=info['severity'],
                            category='HEAVY_DEPENDENCY',
                            description=f'Dépendance lourde: {dep} ({info["size"]})',
                            recommendation=f'Alternative: {info["alternative"]}',
                            impact=f'Impact bundle: {info["size"]}',
                        )
                        findings.append(finding)
            
            except Exception:
                pass
        
        return findings
    
    def analyze_file(self, file_path: Path) -> List[PerformanceFinding]:
        """Analyse un fichier pour des problèmes de performance."""
        findings = []
        
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            
            # Vérifier les imports lourds
            findings.extend(self.check_heavy_imports(file_path, content))
            
            # Vérifier les patterns de performance
            findings.extend(self.check_performance_patterns(file_path, content))
        
        except Exception as e:
            pass
        
        return findings
    
    def analyze(self) -> Dict[str, Any]:
        """Lance l'analyse complète du projet."""
        self.findings = []
        
        # Analyser la taille du bundle
        self.findings.extend(self.analyze_bundle_size())
        
        # Analyser tous les fichiers
        for file_path in self.root_dir.rglob('*'):
            if file_path.is_file() and self.should_analyze(file_path):
                file_findings = self.analyze_file(file_path)
                self.findings.extend(file_findings)
        
        # Calculer les métriques
        severity_counts = {
            'CRITICAL': 0,
            'HIGH': 0,
            'MEDIUM': 0,
            'LOW': 0,
        }
        
        category_counts = {}
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            category_counts[finding.category] = category_counts.get(finding.category, 0) + 1
        
        return {
            'total_issues': len(self.findings),
            'severity_counts': severity_counts,
            'category_counts': category_counts,
            'findings': [
                {
                    'file': f.file_path,
                    'line': f.line_number,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
                    'impact': f.impact,
                }
                for f in sorted(self.findings, key=lambda x: (
                    {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}[x.severity],
                    x.file_path,
                    x.line_number
                ))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        if not self.findings:
            return "✅ Aucun problème de performance détecté"
        
        results = self.analyze()
        severity = results['severity_counts']
        
        summary = [
            f"⚡ A7 - Performance: {len(self.findings)} problèmes détectés",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
        ]
        
        # Top catégories
        top_categories = sorted(
            results['category_counts'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        if top_categories:
            summary.append("\n   Top problèmes:")
            for cat, count in top_categories:
                summary.append(f"   - {cat}: {count}")
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    from datetime import datetime
    
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print(f"🔍 A7 - Performance Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A7PerformanceAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a7_performance_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
