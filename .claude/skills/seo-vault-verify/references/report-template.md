# SEO Vault Verify — Rapport d'audit {{DATE}}

**Skill version :** {{SKILL_VERSION}}
**Manifest version :** {{MANIFEST_VERSION}}
**ZIP SHA256 :** `{{ZIP_SHA256}}`
**Extract dir :** `{{EXTRACT_DIR}}`
**Invocation :** `{{INVOCATION}}`

---

## 1. Scan

- Scope demandé : {{SCOPE_REQUESTED}}
- Fichiers lus : {{FILES_READ_COUNT}}
- Exclusions : {{EXCLUDED_PATHS}}
- Zones non scannées : {{UNSCANNED_ZONES}}

## 2. Analysis

### 2.1 Fichiers régénérés (assertions manifeste)

{{REGENERATED_RESULTS_TABLE}}

### 2.2 Fichiers inchangés (non-régression SHA256)

{{UNCHANGED_RESULTS_TABLE}}

### 2.3 Cross-références ADR-002

- Fichiers référençant ADR-002 : {{ADR_REFS_COUNT}} (attendu ∈ [{{MIN}}, {{MAX}}])
- Détail : {{ADR_REFS_LIST}}

### 2.4 Intégrité Obsidian

- Erreurs frontmatter YAML : {{FRONTMATTER_ERRORS}}
- Erreurs blocs Dataview : {{DATAVIEW_ERRORS}}
- Total blocs Dataview : {{DATAVIEW_TOTAL}}

### 2.5 Jugement stratégique SEO (subagent)

{{SEO_JUDGMENT_JSON}}

## 3. Correction proposed

{{CORRECTIONS_PROPOSED}}

## 4. Validation

- Scripts déterministes : {{SCRIPTS_VALIDATION}}
- Subagent output parsed : {{SUBAGENT_VALIDATION}}
- Schemas inter-couches : {{SCHEMA_VALIDATION}}

## 5. Verdict

**Status final :** `{{FINAL_STATUS}}`

{{VERDICT_RATIONALE}}

---

## Coverage Manifest

```
scope_requested         : {{SCOPE_REQUESTED}}
scope_actually_scanned  : {{SCOPE_SCANNED}}
files_read_count        : {{FILES_READ_COUNT}}
excluded_paths          : {{EXCLUDED_PATHS}}
unscanned_zones         : {{UNSCANNED_ZONES}}
corrections_proposed    : {{CORRECTIONS_PROPOSED_LIST}}
validation_executed     : {{VALIDATION_EXECUTED}}
remaining_unknowns      : {{REMAINING_UNKNOWNS}}
final_status            : {{FINAL_STATUS}}
```
