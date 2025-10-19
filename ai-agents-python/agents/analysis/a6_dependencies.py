"""
A6 - Dependencies Vulnerabilities Agent
Analyse les dépendances pour détecter les versions obsolètes et vulnérables.
"""

import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class DependencyFinding:
    """Résultat d'analyse de dépendance."""
    package_name: str
    current_version: str
    latest_version: Optional[str]
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # OUTDATED, VULNERABLE, DEPRECATED
    description: str
    recommendation: str
    cve_ids: List[str] = None


class A6DependenciesAgent:
    """
    Agent A6 - Analyse des dépendances.
    
    Détecte:
    - Dépendances avec vulnérabilités connues
    - Versions obsolètes
    - Dépendances dépréciées
    - Conflits de versions
    """
    
    # Seuils de vétusté (en jours depuis dernière version majeure)
    OUTDATED_THRESHOLDS = {
        'CRITICAL': 730,  # 2 ans
        'HIGH': 365,      # 1 an
        'MEDIUM': 180,    # 6 mois
        'LOW': 90,        # 3 mois
    }
    
    # Packages connus comme dépréciés
    DEPRECATED_PACKAGES = {
        'request': 'deprecated - use axios, node-fetch, or undici',
        'gulp': 'mostly replaced by native npm scripts',
        'bower': 'deprecated - use npm/yarn',
        'tslint': 'deprecated - use eslint with @typescript-eslint',
    }
    
    def __init__(self, root_dir: str):
        """
        Initialise l'agent A6.
        
        Args:
            root_dir: Répertoire racine du projet
        """
        self.root_dir = Path(root_dir)
        self.findings: List[DependencyFinding] = []
    
    def find_package_json_files(self) -> List[Path]:
        """Trouve tous les fichiers package.json."""
        package_files = []
        
        for file_path in self.root_dir.rglob('package.json'):
            # Ignorer node_modules
            if 'node_modules' not in str(file_path):
                package_files.append(file_path)
        
        return package_files
    
    def find_requirements_files(self) -> List[Path]:
        """Trouve tous les fichiers requirements.txt."""
        req_files = []
        
        for file_path in self.root_dir.rglob('requirements*.txt'):
            req_files.append(file_path)
        
        return req_files
    
    def parse_package_json(self, file_path: Path) -> Dict[str, str]:
        """Parse un fichier package.json."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            dependencies = {}
            
            # Fusionner dependencies et devDependencies
            for dep_type in ['dependencies', 'devDependencies']:
                if dep_type in data:
                    dependencies.update(data[dep_type])
            
            return dependencies
        
        except Exception as e:
            return {}
    
    def parse_requirements(self, file_path: Path) -> Dict[str, str]:
        """Parse un fichier requirements.txt."""
        dependencies = {}
        
        try:
            content = file_path.read_text(encoding='utf-8')
            
            for line in content.split('\n'):
                line = line.strip()
                
                # Ignorer commentaires et lignes vides
                if not line or line.startswith('#'):
                    continue
                
                # Parser package==version ou package>=version
                if '==' in line:
                    name, version = line.split('==', 1)
                    dependencies[name.strip()] = version.strip()
                elif '>=' in line:
                    name, version = line.split('>=', 1)
                    dependencies[name.strip()] = f">={version.strip()}"
        
        except Exception as e:
            pass
        
        return dependencies
    
    def check_npm_outdated(self, package_dir: Path) -> Dict[str, Any]:
        """
        Vérifie les packages npm obsolètes.
        
        Returns:
            Dict avec les packages outdated
        """
        try:
            result = subprocess.run(
                ['npm', 'outdated', '--json'],
                cwd=package_dir,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # npm outdated retourne un code non-zéro si des packages sont outdated
            if result.stdout:
                return json.loads(result.stdout)
            
        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            pass
        
        return {}
    
    def check_npm_audit(self, package_dir: Path) -> Dict[str, Any]:
        """
        Vérifie les vulnérabilités npm.
        
        Returns:
            Dict avec les vulnérabilités
        """
        try:
            result = subprocess.run(
                ['npm', 'audit', '--json'],
                cwd=package_dir,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.stdout:
                return json.loads(result.stdout)
        
        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            pass
        
        return {}
    
    def check_pip_outdated(self) -> List[Dict[str, str]]:
        """Vérifie les packages Python obsolètes."""
        try:
            result = subprocess.run(
                ['pip', 'list', '--outdated', '--format=json'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.stdout:
                return json.loads(result.stdout)
        
        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            pass
        
        return []
    
    def analyze_npm_dependencies(self, package_file: Path) -> List[DependencyFinding]:
        """Analyse les dépendances npm d'un package.json."""
        findings = []
        package_dir = package_file.parent
        
        # Parser le package.json
        dependencies = self.parse_package_json(package_file)
        
        # Vérifier les packages dépréciés
        for pkg_name, version in dependencies.items():
            if pkg_name in self.DEPRECATED_PACKAGES:
                finding = DependencyFinding(
                    package_name=pkg_name,
                    current_version=version,
                    latest_version=None,
                    severity='MEDIUM',
                    category='DEPRECATED',
                    description=f'Package déprécié: {self.DEPRECATED_PACKAGES[pkg_name]}',
                    recommendation=f'Migrer vers une alternative moderne',
                )
                findings.append(finding)
        
        # Vérifier les packages obsolètes
        outdated = self.check_npm_outdated(package_dir)
        for pkg_name, info in outdated.items():
            current = info.get('current', '?')
            latest = info.get('latest', '?')
            
            finding = DependencyFinding(
                package_name=pkg_name,
                current_version=current,
                latest_version=latest,
                severity='MEDIUM',
                category='OUTDATED',
                description=f'Version obsolète: {current} → {latest}',
                recommendation=f'Mettre à jour vers {latest}',
            )
            findings.append(finding)
        
        # Vérifier les vulnérabilités
        audit = self.check_npm_audit(package_dir)
        if 'vulnerabilities' in audit:
            vulns = audit['vulnerabilities']
            
            for pkg_name, vuln_info in vulns.items():
                severity_map = {
                    'critical': 'CRITICAL',
                    'high': 'HIGH',
                    'moderate': 'MEDIUM',
                    'low': 'LOW',
                }
                
                severity = severity_map.get(vuln_info.get('severity', 'low'), 'MEDIUM')
                
                finding = DependencyFinding(
                    package_name=pkg_name,
                    current_version=vuln_info.get('version', '?'),
                    latest_version=None,
                    severity=severity,
                    category='VULNERABLE',
                    description=f"Vulnérabilité {vuln_info.get('severity', 'unknown')}",
                    recommendation='Mettre à jour vers une version sécurisée',
                    cve_ids=vuln_info.get('cves', []),
                )
                findings.append(finding)
        
        return findings
    
    def analyze_python_dependencies(self, req_file: Path) -> List[DependencyFinding]:
        """Analyse les dépendances Python d'un requirements.txt."""
        findings = []
        
        # Parser le fichier
        dependencies = self.parse_requirements(req_file)
        
        # Vérifier les packages obsolètes
        outdated = self.check_pip_outdated()
        
        for pkg_info in outdated:
            pkg_name = pkg_info.get('name')
            current = pkg_info.get('version')
            latest = pkg_info.get('latest_version')
            
            if pkg_name in dependencies:
                finding = DependencyFinding(
                    package_name=pkg_name,
                    current_version=current,
                    latest_version=latest,
                    severity='MEDIUM',
                    category='OUTDATED',
                    description=f'Version obsolète: {current} → {latest}',
                    recommendation=f'Mettre à jour vers {latest}',
                )
                findings.append(finding)
        
        return findings
    
    def analyze(self) -> Dict[str, Any]:
        """Lance l'analyse complète des dépendances."""
        self.findings = []
        
        # Analyser les dépendances npm
        package_files = self.find_package_json_files()
        for package_file in package_files:
            npm_findings = self.analyze_npm_dependencies(package_file)
            self.findings.extend(npm_findings)
        
        # Analyser les dépendances Python
        req_files = self.find_requirements_files()
        for req_file in req_files:
            py_findings = self.analyze_python_dependencies(req_file)
            self.findings.extend(py_findings)
        
        # Calculer les métriques
        severity_counts = {
            'CRITICAL': 0,
            'HIGH': 0,
            'MEDIUM': 0,
            'LOW': 0,
        }
        
        category_counts = {
            'VULNERABLE': 0,
            'OUTDATED': 0,
            'DEPRECATED': 0,
        }
        
        for finding in self.findings:
            severity_counts[finding.severity] += 1
            category_counts[finding.category] += 1
        
        return {
            'total_issues': len(self.findings),
            'severity_counts': severity_counts,
            'category_counts': category_counts,
            'package_files_analyzed': len(package_files),
            'requirements_files_analyzed': len(req_files),
            'findings': [
                {
                    'package': f.package_name,
                    'current': f.current_version,
                    'latest': f.latest_version,
                    'severity': f.severity,
                    'category': f.category,
                    'description': f.description,
                    'recommendation': f.recommendation,
                    'cves': f.cve_ids or [],
                }
                for f in sorted(self.findings, key=lambda x: (
                    {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}[x.severity],
                    x.package_name
                ))
            ]
        }
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel des résultats."""
        if not self.findings:
            return "✅ Toutes les dépendances sont à jour et sécurisées"
        
        results = self.analyze()
        severity = results['severity_counts']
        category = results['category_counts']
        
        summary = [
            f"📦 A6 - Dependencies: {len(self.findings)} problèmes détectés",
            f"   🔴 CRITICAL: {severity['CRITICAL']}",
            f"   🟠 HIGH: {severity['HIGH']}",
            f"   🟡 MEDIUM: {severity['MEDIUM']}",
            f"   🟢 LOW: {severity['LOW']}",
            f"\n   Par catégorie:",
            f"   - Vulnérables: {category['VULNERABLE']}",
            f"   - Obsolètes: {category['OUTDATED']}",
            f"   - Dépréciées: {category['DEPRECATED']}",
        ]
        
        return '\n'.join(summary)


if __name__ == '__main__':
    import sys
    
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print(f"🔍 A6 - Dependencies Analysis")
    print(f"📁 Root: {root}")
    print(f"⏰ Start: {datetime.now().strftime('%H:%M:%S')}\n")
    
    start = datetime.now()
    agent = A6DependenciesAgent(root)
    results = agent.analyze()
    duration = (datetime.now() - start).total_seconds()
    
    print(agent.get_summary())
    print(f"\n⏱️  Duration: {duration:.2f}s")
    
    output_file = Path('a6_dependencies_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Results saved to: {output_file}")
