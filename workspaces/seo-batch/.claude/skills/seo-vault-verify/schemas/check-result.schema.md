# Schéma résultat checker

Structure retournée par chaque fonction `check_*` des couches 2-4.

## `check_content.check_file(path, rules) -> dict`

```python
{
    "pass": bool,              # True si tous les checks ont passé
    "path": str,               # chemin du fichier contrôlé
    "checks": [                # liste des checks individuels
        {
            "pass": bool,
            "type": str,       # enum: "must_contain" | "section_required" | "section_min_terms" |
                               #       "tag_required" | "tag_context" | "frontmatter_key" |
                               #       "dataview_blocks" | "file_exists"
            "detail": str,     # texte explicatif (évidence)
            # champs additionnels selon le type
            "pattern": str,    # si type == "must_contain"
            "mode": str,       # "simple" | "near" si must_contain
            "reason": str,     # si pass == False, raison détaillée
        }
    ]
}
```

## `check_crossref.extract_links(path) -> set[str]`

Retourne `{target_stem, ...}` — set des stems de fichiers cibles (sans `.md`, sans heading anchor).

## `check_crossref.count_files_referencing(vault_root, target_stem) -> int`

Retourne le nombre entier de fichiers `.md` qui référencent `target_stem`.

## `check_crossref.scan_vault(vault_root) -> dict[str, list[str]]`

```python
{
    "00-Meta/README.md": ["ADR-002-maillage-interne-first", "Kickoff-Week1", ...],
    "02-ADR/ADR-001-entity-architecture.md": [...],
    ...
}
```

## `check_obsidian.check_vault_integrity(vault_root) -> dict`

```python
{
    "frontmatter_errors": [    # liste (vide si aucune erreur)
        {"path": str, "error": str}
    ],
    "dataview_errors": [       # liste (vide si aucune erreur)
        {"path": str, "error": str}
    ],
    "dataview_blocks_total": int
}
```
