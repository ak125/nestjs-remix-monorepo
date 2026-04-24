---
name: r8-diversity-check
description: "Vérifie la diversité réelle du contenu R8 (anti-duplicate) après le wire variation (ADR-022 P2d). Wrapper thin sur scripts/qa/r8-diversity-check.py. Utilise ce skill quand tu veux \"vérifier variation R8\", \"anti-duplicate R8\", \"check diversity motorisations\", \"r8 fingerprint audit\", \"mesurer collisions siblings\". Usage : /r8-diversity-check <brand_alias|modele_id> [--batch] [--threshold=80] [--format=json|markdown]"
argument-hint: "<brand|modele-id|slug|--batch> [--threshold N] [--format markdown|json]"
allowed-tools: Read, Bash
---

# R8 Diversity Check — Skill wrapper v1.0

Thin wrapper sur le script Python exécutable `scripts/qa/r8-diversity-check.py`
(pattern aligné `scripts/db/adr017-create-index-concurrently.py` — psycopg2 direct,
déterministe, testé unit).

## Quand utiliser ce skill

Après avoir :
1. Mergé les PRs ADR-022 Pilier 2 (#145 pools + #146 wire enricher)
2. Lancé l'enrichissement R8 via `POST /api/admin/r8/enrich/:typeId` pour les types d'un constructeur
3. Voulu vérifier que les fingerprints sont bien distincts entre motorisations sœurs

## Démarcation

- **Ce skill MESURE** la diversité post-enrichement (read-only DB)
- Pour **GÉNÉRER** contenu R8 → `content-gen` ou endpoint `/api/admin/r8/enrich/:typeId`
- Pour **AUDIT SEO GLOBAL** R1-R8 → `seo-gamme-audit`
- Pour **QUALITÉ ÉDITORIALE** → `content-audit`
- Pour **ANTI-CANNIB CROSS-ROLE** (R1/R3/R4 mélangés) → `blog-hub-planner`

## Comment invoquer

Le skill exécute directement le script Python via Bash. Exemples :

```bash
# Par marque alias
python3 scripts/qa/r8-diversity-check.py --brand smart

# Par modele_id direct
python3 scripts/qa/r8-diversity-check.py --modele-id 140004

# Par slug
python3 scripts/qa/r8-diversity-check.py --slug renault-clio-3

# Batch : tous modèles ≥ 3 pages R8 enrichies
python3 scripts/qa/r8-diversity-check.py --batch

# Output JSON (pour CI)
python3 scripts/qa/r8-diversity-check.py --brand smart --format json

# Seuil custom
python3 scripts/qa/r8-diversity-check.py --brand smart --threshold 75
```

## Exit codes

| Code | Sens |
|------|------|
| 0 | PASS — tous slots ≥ seuil sur tous modèles |
| 1 | REVIEW — 1-2 slots sous seuil sur ≥ 1 modèle |
| 2 | FAIL — ≥ 3 slots sous seuil OU ≥ 50 % modèles en FAIL |
| 3 | Erreur technique (DB, args invalides, scope vide) |

## Seuils par défaut

| Fingerprint | Seuil PASS | Justification |
|-------------|-----------|---------------|
| `content` | ≥ 80 % | Global page — doit être distinct |
| `normalized_text` | ≥ 80 % | Global — texte normalisé |
| `block_sequence` | n/a | Stable attendu (structure des blocs constante) |
| `semantic_key` | ≥ 80 % | Sémantique globale |
| `faq_signature` | ≥ 80 % | S_FAQ_DEDICATED (pool SEO_R8_FAQ_OPENING N=7) |
| `category_signature` | ≥ 80 % | S_CATALOG_ACCESS (pool N=7) |

## Prérequis

- `SUPABASE_DB_PASSWORD` dans `backend/.env`
- Python 3 + `psycopg2` + `python-dotenv` (déjà installés sur DEV VPS)
- Backend DEV enrichi au préalable via l'endpoint admin

## Output attendu

- **Markdown** (default) : tableau par modèle + collisions détaillées + actions recommandées
- **JSON** : structure `{summary, models[]}` parseable (CI friendly)

## Tests unitaires

```bash
python3 scripts/qa/r8-diversity-check-test.py
# 11 tests (VerdictTest + OutputFormatTest)
```

## Security

- Read-only sur DB (pas de INSERT / UPDATE)
- Connexion directe port 5432 via `SUPABASE_DB_PASSWORD` (BYPASSRLS service_role)
- Pas de génération, pas d'écriture RAG

## Références

- Script : `scripts/qa/r8-diversity-check.py`
- Tests : `scripts/qa/r8-diversity-check-test.py`
- ADR-022 Pilier 2d (wire variation)
- PRs base : #145 (pools), #146 (enricher wire)
- Related agents : `r8-keyword-planner` (P2_EVALUATE_DIVERSITY), `r8-vehicle-validator`
