"""
A1 - Security Vulnerabilities Agent
Détecte les failles de sécurité potentielles dans le code.
"""

import re
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class SecurityFinding:
    """Résultat d'une détection de vulnérabilité."""
    file_path: str
    line_number: int
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # XSS, SQL_INJECTION, HARDCODED_SECRET, etc.
    description: str
    code_snippet: str
    recommendation: str


class A1SecurityAgent:
    """
    Agent A1 - Détection de vulnérabilités de sécurité.
    
    Détecte:
    - Secrets hardcodés (API keys, passwords, tokens)
    - Injections SQL potentielles
    - XSS potentiels
    - Désérialisation non sécurisée
    - Utilisation de eval(), dangerouslySetInnerHTML
    - Dépendances vulnérables
    - Mauvaises pratiques crypto
    """
    
    def __init__(self, workspace_root: Path, config):
        """Initialise l'agent A1."""
        self.workspace_root = workspace_root
        self.config = config
        self.root_dir = workspace_root
        self.findings: List[SecurityFinding] = []
    
    # Patterns de détection
    PATTERNS = {
        'hardcoded_secret': {
            'patterns': [
                r'(?i)(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["\']([^"\']{20,})["\']',
                r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']([^"\']{8,})["\']',
                r'(?i)(token|auth[_-]?token|access[_-]?token)\s*[:=]\s*["\']([^"\']{20,})["\']',
                r'(?i)(secret[_-]?key|private[_-]?key)\s*[:=]\s*["\']([^"\']{20,})["\']',
                r'(?i)(aws[_-]?access[_-]?key|aws[_-]?secret)\s*[:=]\s*["\']([^"\']{20,})["\']',
            ],
            'severity': 'CRITICAL',
            'recommendation': 'Utiliser des variables d\'environnement ou un gestionnaire de secrets (ex: AWS Secrets Manager, HashiCorp Vault)',
        },
        'sql_injection': {
            'patterns': [
                r'\.query\s*\(\s*["\'].*\$\{',
                r'\.query\s*\(\s*`.*\$\{',
                r'\.raw\s*\(\s*["\'].*\$\{',
                r'\.raw\s*\(\s*`.*\$\{',
                r'execute\s*\(\s*["\'].*\+',
            ],
            'severity': 'CRITICAL',
            'recommendation': 'Utiliser des requêtes préparées (prepared statements) ou un ORM sécurisé',
        },
        'xss': {
            'patterns': [
                r'dangerouslySetInnerHTML',
                r'\.innerHTML\s*=',
                r'document\.write\s*\(',
            ],
            'severity': 'HIGH',
            'recommendation': 'Utiliser des méthodes sécurisées (textContent, createElement) ou sanitizer le HTML',
        },
        'eval': {
            'patterns': [
                r'\beval\s*\(',
                r'new\s+Function\s*\(',
                r'setTimeout\s*\(["\']',
                r'setInterval\s*\(["\']',
            ],
            'severity': 'HIGH',
            'recommendation': 'Éviter eval() et Function(). Utiliser des alternatives sécurisées',
        },
        'unsafe_deserialization': {
            'patterns': [
                r'pickle\.loads?\s*\(',
                r'yaml\.load\s*\([^,)]*\)',  # sans safe_load
                r'JSON\.parse\s*\([^)]*\)',  # si non validé
            ],
            'severity': 'MEDIUM',
            'recommendation': 'Utiliser safe_load pour YAML, valider les données JSON avant parsing',
        },
        'weak_crypto': {
            'patterns': [
                r'\bMD5\s*\(',
                r'\bSHA1\s*\(',
                r'crypto\.createHash\s*\(\s*["\']md5["\']',
                r'crypto\.createHash\s*\(\s*["\']sha1["\']',
            ],
            'severity': 'MEDIUM',
            'recommendation': 'Utiliser des algorithmes modernes (SHA-256, bcrypt, argon2)',
        },
        'insecure_random': {
            'patterns': [
                r'Math\.random\s*\(',
                r'random\.random\s*\(',
            ],
            'severity': 'LOW',
            'recommendation': 'Pour la sécurité, utiliser crypto.randomBytes() ou secrets module',
        },
        'path_traversal': {
            'patterns': [
                r'(readFile|writeFile|unlink)\s*\([^)]*\+',
                r'(readFile|writeFile|unlink)\s*\(`.*\$\{',
            ],
            'severity': 'HIGH',
            'recommendation': 'Valider et normaliser les chemins, utiliser path.join() avec validation',
        },
    }
    
    # Extensions à analyser
    EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py', '.sql'}
    
    # Fichiers à ignorer
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
        'mock',
    ]
    
    def should_analyze(self, file_path: Path) -> bool:
        """Vérifie si un fichier doit être analysé."""
        # Ignorer certains dossiers
        for pattern in self.IGNORE_PATTERNS:
            if pattern in str(file_path):
                return False
        
        # Vérifier l'extension
        return file_path.suffix in self.EXTENSIONS
    
    def analyze_file(self, file_path: Path) -> List[SecurityFinding]:
        """
        Analyse un fichier pour détecter des vulnérabilités.
        
        Args:
            file_path: Chemin du fichier à analyser
            
        Returns:
            Liste des vulnérabilités détectées
        """
        findings = []
        
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            for category, config in self.PATTERNS.items():
                for pattern in config['patterns']:
                    for line_num, line in enumerate(lines, 1):
                        if re.search(pattern, line):
                            # Ignorer les commentaires
                            if line.strip().startswith(('//','#', '/*', '*')):
                                continue
                            
                            finding = SecurityFinding(
                                file_path=str(file_path.relative_to(self.root_dir)),
                                line_number=line_num,
                                severity=config['severity'],
                                category=category.upper(),
                                description=self._get_description(category),
                                code_snippet=line.strip(),
                                recommendation=config['recommendation'],
                            )
                            findings.append(finding)
            
        except Exception as e:
            # Ignorer les erreurs de lecture
            pass
        
        return findings
    
    def _get_description(self, category: str) -> str:
        """Retourne une description de la vulnérabilité."""
        descriptions = {
            'hardcoded_secret': 'Secret ou credential hardcodé dans le code',
            'sql_injection': 'Injection SQL potentielle détectée',
            'xss': 'Cross-Site Scripting (XSS) potentiel',
            'eval': 'Utilisation de eval() ou Function() - risque d\'injection de code',
            'unsafe_deserialization': 'Désérialisation non sécurisée',
            'weak_crypto': 'Algorithme de hashing faible (MD5/SHA1)',
            'insecure_random': 'Générateur de nombres aléatoires non-cryptographique',
            'path_traversal': 'Path traversal potentiel',
        }
        return descriptions.get(category, 'Vulnérabilité de sécurité détectée')
    
    def analyze(self) -> Dict[str, Any]:
        """
        Lance l'analyse complète du projet.
        
        Returns:
            Résultats de l'analyse avec métriques
        """
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
        
        category_counts = {}
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            category_counts[finding.category] = category_counts.get(finding.category, 0) + 1
        
        return {
            'total_vulnerabilities': len(self.findings),
            'severity_counts': severity_counts,
            'category_counts': category_counts,
            'critical_files': len(set(f.file_path for f in self.findings if f.severity == 'CRITICAL')),
            'findings': [
                {
                    'file': f.file_path,
                    'line': f.line_number,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'code': f.code_snippet,
                    'recommendation': f.recommendation,
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
            return "✅ Aucune vulnérabilité détectée"
        
        results = self.analyze()
        severity = results['severity_counts']
        
        summary = [
            f"🔒 A1 - Security Vulnerabilities: {len(self.findings)} vulnérabilités détectées",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
        ]
        
        # Top 3 catégories
        top_categories = sorted(
            results['category_counts'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        if top_categories:
            summary.append("\n   Top vulnérabilités:")
            for cat, count in top_categories:
                summary.append(f"   - {cat}: {count}")
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    import json
    from datetime import datetime
    
    # Test de l'agent
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print(f"🔍 A1 - Security Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A1SecurityAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    # Sauvegarder les résultats
    output_file = Path('a1_security_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
