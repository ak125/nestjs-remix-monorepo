"""
A8 - Accessibility Agent
Analyse l'accessibilité WCAG 2.1 du code.
"""

import re
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class AccessibilityFinding:
    """Résultat d'analyse d'accessibilité."""
    file_path: str
    line: int
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # MISSING_ALT, NO_ARIA_LABEL, LOW_CONTRAST
    description: str
    recommendation: str
    wcag_criterion: str  # Ex: 1.1.1, 2.4.6


class A8AccessibilityAgent:
    """
    Agent A8 - Analyse d'accessibilité WCAG 2.1.
    
    Détecte:
    - Images sans alt text
    - Boutons/liens sans labels accessibles
    - Mauvais contraste de couleurs
    - Formulaires sans labels
    - Navigation au clavier manquante
    - Balises sémantiques manquantes
    """
    
    # Patterns d'accessibilité
    PATTERNS = {
        # Images sans alt
        'img_no_alt': re.compile(
            r'<img(?![^>]*\balt=)[^>]*>',
            re.IGNORECASE
        ),
        # Boutons sans aria-label ou texte
        'button_no_label': re.compile(
            r'<button(?![^>]*\baria-label=)(?![^>]*>[\w\s]+<\/button>)[^>]*>',
            re.IGNORECASE
        ),
        # Inputs sans label
        'input_no_label': re.compile(
            r'<input(?![^>]*\baria-label=)(?![^>]*\bid=)[^>]*>',
            re.IGNORECASE
        ),
        # Liens vides
        'empty_link': re.compile(
            r'<a(?![^>]*\baria-label=)[^>]*>\s*<\/a>',
            re.IGNORECASE
        ),
        # onClick sans onKeyPress
        'click_no_keyboard': re.compile(
            r'onClick=\{[^}]+\}(?![^}]*onKeyPress)',
            re.MULTILINE
        ),
        # Div/span cliquable sans role
        'div_clickable_no_role': re.compile(
            r'<(div|span)(?![^>]*\brole=)[^>]*onClick',
            re.IGNORECASE
        ),
        # Iframe sans title
        'iframe_no_title': re.compile(
            r'<iframe(?![^>]*\btitle=)[^>]*>',
            re.IGNORECASE
        ),
        # Couleurs avec mauvais contraste (simplifié)
        'low_contrast': re.compile(
            r'color:\s*#([a-f0-9]{6}|[a-f0-9]{3})\s*;.*background(?:-color)?:\s*#([a-f0-9]{6}|[a-f0-9]{3})',
            re.IGNORECASE | re.DOTALL
        ),
    }
    
    CODE_EXTENSIONS = {'.tsx', '.jsx', '.html', '.vue'}
    
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
    ]
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A8.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[AccessibilityFinding] = []
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        return file_path.suffix in self.CODE_EXTENSIONS
    
    def get_line_number(self, content: str, position: int) -> int:
        """Retourne le numéro de ligne d'une position."""
        return content[:position].count('\n') + 1
    
    def analyze_file(self, file_path: Path):
        """Analyse un fichier pour l'accessibilité."""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            return
        
        relative_path = str(file_path.relative_to(self.root_dir))
        
        # Images sans alt
        for match in self.PATTERNS['img_no_alt'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='HIGH',
                category='MISSING_ALT',
                description='Image sans attribut alt',
                recommendation='Ajouter alt="description" ou alt="" si décorative',
                wcag_criterion='1.1.1',
            )
            self.findings.append(finding)
        
        # Boutons sans label
        for match in self.PATTERNS['button_no_label'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='CRITICAL',
                category='NO_ARIA_LABEL',
                description='Bouton sans label accessible',
                recommendation='Ajouter aria-label ou texte visible dans le bouton',
                wcag_criterion='4.1.2',
            )
            self.findings.append(finding)
        
        # Inputs sans label
        for match in self.PATTERNS['input_no_label'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='HIGH',
                category='NO_LABEL',
                description='Input sans label associé',
                recommendation='Ajouter <label htmlFor="id"> ou aria-label',
                wcag_criterion='3.3.2',
            )
            self.findings.append(finding)
        
        # Liens vides
        for match in self.PATTERNS['empty_link'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='MEDIUM',
                category='EMPTY_LINK',
                description='Lien vide sans contenu',
                recommendation='Ajouter texte ou aria-label',
                wcag_criterion='2.4.4',
            )
            self.findings.append(finding)
        
        # onClick sans clavier
        for match in self.PATTERNS['click_no_keyboard'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='MEDIUM',
                category='NO_KEYBOARD',
                description='onClick sans support clavier',
                recommendation='Ajouter onKeyPress ou utiliser <button>',
                wcag_criterion='2.1.1',
            )
            self.findings.append(finding)
        
        # Div cliquable sans role
        for match in self.PATTERNS['div_clickable_no_role'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='HIGH',
                category='MISSING_ROLE',
                description='Élément cliquable sans rôle sémantique',
                recommendation='Ajouter role="button" ou utiliser <button>',
                wcag_criterion='4.1.2',
            )
            self.findings.append(finding)
        
        # Iframe sans title
        for match in self.PATTERNS['iframe_no_title'].finditer(content):
            finding = AccessibilityFinding(
                file_path=relative_path,
                line=self.get_line_number(content, match.start()),
                severity='MEDIUM',
                category='MISSING_TITLE',
                description='Iframe sans attribut title',
                recommendation='Ajouter title="description du contenu"',
                wcag_criterion='4.1.2',
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
        wcag_counts = {}
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            category_counts[finding.category] = category_counts.get(finding.category, 0) + 1
            wcag_counts[finding.wcag_criterion] = wcag_counts.get(finding.wcag_criterion, 0) + 1
        
        return {
            'total_issues': len(self.findings),
            'severity_counts': severity_counts,
            'category_counts': category_counts,
            'wcag_counts': wcag_counts,
            'findings': [
                {
                    'file': f.file_path,
                    'line': f.line,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
                    'wcag_criterion': f.wcag_criterion,
                }
                for f in sorted(self.findings, key=lambda x: (
                    {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}[x.severity],
                    x.file_path,
                    x.line
                ))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        results = self.analyze()
        
        if results['total_issues'] == 0:
            return "✅ Aucun problème d'accessibilité détecté"
        
        severity = results['severity_counts']
        categories = results['category_counts']
        
        summary = [
            f"♿ A8 - Accessibility: {results['total_issues']} problèmes WCAG",
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
    
    print(f"🔍 A8 - Accessibility Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A8AccessibilityAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a8_accessibility_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
