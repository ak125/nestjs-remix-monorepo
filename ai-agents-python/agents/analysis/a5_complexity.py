"""
A5 - Code Complexity Agent
Analyse la complexité cyclomatique et cognitive du code.
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Set
from dataclasses import dataclass


@dataclass
class ComplexityFinding:
    """Résultat d'analyse de complexité."""
    file_path: str
    function_name: str
    line_number: int
    cyclomatic_complexity: int
    cognitive_complexity: int
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    recommendation: str


class A5ComplexityAgent:
    """
    Agent A5 - Analyse de complexité du code.
    
    Calcule:
    - Complexité cyclomatique (McCabe)
    - Complexité cognitive
    - Profondeur de nidification
    - Nombre de paramètres
    """
    
    # Seuils de complexité
    THRESHOLDS = {
        'cyclomatic': {
            'CRITICAL': 20,
            'HIGH': 15,
            'MEDIUM': 10,
            'LOW': 6,
        },
        'cognitive': {
            'CRITICAL': 25,
            'HIGH': 15,
            'MEDIUM': 10,
            'LOW': 5,
        },
        'nesting': {
            'CRITICAL': 5,
            'HIGH': 4,
            'MEDIUM': 3,
        },
        'parameters': {
            'HIGH': 7,
            'MEDIUM': 5,
        },
    }
    
    # Extensions à analyser
    EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py'}
    
    # Patterns pour détecter les fonctions
    FUNCTION_PATTERNS = [
        # TypeScript/JavaScript
        r'(?:async\s+)?function\s+(\w+)\s*\(',
        r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>',
        r'(\w+)\s*\([^)]*\)\s*{',  # méthodes de classe
        # Python
        r'def\s+(\w+)\s*\(',
        r'async\s+def\s+(\w+)\s*\(',
    ]
    
    # Mots-clés qui augmentent la complexité cyclomatique
    CYCLOMATIC_KEYWORDS = {
        'if', 'else', 'elif', 'for', 'while', 'case', 'catch',
        'and', 'or', '&&', '||', '?', 'break', 'continue', 'return'
    }
    
    # Mots-clés qui augmentent la complexité cognitive
    COGNITIVE_KEYWORDS = {
        'if', 'else', 'elif', 'for', 'while', 'case', 'catch',
        'and', 'or', '&&', '||', '?', 'break', 'continue'
    }
    
    IGNORE_PATTERNS = [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '__pycache__',
        '.git',
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A5.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[ComplexityFinding] = []
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        return file_path.suffix in self.EXTENSIONS
    
    def extract_functions(self, content: str, lines: List[str]) -> List[Dict[str, Any]]:
        """
        Extrait les fonctions d'un fichier.
        
        Returns:
            Liste de dicts avec {name, start_line, end_line, content}
        """
        functions = []
        
        for pattern in self.FUNCTION_PATTERNS:
            for match in re.finditer(pattern, content):
                func_name = match.group(1)
                start_pos = match.start()
                
                # Trouver le numéro de ligne
                line_num = content[:start_pos].count('\n') + 1
                
                # Extraire le corps de la fonction (simplification)
                func_content = self._extract_function_body(lines, line_num)
                
                if func_content:
                    functions.append({
                        'name': func_name,
                        'start_line': line_num,
                        'content': func_content,
                    })
        
        return functions
    
    def _extract_function_body(self, lines: List[str], start_line: int) -> str:
        """Extrait le corps d'une fonction (simple heuristique)."""
        body_lines = []
        brace_count = 0
        started = False
        
        for i in range(start_line - 1, len(lines)):
            line = lines[i]
            
            # Compter les accolades
            brace_count += line.count('{') - line.count('}')
            
            if '{' in line:
                started = True
            
            body_lines.append(line)
            
            # Fin de fonction
            if started and brace_count == 0:
                break
            
            # Limite de 200 lignes
            if len(body_lines) > 200:
                break
        
        return '\n'.join(body_lines)
    
    def calculate_cyclomatic_complexity(self, code: str) -> int:
        """
        Calcule la complexité cyclomatique.
        
        Formule: M = E - N + 2P
        Simplification: 1 + nombre de points de décision
        """
        complexity = 1  # Base
        
        # Compter les mots-clés de décision
        for keyword in self.CYCLOMATIC_KEYWORDS:
            # Utiliser des regex pour éviter les faux positifs
            if keyword in {'&&', '||', '?'}:
                complexity += code.count(keyword)
            else:
                # Utiliser word boundaries
                pattern = r'\b' + re.escape(keyword) + r'\b'
                complexity += len(re.findall(pattern, code))
        
        return complexity
    
    def calculate_cognitive_complexity(self, code: str) -> int:
        """
        Calcule la complexité cognitive.
        
        Plus sophistiqué que la complexité cyclomatique:
        - Pénalise la nidification
        - Pénalise les séquences complexes
        """
        complexity = 0
        nesting_level = 0
        lines = code.split('\n')
        
        for line in lines:
            stripped = line.strip()
            
            # Augmenter le niveau de nidification
            if any(kw in stripped for kw in ['if', 'for', 'while', 'case']):
                complexity += 1 + nesting_level
                nesting_level += 1
            
            # Opérateurs logiques
            complexity += stripped.count('&&') + stripped.count('||')
            
            # Diminuer le niveau de nidification
            if stripped.startswith('}'):
                nesting_level = max(0, nesting_level - 1)
        
        return complexity
    
    def calculate_nesting_depth(self, code: str) -> int:
        """Calcule la profondeur de nidification maximale."""
        max_depth = 0
        current_depth = 0
        
        for char in code:
            if char == '{':
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == '}':
                current_depth = max(0, current_depth - 1)
        
        return max_depth
    
    def count_parameters(self, code: str) -> int:
        """Compte le nombre de paramètres d'une fonction."""
        # Extraire la signature
        match = re.search(r'\(([^)]*)\)', code[:200])
        if not match:
            return 0
        
        params = match.group(1)
        if not params.strip():
            return 0
        
        # Compter les virgules (approximation)
        return params.count(',') + 1
    
    def analyze_function(self, func: Dict[str, Any], file_path: Path) -> ComplexityFinding:
        """Analyse la complexité d'une fonction."""
        code = func['content']
        
        cyclomatic = self.calculate_cyclomatic_complexity(code)
        cognitive = self.calculate_cognitive_complexity(code)
        nesting = self.calculate_nesting_depth(code)
        params = self.count_parameters(code)
        
        # Déterminer la sévérité
        severity = 'LOW'
        if cyclomatic >= self.THRESHOLDS['cyclomatic']['CRITICAL']:
            severity = 'CRITICAL'
        elif cyclomatic >= self.THRESHOLDS['cyclomatic']['HIGH']:
            severity = 'HIGH'
        elif cyclomatic >= self.THRESHOLDS['cyclomatic']['MEDIUM']:
            severity = 'MEDIUM'
        
        # Générer une recommandation
        recommendations = []
        if cyclomatic > self.THRESHOLDS['cyclomatic']['MEDIUM']:
            recommendations.append('Diviser en fonctions plus petites')
        if cognitive > self.THRESHOLDS['cognitive']['MEDIUM']:
            recommendations.append('Simplifier la logique conditionnelle')
        if nesting > self.THRESHOLDS['nesting']['MEDIUM']:
            recommendations.append('Réduire la profondeur de nidification (early returns)')
        if params > self.THRESHOLDS['parameters']['MEDIUM']:
            recommendations.append('Réduire le nombre de paramètres (utiliser des objets)')
        
        recommendation = ' | '.join(recommendations) if recommendations else 'Acceptable'
        
        return ComplexityFinding(
            file_path=str(file_path.relative_to(self.root_dir)),
            function_name=func['name'],
            line_number=func['start_line'],
            cyclomatic_complexity=cyclomatic,
            cognitive_complexity=cognitive,
            severity=severity,
            recommendation=recommendation,
        )
    
    def analyze_file(self, file_path: Path) -> List[ComplexityFinding]:
        """Analyse la complexité d'un fichier."""
        findings = []
        
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            # Extraire les fonctions
            functions = self.extract_functions(content, lines)
            
            # Analyser chaque fonction
            for func in functions:
                finding = self.analyze_function(func, file_path)
                
                # Ne garder que les fonctions complexes
                if finding.cyclomatic_complexity >= self.THRESHOLDS['cyclomatic']['LOW']:
                    findings.append(finding)
        
        except Exception as e:
            pass
        
        return findings
    
    def analyze(self) -> Dict[str, Any]:
        """Lance l'analyse complète du projet."""
        self.findings = []
        
        # Parcourir tous les fichiers
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
        
        total_cyclomatic = 0
        total_cognitive = 0
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            total_cyclomatic += finding.cyclomatic_complexity
            total_cognitive += finding.cognitive_complexity
        
        avg_cyclomatic = total_cyclomatic / len(self.findings) if self.findings else 0
        avg_cognitive = total_cognitive / len(self.findings) if self.findings else 0
        
        return {
            'total_complex_functions': len(self.findings),
            'severity_counts': severity_counts,
            'average_cyclomatic': round(avg_cyclomatic, 2),
            'average_cognitive': round(avg_cognitive, 2),
            'max_cyclomatic': max((f.cyclomatic_complexity for f in self.findings), default=0),
            'max_cognitive': max((f.cognitive_complexity for f in self.findings), default=0),
            'findings': [
                {
                    'file': f.file_path,
                    'function': f.function_name,
                    'line': f.line_number,
                    'cyclomatic': f.cyclomatic_complexity,
                    'cognitive': f.cognitive_complexity,
                    'severity': f.severity,
                    'recommendation': f.recommendation,
                }
                for f in sorted(self.findings, key=lambda x: (
                    {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}[x.severity],
                    -x.cyclomatic_complexity
                ))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        if not self.findings:
            return "✅ Aucune fonction trop complexe détectée"
        
        results = self.analyze()
        severity = results['severity_counts']
        
        summary = [
            f"🧠 A5 - Code Complexity: {len(self.findings)} fonctions complexes",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
            f"\n   Moyennes:",
            f"   - Cyclomatique: {results['average_cyclomatic']}",
            f"   - Cognitive: {results['average_cognitive']}",
        ]
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    import json
    from datetime import datetime
    
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print(f"🔍 A5 - Complexity Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A5ComplexityAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    output_file = Path('a5_complexity_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
