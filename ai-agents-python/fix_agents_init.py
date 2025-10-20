#!/usr/bin/env python3
"""
Script pour corriger tous les __init__ des agents A7-A12
"""
import re
from pathlib import Path

agents_to_fix = [
    'a7_performance.py',
    'a8_accessibility.py', 
    'a9_seo.py',
    'a10_i18n.py',
    'a11_tests.py',
    'a12_documentation.py'
]

agents_dir = Path(__file__).parent / 'agents' / 'analysis'

for agent_file in agents_to_fix:
    file_path = agents_dir / agent_file
    if not file_path.exists():
        print(f"⚠️  {agent_file} n'existe pas")
        continue
    
    content = file_path.read_text()
    
    # Remplacer la signature __init__
    old_pattern = r'def __init__\(self, root_dir: str\):'
    new_init = 'def __init__(self, workspace_root: Path, config):'
    
    if re.search(old_pattern, content):
        content = re.sub(old_pattern, new_init, content)
        
        # Remplacer le corps du __init__ aussi
        # Chercher le pattern complet avec le docstring
        old_body_pattern = r'(def __init__\(self, workspace_root: Path, config\):)\s*"""[^"]*"""[^}]*?self\.root_dir = Path\(root_dir\)'
        
        # Remplacer juste après le __init__
        content = re.sub(
            r'(def __init__\(self, workspace_root: Path, config\):)\s*"""([^"]*)"""(\s*)self\.root_dir = Path\(root_dir\)',
            r'\1\n        """\2"""\3self.workspace_root = workspace_root\n        self.config = config\n        self.root_dir = workspace_root',
            content
        )
        
        # Ajouter import Path si manquant
        if 'from pathlib import Path' not in content:
            # Trouver la ligne d'import existante
            import_match = re.search(r'(from typing import [^\n]+)', content)
            if import_match:
                content = content.replace(
                    import_match.group(0),
                    f"from pathlib import Path\n{import_match.group(0)}"
                )
        
        file_path.write_text(content)
        print(f"✅ {agent_file} corrigé")
    else:
        print(f"⏭️  {agent_file} déjà OK ou pattern non trouvé")

print("\n✨ Tous les agents corrigés !")
