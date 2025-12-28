"""
Agent A4: Dead Code Detector
Détecte les fichiers non utilisés (non importés + non référencés + untouched 30j+)
"""

from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Set, Optional
import os
import re
from dataclasses import dataclass

try:
    from core.config import Config
except ImportError:
    # Fallback pour exécution standalone
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from core.config import Config


@dataclass
class DeadCodeResult:
    """Résultat de détection de dead code"""
    file_path: str
    reason: str
    last_modified: datetime
    confidence: float  # 0.0 - 1.0


class DeadCodeDetector:
    """Agent A4 - Détecte le code mort"""
    
    def __init__(self, workspace_root: Path, config):
        self.workspace_root = workspace_root
        self.config = config
        self.root = workspace_root
        self.threshold_days = config.thresholds.dead_code_days
        
    def analyze(self) -> List[DeadCodeResult]:
        """Analyse et détecte le dead code"""
        results = []
        
        # 1. Trouver tous les fichiers TS/TSX
        all_files = self._find_all_files()
        
        # 2. Construire graphe d'imports
        import_graph = self._build_import_graph(all_files)
        
        # 3. Détecter fichiers non importés
        unused_files = self._find_unused_files(all_files, import_graph)
        
        # 4. Vérifier date dernière modification
        old_files = self._find_old_files(unused_files)
        
        # 5. Calculer confidence
        for file_path in old_files:
            result = self._create_result(file_path)
            if result:
                results.append(result)
        
        return results
    
    def _find_all_files(self) -> Set[Path]:
        """Trouve tous les fichiers TS/TSX/JS"""
        files = set()
        
        for pattern in ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]:
            for file_path in self.root.rglob(pattern):
                if not self.config.should_exclude(file_path):
                    files.add(file_path)
        
        return files
    
    def _build_import_graph(self, files: Set[Path]) -> dict:
        """Construit le graphe d'imports"""
        graph = {}
        
        for file_path in files:
            imports = self._extract_imports(file_path)
            graph[file_path] = imports
        
        return graph
    
    def _extract_imports(self, file_path: Path) -> Set[str]:
        """Extrait les imports d'un fichier"""
        imports = set()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Regex pour imports
            # import ... from '...'
            # import('...')
            patterns = [
                r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]',
                r'import\([\'"]([^\'"]+)[\'"]\)',
                r'require\([\'"]([^\'"]+)[\'"]\)'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, content)
                imports.update(matches)
        
        except Exception:
            pass
        
        return imports
    
    def _find_unused_files(self, all_files: Set[Path], graph: dict) -> Set[Path]:
        """Trouve les fichiers non importés"""
        unused = set()
        
        # Créer set de tous les chemins importés
        imported = set()
        for imports in graph.values():
            imported.update(imports)
        
        for file_path in all_files:
            # Vérifier si le fichier est importé
            relative = file_path.relative_to(self.root)
            is_imported = False
            
            for imp in imported:
                if str(relative).replace('\\', '/') in imp or \
                   file_path.stem in imp:
                    is_imported = True
                    break
            
            # Exclure entry points
            if self._is_entry_point(file_path):
                continue
            
            if not is_imported:
                unused.add(file_path)
        
        return unused
    
    def _is_entry_point(self, file_path: Path) -> bool:
        """Vérifie si c'est un entry point"""
        entry_points = [
            "main.ts",
            "main.server.ts",
            "entry.client.tsx",
            "entry.server.tsx",
            "root.tsx",
            "index.ts",
            "index.tsx"
        ]
        
        return file_path.name in entry_points
    
    def _find_old_files(self, files: Set[Path]) -> Set[Path]:
        """Trouve les fichiers non modifiés depuis N jours"""
        old_files = set()
        threshold_date = datetime.now() - timedelta(days=self.threshold_days)
        
        for file_path in files:
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                if mtime < threshold_date:
                    old_files.add(file_path)
            except Exception:
                pass
        
        return old_files
    
    def _create_result(self, file_path: Path) -> Optional[DeadCodeResult]:
        """Crée un résultat de détection"""
        try:
            mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
            days_old = (datetime.now() - mtime).days
            
            # Confidence basée sur l'âge
            confidence = min(1.0, days_old / 90.0)  # Max confidence après 90j
            
            return DeadCodeResult(
                file_path=str(file_path.relative_to(self.root)),
                reason=f"Not imported, untouched for {days_old} days",
                last_modified=mtime,
                confidence=confidence
            )
        except Exception:
            return None


# Interface simple pour utilisation standalone
def detect_dead_code(config: Config, root_path: str) -> List[DeadCodeResult]:
    """Fonction helper pour détecter le dead code"""
    detector = DeadCodeDetector(config, Path(root_path))
    return detector.analyze()


if __name__ == "__main__":
    # Test standalone
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    
    from core.config import Config
    
    config = Config.load()
    root = Path("/workspaces/nestjs-remix-monorepo")
    
    results = detect_dead_code(config, str(root))
    
    print(f"Found {len(results)} dead code files:")
    for result in results[:10]:  # Show first 10
        print(f"  - {result.file_path} (confidence: {result.confidence:.0%})")
    
    # Sauvegarder les résultats JSON
    import json
    output_file = Path('a4_dead_code_results.json')
    results_json = [
        {
            'file_path': r.file_path,
            'reason': r.reason,
            'confidence': r.confidence,
            'last_modified': r.last_modified.isoformat() if r.last_modified else None,
        }
        for r in results
    ]
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results_json, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Résultats sauvegardés: {output_file}")
