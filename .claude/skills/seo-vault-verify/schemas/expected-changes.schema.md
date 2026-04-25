# Schéma du manifeste `expected-changes-vN.yaml`

Documentation structurée des champs attendus. Pas de JSON Schema lib — validation via stdlib (`isinstance`, checks manuels) dans `run_audit.py`.

## Structure racine

```yaml
version: <int>               # requis, version du schéma (1 actuellement)
source_zip_sha256: <str>     # optionnel, "PENDING_BASELINE" avant premier audit
adr_reference: <str>         # requis, ex: "ADR-002"
files_regenerated: [...]     # requis, liste d'items
files_unchanged: [...]       # optionnel, liste d'items non-régression
cross_ref_aggregate: {...}   # optionnel, bornes du nombre de refs cross
matching_rules: {...}        # optionnel, overrides des règles de matching
```

## Item `files_regenerated[*]`

```yaml
path: <str>                  # requis, relatif à la racine du vault (ex: "00-Meta/README.md")
must_contain: [...]          # optionnel, liste de patterns à vérifier
sections_required: [...]     # optionnel, liste de sections H2 attendues
tags_required: [<str>, ...]  # optionnel, tags Obsidian (#pilier/maillage, etc.)
tag_context: [...]           # optionnel, tag + qualifier à proximité
frontmatter_keys_required: [<str>, ...]  # optionnel, clés attendues dans YAML frontmatter
dataview_blocks_min: <int>   # optionnel, nombre minimum de blocs ```dataview
cross_ref_targets: [<str>, ...]  # optionnel, stems de cibles attendues en wikilinks/md-links
```

### `must_contain[*]`

```yaml
pattern: <str>               # requis, string à trouver (NFC, case-insens)
near: <str>                  # optionnel, autre string de contexte
window: <int>                # optionnel, caractères autour de `near` (défaut 200)
case_sensitive: <bool>       # optionnel, défaut false
```

### `sections_required[*]`

```yaml
title: <str>                 # requis, titre exact de la section H2
min_terms: <int>             # optionnel, nombre minimum de termes définis dans le body
term_markers: [<str>, ...]   # optionnel, markers pour compter les termes (ex: ["**", ":"])
```

### `tag_context[*]`

```yaml
tag: <str>                   # requis, tag à localiser
qualifier_pattern: <str>     # requis, string attendue à proximité
window: <int>                # optionnel, défaut 100
```

## Item `files_unchanged[*]`

```yaml
path: <str>                  # requis
sha256_expected: <str>       # requis, "PENDING_BASELINE" ou hash hex
```

## `cross_ref_aggregate`

```yaml
adr_002_min_files_referencing: <int>  # borne basse inclusive
adr_002_max_files_referencing: <int>  # borne haute inclusive
```

## `matching_rules`

```yaml
unicode_normalization: NFC   # toujours NFC (non configurable)
case_sensitive_default: <bool>  # défaut false (global)
whitespace_collapse: <bool>     # défaut true (multi-whitespace → 1 space)
```

## Exemple minimal

```yaml
version: 1
adr_reference: ADR-002
files_regenerated:
  - path: README.md
    must_contain:
      - pattern: "Hello"
cross_ref_aggregate:
  adr_002_min_files_referencing: 1
  adr_002_max_files_referencing: 10
```
