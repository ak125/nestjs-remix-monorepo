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
- Pour le **NETTOYAGE** des sections polluées → utiliser `surgical-cleaner` (chaîne : v5-guardian détecte → surgical-cleaner nettoie → content-gen regénère si besoin)
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
    WHEN sgc_content ~* 'Source:\s*web(-catalog)?/|Réf\.\s*:' THEN 'RAG_SCRAPING'
    WHEN sgc_content ~* 'Skip to (main content|menu|footer)|Gestion des cookies|Navigation principale|Inscription newsletter|Aller au contenu|Téléchargement →|Partager sur' THEN 'NAV_SCRAPING'
    WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ|PRIX IMBATTABLE|Reconditionnement des|Formula XT|Essential Line|Technologies de plaquettes' THEN 'OEM_MARKETING'
    WHEN sgc_content ~* 'Réf\.\s*(OE|OEM)|N°\s*d''article|Brembo.*premium|Verniciatura|Beschichtung' THEN 'OEM_PRODUCT'
    WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s|##\s+Quand\s|##\s+Quel' THEN 'BLOG_H2_INJECTED'
    WHEN sgc_content ~* '- Vivacar|vroomly|oscaro\.com|mister-auto|autodoc' THEN 'COMPETITOR_SCRAPING'
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

### Priorité de nettoyage (rapport)

Priorité = **HAUTE** si S4_DEPOSE 100 % scrapé ou taille > 3000 chars, **MOYENNE** sinon.
Pollution détectée → chaîne de nettoyage : `surgical-cleaner` (nettoyage) → `content-gen` (regénération si besoin).

### Scan grande échelle (--batch, toutes gammes)

Exclure les sections déjà nettoyées (`pipeline-v5-surgical-clean`, `pipeline-v5-replace`) pour ne pas re-flagger le travail validé :

```sql
SELECT pollution_type, COUNT(*) as section_count, COUNT(DISTINCT sgc_pg_id) as gamme_count
FROM (
  SELECT sgc_pg_id,
    CASE
      WHEN sgc_content ~* 'Source:\s*web(-catalog)?/' THEN 'RAG_SCRAPING'
      WHEN sgc_content ~* 'Skip to (main content|menu|footer)|Inscription newsletter|Aller au contenu|Gestion des cookies|Téléchargement →|Partager sur' THEN 'NAV_SCRAPING'
      WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ|Reconditionnement des|Formula XT|Essential Line|Technologies de plaquettes' THEN 'OEM_MARKETING'
      WHEN sgc_content ~* 'Textar équipées|Brembo.*premium|Verniciatura|Beschichtung' THEN 'OEM_PRODUCT'
      WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s|##\s+Quand\s|##\s+Quel' THEN 'BLOG_H2_INJECTED'
      WHEN sgc_content ~* '- Vivacar|vroomly|oscaro\.com|mister-auto' THEN 'COMPETITOR_SCRAPING'
      ELSE 'CLEAN'
    END as pollution_type
  FROM "__seo_gamme_conseil"
  WHERE sgc_enriched_by IS DISTINCT FROM 'pipeline-v5-surgical-clean'
    AND sgc_enriched_by IS DISTINCT FROM 'pipeline-v5-replace'
) sub
GROUP BY pollution_type
ORDER BY section_count DESC;
```

Pour le détail des sections polluées (pg_id, section, preview), reprendre la même clause `WHERE sgc_enriched_by IS DISTINCT FROM …` + le filtre `OR` des patterns ci-dessus.

### Faux positifs connus

- **pg_id=1164 (Accessoires plaquettes) S3** : le regex capte « Brembo » dans un contexte technique légitime de compatibilité étrier. Ce n'est PAS de la pollution.
- Le contenu technique qui mentionne des marques dans un contexte de comparaison ou de compatibilité est légitime (vaut aussi pour `Textar|ATE|TRW` du pattern BRAND_SCRAPING).

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

### Critères spécifiques par type de section (bonus/malus)

| Section | Bonus/Malus spécifiques |
|---------|------------------------|
| S1 (fonction) | +10 si explique le rôle mécanique concret, -10 si copié de Wikipedia |
| S2 (quand changer) | +10 si liste de symptômes concrets, -10 si générique "consultez un pro" |
| S3 (comment choisir) | +10 si critères d'achat spécifiques (marques, specs), -10 si marketing |
| S4_DEPOSE | +10 si étapes numérotées avec outils, -10 si blog scrapé |
| S5 (erreurs) | +10 si erreurs spécifiques au composant, -10 si "ne pas oublier de vérifier" |
| S6 (vérifications) | +10 si méthode de diagnostic concrète, -10 si conseil vague |

### Requête SQL de scoring rapide

```sql
SELECT sgc_pg_id, sgc_section_type,
  LENGTH(sgc_content) as len,
  sgc_enriched_by,
  -- Indicateurs pollution
  CASE WHEN sgc_content ~* 'Source:\s*web(-catalog)?/' THEN 1 ELSE 0 END as has_rag_scraping,
  CASE WHEN sgc_content ~* 'Skip to main content|Gestion des cookies' THEN 1 ELSE 0 END as has_nav_scraping,
  CASE WHEN sgc_content ~* 'COMBO IDÉAL|MÊME QUALITÉ' THEN 1 ELSE 0 END as has_oem_marketing,
  CASE WHEN sgc_content ~* '##\s+Comment\s|##\s+Pourquoi\s' THEN 1 ELSE 0 END as has_blog_h2,
  -- Indicateurs qualité
  CASE WHEN LENGTH(sgc_content) BETWEEN 150 AND 1500 THEN 'OK'
       WHEN LENGTH(sgc_content) < 50 THEN 'VIDE'
       WHEN LENGTH(sgc_content) > 3000 THEN 'SUSPECT'
       ELSE 'COURT' END as length_verdict
FROM "__seo_gamme_conseil"
WHERE sgc_pg_id = '{pg_id}'
ORDER BY sgc_section_type;
```

### Verdicts

| Score | Verdict | Action |
|-------|---------|--------|
| ≥ 70 | **WRITE** | Prêt pour écriture (avec confirmation rapide) |
| 40-69 | **REVIEW** | Examen humain requis |
| < 40 | **BLOCK** | Ne pas écrire, chercher meilleure source |

Principe fondamental : **3 niveaux de vérification, jamais de write automatique** (scorer → comparer → décider). Tout verdict BLOCK ou REVIEW stoppe le pipeline jusqu'à validation humaine.

### Matrice de décision vs existant (anti-régression L2)

Avant toute modification, comparer le contenu proposé avec l'existant. **BLOCK si le nouveau contenu est inférieur à l'existant** (score inférieur, plus court ET moins spécifique, pollué, ou existant déjà nettoyé `pipeline-v5-*`).

| Existant | Nouveau proposé | Verdict |
|----------|-----------------|---------|
| Vide / <50 chars | Score >= 70 | WRITE |
| Vide / <50 chars | Score 40-69 | REVIEW |
| Vide / <50 chars | Score < 40 | BLOCK |
| Court (<300) générique | Score >= 70 + spécifique | WRITE |
| Court (<300) générique | Score 40-69 | REVIEW |
| Bon (>300, propre) | Score >= 80 + nettement supérieur | REVIEW (validation manuelle) |
| Bon (>300, propre) | Score < 80 | BLOCK (pas de régression) |
| Déjà nettoyé (v5-*) | Tout | BLOCK (sauf si score > 90 + REVIEW) |

### Check claims numériques non sourcés (plafonne le verdict)

> Origine : taxonomie de `claim-extractor.util.ts` (chaîne buying-guide legacy, portée ici
> avant suppression — programme purge RAG-source 2026-06-11, ADR-031/046).

Avant tout verdict WRITE, scanner le contenu proposé avec les 4 familles de claims :

| Kind | Pattern (gi) | Exemple |
|------|--------------|---------|
| mileage | `\d[\d\s.,]*\d?\s*(?:-` ou `à` ou `a)\s*\d[\d\s.,]*\d?\s*km` ou `\d[\d\s.,]*\d?\s*km` | « tous les 60 000 km », « 30 000 - 60 000 km » |
| dimension | `\d+(?:[.,]\d+)?\s*(?:mm` ou `cm` ou `Nm` ou `bar` ou `°C)` | « 22,4 mm », « 110 Nm » |
| percentage | `\d+(?:[.,]\d+)?\s*%` | « 30 % » |
| norm | `(?:ISO` ou `ECE` ou `FMVSS` ou `NF` ou `EN)\s*[\w.-]+` | « ECE R90 » |

Normalisation avant comparaison (équivalent `normalizeClaimValue` legacy) : supprimer tous
les espaces, virgule → point, lowercase, trim.

**Règle** : tout claim détecté dont la valeur normalisée n'a **aucune trace** dans une source
autoritaire (facts/sources WIKI `exports/seo` de la gamme, ou donnée DB autoritaire citée) ⇒
**verdict plafonné à REVIEW** (jamais WRITE direct), avec la liste des claims non sourcés
dans le rapport. Ne jamais inventer ni « corriger » une valeur — signaler uniquement.

### Check vocabulaire cross-rôle R1 (plafonne le verdict)

> Origine : salvage du script archivé `generate-content-r1.py` (PR #954). La liste vit dans
> un seul fichier — **pointer, pas duplication**.

Pour du contenu destiné à une page **R1** (routage gamme) : scanner contre les listes
**FORBIDDEN VOCABULARY** (anglicismes interdits + vocabulaire cross-rôle R3/R4/R5/R6 +
jargon accepté à ne pas flagger) définies dans
`.claude/prompts/R1_ROUTER/editorial.md` §FORBIDDEN VOCABULARY (racine monorepo ;
depuis ce workspace : `../../.claude/prompts/R1_ROUTER/editorial.md`). Ne PAS recopier
la liste ici — la lire à chaque run (SoT unique).

**Règle** : tout terme interdit détecté ⇒ **verdict plafonné à REVIEW**, avec les termes
trouvés et leur rôle d'origine (R3 how-to, R5 diagnostic, R4 référence, R6 guide d'achat)
dans le rapport. Les termes de la section « Jargon technique accepté » ne sont jamais flaggés.

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
