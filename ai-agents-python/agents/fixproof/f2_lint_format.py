#!/usr/bin/env python3
"""
Agent F2 - Lint & Format
Applique autopep8, black, isort sur les fichiers Python
Pour TS/JS, utilise prettier (via subprocess)

Auto-fix safe : OUI (formatage ne casse pas la logique)
"""

import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class LintFixResult:
    """Résultat d'une correction de lint/format"""
    file_path: str
    action: str  # "formatted" | "skipped" | "error"
    tool: str  # "black" | "autopep8" | "isort" | "prettier"
    changes: int  # Nombre de lignes modifiées
    reason: str


class LintFormatter:
    """
    Agent F2 - Lint & Format
    
    Python: black + autopep8 + isort
    TS/JS: prettier (si disponible)
    """
    
    def __init__(self, config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
        
        # Vérifier outils disponibles
        self.has_black = self._check_tool('black')
        self.has_autopep8 = self._check_tool('autopep8')
        self.has_isort = self._check_tool('isort')
        self.has_prettier = self._check_tool('prettier')
    
    def fix(self, findings: List[Dict[str, Any]], dry_run: bool = False) -> List[Dict[str, Any]]:
        """
        Formate les fichiers détectés comme ayant des problèmes de lint
        
        Args:
            findings: Liste des fichiers à formater (peut venir de A2, A3, etc.)
            dry_run: Si True, simule seulement
        
        Returns:
            Liste de LintFixResult sérialisés
        """
        print("🔧 F2 - Lint & Format...")
        
        if not self.config.auto_fix.lint_errors:
            print("   ⏭️  Auto-fix lint désactivé (config)")
            return []
        
        results = []
        
        # Si findings vide, formater tous les fichiers modifiés (git diff)
        files_to_format = self._get_files_to_format(findings)
        
        for file_path in files_to_format:
            # Ignorer exclusions
            if self.config.should_exclude(str(file_path)):
                continue
            
            # Déterminer le type de fichier
            ext = file_path.suffix
            
            if ext == '.py':
                result = self._format_python(file_path, dry_run)
            elif ext in ['.ts', '.tsx', '.js', '.jsx']:
                result = self._format_javascript(file_path, dry_run)
            else:
                continue
            
            if result:
                results.append(self._serialize(result))
        
        print(f"   ✅ {len(results)} fichier(s) formaté(s)")
        return results
    
    def _get_files_to_format(self, findings: List[Dict[str, Any]]) -> List[Path]:
        """Récupère la liste des fichiers à formater"""
        files = set()
        
        # Depuis findings
        for finding in findings:
            file_path = finding.get('file_path')
            if file_path:
                files.add(self.workspace_root / file_path)
        
        # Si vide, utiliser git diff
        if not files:
            files = self._get_modified_files()
        
        return list(files)
    
    def _get_modified_files(self) -> set:
        """Récupère les fichiers modifiés (git diff)"""
        try:
            result = subprocess.run(
                ['git', 'diff', '--name-only', '--cached'],
                cwd=self.workspace_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                files = set()
                for line in result.stdout.strip().split('\n'):
                    if line:
                        file_path = self.workspace_root / line
                        if file_path.exists():
                            files.add(file_path)
                return files
        except Exception as e:
            print(f"⚠️  Erreur git diff: {e}")
        
        return set()
    
    def _format_python(self, file_path: Path, dry_run: bool) -> LintFixResult:
        """Formate un fichier Python avec black + isort"""
        
        if not file_path.exists():
            return LintFixResult(
                file_path=str(file_path.relative_to(self.workspace_root)),
                action="error",
                tool="black",
                changes=0,
                reason="File not found"
            )
        
        # Lire contenu original
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
        except Exception as e:
            return LintFixResult(
                file_path=str(file_path.relative_to(self.workspace_root)),
                action="error",
                tool="black",
                changes=0,
                reason=f"Cannot read: {e}"
            )
        
        # Appliquer black
        if self.has_black:
            try:
                cmd = ['black', '--quiet', str(file_path)]
                if dry_run:
                    cmd.append('--check')
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                # black --check retourne 1 si fichier aurait changé
                if dry_run and result.returncode == 1:
                    return LintFixResult(
                        file_path=str(file_path.relative_to(self.workspace_root)),
                        action="would_format",
                        tool="black",
                        changes=1,  # Approximation
                        reason="Would be formatted by black (dry-run)"
                    )
                
            except Exception as e:
                print(f"⚠️  Black error: {e}")
        
        # Appliquer isort
        if self.has_isort and not dry_run:
            try:
                subprocess.run(
                    ['isort', str(file_path)],
                    capture_output=True,
                    check=False
                )
            except Exception as e:
                print(f"⚠️  isort error: {e}")
        
        # Comparer
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                new_content = f.read()
            
            if new_content != original_content:
                # Calculer nombre de lignes changées
                changes = self._count_diff_lines(original_content, new_content)
                
                return LintFixResult(
                    file_path=str(file_path.relative_to(self.workspace_root)),
                    action="formatted",
                    tool="black+isort",
                    changes=changes,
                    reason="Formatted successfully"
                )
            else:
                return LintFixResult(
                    file_path=str(file_path.relative_to(self.workspace_root)),
                    action="skipped",
                    tool="black+isort",
                    changes=0,
                    reason="Already formatted"
                )
        
        except Exception as e:
            return LintFixResult(
                file_path=str(file_path.relative_to(self.workspace_root)),
                action="error",
                tool="black+isort",
                changes=0,
                reason=f"Error comparing: {e}"
            )
    
    def _format_javascript(self, file_path: Path, dry_run: bool) -> LintFixResult:
        """Formate un fichier TS/JS avec prettier"""
        
        if not self.has_prettier:
            return LintFixResult(
                file_path=str(file_path.relative_to(self.workspace_root)),
                action="skipped",
                tool="prettier",
                changes=0,
                reason="Prettier not installed"
            )
        
        try:
            cmd = ['prettier', '--write', str(file_path)]
            if dry_run:
                cmd = ['prettier', '--check', str(file_path)]
            
            result = subprocess.run(
                cmd,
                cwd=self.workspace_root,
                capture_output=True,
                text=True
            )
            
            if dry_run:
                if result.returncode != 0:
                    return LintFixResult(
                        file_path=str(file_path.relative_to(self.workspace_root)),
                        action="would_format",
                        tool="prettier",
                        changes=1,
                        reason="Would be formatted (dry-run)"
                    )
                else:
                    return LintFixResult(
                        file_path=str(file_path.relative_to(self.workspace_root)),
                        action="skipped",
                        tool="prettier",
                        changes=0,
                        reason="Already formatted"
                    )
            else:
                return LintFixResult(
                    file_path=str(file_path.relative_to(self.workspace_root)),
                    action="formatted",
                    tool="prettier",
                    changes=1,  # Prettier ne donne pas le nombre exact
                    reason="Formatted successfully"
                )
        
        except Exception as e:
            return LintFixResult(
                file_path=str(file_path.relative_to(self.workspace_root)),
                action="error",
                tool="prettier",
                changes=0,
                reason=f"Prettier error: {e}"
            )
    
    def _check_tool(self, tool_name: str) -> bool:
        """Vérifie si un outil est disponible"""
        try:
            result = subprocess.run(
                ['which', tool_name],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except:
            return False
    
    def _count_diff_lines(self, old: str, new: str) -> int:
        """Compte le nombre de lignes différentes"""
        old_lines = old.split('\n')
        new_lines = new.split('\n')
        
        # Simple diff count
        diff_count = 0
        for i, (old_line, new_line) in enumerate(zip(old_lines, new_lines)):
            if old_line != new_line:
                diff_count += 1
        
        # Ajouter diff de longueur
        diff_count += abs(len(old_lines) - len(new_lines))
        
        return diff_count
    
    def _serialize(self, result: LintFixResult) -> Dict[str, Any]:
        """Sérialise un résultat"""
        return {
            'file_path': result.file_path,
            'action': result.action,
            'tool': result.tool,
            'changes': result.changes,
            'reason': result.reason
        }


# Test standalone
if __name__ == '__main__':
    from pathlib import Path
    import sys
    
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    
    from core.config import Config
    
    workspace = Path.cwd()
    while not (workspace / 'package.json').exists() and workspace != workspace.parent:
        workspace = workspace.parent
    
    config = Config.load(str(workspace / 'ai-agents-python' / 'config.yaml'))
    
    formatter = LintFormatter(config, workspace)
    
    print(f"🔧 Outils disponibles:")
    print(f"   Black: {'✅' if formatter.has_black else '❌'}")
    print(f"   autopep8: {'✅' if formatter.has_autopep8 else '❌'}")
    print(f"   isort: {'✅' if formatter.has_isort else '❌'}")
    print(f"   Prettier: {'✅' if formatter.has_prettier else '❌'}")
    
    # Test sur fichier Python courant
    results = formatter.fix([{'file_path': 'ai-agents-python/agents/fixproof/f2_lint_format.py'}], dry_run=True)
    
    print(f"\n📊 Résultats: {len(results)} fichier(s)")
    for result in results:
        print(f"   {result['action']}: {result['file_path']} ({result['tool']})")
