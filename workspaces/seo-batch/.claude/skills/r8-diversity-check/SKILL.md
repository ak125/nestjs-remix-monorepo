---
name: r8-diversity-check
description: "Mesure la diversité fingerprint entre pages R8 motorisations sœurs (même modele_id). Use when user mentions duplicate content motorisations, variation R8, fingerprint audit, anti-duplicate sibling véhicule, ou avant batch INDEX."
argument-hint: "<brand|modele-id|slug|--batch> [--threshold N] [--format markdown|json]"
allowed-tools: Read, Bash
---

# R8 Diversity Check

Wrapper thin sur `scripts/qa/r8-diversity-check.py` (psycopg2 direct, déterministe, 11 tests
unit OK). Mesure les fingerprints distincts entre pages R8 sœurs d'un même `modele_id`
pour vérifier que le wire variation (ADR-022) produit bien du contenu différencié.

## Quick start

```bash
# Cas le plus courant : check toutes motorisations d'un constructeur
python3 scripts/qa/r8-diversity-check.py --brand smart

# Check précis d'un modèle (ex: Renault Clio III)
python3 scripts/qa/r8-diversity-check.py --modele-id 140004

# Check tous les constructeurs ayant >= 3 pages R8
python3 scripts/qa/r8-diversity-check.py --batch
```

## Quand déclencher ce skill

**Contextes naturels où l'utilisateur t'en a besoin** :

- Après un batch d'enrichissement R8 (`POST /api/admin/r8/enrich/:typeId` en boucle)
- Avant de publier un constructeur (décision INDEX vs REVIEW vs REGENERATE)
- Quand l'utilisateur se demande si ses pages motorisations sont assez différentes
- Quand on veut mesurer l'impact du wire variation (pré/post ADR-022 P2d)
- Dans le rollout 1-constructeur-à-la-fois : check avant de passer au suivant
- Lors d'un audit de régression SEO (re-mesure post-update d'un pool variation)

**Exemples de questions qui doivent déclencher le skill** :

- "Mes pages R8 SMART ont-elles bien du contenu différent entre les 13 modèles ?"
- "Est-ce que les 18 motorisations de la Clio 3 vont passer Google duplicate ?"
- "Donne-moi le rapport fingerprint pour Renault"
- "Y a-t-il des collisions de hash entre les motorisations du Clio III Break ?"
- "Combien de h1 distincts sur le batch SMART qu'on vient d'enrichir ?"
- "Check diversity après le merge de la PR #146"
- "Audit anti-duplicate sur le catalogue véhicule"

## Démarcation avec autres skills (ne PAS confondre)

| Besoin | Skill à utiliser |
|--------|------------------|
| Mesurer diversité R8 post-wire (ce skill) | `r8-diversity-check` |
| Générer le contenu R8 d'une page | `content-gen` ou endpoint `/api/admin/r8/enrich/:typeId` |
| Audit SEO global R1-R8 (métriques, maillage, score composite) | `seo-gamme-audit` |
| Qualité éditoriale R2D2 (Intent-First, lisibilité) | `content-audit` |
| Anti-cannibalisation cross-role (R1 vs R3 vs R4) | `blog-hub-planner` |
| Scanner pollution OEM/scraping dans sections conseil v5 | `pollution-scanner` |
| Guardian v5 (pollution + quality + régression) | `v5-guardian` |

Si l'utilisateur demande "vérifier mes pages SMART", c'est ce skill pour la diversité
des motorisations d'un constructeur. Pour la qualité de chaque page isolée, c'est
`content-audit`. Pour un audit global (tous rôles R1-R8), c'est `seo-gamme-audit`.

## Exécution

Le skill exécute directement le script Python via `Bash`. Les 4 modes de scope sont
mutuellement exclusifs (argparse `required=True` group).

### Arguments scope (1 requis parmi)

- `--brand <alias>` — toutes motorisations de la marque (ex: `smart`, `renault`, `dacia`)
- `--modele-id <int>` — un modèle précis (ex: `140004` pour Clio III)
- `--slug <brand-model>` — par slug (ex: `renault-clio-3`)
- `--batch` — tous les modèles ayant ≥ 3 pages R8 enrichies

### Options

- `--threshold <N>` — seuil PASS en % distinct (défaut `80`)
- `--format markdown|json` — format output (défaut `markdown`)

### Exemples étendus

```bash
# Rapport JSON pour CI / integration downstream
python3 scripts/qa/r8-diversity-check.py --brand smart --format json | jq .summary.global_verdict

# Seuil plus permissif (70%) pour rollout initial
python3 scripts/qa/r8-diversity-check.py --brand dacia --threshold 70

# Chainage shell : exit code drive la décision
python3 scripts/qa/r8-diversity-check.py --brand smart && echo "SMART prêt INDEX"
```

## Exit codes (exploitables en shell)

| Code | Sens | Action suggérée |
|------|------|-----------------|
| 0 | PASS | Tous modèles ≥ seuil. Feu vert publication |
| 1 | REVIEW | 1-2 slots sous seuil sur ≥ 1 modèle. Reviser les collisions |
| 2 | FAIL | ≥ 3 slots sous seuil ou ≥ 50% modèles FAIL. Enrichir pools puis re-run |
| 3 | Erreur technique | DB connection, args invalides, scope vide (aucune page R8) |

## Seuils par défaut + le WHY

| Fingerprint | Seuil PASS | Pourquoi ce seuil |
|-------------|-----------|-------------------|
| `content` | ≥ 80 % | Hash global de la page rendue. Distinct obligatoire pour éviter Google duplicate content. 80% = tolère 20% collision résiduelle acceptable sur petits siblings (≤ 5) |
| `normalized_text` | ≥ 80 % | Texte normalisé (lowercase, sans ponctuation). Détecte duplicate même avec variations superficielles |
| `block_sequence` | n/a (stable attendu) | Structure des blocs R8 identique entre siblings (même ordre S_IDENTITY → S_COMPAT → ...). Si ce hash varie, c'est un BUG structurel, pas un indicateur diversité |
| `semantic_key` | ≥ 80 % | Union tokens sémantiques (brand, model, type, power, fuel, families). Doit différer entre motorisations |
| `faq_signature` | ≥ 80 % | Bloc S_FAQ_DEDICATED — driven par pool `SEO_R8_FAQ_OPENING_VARIATIONS` (N=7 prime). Collision possible si 2 siblings partagent index rotation |
| `category_signature` | ≥ 80 % | Bloc S_CATALOG_ACCESS — driven par pool `SEO_R8_CATALOG_ACCESS_VARIATIONS` (N=7). Même logique |

**Pourquoi 80 %** : pour 18 motorisations Clio III, un pool de taille 7 (prime) garantit
7/7 residus distincts → 7 variantes distribuées sur 18 pages = 11 collisions max.
11/18 = 61% collision, soit 39% distinct théorique. Le rendu effectif avec
placeholders injectés ({power}, {fuel}, etc.) augmente la différenciation réelle
au-dessus de 80%. Seuil 80 = marge de sécurité pour cas avec siblings count < N.

**Ajustement seuil** : petits groupes siblings (< 5) peuvent nécessiter `--threshold 70` pour
éviter faux positifs. Grands groupes (> 20) peuvent viser `--threshold 90`.

## Verdict global (aggregation multi-modèles)

Si `--batch` ou `--brand` fournit N modèles :
- **PASS** : 100 % des modèles sont PASS
- **REVIEW** : ≥ 1 modèle non-PASS mais < 50 % en FAIL
- **FAIL** : ≥ 50 % des modèles en FAIL (signal rouge systémique)

## Sample output markdown

Le script produit un rapport comme ceci :

```markdown
# R8 Diversity Check — brand:smart

**Run**: 2026-04-24T13:45:00+00:00
**Seuil**: 80% distinct par slot
**Verdict global**: **REVIEW** (PASS 11, REVIEW 2, FAIL 0 / 13 modèles)

## Détail par modèle

| modele_id | Marque | Modèle | Sib | content | norm | blk_seq | semantic | faq | category | avg_div | Verdict |
|-----------|--------|--------|-----|---------|------|---------|----------|-----|----------|---------|---------|
| 151000 | SMART | CABRIO (450) | 6 | 6/6 (100%) | 6/6 | 1/6* | 6/6 | 5/6 (83%) | 5/6 | 72.4 | ✅ PASS |
| 151001 | SMART | CITY COUPE | 8 | 8/8 | 8/8 | 1/8* | 8/8 | 5/8 (63%) | 7/8 | 70.2 | ⚠️ REVIEW |
...

\* `block_sequence` est attendu stable (structure des blocs constante).

## Collisions détectées

### 151001 CITY COUPE — verdict REVIEW
Slots sous seuil: faq_signature

**faq_signature** (pool hint: SEO_R8_FAQ_OPENING_VARIATIONS (N=7)) :
- hash `abc12345...` → type_ids [34201, 34205, 34212] (3 collisions)
- hash `def67890...` → type_ids [34207, 34210] (2 collisions)

## Actions recommandées
- Enrichir pools sous-dimensionnés (augmenter N vers prime supérieur 11 ou 13)
- Re-enrichir les modèles REVIEW/FAIL via POST /api/admin/r8/enrich/:typeId
- Re-run `r8-diversity-check` post-enrichement
```

## Prérequis

- `SUPABASE_DB_PASSWORD` dans `backend/.env` (connexion port 5432 direct)
- Python 3 + `psycopg2` + `python-dotenv` (déjà installés sur DEV VPS)
- Backend DEV a au moins enrichi les types du scope demandé (table `__seo_r8_pages`
  et `__seo_r8_fingerprints` non vides)

Si aucune page R8 existe pour le scope, le script sort avec exit `3` et indique
d'appeler l'endpoint admin enricher d'abord.

## Tests unitaires

```bash
python3 scripts/qa/r8-diversity-check-test.py
# Résultat attendu : Ran 11 tests in ~0.001s — OK
```

Tests couvrent : verdict logic (6 cas : PASS/REVIEW/FAIL, block_seq ignored,
single sibling, threshold custom) + output formatters (5 cas : markdown sections,
verdict badges, collisions, JSON parseable complet).

## Sécurité

- **Read-only DB** : script n'exécute aucun INSERT/UPDATE/DELETE
- Connexion via `SUPABASE_DB_PASSWORD` → rôle `postgres` avec `BYPASSRLS`
- Aucune écriture disque, aucune génération de contenu
- Sortie vers stdout uniquement ; logs vers stderr

## Structure du skill

```
.claude/skills/r8-diversity-check/
└── SKILL.md                           (ce fichier, thin wrapper ~180 LOC)

scripts/qa/
├── r8-diversity-check.py              (script exécutable, ~450 LOC)
└── r8-diversity-check-test.py         (tests unittest, 11 tests, ~200 LOC)
```

## Références

- Script : `scripts/qa/r8-diversity-check.py`
- Tests : `scripts/qa/r8-diversity-check-test.py`
- ADR-022 Pilier 2d — R8 RAG Control Plane wire variation
- PRs base : #145 (variation pools prime-sized) + #146 (enricher wire)
- Pattern Python direct-pg : `scripts/db/adr017-create-index-concurrently.py`
- Agents apparentés : `r8-keyword-planner` (P2_EVALUATE_DIVERSITY en pre-build),
  `r8-vehicle-validator` (validation post-enrich)
- Plan rollout : `/home/deploy/.claude/plans/objectif-sont-les-page-validated-pizza.md`
