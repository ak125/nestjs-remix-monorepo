---
name: content-gen
description: "Générateur de contenu SEO par rôle R* via Claude Code (sans clé API payante). Lit RAG + KP → génère le contenu → écrit en DB. Usage : /content-gen <pg_alias|vehicle_slug> [--r1|--r3|--r4|--r5|--r6|--r8|--meta|--all]"
argument-hint: "<pg_alias ou vehicle_slug> [--r1|--r3|--r4|--r5|--r6|--r8|--meta|--all]"
allowed-tools: Read, mcp__supabase__execute_sql, Glob
---

# Content Generator — Skill /content-gen v1.0

## Usage
- `/content-gen filtre-a-huile` — génère contenu pour TOUS les rôles R* de cette gamme
- `/content-gen filtre-a-huile --r1` — R1 seul (sg_content + meta)
- `/content-gen filtre-a-huile --r3` — R3 seul (sections conseil)
- `/content-gen filtre-a-huile --r4` — R4 seul (référence encyclopédique)
- `/content-gen filtre-a-huile --r6` — R6 seul (guide d'achat)
- `/content-gen filtre-a-huile --meta` — meta descriptions seulement (R1+R3+R6)
- `/content-gen renault-clio-3 --r8` — R8 véhicule
- `/content-gen filtre-a-huile --all` — forcer tous les rôles

## Projet Supabase
`cxpojprgwgubzjyqzmoq`

## Principe

Ce skill utilise **Claude Code lui-même comme LLM** pour générer le contenu.
Pas de clé API payante nécessaire. Le contenu est généré dans la conversation
puis écrit directement en DB via MCP Supabase.

---

## Procédure

### Étape 0 — Détection gamme / véhicule

Même logique que `/kp` et `/rag-check` :
1. Lire `/opt/automecanik/rag/knowledge/gammes/{input}.md` → MODE GAMME
2. Sinon `vehicles/{input}.md` → MODE VÉHICULE
3. Sinon DB

### Étape 1 — Résoudre l'entité

**Gamme** :
```sql
SELECT pg_id, pg_alias, pg_name FROM pieces_gamme
WHERE pg_alias = '{input}' OR pg_id::text = '{input}';
```

**Véhicule** : extraire du frontmatter (modele_id, marque_id)

### Étape 2 — Lire les sources

**2a** — Fichier RAG gamme/véhicule :
```
Read /opt/automecanik/rag/knowledge/gammes/{pg_alias}.md
```
Parser le frontmatter YAML complet.

**2b** — Keyword plan en DB (si validé) :
```sql
SELECT rkp_section_terms, rkp_intent_map, rkp_quality_score
FROM __seo_r3_keyword_plan WHERE rkp_pg_id = {pg_id} AND rkp_status = 'validated';
```
(adapter le nom de table selon le rôle : r1, r3, r4, r5, r6, r8)

**2c** — Contenu existant (pour ne pas régresser) :
```sql
SELECT length(sg_content) as current_r1_chars, sg_h1, sg_title, sg_descrip
FROM __seo_gamme WHERE sg_pg_id = '{pg_id}';
```

**2d** — Prompt canonique du rôle :
```
Read .claude/prompts/R{X}_{ROLE}/generator.md
```

### Étape 3 — Déterminer les rôles à générer

| Argument | Rôles |
|----------|-------|
| (aucun) | R1 + R3 + R4 + R6 (si evidence suffisante) |
| `--r1` | R1 seul |
| `--r3` | R3 seul |
| `--r4` | R4 seul |
| `--r5` | R5 seul |
| `--r6` | R6 seul |
| `--r8` | R8 seul (véhicule) |
| `--meta` | Meta descriptions R1+R3+R6 |
| `--all` | Tous les rôles forcés |

### Étape 4 — Générer le contenu par rôle

Pour chaque rôle, suivre le prompt canonique `.claude/prompts/R*/generator.md`.

**RÈGLES DE GÉNÉRATION** :

1. **Utiliser UNIQUEMENT les données du RAG** — ne pas inventer
2. **Respecter le vocabulaire interdit** du rôle (voir generator.md)
3. **Respecter les seuils de longueur** :
   - R1 : max 150 mots (surface courte)
   - R3 : 50-400 mots par section, 8 sections
   - R4 : 200-2000 chars pour la définition, 100-600 pour chaque champ
   - R6 : >1000 chars pour how_to_choose
4. **Format HTML** pour R1 sg_content et R3 sgc_content
5. **Texte brut** pour R4 (definition, role_mecanique) et R6 (how_to_choose)
6. **Intégrer les keywords du KP** dans les H2, body, FAQ si disponibles

---

## Étape 5 — Génération R1 (page gamme router)

À partir du RAG, générer :
- `sg_content` : HTML court (3 sections H2, max 150 mots)
  - H2 1 : "{Pièce} : les variantes à connaître" (20% budget)
  - H2 2 : "Pourquoi sélectionner votre véhicule ?" (35% budget)
  - H2 3 : "Trouvez votre véhicule rapidement" (35% budget)
- `sg_h1` : "{Pièce au pluriel} — trouvez la référence compatible avec votre véhicule" (max 70c)
- `sg_title` : "{Pièce} : sélectionnez votre véhicule | AutoMecanik" (max 60c)
- `sg_descrip` : 120-155 chars, contient nom pièce + "véhicule" + "compatible"

**Inclure les liens de maillage** dans sg_content :
- Lien vers R4 : `<a href="/reference-auto/{alias}">En savoir plus</a>`
- Lien vers R3 : `<a href="/blog-pieces-auto/{alias}">Conseils</a>`
- Lien vers R6 : `<a href="/blog-pieces-auto/guide-achat/{alias}">Guide d'achat</a>`

**Écriture** (TOUJOURS en mode draft — jamais écrire les champs live directement) :
```sql
UPDATE __seo_gamme SET
  sg_content_draft = $content$...$content$,
  sg_h1 = '...',
  sg_title_draft = '...',
  sg_descrip_draft = '...',
  sg_draft_source = 'content-gen-skill',
  sg_draft_updated_at = now()
WHERE sg_pg_id = '{pg_id}';
```
> **INTERDIT** : ne JAMAIS écrire `sg_content`, `sg_title`, `sg_descrip` (champs live).
> Utiliser uniquement les champs `*_draft`. La promotion draft→live est un processus séparé.

---

## Étape 6 — Génération R3 (sections conseil)

À partir du RAG frontmatter, générer 8 sections HTML :

| Section | Source RAG | Budget |
|---------|-----------|--------|
| S1 Avant de commencer | domain.role, safety | 50-150 mots |
| S2 Quand intervenir | maintenance.interval, wear_signs | 120-250 mots |
| S3 Compatibilité | selection.criteria | 100-200 mots |
| S4 Dépose/repose | diagnostic.depose_steps | 200-400 mots (si evidence) |
| S5 Erreurs fréquentes | selection.anti_mistakes | 100-220 mots |
| S6 Vérification finale | maintenance.good_practices | 80-180 mots |
| S7 Pièces associées | domain.related_parts | 60-150 mots |
| S8 FAQ | rendering.faq | 150-350 mots |

**Format** : HTML avec `<p>`, `<ul>`, `<li>`, `<strong>`. Pas de H2 (le heading est séparé).

**Écriture par section** (upsert sur la contrainte unique `(sgc_pg_id, sgc_section_type)`) :
```sql
INSERT INTO __seo_gamme_conseil (sgc_pg_id, sgc_section_type, sgc_content, sgc_quality_score, sgc_enriched_by)
VALUES ('{pg_id}', 'S1', $content$...$content$, 85, 'content-gen-skill')
ON CONFLICT (sgc_pg_id, sgc_section_type) DO UPDATE SET
  sgc_content = CASE
    WHEN length(EXCLUDED.sgc_content) >= length(__seo_gamme_conseil.sgc_content)
    THEN EXCLUDED.sgc_content
    ELSE __seo_gamme_conseil.sgc_content
  END,
  sgc_quality_score = EXCLUDED.sgc_quality_score,
  sgc_enriched_by = 'content-gen-skill';
```
> **IMPORTANT** : Utiliser `ON CONFLICT (sgc_pg_id, sgc_section_type)` — jamais `(sgc_pg_id, sgc_id)`.
> Le CASE protège contre la régression : le contenu plus court ne remplace JAMAIS le contenu plus long.

---

## Étape 7 — Génération R4 (référence encyclopédique)

À partir du RAG, générer les champs texte :

| Champ | Source RAG | Longueur |
|-------|-----------|----------|
| definition | domain.role + must_be_true | 800-2000 chars, 3 paragraphes, min 4 chiffres |
| role_mecanique | domain.role + related_parts | 300-700 chars, transformation physique |
| role_negatif | domain.must_be_true (inversé) | 300-600 chars, 4-6 phrases "ne fait pas" |
| confusions_courantes | domain.confusion_with | ARRAY de "{A} ≠ {B} : {explication}" |
| regles_metier | domain.must_be_true | ARRAY de verbe d'action + pourquoi |
| composition | domain.composition, related_parts | ARRAY de "{composant} en {matériau} — {spec}" |
| scope_limites | domain.cross_gammes | 100-300 chars |

**Écriture** :
```sql
UPDATE __seo_reference SET
  definition = $def$...$def$,
  role_mecanique = $rm$...$rm$,
  role_negatif = $rn$...$rn$,
  confusions_courantes = ARRAY['...', '...', '...'],
  regles_metier = ARRAY['...', '...', '...'],
  composition = ARRAY['...', '...', '...'],
  scope_limites = '...'
WHERE pg_id = {pg_id};
```

---

## Étape 8 — Génération R6 (guide d'achat)

À partir du RAG + KP R6, générer :

| Champ | Source | Longueur |
|-------|--------|----------|
| sgpg_intro_role | domain.role | 100-200 chars |
| sgpg_risk_explanation | diagnostic.causes | 100-300 chars |
| sgpg_how_to_choose | selection.criteria + anti_mistakes | >1000 chars (guide complet) |

**Écriture** :
```sql
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_role = '...',
  sgpg_risk_explanation = '...',
  sgpg_how_to_choose = $htc$...$htc$,
  sgpg_updated_at = now()
WHERE sgpg_pg_id = '{pg_id}';
```

---

## Étape 9 — Génération meta descriptions (--meta)

Pour chaque rôle avec du contenu :

**R1 meta** :
```sql
UPDATE __seo_gamme SET sg_descrip_draft = '...', sg_draft_source = 'content-gen-skill', sg_draft_updated_at = now()
WHERE sg_pg_id = '{pg_id}';
```
> **INTERDIT** : ne JAMAIS écrire `sg_descrip` (champ live). Utiliser `sg_descrip_draft`.
Format : 120-155 chars, nom pièce + "véhicule" + "compatible" + "livraison"

**R3 meta** (via __blog_advice si existe) :
```sql
UPDATE __blog_advice SET ba_meta_description = '...' WHERE ba_pg_id = '{pg_id}';
```
Format : 120-155 chars, "comment" + nom pièce + "guide" + "étape par étape"

---

## Étape 10 — Rapport de génération

Afficher :
```
## Content Generated — {pg_name} (pg_id={pg_id})

| Rôle | Avant | Après | Delta | Écrit en DB |
|------|-------|-------|-------|-------------|
| R1 | 1061c | 1187c | +126c | ✅ __seo_gamme |
| R3 | 10 sections | 10 sections (7 updated) | 0 new, 7 maj | ✅ __seo_gamme_conseil |
| R4 | def 1550c | def 1600c | +50c | ✅ __seo_reference |
| R6 | choose 14014c | choose 14200c | +186c | ✅ __seo_gamme_purchase_guide |

Vocabulaire interdit : 0 fuites détectées
Source : RAG + KP (Claude Code generation)
```

---

## Étape 11 — Vérification post-génération

Après écriture, lancer automatiquement :
```sql
-- Vérifier que le draft est bien écrit
SELECT length(sg_content_draft) as r1_draft_chars, sg_draft_updated_at::text
FROM __seo_gamme WHERE sg_pg_id = '{pg_id}';
```

Si le draft n'a pas changé → signaler "⚠️ Écriture échouée — vérifier les RLS"

---

## Règles

1. **Ne JAMAIS inventer** — uniquement RAG + KP comme source
2. **Vérifier le vocabulaire interdit** avant écriture
3. **⛔ GUARD ANTI-RÉGRESSION (BLOQUANT)** :
   - AVANT chaque UPDATE, comparer `new_length` vs `existing_length` en DB
   - Si `new_length < existing_length` → **BLOQUER l'écriture**
   - Afficher : "⛔ GUARD: Contenu R{X} existant ({existing}c) > contenu généré ({new}c). Écriture bloquée."
   - Ne JAMAIS écrire un contenu vide si l'existant n'est pas vide
   - Exception : `--force` bypass le guard (avec warning)
   - S'applique à : sg_content (R1), sgc_content (R3), definition (R4), sgpg_how_to_choose (R6), role_mecanique (R4)
4. **Écrire avec des dollar-quoted strings** (`$content$...$content$`) pour éviter les problèmes d'échappement SQL
5. **Signaler les sections non générées** (evidence insuffisante)
6. **Format HTML** pour R1/R3, **texte brut** pour R4/R6
7. **Intégrer les maillages inter-rôles** dans R1 sg_content
8. **Respecter les limites de longueur** par rôle (R1 = court, R3 = moyen, R4/R6 = long)
9. **Toujours lire le contenu existant AVANT de générer** — pour calibrer la longueur cible (≥ existant)
