---
name: v5-guardian
description: "Gardien unifié pipeline v5 : pollution + quality gate + anti-régression. Use when user mentions guardian, vérifier qualité v5, check pipeline, anti-régression, health check gamme. Remplace pollution-scanner + content-quality-gate combinés."
argument-hint: "<pg_alias|pg_id|--batch|--health>"
allowed-tools: Read, mcp__claude_ai_Supabase__execute_sql, Glob
---

# V5 Guardian — Gardien unifié du contenu pipeline v5

## Démarcation

- Ce skill **VÉRIFIE** la qualité et protège le contenu v5 (pollution, régression, scoring)
- Pour la **GÉNÉRATION** de contenu → utiliser `content-gen`
- Pour l'**AUDIT ÉDITORIAL** approfondi (R2D2, E-E-A-T) → utiliser `content-audit`
- Pour l'**AUDIT SEO GLOBAL** (métriques R1-R8, maillage) → utiliser `seo-gamme-audit`
- Pour la **MIGRATION** v4→v5 → utiliser `md-v5-migrator`
- **Fusionne** : `pollution-scanner` (détection) + `content-quality-gate` (scoring) + guard pipeline-v5 (protection)

## Usage

- `/v5-guardian filtre-a-huile` — check complet d'une gamme (pollution + scoring + gaps)
- `/v5-guardian 82` — par pg_id
- `/v5-guardian --batch` — scan les 241 gammes, rapport synthétique
- `/v5-guardian --health` — health check global (stats agrégées, alertes)
- `/v5-guardian filtre-a-huile --pre-write` — check avant écriture (appelé par content-gen)

## Base de données

- **Projet Supabase** : `cxpojprgwgubzjyqzmoq`
- **Table principale** : `__seo_gamme_conseil`
- **Colonnes clés** : `sgc_pg_id` (TEXT !), `sgc_section_type`, `sgc_content`, `sgc_enriched_by`
- **Outil MCP** : `mcp__claude_ai_Supabase__execute_sql`

---

## Module 1 : Détection de pollution (ex pollution-scanner)

### Les 15+ patterns de pollution

```sql
SELECT sgc_pg_id, sgc_section_type, LENGTH(sgc_content) as len,
  CASE
    WHEN sgc_content ~* 'Source:\s*web/|Réf\.\s*:' THEN 'RAG_SCRAPING'
    WHEN sgc_content ~* 'Skip to main content|Gestion des cookies|Navigation principale' THEN 'NAV_SCRAPING'
    WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ|PRIX IMBATTABLE' THEN 'OEM_MARKETING'
    WHEN sgc_content ~* 'Réf\.\s*(OE|OEM)|N°\s*d''article' THEN 'OEM_PRODUCT'
    WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s|##\s+Quel' THEN 'BLOG_H2_INJECTED'
    WHEN sgc_content ~* 'oscaro\.com|mister-auto|autodoc' THEN 'COMPETITOR_SCRAPING'
    WHEN sgc_content ~* 'Textar|ATE|TRW.*force' THEN 'BRAND_SCRAPING'
    WHEN sgc_content ~* '<script|onclick|javascript:' THEN 'XSS_INJECTION'
    WHEN sgc_content ~* 'lorem ipsum|dolor sit amet' THEN 'PLACEHOLDER'
    WHEN sgc_content ~* 'TODO|FIXME|XXX' THEN 'DEV_ARTIFACT'
    WHEN LENGTH(sgc_content) < 50 THEN 'TOO_SHORT'
    WHEN LENGTH(sgc_content) > 5000 THEN 'SUSPECT_LONG'
    ELSE 'CLEAN'
  END as pollution_type
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}'
ORDER BY sgc_section_type;
```

### Verdict pollution

| Type | Sévérité | Action |
|------|----------|--------|
| RAG_SCRAPING, NAV_SCRAPING, COMPETITOR_SCRAPING | CRITIQUE | Nettoyage immédiat proposé |
| OEM_MARKETING, OEM_PRODUCT, BRAND_SCRAPING | HAUTE | Review + nettoyage |
| BLOG_H2_INJECTED | MOYENNE | Review (peut être intentionnel) |
| TOO_SHORT | BASSE | Gap à combler via content-gen |
| CLEAN | OK | Rien à faire |

---

## Module 2 : Scoring qualité (ex content-quality-gate)

### Critères de scoring (0-100)

| Critère | Points | Mesure |
|---------|--------|--------|
| **Longueur** | 0-15 | <50=0, 50-150=5, 150-400=10, 400-1500=15, >3000=10 |
| **Absence pollution** | 0-20 | 0 match regex = 20, 1 match = 5, 2+ = 0 |
| **Structure HTML** | 0-15 | `<b>`, `<ul>`, `<li>` appropriés = 15, brut = 5, cassé = 0 |
| **Spécificité pièce** | 0-20 | Mentionne pièce + détails techniques = 20, générique = 5 |
| **Cohérence section** | 0-15 | Contenu correspond au type S1/S2/S3/etc. |
| **Français correct** | 0-15 | Pas de fragments étrangers, phrases complètes |

### Verdicts

| Score | Verdict | Action |
|-------|---------|--------|
| ≥ 70 | **WRITE** | Prêt pour écriture (avec confirmation rapide) |
| 40-69 | **REVIEW** | Examen humain requis |
| < 40 | **BLOCK** | Ne pas écrire, chercher meilleure source |

---

## Module 3 : Guard anti-régression (ex guard pipeline-v5)

### Règle NON-NÉGOCIABLE

**Si une section a `sgc_enriched_by LIKE 'pipeline-v5-%'`, NE JAMAIS écraser.**

Ces sections ont été auditées et validées humainement. Le pipeline doit SKIP et afficher :
`⚠️ Section {type} protégée (pipeline-v5), SKIP.`

### Tags protégés

| Tag `sgc_enriched_by` | Signification | Protection |
|------------------------|---------------|------------|
| `pipeline-v5-surgical-clean` | Nettoyé manuellement | ABSOLUE |
| `pipeline-v5-legacy-recycle` | Recyclé depuis legacy | ABSOLUE |
| `pipeline-v5-legacy-enrich` | Enrichi depuis legacy | ABSOLUE |
| `pipeline-v5-replace` | Remplacé après review | HAUTE |
| `content-gen-r3` | Généré R3 | STANDARD |
| `content-gen-r1` | Généré R1 | STANDARD |

### Matrice anti-régression (avant écriture)

```python
# Pseudo-code du guard — à appliquer AVANT tout UPDATE
existing = query("SELECT sgc_content, sgc_enriched_by, LENGTH(sgc_content) FROM ...")
new_content = generated_content

# Rule 1: Protection pipeline-v5
if existing.enriched_by LIKE 'pipeline-v5-%':
    BLOCK("Section protégée pipeline-v5")

# Rule 2: Anti-régression longueur
if len(existing.content) > 0 and len(new_content) < len(existing.content):
    BLOCK(f"Régression longueur: {len(existing.content)}c → {len(new_content)}c")

# Rule 3: Anti-pollution
if has_pollution(new_content):
    BLOCK(f"Pollution détectée dans le contenu proposé: {pollution_type}")

# Rule 4: Score minimum
if score(new_content) < 40:
    BLOCK(f"Score insuffisant: {score}/100")
```

### Requête pre-write

```sql
SELECT sgc_section_type, sgc_enriched_by, LENGTH(sgc_content) as len,
  LEFT(sgc_content, 200) as preview,
  CASE WHEN sgc_enriched_by LIKE 'pipeline-v5-%' THEN 'PROTECTED' ELSE 'WRITABLE' END as status
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}'
ORDER BY sgc_section_type;
```

---

## Module 4 : Gap detection

### Sections attendues

Gamme complète = `S1, S2, S2_DIAG, S3, S4_DEPOSE, S4_REPOSE, S5, S6, S_GARAGE, S7, S8, META`

```sql
SELECT pg.pg_id, pg.pg_nom,
  ARRAY_AGG(sgc.sgc_section_type ORDER BY sgc.sgc_section_type) as sections_presentes,
  12 - COUNT(sgc.sgc_section_type) as gaps_count
FROM "__piece_gamme" pg
LEFT JOIN "__seo_gamme_conseil" sgc ON sgc.sgc_pg_id = pg.pg_id::text
  AND LENGTH(COALESCE(sgc.sgc_content, '')) > 50
GROUP BY pg.pg_id, pg.pg_nom
HAVING COUNT(sgc.sgc_section_type) < 12
ORDER BY gaps_count DESC;
```

### Priorisation des gaps

| Section manquante | Priorité | Impact |
|-------------------|----------|--------|
| S3 (comment choisir) | HAUTE | Conversion directe |
| S4_DEPOSE (démontage) | HAUTE | Contenu unique, valeur SEO |
| S2 (quand changer) | MOYENNE | Symptômes, diagnostic |
| S5 (erreurs à éviter) | MOYENNE | Différenciation |
| S1 (fonction) | BASSE | Souvent couvert par description |

---

## Mode --health (health check global)

Requête agrégée pour dashboard rapide :

```sql
SELECT
  COUNT(DISTINCT sgc_pg_id) as gammes_with_content,
  COUNT(*) as total_sections,
  COUNT(*) FILTER (WHERE LENGTH(sgc_content) > 150) as sections_ok,
  COUNT(*) FILTER (WHERE LENGTH(sgc_content) < 50) as sections_vides,
  COUNT(*) FILTER (WHERE sgc_enriched_by LIKE 'pipeline-v5-%') as sections_protected,
  COUNT(*) FILTER (WHERE sgc_enriched_by LIKE 'content-gen-%') as sections_generated,
  COUNT(*) FILTER (WHERE sgc_content ~* 'Source:\s*web/|Skip to main content|COMBO IDÉAL|oscaro\.com') as sections_polluees
FROM "__seo_gamme_conseil";
```

---

## Workflow complet

1. **Identifier** : résoudre pg_alias → pg_id (même logique que content-gen étape 0)
2. **Scanner** : Module 1 (pollution) sur toutes les sections
3. **Scorer** : Module 2 (qualité) sur toutes les sections
4. **Protéger** : Module 3 (guard) — lister les sections protégées
5. **Gaps** : Module 4 — lister les sections manquantes
6. **Rapport** : tableau synthétique + coverage manifest

## Rapport de sortie

| pg_id | Section | Len | Pollution | Score | Protected | Verdict |
|-------|---------|-----|-----------|-------|-----------|---------|
| 7 | S1 | 423 | CLEAN | 78 | non | OK |
| 7 | S2 | 0 | - | - | - | GAP |
| 7 | S3 | 312 | CLEAN | 72 | v5-surgical | PROTECTED |

Plus le coverage manifest obligatoire :

```
scope_requested / scope_actually_scanned / files_read_count
excluded_paths / unscanned_zones
corrections_proposed (JAMAIS appliquées auto)
remaining_unknowns / final_status
```

## Attention SQL

- `sgc_pg_id` est TEXT → utiliser des quotes : `WHERE sgc_pg_id = '82'`
- `pg_id` dans `__piece_gamme` est INT → cast si jointure : `pg.pg_id::text = sgc.sgc_pg_id`
- Pas de colonne `sgc_updated_at` (elle n'existe pas)
- Échapper les apostrophes : `l'étrier` → `l''étrier`
