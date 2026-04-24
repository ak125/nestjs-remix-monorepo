---
name: r8-diversity-check
description: "Vérifie la diversité réelle du contenu R8 (anti-duplicate) après le wire variation (ADR-022 P2d). Mesure les fingerprints distincts par sibling group (motorisations d'un même modele_id). Verdict PASS/REVIEW/FAIL par slot. Utilise ce skill quand tu veux \"vérifier variation R8\", \"anti-duplicate R8\", \"check diversity motorisations\", \"r8 fingerprint audit\", \"mesurer collisions siblings\". Usage : /r8-diversity-check <brand_alias|modele_id> [--batch] [--generate] [--threshold=80]"
argument-hint: "<brand_alias|modele_id> [--batch] [--generate] [--threshold=N]"
allowed-tools: Read, mcp__claude_ai_Supabase__execute_sql, Bash
---

# R8 Diversity Check — Skill v1.0

Vérifie que les pages R8 d'un même modèle (motorisations sœurs) produisent
un contenu suffisamment distinct pour éviter le duplicate content SEO.

Scope : enforce les gates de diversité post-`r8-vehicle-enricher` (ADR-022
Pilier 2d — wire variation pools). Ce skill NE génère PAS de contenu —
il MESURE seulement la distinctness des fingerprints.

## Usage

- `/r8-diversity-check smart` — check all 13 SMART models
- `/r8-diversity-check 140004` — check Renault Clio III (modele_id direct)
- `/r8-diversity-check renault-clio-3` — check via slug
- `/r8-diversity-check smart --generate` — génère R8 pages via enricher AVANT check
- `/r8-diversity-check --batch` — check tous constructeurs ayant ≥ 3 motorisations indexées
- `/r8-diversity-check smart --threshold=70` — seuil PASS personnalisé (default 80%)

## Démarcation

- **Ce skill VÉRIFIE** les fingerprints `__seo_r8_fingerprints` après enrichissement
- Pour **GÉNÉRER** le contenu R8 → `content-gen` ou endpoint `/api/admin/r8/enrich/:typeId`
- Pour l'**AUDIT SEO GLOBAL** (R1-R8) → `seo-gamme-audit`
- Pour la **QUALITÉ ÉDITORIALE** (lisibilité, génériques) → `content-audit`
- Pour **AUDIT ANTI-CANNIB CROSS-ROLE** (R1/R3/R4) → `blog-hub-planner`

## Base de données

- Projet Supabase : `cxpojprgwgubzjyqzmoq`
- Tables lues :
  - `__seo_r8_pages` (id, page_key, type_id, type_name, seo_decision, diversity_score)
  - `__seo_r8_fingerprints` (page_id, 6 fingerprints + top_tokens JSONB)
  - `auto_type` (jointure type_id → modele_id)
  - `auto_modele` (modele_name, modele_alias, modele_marque_id)
  - `auto_marque` (marque_name, marque_alias)
- Tool : `mcp__claude_ai_Supabase__execute_sql` exclusivement

## Seuils de diversité (defaults)

| Fingerprint | Seuil PASS | Bloc impacté | Rotation pool |
|-------------|-----------|--------------|---------------|
| `content_fingerprint` | ≥ 80 % distinct | global page | — |
| `normalized_text_fingerprint` | ≥ 80 % | global page | — |
| `block_sequence_fingerprint` | = 100 % stable | structure blocs | — |
| `semantic_key_fingerprint` | ≥ 80 % | sémantique globale | — |
| `faq_signature` | ≥ 70 % | S_FAQ_DEDICATED | SEO_R8_FAQ_OPENING (N=7) |
| `category_signature` | ≥ 80 % | S_CATALOG_ACCESS | SEO_R8_CATALOG_ACCESS (N=7) |

Règle : un fingerprint `block_sequence` DEVRAIT être stable (même structure de blocs),
donc 100 % identiques = normal. Les autres mesurent le contenu → distincts souhaités.

## Verdict par modele_id

- **PASS** : tous les slots (sauf block_sequence) ≥ seuil
- **REVIEW** : 1-2 slots sous seuil → enrichir pools ou bump size
- **FAIL** : ≥ 3 slots sous seuil → wire bug ou pools trop petits

## Workflow étape par étape

### Étape 1 — Parse argument

```
Si argument = entier → modele_id direct
Si argument = "brand" alias → query auto_marque.marque_alias = argument
Si argument = slug "brand-model-x" → split → marque_alias + modele_alias
Si --batch → query tous modeles avec ≥ 3 pages R8 enrichies
```

### Étape 2 (optionnel si `--generate`) — Générer les pages R8

```
POST /api/admin/vehicle-rag/generate-batch {modeleIds: [...]}  // RAG files
POST /api/admin/r8/enrich/:typeId (pour chaque type_id)        // R8 pages + fingerprints
```

Prérequis : backend DEV running + session admin (superadmin@autoparts.com).

### Étape 3 — Query DB diversity

```sql
WITH target AS (
  -- Selon argument, résout les modele_id cibles
  SELECT modele_id FROM auto_modele WHERE modele_marque_id::text = :marque_id_or_alias
),
pages_with_fp AS (
  SELECT
    p.type_id::int AS type_id,
    t.type_modele_id_i AS modele_id,
    m.modele_name,
    br.marque_name,
    p.seo_decision,
    p.diversity_score,
    fp.content_fingerprint,
    fp.normalized_text_fingerprint,
    fp.block_sequence_fingerprint,
    fp.semantic_key_fingerprint,
    fp.faq_signature,
    fp.category_signature
  FROM public.__seo_r8_pages p
  JOIN public.__seo_r8_fingerprints fp ON fp.page_id = p.id
  JOIN public.auto_type t ON t.type_id = p.type_id::int
  JOIN public.auto_modele m ON m.modele_id = t.type_modele_id_i
  JOIN public.auto_marque br ON br.marque_id::text = m.modele_marque_id::text
  WHERE t.type_modele_id_i IN (SELECT modele_id FROM target)
)
SELECT
  modele_id,
  modele_name,
  marque_name,
  COUNT(*) AS sibling_count,
  COUNT(DISTINCT content_fingerprint) AS distinct_content,
  COUNT(DISTINCT normalized_text_fingerprint) AS distinct_normalized,
  COUNT(DISTINCT block_sequence_fingerprint) AS distinct_block_seq,
  COUNT(DISTINCT semantic_key_fingerprint) AS distinct_semantic,
  COUNT(DISTINCT faq_signature) AS distinct_faq,
  COUNT(DISTINCT category_signature) AS distinct_category,
  ROUND(AVG(diversity_score)::numeric, 1) AS avg_diversity_score,
  COUNT(*) FILTER (WHERE seo_decision = 'INDEX') AS index_count,
  COUNT(*) FILTER (WHERE seo_decision = 'REVIEW') AS review_count,
  COUNT(*) FILTER (WHERE seo_decision = 'REGENERATE') AS regenerate_count,
  COUNT(*) FILTER (WHERE seo_decision = 'REJECT') AS reject_count
FROM pages_with_fp
GROUP BY modele_id, modele_name, marque_name
HAVING COUNT(*) >= 2  -- sibling check nécessite ≥ 2
ORDER BY modele_name;
```

### Étape 4 — Detect collisions

Pour chaque modele_id avec ratio distinct < seuil sur un fingerprint :

```sql
SELECT
  fp.faq_signature,
  COUNT(*) AS colliding_type_ids,
  array_agg(p.type_id::int ORDER BY p.type_id) AS type_ids_with_same_hash
FROM public.__seo_r8_fingerprints fp
JOIN public.__seo_r8_pages p ON p.id = fp.page_id
JOIN public.auto_type t ON t.type_id = p.type_id::int
WHERE t.type_modele_id_i = :modele_id
GROUP BY fp.faq_signature
HAVING COUNT(*) >= 2;
```

Adapter la colonne `faq_signature` selon le slot qui pose problème.

### Étape 5 — Rapport Markdown

Format final à produire :

```markdown
# R8 Diversity Check — SMART (13 modèles, 66 motorisations)

**Run** : 2026-04-24T12:34:56Z
**Seuil** : 80 % distinct par slot (configurable --threshold)

## Résumé par modèle

| modele_id | Modèle | Siblings | content | normalized | block_seq | semantic | faq | category | avg_div | Verdict |
|-----------|--------|----------|---------|------------|-----------|----------|-----|----------|---------|---------|
| 151000 | CABRIO (450) | 6 | 6/6 100% | 6/6 100% | 1/6* | 6/6 | 5/6 83% | 5/6 83% | 72.4 | ✅ PASS |
| 151001 | CITY COUPE | 8 | 8/8 | 8/8 | 1/8* | 8/8 | 6/8 75% | 7/8 88% | 70.2 | ⚠️ REVIEW |
| ... | | | | | | | | | | |

\* block_sequence attendu à 1 (structure blocs stable) — pas un échec.

## Collisions détectées (REVIEW/FAIL)

### 151001 CITY COUPE — faq_signature (6/8 distinct, 75% < seuil 80%)

```
Hash abc123 : types 34201, 34205
  → Collision sur rotation pool SEO_R8_FAQ_OPENING_VARIATIONS (N=7)
  → Formule : (34201 + 0 + 300) % 7 = (34205 + 0 + 300) % 7

Hash def456 : types 34210, 34212
  → Même collision
```

**Recommandation** : enrichir `SEO_R8_FAQ_OPENING_VARIATIONS` à 11 variantes (prime)
pour baisser la probabilité de collision sur petits siblings groups.

## Verdict global

- PASS : 10 / 13 modèles
- REVIEW : 2 / 13
- FAIL : 1 / 13

## Actions suggérées

- [ ] Enrichir `SEO_R8_FAQ_OPENING_VARIATIONS` (7 → 11)
- [ ] Re-enrichir les 3 modèles en REVIEW/FAIL après enrichissement pool
- [ ] Valider manuellement editorially les 10 en PASS
```

## Edge cases

- **0 sibling** (modele avec 1 seul type_id) : skip (pas de duplicate possible)
- **block_sequence != 1** : bug structurel (structure des blocs varie entre siblings)
  → investigation required, pas un issue de variation
- **__seo_r8_fingerprints vide** : demander à l'utilisateur de lancer `--generate`
  ou d'enrichir d'abord via endpoint admin
- **diversity_score NULL** : page R8 n'a pas été scorée → enrichissement incomplet
- **seo_decision=REJECT** : exclure du calcul (page pas publiable pour autres raisons)

## Sécurité

- Read-only : ce skill ne FAIT QUE lire la DB
- Aucune modification de pages, fingerprints, ou enrichment
- Mode `--generate` hit backend endpoint admin standard (nécessite session admin)

## Example d'invocation complète

```
/r8-diversity-check smart --generate --threshold=75
```

Workflow :
1. Query 13 SMART modele_id
2. Pour chaque modele_id, list all type_ids via auto_type
3. POST vehicle-rag/generate-batch (RAG files)
4. POST r8/enrich/:typeId en boucle (pages + fingerprints)
5. Query diversity aggregée
6. Query collisions pour ratios < 75 %
7. Render markdown report

## Prérequis

- PRs #145 + #146 mergées (wire variation actif)
- Backend DEV :3000 running (si `--generate`)
- Session admin valide dans /tmp/cookies.txt (via POST /auth/login)
- MCP `mcp__claude_ai_Supabase__execute_sql` disponible

## Limites connues

- Ne détecte pas les collisions **cross-modele** (2 modèles avec même content) → utiliser
  `blog-hub-planner` anti-cannibalisation pour ça
- Ne mesure pas la **qualité éditoriale** des variantes (lisibilité, cohérence) →
  utiliser `content-audit`
- Single shot : pas de monitoring continu (run manuellement après chaque batch)

## Refs

- ADR-022 : R8 RAG Control Plane (Pilier 2d wire variation)
- Plan : `/home/deploy/.claude/plans/objectif-sont-les-page-validated-pizza.md`
- Pools : `backend/src/config/seo-variations.config.ts` (PR #145)
- Wire : `backend/src/modules/admin/services/r8-vehicle-enricher.service.ts` (PR #146)
- Related agents : `r8-keyword-planner` (P2_EVALUATE_DIVERSITY), `r8-vehicle-validator`
