# Schéma rapport final

Structure produite par `run_audit.run_audit()` et sérialisée en JSON.

## Top-level

```python
{
    "verdict": str,              # enum: "SCOPE_SCANNED" | "PARTIAL_COVERAGE"
                                 #     | "REVIEW_REQUIRED" | "INSUFFICIENT_EVIDENCE"
    "generated_at": str,         # ISO 8601 UTC
    "extract_manifest": dict,    # output de vault_extract (zip_sha256, extract_dir, files)
    "content_checks": [...],     # liste de check-result (cf. check-result.schema.md)
    "crossref": {...},           # agrégation ADR refs (cf. ci-dessous)
    "unchanged_checks": [...],   # non-régression SHA256 (cf. ci-dessous)
    "obsidian": {...},           # output de check_vault_integrity
    "subagent": dict | None,     # résultat subagent SEO (si exécuté)
    "missing_files": [<str>, ...],  # fichiers attendus absents du vault
    "error": str                 # optionnel, si extraction échouée
}
```

## `crossref`

```python
{
    "adr_ref_target": str,       # ex: "ADR-002"
    "count_files_referencing": int,
    "expected_min": int,
    "expected_max": int,
    "in_range": bool
}
```

## `unchanged_checks[*]`

```python
{
    "path": str,
    "pass": bool,
    "sha256_actual": str,        # hex 64
    "sha256_expected": str,      # optionnel (PENDING_BASELINE si pas gelé)
    "note": str,                 # optionnel (ex: "baseline non gelée")
    "reason": str                # si pass == False
}
```

## `subagent` (si exécuté)

```python
{
    "dimensions": [
        {
            "name": str,         # enum: "pilier_primaire_secondaire" | "anti_sur_optimisation"
                                 #     | "kpis_mesurables" | "outreach_opportuniste"
            "status": str,       # enum: "OK" | "FLAG" | "UNKNOWN"
            "evidence": str,
            "comment": str
        }
    ],
    "overall_status": str,       # "OK" | "FLAG" | "UNKNOWN"
    "overall_comment": str
}
```

## Règles de verdict

Déterminisme appliqué par `run_audit.py` :

| Condition | Verdict |
|-----------|---------|
| Extraction échouée | `INSUFFICIENT_EVIDENCE` |
| ≥1 fichier attendu absent | `REVIEW_REQUIRED` |
| ≥1 `content_checks` fail OU crossref hors plage OU obsidian error | `REVIEW_REQUIRED` |
| Tous déterministes OK mais subagent absent | `PARTIAL_COVERAGE` |
| Tous déterministes OK + subagent `overall_status == "OK"` | `SCOPE_SCANNED` |
| Tous déterministes OK + subagent `FLAG` ou `UNKNOWN` | `REVIEW_REQUIRED` |

## Coverage manifest (rendu dans le .md)

Section textuelle obligatoire contenant : `scope_requested`, `scope_actually_scanned`, `files_read_count`, `excluded_paths`, `unscanned_zones`, `corrections_proposed`, `validation_executed`, `remaining_unknowns`, `final_status`.

Verdict `SCOPE_SCANNED` exige que tous les champs soient remplis avec évidence — sinon fallback `PARTIAL_COVERAGE`.
