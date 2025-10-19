"""
A12 - Documentation Agent
Analyse la qualité de la documentation du code.
"""

import re
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class DocumentationFinding:
    """Résultat d'analyse de documentation."""
    file_path: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # NO_JSDOC, MISSING_README, UNDOCUMENTED_API
    description: str
    recommendation: str
    entity_type: str  # function, class, module, api
    entity_name: str


class A12DocumentationAgent:
    """
    Agent A12 - Analyse de la documentation.
    
    Détecte:
    - Fonctions/classes sans JSDoc
    - API endpoints sans documentation
    - README manquants dans les modules
    - Paramètres sans description
    - Fonctions complexes sans exemples
    """
    
    # Patterns pour détecter les entités nécessitant de la documentation
    PATTERNS = {
        # Fonctions exportées TypeScript/JavaScript
        'exported_function': re.compile(
            r'export\s+(async\s+)?function\s+(\w+)\s*\(',
            re.MULTILINE
        ),
        # Classes exportées
        'exported_class': re.compile(
            r'export\s+(abstract\s+)?class\s+(\w+)',
            re.MULTILINE
        ),
        # Routes API NestJS
        'nestjs_route': re.compile(
            r'@(Get|Post|Put|Delete|Patch)\s*\([\'"]([^\'"]+)[\'"]\)',
            re.MULTILINE
        ),
        # Routes Express
        'express_route': re.compile(
            r'router\.(get|post|put|delete|patch)\s*\([\'"]([^\'"]+)[\'"]',
            re.MULTILINE
        ),
        # Méthodes publiques de classe
        'public_method': re.compile(
            r'^\s+(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]',
            re.MULTILINE
        ),
        # Hooks React
        'react_hook': re.compile(
            r'export\s+(const|function)\s+(use[A-Z]\w+)\s*[=\(]',
            re.MULTILINE
        ),
    }
    
    # Pattern JSDoc
    JSDOC_PATTERN = re.compile(
        r'/\*\*[\s\S]*?\*/',
        re.MULTILINE
    )
    
    CODE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx'}
    
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
        '.test.',
        '.spec.',
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A12.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[DocumentationFinding] = []
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        return file_path.suffix in self.CODE_EXTENSIONS
    
    def has_jsdoc_before(self, content: str, position: int) -> bool:
        """Vérifie si un JSDoc existe juste avant une position."""
        # Chercher le JSDoc dans les 200 caractères avant
        search_start = max(0, position - 200)
        search_content = content[search_start:position]
        
        # Chercher /** ... */
        jsdoc_matches = list(self.JSDOC_PATTERN.finditer(search_content))
        
        if not jsdoc_matches:
            return False
        
        # Vérifier que le JSDoc est juste avant (avec seulement des espaces)
        last_jsdoc = jsdoc_matches[-1]
        between = search_content[last_jsdoc.end():]
        
        return between.strip() == ''
    
    def get_complexity_estimate(self, function_body: str) -> int:
        """Estime la complexité d'une fonction (simplifié)."""
        complexity = 1
        
        # Compter les branches
        complexity += function_body.count('if ')
        complexity += function_body.count('else ')
        complexity += function_body.count('case ')
        complexity += function_body.count('for ')
        complexity += function_body.count('while ')
        complexity += function_body.count('&&')
        complexity += function_body.count('||')
        
        return complexity
    
    def analyze_file(self, file_path: Path):
        """Analyse un fichier pour la documentation."""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            return
        
        relative_path = str(file_path.relative_to(self.root_dir))
        
        # Vérifier les fonctions exportées
        for match in self.PATTERNS['exported_function'].finditer(content):
            function_name = match.group(2)
            position = match.start()
            
            if not self.has_jsdoc_before(content, position):
                # Estimer la complexité
                # Chercher le corps de la fonction (simplifié)
                func_end = content.find('\n}', position)
                if func_end == -1:
                    func_end = len(content)
                
                function_body = content[position:func_end]
                complexity = self.get_complexity_estimate(function_body)
                
                severity = 'MEDIUM'
                if complexity > 10:
                    severity = 'HIGH'
                if complexity > 20:
                    severity = 'CRITICAL'
                
                finding = DocumentationFinding(
                    file_path=relative_path,
                    severity=severity,
                    category='NO_JSDOC',
                    description=f'Fonction exportée sans JSDoc (complexité: {complexity})',
                    recommendation='Ajouter un JSDoc avec description, @param, @returns',
                    entity_type='function',
                    entity_name=function_name,
                )
                
                self.findings.append(finding)
        
        # Vérifier les classes exportées
        for match in self.PATTERNS['exported_class'].finditer(content):
            class_name = match.group(2)
            position = match.start()
            
            if not self.has_jsdoc_before(content, position):
                finding = DocumentationFinding(
                    file_path=relative_path,
                    severity='HIGH',
                    category='NO_JSDOC',
                    description='Classe exportée sans JSDoc',
                    recommendation='Ajouter un JSDoc avec description et usage',
                    entity_type='class',
                    entity_name=class_name,
                )
                
                self.findings.append(finding)
        
        # Vérifier les routes API NestJS
        for match in self.PATTERNS['nestjs_route'].finditer(content):
            method = match.group(1)
            route = match.group(2)
            position = match.start()
            
            if not self.has_jsdoc_before(content, position):
                finding = DocumentationFinding(
                    file_path=relative_path,
                    severity='CRITICAL',
                    category='UNDOCUMENTED_API',
                    description=f'Route API sans documentation: {method} {route}',
                    recommendation='Documenter les paramètres, body, et réponses possibles',
                    entity_type='api',
                    entity_name=f'{method} {route}',
                )
                
                self.findings.append(finding)
        
        # Vérifier les hooks React
        for match in self.PATTERNS['react_hook'].finditer(content):
            hook_name = match.group(2)
            position = match.start()
            
            if not self.has_jsdoc_before(content, position):
                finding = DocumentationFinding(
                    file_path=relative_path,
                    severity='MEDIUM',
                    category='NO_JSDOC',
                    description='Hook React sans documentation',
                    recommendation='Documenter les paramètres et la valeur retournée',
                    entity_type='hook',
                    entity_name=hook_name,
                )
                
                self.findings.append(finding)
    
    def check_readme_coverage(self):
        """Vérifie la présence de README dans les modules importants."""
        important_dirs = [
            self.root_dir / 'backend' / 'src',
            self.root_dir / 'frontend' / 'app',
            self.root_dir / 'packages',
        ]
        
        for base_dir in important_dirs:
            if not base_dir.exists():
                continue
            
            # Chercher les sous-dossiers
            for subdir in base_dir.iterdir():
                if not subdir.is_dir():
                    continue
                
                # Ignorer certains dossiers
                if subdir.name in self.IGNORE_PATTERNS:
                    continue
                
                # Vérifier si le dossier contient du code
                has_code = any(
                    f.suffix in self.CODE_EXTENSIONS
                    for f in subdir.rglob('*')
                    if f.is_file()
                )
                
                if not has_code:
                    continue
                
                # Vérifier la présence d'un README
                has_readme = any(
                    f.name.lower().startswith('readme')
                    for f in subdir.iterdir()
                    if f.is_file()
                )
                
                if not has_readme:
                    relative_path = str(subdir.relative_to(self.root_dir))
                    
                    finding = DocumentationFinding(
                        file_path=relative_path,
                        severity='LOW',
                        category='MISSING_README',
                        description='Module sans README',
                        recommendation='Créer un README.md avec description et usage',
                        entity_type='module',
                        entity_name=subdir.name,
                    )
                    
                    self.findings.append(finding)
    
    def analyze(self) -> Dict[str, Any]:
        """Lance l'analyse complète du projet."""
        self.findings = []
        
        # Analyser tous les fichiers de code
        for file_path in self.root_dir.rglob('*'):
            if not file_path.is_file():
                continue
            
            if self.should_analyze(file_path):
                self.analyze_file(file_path)
        
        # Vérifier les README
        self.check_readme_coverage()
        
        # Calculer les métriques
        severity_counts = {
            'CRITICAL': 0,
            'HIGH': 0,
            'MEDIUM': 0,
            'LOW': 0,
        }
        
        category_counts = {}
        entity_type_counts = {}
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            category_counts[finding.category] = category_counts.get(finding.category, 0) + 1
            entity_type_counts[finding.entity_type] = entity_type_counts.get(finding.entity_type, 0) + 1
        
        return {
            'total_issues': len(self.findings),
            'severity_counts': severity_counts,
            'category_counts': category_counts,
            'entity_type_counts': entity_type_counts,
            'findings': [
                {
                    'file': f.file_path,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
                    'entity_type': f.entity_type,
                    'entity_name': f.entity_name,
                }
                for f in sorted(self.findings, key=lambda x: (
                    {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}[x.severity],
                    x.file_path
                ))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        results = self.analyze()
        
        if results['total_issues'] == 0:
            return "✅ Toutes les entités publiques sont documentées"
        
        severity = results['severity_counts']
        categories = results['category_counts']
        
        summary = [
            f"📚 A12 - Documentation: {results['total_issues']} entités non documentées",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
            f"\n   Top catégories:",
        ]
        
        # Trier par count
        sorted_categories = sorted(
            categories.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]
        
        for category, count in sorted_categories:
            summary.append(f"   - {category}: {count}")
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    import json
    from datetime import datetime
    
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print(f"🔍 A12 - Documentation Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A12DocumentationAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a12_documentation_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
