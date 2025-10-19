"""
Agent F1: Dead Code Surgeon
Supprime automatiquement le code mort détecté par A4
"""

from pathlib import Path
from typing import List
import os
from dataclasses import dataclass

from agents.analysis.a4_dead_code import DeadCodeResult
from core.config import Config


@dataclass
class FixResult:
    """Résultat d'une correction"""
    file_path: str
    action: str  # "removed" | "skipped" | "error"
    reason: str
    lines_removed: int = 0


class DeadCodeSurgeon:
    """Agent F1 - Supprime le dead code"""
    
    def __init__(self, config: Config, monorepo_root: Path, dry_run: bool = False):
        self.config = config
        self.root = monorepo_root
        self.dry_run = dry_run
        
    def fix(self, dead_code_results: List[DeadCodeResult]) -> List[FixResult]:
        """Corrige (supprime) le dead code détecté"""
        results = []
        
        for dc in dead_code_results:
            # Vérifier si auto-fix autorisé
            if not self.config.auto_fix.dead_code:
                results.append(FixResult(
                    file_path=dc.file_path,
                    action="skipped",
                    reason="Auto-fix disabled in config"
                ))
                continue
            
            # Vérifier confidence
            if dc.confidence < 0.9:
                results.append(FixResult(
                    file_path=dc.file_path,
                    action="skipped",
                    reason=f"Low confidence ({dc.confidence:.0%})"
                ))
                continue
            
            # Supprimer le fichier
            result = self._remove_file(dc.file_path)
            results.append(result)
        
        return results
    
    def _remove_file(self, relative_path: str) -> FixResult:
        """Supprime un fichier"""
        file_path = self.root / relative_path
        
        if not file_path.exists():
            return FixResult(
                file_path=relative_path,
                action="error",
                reason="File not found"
            )
        
        try:
            # Compter les lignes avant suppression
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = len(f.readlines())
            
            if self.dry_run:
                return FixResult(
                    file_path=relative_path,
                    action="removed (dry-run)",
                    reason="Would be deleted",
                    lines_removed=lines
                )
            
            # Supprimer le fichier
            os.remove(file_path)
            
            return FixResult(
                file_path=relative_path,
                action="removed",
                reason="Dead code removed successfully",
                lines_removed=lines
            )
            
        except Exception as e:
            return FixResult(
                file_path=relative_path,
                action="error",
                reason=f"Failed to remove: {str(e)}"
            )


# Interface simple
def fix_dead_code(config: Config, root_path: str, dead_code: List[DeadCodeResult], dry_run: bool = False) -> List[FixResult]:
    """Fonction helper pour corriger le dead code"""
    surgeon = DeadCodeSurgeon(config, Path(root_path), dry_run=dry_run)
    return surgeon.fix(dead_code)


if __name__ == "__main__":
    # Test standalone
    from core.config import Config
    from agents.analysis.a4_dead_code import detect_dead_code
    
    config = Config.load()
    root = Path("/workspaces/nestjs-remix-monorepo")
    
    # 1. Détecter
    dead_code = detect_dead_code(config, str(root))
    print(f"Detected {len(dead_code)} dead code files")
    
    # 2. Corriger (dry-run)
    results = fix_dead_code(config, str(root), dead_code, dry_run=True)
    
    removed = [r for r in results if r.action.startswith("removed")]
    print(f"\nWould remove {len(removed)} files (dry-run):")
    for result in removed[:10]:
        print(f"  - {result.file_path} ({result.lines_removed} lines)")
