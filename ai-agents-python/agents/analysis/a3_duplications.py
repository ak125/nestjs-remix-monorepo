#!/usr/bin/env python3
"""
Agent A3 - Duplications Detector
Détecte les duplications de code (équivalent jscpd en Python)

Utilise AST pour détecter les duplications sémantiques, pas juste textuelles
"""

import os
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Set, Tuple
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class DuplicationResult:
    """Résultat pour une duplication détectée"""
    files: List[str]  # Fichiers contenant la duplication
    lines_duplicated: int
    tokens: int
    fragment: str  # Snippet du code dupliqué
    locations: List[Dict[str, Any]]  # [{file, start_line, end_line}]
    severity: str  # 'minor', 'medium', 'high', 'critical'


class DuplicationDetector:
    """
    Détecte les duplications de code
    
    Approche:
    1. Tokenize le code (ignorer whitespace, comments)
    2. Rolling hash sur séquences de N tokens
    3. Grouper les hashs identiques
    4. Vérifier duplications réelles (éviter faux positifs)
    
    Config:
    - min_tokens: 6 (minimum de tokens pour considérer une duplication)
    - min_lines: 3 (minimum de lignes)
    """
    
    def __init__(self, config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
        self.min_tokens = config.thresholds.duplication.min_tokens
        self.min_lines = config.thresholds.duplication.min_lines
        
        # Cache des fichiers analysés
        self.file_tokens: Dict[str, List[str]] = {}
        self.token_hashes: Dict[str, List[Tuple[int, int]]] = {}  # hash -> [(file_id, pos)]
    
    def analyze(self) -> List[Dict[str, Any]]:
        """
        Détecte toutes les duplications
        
        Returns:
            Liste de DuplicationResult sérialisés
        """
        print("🔍 A3 - Détection duplications...")
        
        # 1. Trouver tous les fichiers à analyser
        files = self._find_files()
        print(f"   Analyse de {len(files)} fichier(s)...")
        
        # 2. Tokenize tous les fichiers
        for file_path in files:
            tokens = self._tokenize_file(file_path)
            if tokens:
                self.file_tokens[str(file_path)] = tokens
        
        # 3. Construire index de hashs
        self._build_hash_index()
        
        # 4. Détecter duplications
        duplications = self._find_duplications()
        
        # 5. Filtrer et trier
        filtered = self._filter_duplications(duplications)
        filtered.sort(key=lambda d: d.lines_duplicated * len(d.files), reverse=True)
        
        # Sérialiser
        return [self._serialize(d) for d in filtered]
    
    def _find_files(self) -> List[Path]:
        """Trouve tous les fichiers TS/TSX/JS à analyser"""
        files = []
        
        for ext in ['.ts', '.tsx', '.js', '.jsx']:
            for file_path in self.workspace_root.rglob(f'*{ext}'):
                # Ignorer exclusions
                if self.config.should_exclude(str(file_path)):
                    continue
                
                # Ignorer fichiers de test (pour l'instant)
                if '.test.' in file_path.name or '.spec.' in file_path.name:
                    continue
                
                files.append(file_path)
        
        return files
    
    def _tokenize_file(self, file_path: Path) -> List[str]:
        """
        Tokenize un fichier en ignorant whitespace et commentaires
        
        Approche simple: split sur caractères spéciaux
        Pour une vraie implémentation, utiliser un parser AST
        """
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Supprimer commentaires (simple regex, pas parfait)
            import re
            
            # Commentaires ligne
            content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
            
            # Commentaires bloc
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
            
            # Tokenize (simple split sur non-alphanumeriques)
            tokens = re.findall(r'\b\w+\b', content)
            
            # Filtrer tokens trop courts (< 2 chars)
            tokens = [t for t in tokens if len(t) >= 2]
            
            return tokens
        
        except Exception as e:
            print(f"⚠️  Erreur tokenization {file_path}: {e}")
            return []
    
    def _build_hash_index(self):
        """
        Construit un index de hashs pour rolling window
        
        Pour chaque fichier, crée des hashs pour chaque séquence de N tokens
        """
        for file_path, tokens in self.file_tokens.items():
            file_id = file_path
            
            # Rolling window de min_tokens
            for i in range(len(tokens) - self.min_tokens + 1):
                window = tokens[i:i + self.min_tokens]
                window_hash = self._hash_tokens(window)
                
                if window_hash not in self.token_hashes:
                    self.token_hashes[window_hash] = []
                
                self.token_hashes[window_hash].append((file_id, i))
        
        print(f"   Index: {len(self.token_hashes)} hashs uniques")
    
    def _hash_tokens(self, tokens: List[str]) -> str:
        """Hash une séquence de tokens"""
        content = '|'.join(tokens)
        return hashlib.md5(content.encode()).hexdigest()
    
    def _find_duplications(self) -> List[DuplicationResult]:
        """Trouve toutes les duplications basées sur l'index"""
        duplications = []
        
        # Grouper par hash (seulement ceux avec 2+ occurrences)
        for window_hash, occurrences in self.token_hashes.items():
            if len(occurrences) < 2:
                continue
            
            # Grouper par fichier
            files_involved = defaultdict(list)
            for file_id, pos in occurrences:
                files_involved[file_id].append(pos)
            
            # Seulement si plusieurs fichiers (ou plusieurs positions dans même fichier)
            if len(files_involved) < 2 and all(len(positions) < 2 for positions in files_involved.values()):
                continue
            
            # Construire DuplicationResult
            locations = []
            for file_id, positions in files_involved.items():
                for pos in positions:
                    # Estimer numéro de ligne (approximatif)
                    line_num = self._estimate_line_number(file_id, pos)
                    
                    locations.append({
                        'file': file_id,
                        'start_line': line_num,
                        'end_line': line_num + self.min_lines,
                        'token_pos': pos
                    })
            
            # Fragment (premiers tokens)
            first_file, first_pos = occurrences[0]
            tokens = self.file_tokens[first_file]
            fragment_tokens = tokens[first_pos:first_pos + min(10, self.min_tokens)]
            fragment = ' '.join(fragment_tokens)
            
            # Sévérité basée sur nombre d'occurrences
            severity = self._calculate_duplication_severity(len(occurrences))
            
            duplication = DuplicationResult(
                files=list(files_involved.keys()),
                lines_duplicated=self.min_lines,  # Estimation
                tokens=self.min_tokens,
                fragment=fragment + '...',
                locations=locations,
                severity=severity
            )
            
            duplications.append(duplication)
        
        return duplications
    
    def _estimate_line_number(self, file_path: str, token_pos: int) -> int:
        """
        Estime le numéro de ligne pour une position de token
        
        Approximation: assume distribution uniforme des tokens
        """
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = len(f.readlines())
            
            total_tokens = len(self.file_tokens[file_path])
            
            # Ratio approximatif
            line_ratio = token_pos / total_tokens
            estimated_line = int(line_ratio * lines)
            
            return max(1, estimated_line)
        
        except:
            return 1
    
    def _calculate_duplication_severity(self, occurrences: int) -> str:
        """Calcule sévérité basée sur nombre d'occurrences"""
        if occurrences >= 10:
            return 'critical'
        elif occurrences >= 5:
            return 'high'
        elif occurrences >= 3:
            return 'medium'
        else:
            return 'minor'
    
    def _filter_duplications(self, duplications: List[DuplicationResult]) -> List[DuplicationResult]:
        """Filtre les faux positifs et duplications triviales"""
        filtered = []
        
        for dup in duplications:
            # Ignorer duplications triviales (imports, exports)
            if any(keyword in dup.fragment.lower() for keyword in ['import', 'export', 'from', 'require']):
                continue
            
            # Ignorer fragments trop courts
            if len(dup.fragment) < 20:
                continue
            
            filtered.append(dup)
        
        return filtered
    
    def _serialize(self, result: DuplicationResult) -> Dict[str, Any]:
        """Sérialise un résultat en dict JSON-compatible"""
        return {
            'files': [str(Path(f).relative_to(self.workspace_root)) for f in result.files],
            'lines_duplicated': result.lines_duplicated,
            'tokens': result.tokens,
            'fragment': result.fragment,
            'locations': [
                {
                    'file': str(Path(loc['file']).relative_to(self.workspace_root)),
                    'start_line': loc['start_line'],
                    'end_line': loc['end_line']
                }
                for loc in result.locations
            ],
            'severity': result.severity,
            'occurrences': len(result.locations),
            'impact_score': result.lines_duplicated * len(result.files)
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
    
    config = Config.load(workspace / 'ai-agents-python' / 'config.yaml')
    
    detector = DuplicationDetector(config, workspace)
    results = detector.analyze()
    
    print(f"\n📊 Résultats: {len(results)} duplication(s)")
    
    for i, result in enumerate(results[:5], 1):
        print(f"\n{i}. Duplication ({result['severity']})")
        print(f"   Fichiers: {len(result['files'])}")
        print(f"   Occurrences: {result['occurrences']}")
        print(f"   Impact: {result['impact_score']}")
        print(f"   Fragment: {result['fragment'][:60]}...")
