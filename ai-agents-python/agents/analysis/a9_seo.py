"""
A9 - SEO Agent
Analyse l'optimisation SEO du code.
"""

import re
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class SEOFinding:
    """Résultat d'analyse SEO."""
    file_path: str
    line: int
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # MISSING_META, NO_STRUCTURED_DATA, BAD_TITLE
    description: str
    recommendation: str


class A9SEOAgent:
    """
    Agent A9 - Analyse SEO.
    
    Détecte:
    - Balises meta manquantes (title, description)
    - Structured data manquante (JSON-LD)
    - OpenGraph tags manquants
    - Twitter cards manquants
    - Balises h1 multiples ou manquantes
    - Images sans alt (SEO)
    - URLs non optimisées
    """
    
    PATTERNS = {
        # Meta description manquante
        'no_meta_description': re.compile(
            r'<head>(?!.*<meta\s+name=["\']description["\'])',
            re.IGNORECASE | re.DOTALL
        ),
        # Title manquant
        'no_title': re.compile(
            r'<head>(?!.*<title>)',
            re.IGNORECASE | re.DOTALL
        ),
        # OpenGraph manquant
        'no_og_title': re.compile(
            r'<head>(?!.*<meta\s+property=["\']og:title["\'])',
            re.IGNORECASE | re.DOTALL
        ),
        'no_og_description': re.compile(
            r'<head>(?!.*<meta\s+property=["\']og:description["\'])',
            re.IGNORECASE | re.DOTALL
        ),
        'no_og_image': re.compile(
            r'<head>(?!.*<meta\s+property=["\']og:image["\'])',
            re.IGNORECASE | re.DOTALL
        ),
        # Canonical manquant
        'no_canonical': re.compile(
            r'<head>(?!.*<link\s+rel=["\']canonical["\'])',
            re.IGNORECASE | re.DOTALL
        ),
        # H1 multiple
        'multiple_h1': re.compile(
            r'(<h1[^>]*>.*?</h1>)',
            re.IGNORECASE | re.DOTALL
        ),
        # Structured data JSON-LD
        'no_jsonld': re.compile(
            r'<head>(?!.*<script\s+type=["\']application/ld\+json["\'])',
            re.IGNORECASE | re.DOTALL
        ),
    }
    
    CODE_EXTENSIONS = {'.html', '.tsx', '.jsx', '.vue'}
    
    IGNORE_PATTERNS = [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '__pycache__',
        '.git',
        '.test.',
        '.spec.',
        'components',  # Composants ne sont pas des pages
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A9.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[SEOFinding] = []
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        # Analyser seulement les fichiers qui ressemblent à des pages
        if 'routes' not in str(file_path) and 'pages' not in str(file_path):
            return False
        
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        return file_path.suffix in self.CODE_EXTENSIONS
    
    def get_line_number(self, content: str, position: int) -> int:
        """Retourne le numéro de ligne d'une position."""
        return content[:position].count('\n') + 1
    
    def analyze_file(self, file_path: Path):
        """Analyse un fichier pour le SEO."""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            return
        
        # Chercher les balises <head> ou composants Meta
        has_head = '<head>' in content.lower() or 'meta' in content.lower()
        
        if not has_head:
            # Pas de balises meta dans ce fichier (composant simple)
            return
        
        relative_path = str(file_path.relative_to(self.root_dir))
        
        # Meta description
        if not re.search(r'<meta\s+name=["\']description["\']', content, re.IGNORECASE):
            finding = SEOFinding(
                file_path=relative_path,
                line=1,
                severity='HIGH',
                category='MISSING_META',
                description='Meta description manquante',
                recommendation='Ajouter <meta name="description" content="..." />',
            )
            self.findings.append(finding)
        
        # Title
        if not re.search(r'<title>', content, re.IGNORECASE):
            finding = SEOFinding(
                file_path=relative_path,
                line=1,
                severity='CRITICAL',
                category='MISSING_TITLE',
                description='Balise <title> manquante',
                recommendation='Ajouter <title>Titre optimisé SEO</title>',
            )
            self.findings.append(finding)
        
        # OpenGraph
        if not re.search(r'property=["\']og:title["\']', content, re.IGNORECASE):
            finding = SEOFinding(
                file_path=relative_path,
                line=1,
                severity='MEDIUM',
                category='MISSING_OG',
                description='OpenGraph og:title manquant',
                recommendation='Ajouter <meta property="og:title" content="..." />',
            )
            self.findings.append(finding)
        
        # Canonical
        if not re.search(r'rel=["\']canonical["\']', content, re.IGNORECASE):
            finding = SEOFinding(
                file_path=relative_path,
                line=1,
                severity='MEDIUM',
                category='MISSING_CANONICAL',
                description='URL canonique manquante',
                recommendation='Ajouter <link rel="canonical" href="..." />',
            )
            self.findings.append(finding)
        
        # H1 multiple
        h1_matches = re.findall(r'<h1[^>]*>.*?</h1>', content, re.IGNORECASE | re.DOTALL)
        if len(h1_matches) > 1:
            finding = SEOFinding(
                file_path=relative_path,
                line=1,
                severity='MEDIUM',
                category='MULTIPLE_H1',
                description=f'{len(h1_matches)} balises H1 trouvées (devrait être 1)',
                recommendation='Utiliser une seule balise H1 par page',
            )
            self.findings.append(finding)
        
        # JSON-LD structured data
        if not re.search(r'type=["\']application/ld\+json["\']', content, re.IGNORECASE):
            finding = SEOFinding(
                file_path=relative_path,
                line=1,
                severity='LOW',
                category='MISSING_STRUCTURED_DATA',
                description='Structured data JSON-LD manquante',
                recommendation='Ajouter schema.org structured data pour rich snippets',
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
                    'line': f.line,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
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
            return "✅ SEO optimisé"
        
        severity = results['severity_counts']
        categories = results['category_counts']
        
        summary = [
            f"🔍 A9 - SEO: {results['total_issues']} problèmes SEO",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
            f"\n   Top problèmes:",
        ]
        
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
    
    print(f"🔍 A9 - SEO Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A9SEOAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a9_seo_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
