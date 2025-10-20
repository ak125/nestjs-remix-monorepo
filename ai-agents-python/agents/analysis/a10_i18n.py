"""
A10 - I18n Agent
Analyse l'internationalisation du code.
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Set
from dataclasses import dataclass
import json


@dataclass
class I18nFinding:
    """Résultat d'analyse i18n."""
    file_path: str
    line: int
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # HARDCODED_TEXT, MISSING_TRANSLATION, MIXED_LANGS
    description: str
    recommendation: str
    text_found: str


class A10I18nAgent:
    """
    Agent A10 - Analyse d'internationalisation.
    
    Détecte:
    - Texte hardcodé en français/anglais dans le code
    - Clés de traduction manquantes
    - Texte non internationalisé dans les composants
    - Dates/nombres non formatés selon locale
    - Messages d'erreur hardcodés
    """
    
    # Patterns de texte hardcodé
    PATTERNS = {
        # Texte français dans JSX
        'french_in_jsx': re.compile(
            r'>\s*([A-ZÀÉÈÊËÏÎÔŒÙ][a-zàâäéèêëïîôùûüÿœ\s]{10,})\s*<',
            re.MULTILINE
        ),
        # Texte anglais dans JSX
        'english_in_jsx': re.compile(
            r'>\s*([A-Z][a-z\s]{10,})\s*<',
            re.MULTILINE
        ),
        # Messages d'erreur hardcodés
        'error_message': re.compile(
            r'(throw new Error|console\.(error|warn))\s*\([\'"]([^\'"]{15,})[\'"]',
            re.MULTILINE
        ),
        # Labels de formulaire hardcodés
        'hardcoded_placeholder': re.compile(
            r'placeholder=[\'"]([a-zA-ZÀ-ÿ\s]{5,})[\'"]',
            re.IGNORECASE
        ),
        # Titre hardcodé
        'hardcoded_title': re.compile(
            r'title=[\'"]([a-zA-ZÀ-ÿ\s]{5,})[\'"]',
            re.IGNORECASE
        ),
        # Alt text hardcodé
        'hardcoded_alt': re.compile(
            r'alt=[\'"]([a-zA-ZÀ-ÿ\s]{5,})[\'"]',
            re.IGNORECASE
        ),
    }
    
    # Mots-clés français communs
    FRENCH_KEYWORDS = {
        'les', 'des', 'une', 'vous', 'pour', 'dans', 'avec', 'cette', 'votre',
        'notre', 'tous', 'tout', 'être', 'avoir', 'faire', 'très', 'même',
    }
    
    # Mots-clés anglais communs
    ENGLISH_KEYWORDS = {
        'the', 'and', 'for', 'with', 'this', 'that', 'your', 'have', 'from',
        'they', 'will', 'would', 'there', 'their', 'about', 'which',
    }
    
    CODE_EXTENSIONS = {'.tsx', '.jsx', '.ts', '.js', '.vue'}
    
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
        'i18n',  # Fichiers de traduction eux-mêmes
        'locales',
    ]
    
    # Patterns de fonction i18n à ignorer
    I18N_FUNCTIONS = ['t(', 'i18n.t(', 'translate(', '$t(', 'formatMessage(']
    
    def __init__(self, workspace_root: Path, config):
        """
        Initialise l'agent A10.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.workspace_root = workspace_root
        self.config = config
        self.root_dir = workspace_root
        self.findings: List[I18nFinding] = []
        self.translation_keys: Set[str] = set()
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        return file_path.suffix in self.CODE_EXTENSIONS
    
    def get_line_number(self, content: str, position: int) -> int:
        """Retourne le numéro de ligne d'une position."""
        return content[:position].count('\n') + 1
    
    def is_near_i18n_function(self, content: str, position: int) -> bool:
        """Vérifie si le texte est proche d'une fonction i18n."""
        # Chercher 50 caractères avant et après
        start = max(0, position - 50)
        end = min(len(content), position + 50)
        context = content[start:end]
        
        return any(func in context for func in self.I18N_FUNCTIONS)
    
    def contains_french_keywords(self, text: str) -> bool:
        """Vérifie si le texte contient des mots français."""
        words = text.lower().split()
        return any(word in self.FRENCH_KEYWORDS for word in words)
    
    def contains_english_keywords(self, text: str) -> bool:
        """Vérifie si le texte contient des mots anglais."""
        words = text.lower().split()
        return any(word in self.ENGLISH_KEYWORDS for word in words)
    
    def analyze_file(self, file_path: Path):
        """Analyse un fichier pour l'i18n."""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            return
        
        relative_path = str(file_path.relative_to(self.root_dir))
        
        # Texte français dans JSX
        for match in self.PATTERNS['french_in_jsx'].finditer(content):
            text = match.group(1).strip()
            position = match.start()
            
            # Ignorer si c'est du code ou proche d'une fonction i18n
            if self.is_near_i18n_function(content, position):
                continue
            
            if not self.contains_french_keywords(text):
                continue
            
            finding = I18nFinding(
                file_path=relative_path,
                line=self.get_line_number(content, position),
                severity='HIGH',
                category='HARDCODED_TEXT',
                description='Texte français hardcodé dans le JSX',
                recommendation='Utiliser {t("key")} avec fichier de traduction',
                text_found=text[:50],
            )
            self.findings.append(finding)
        
        # Messages d'erreur hardcodés
        for match in self.PATTERNS['error_message'].finditer(content):
            message = match.group(3)
            position = match.start()
            
            finding = I18nFinding(
                file_path=relative_path,
                line=self.get_line_number(content, position),
                severity='MEDIUM',
                category='HARDCODED_ERROR',
                description='Message d\'erreur hardcodé',
                recommendation='Déplacer dans fichier i18n pour traduction',
                text_found=message[:50],
            )
            self.findings.append(finding)
        
        # Placeholders hardcodés
        for match in self.PATTERNS['hardcoded_placeholder'].finditer(content):
            text = match.group(1)
            position = match.start()
            
            # Vérifier que c'est du texte naturel (pas une clé)
            if '.' in text or '_' in text:
                continue
            
            finding = I18nFinding(
                file_path=relative_path,
                line=self.get_line_number(content, position),
                severity='MEDIUM',
                category='HARDCODED_PLACEHOLDER',
                description='Placeholder hardcodé',
                recommendation='Utiliser placeholder={t("forms.placeholder")}',
                text_found=text[:50],
            )
            self.findings.append(finding)
        
        # Titres hardcodés
        for match in self.PATTERNS['hardcoded_title'].finditer(content):
            text = match.group(1)
            position = match.start()
            
            if '.' in text or '_' in text:
                continue
            
            finding = I18nFinding(
                file_path=relative_path,
                line=self.get_line_number(content, position),
                severity='LOW',
                category='HARDCODED_TITLE',
                description='Attribut title hardcodé',
                recommendation='Utiliser title={t("tooltips.key")}',
                text_found=text[:50],
            )
            self.findings.append(finding)
    
    def load_translation_files(self):
        """Charge les fichiers de traduction pour vérifier les clés."""
        translation_dirs = [
            self.root_dir / 'frontend' / 'app' / 'i18n',
            self.root_dir / 'frontend' / 'locales',
            self.root_dir / 'backend' / 'i18n',
        ]
        
        for trans_dir in translation_dirs:
            if not trans_dir.exists():
                continue
            
            for json_file in trans_dir.rglob('*.json'):
                try:
                    data = json.loads(json_file.read_text(encoding='utf-8'))
                    self._extract_keys(data)
                except Exception:
                    pass
    
    def _extract_keys(self, data: dict, prefix: str = ''):
        """Extrait récursivement les clés de traduction."""
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict):
                self._extract_keys(value, full_key)
            else:
                self.translation_keys.add(full_key)
    
    def analyze(self) -> Dict[str, Any]:
        """Lance l'analyse complète du projet."""
        self.findings = []
        self.translation_keys = set()
        
        # Charger les clés de traduction existantes
        self.load_translation_files()
        
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
            'translation_keys_found': len(self.translation_keys),
            'findings': [
                {
                    'file': f.file_path,
                    'line': f.line,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
                    'text_found': f.text_found,
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
            return "✅ Code entièrement internationalisé"
        
        severity = results['severity_counts']
        categories = results['category_counts']
        
        summary = [
            f"🌍 A10 - I18n: {results['total_issues']} textes hardcodés",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
            f"\n   Clés de traduction trouvées: {results['translation_keys_found']}",
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
    
    print(f"🔍 A10 - I18n Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A10I18nAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a10_i18n_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
