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

**2b** — Keywords importés depuis Claude Chrome (SOURCE PRIORITAIRE) :
```sql
SELECT kw, intent, vol FROM __seo_keyword_results
WHERE pg_id = {pg_id} AND role = '{role}'
ORDER BY
  CASE vol WHEN 'HIGH' THEN 1 WHEN 'MED' THEN 2 ELSE 3 END,
  kw;
```
Ces mots-clés DOIVENT être intégrés dans le contenu généré (H1, H2, body, meta, FAQ).
Règle d'intégration :
- KW vol=HIGH → OBLIGATOIRE dans H1 ou H2 + body text
- KW vol=MED → intégrer dans body text ou FAQ
- KW vol=LOW → optionnel, utiliser comme variantes naturelles

**2b-fallback** — Si `__seo_keyword_results` est vide pour ce pg_id+role, fallback sur les anciennes tables KP :
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

### Étape 4 — Lancer via le moteur agentique

**Le skill /content-gen passe par le moteur agentique** pour orchestrer la génération.
Cela donne automatiquement : plan multi-branches → solve parallèle → critique → approve humain.

#### 4a — Créer le run agentique

```bash
curl -s -X POST http://localhost:3000/api/admin/agentic/runs \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Content generation pour gamme {pg_alias} (pg_id={pg_id})",
    "goal_type": "content_generation",
    "triggered_by": "skill:content-gen"
  }'
```

Récupérer le `run_id` de la réponse.

#### 4b — Lancer le planner

```
Agent tool, subagent_type: "agentic-planner"
Prompt: "run_id = {run_id}"
```

Le planner crée les branches (ex: r1-content-batch, r4-content-batch, r6-content-batch, conseil-batch).

#### 4c — Lancer les solvers (en parallèle)

Pour chaque branch_id, lancer un solver **en parallèle** :

```
Agent tool, subagent_type: "agentic-solver"
Prompt: "run_id = {run_id}, branch_id = {branch_id}"
run_in_background: true
```

#### 4d — Lancer le critic

```
Agent tool, subagent_type: "agentic-critic"
Prompt: "run_id = {run_id}"
```

#### 4e — Gate humaine

Le run s'arrête en phase `applying`. Afficher :
"Run terminé. Approve avec `POST /api/admin/agentic/runs/{run_id}/approve`"

**Fallback** : si le backend n'est pas démarré, générer directement le contenu par rôle ci-dessous.

**RÈGLES DE GÉNÉRATION (mode direct ou solver)** :

1. **Utiliser UNIQUEMENT les données du RAG + KW importés** — ne pas inventer
2. **Respecter le vocabulaire interdit** du rôle (voir generator.md)
3. **Respecter les seuils de longueur** :
   - R1 : 250-400 mots (contenu riche, 4-5 H2, intégration KW)
   - R3 : 50-400 mots par section, 8 sections
   - R4 : 200-2000 chars pour la définition, 100-600 pour chaque champ
   - R6 : >1000 chars pour how_to_choose
4. **Format HTML** pour R1 sg_content et R3 sgc_content
5. **Texte brut** pour R4 (definition, role_mecanique) et R6 (how_to_choose)
6. **INTÉGRATION OBLIGATOIRE DES KW IMPORTÉS** :
   - Lire `__seo_keyword_results WHERE pg_id={pg_id} AND role='{role}'`
   - **KW vol=HIGH** → DOIT apparaître dans H1/H2 et dans le body (au moins 1 occurrence naturelle)
   - **KW vol=MED** → intégrer dans le body, les listes à puces, ou les FAQ
   - **KW vol=LOW** → utiliser comme variantes naturelles dans le texte (longue traîne)
   - **PAA** → transformer en questions FAQ si section FAQ présente
   - Vérifier APRÈS génération que les KW HIGH sont bien présents dans le contenu
   - Si un KW HIGH est absent → réviser le contenu pour l'inclure naturellement

---

## Étape 5 — Génération R1 (page gamme router)

**R1 = 2 prompts séparés, 1 étape de chargement commune :**

### 5.0 — Chargement données (commun aux 2 prompts)

Charger UNE SEULE FOIS et réutiliser dans 5a + 5b :

```python
# 1. KW importés
kw = SQL("SELECT kw, intent, vol FROM __seo_keyword_results WHERE pg_id={pg_id} AND role='R1' ORDER BY CASE vol WHEN 'HIGH' THEN 1 WHEN 'MED' THEN 2 ELSE 3 END")
kw_high = [k for k in kw if k.vol == 'HIGH']
kw_med  = [k for k in kw if k.vol == 'MED']
kw_paa  = [k for k in kw if k.intent == 'paa']

# 2. RAG gamme
rag = parse_yaml("/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md")

# 3. DB aggregates
agg = SQL("SELECT products_total, top_brands FROM gamme_aggregates WHERE ga_pg_id={pg_id}")

# 4. Contenu existant (pour garde anti-régression)
existing = SQL("SELECT length(sg_content) as chars, sg_h1 FROM __seo_gamme WHERE sg_pg_id='{pg_id}'")
```

**⛔ GATE : si `len(kw) == 0` :**
- Afficher : "⚠️ Aucun KW importé pour R1. Le contenu sera générique. Importez d'abord via /admin/keyword-planner."
- Continuer avec les données RAG uniquement (pas de blocage dur)
- Marquer `kw_driven = false` (pour le rapport)

### 5a — Contenu éditorial (sg_content) — PROMPT: `.claude/prompts/R1_ROUTER/editorial.md`

Lire le prompt editorial.md et suivre ses instructions. En résumé :

1. Utiliser les données chargées en 5.0
2. Générer **1500-2000 mots HTML** avec **6-8 H2** enrichis KW
3. Intégrer TOUS les KW vol=HIGH dans H2 + body
4. Transformer les KW intent=paa en FAQ `<details><summary>`
5. Maillage interne R3 + R4 + R6 + gammes liées

Cibles de longueur :
- **Minimum** : 10 000 chars / 1500 mots / 6 H2
- **Optimal** : 15 000 chars / 2000 mots / 8 H2
- **Maximum** : 20 000 chars (au-delà, risque de dilution)

### 5b — Meta tags

- `sg_h1` : KW vol=HIGH le plus fort (max 70c)
- `sg_title_draft` : KW vol=HIGH + "| AutoMecanik" (max 60c)
- `sg_descrip_draft` : 120-155 chars, KW HIGH principal + "livraison" ou "en stock"

### 5c — H2 Overrides

Extraire les H2 du sg_content généré et écrire dans `sgpg_h2_overrides` :
```sql
UPDATE __seo_gamme_purchase_guide SET sgpg_h2_overrides = $h2${
  "content": "[Premier H2 du sg_content]",
  "motorizations": "[Gamme] compatible avec votre véhicule",
  "equipementiers": "Marques [gamme] : [top 3]",
  "checklist": "Vérifications avant achat de [gamme]",
  "faq": "[H2 FAQ du sg_content]"
}$h2$ WHERE sgpg_pg_id = '{pg_id}';
```
Règles H2 : nom gamme obligatoire, KW HIGH dans "content", max 60 chars.
Si 0 KW → ne PAS générer de h2Overrides (fallbacks hardcodés s'appliquent).

### 5d — Écriture avec garde anti-régression

**⛔ GUARD ANTI-RÉGRESSION (BLOQUANT) :**
```python
new_length = len(generated_content)
existing_length = existing.chars  # chargé en 5.0

if existing_length > 0 and new_length < existing_length:
    print(f"⛔ GUARD: Contenu existant ({existing_length}c) > généré ({new_length}c). Écriture BLOQUÉE.")
    # NE PAS écrire. Demander confirmation humaine.
    return
```

**Si garde OK → écrire directement dans sg_content (champ live) :**
```sql
UPDATE __seo_gamme SET
  sg_content = $content$[HTML 1500-2000 mots]$content$,
  sg_h1 = '[H1 enrichi KW]',
  sg_title_draft = '[title draft]',
  sg_descrip_draft = '[description draft]',
  sg_draft_source = 'content-gen-skill',
  sg_draft_updated_at = now()
WHERE sg_pg_id = '{pg_id}';
```

> **Note** : `sg_content` est écrit directement (live) car le editorial.md produit du contenu
> validé et la garde anti-régression protège contre les régressions.
> `sg_title_draft` et `sg_descrip_draft` restent en draft (promotion séparée via SeoTitleEngine).

### 5e — Validation KW post-écriture

Après écriture, vérifier AUTOMATIQUEMENT l'intégration des KW :

```python
content_lower = generated_content.lower()
missing_high = [k.kw for k in kw_high if not fuzzy_match(k.kw, content_lower)]
missing_med  = [k.kw for k in kw_med if not fuzzy_match(k.kw, content_lower)]

if len(missing_high) > 0:
    print(f"⚠️ {len(missing_high)} KW HIGH manquants : {missing_high}")
    print("→ Réviser le contenu pour les inclure naturellement.")
    # NE PAS bloquer, mais AVERTIR

integration_score = round(
    (len(kw_high) - len(missing_high)) / max(len(kw_high), 1) * 50 +
    (len(kw_med) - len(missing_med)) / max(len(kw_med), 1) * 35 +
    15  # LOW = bonus fixe
)
print(f"Score intégration KW : {integration_score}/100")
```

### 5f — Invalidation cache

**OBLIGATOIRE** après toute écriture dans `__seo_gamme` ou `__seo_gamme_purchase_guide` :
```
POST http://localhost:3000/api/admin/cache/invalidate?pg_id={pg_id}
```
Fallback si endpoint non disponible : `redis-cli DEL gamme:rpc:v2:{pg_id}`

Sans cette étape, l'ancien contenu est servi pendant 1h (TTL cache).

### 5g — Maillage bidirectionnel

**Source de vérité** : table `__seo_gamme_links` (1199 liens, 236 gammes).

Après écriture du sg_content pour gamme A :

**1. Liens sortants (A → cibles)** :
```sql
SELECT l.target_pg_id, l.anchor_text, l.context, l.relation,
       pg.pg_alias, pg.pg_name
FROM __seo_gamme_links l
JOIN pieces_gamme pg ON pg.pg_id = l.target_pg_id
WHERE l.source_pg_id = {pg_id}
ORDER BY l.relation, pg.pg_name;
```

Pour chaque lien cible :
- Vérifier si `sg_content` contient déjà un `<a href="/pieces/{target_alias}-{target_id}.html">`
- Si absent → l'ajouter naturellement dans le body (pas en append brut)
- Format : `<a href="/pieces/{alias}-{id}.html">{anchor_text}</a>` dans une phrase contextuelle

**2. Liens entrants (sources → A, bidirectionnel)** :
```sql
SELECT l.source_pg_id, l.anchor_text, l.context,
       pg.pg_alias, pg.pg_name,
       sg.sg_content
FROM __seo_gamme_links l
JOIN pieces_gamme pg ON pg.pg_id = l.source_pg_id
JOIN __seo_gamme sg ON sg.sg_pg_id = l.source_pg_id::text
WHERE l.target_pg_id = {pg_id} AND l.bidirectional = true;
```

Pour chaque gamme source :
- Vérifier si `source.sg_content` contient déjà un lien vers gamme A (`/pieces/{pg_alias}-{pg_id}.html`)
- Si absent ET source.sg_content n'est pas vide :
  ```sql
  UPDATE __seo_gamme SET
    sg_content = sg_content || $link$
  <p class="mt-3 text-sm text-slate-500">{context} — <a href="/pieces/{pg_alias}-{pg_id}.html" class="text-blue-600 hover:underline">{anchor_text}</a></p>
  $link$
  WHERE sg_pg_id = '{source_pg_id}';
  ```
- Invalider le cache Redis de la gamme source : `redis-cli DEL gamme:rpc:v2:{source_pg_id}`

**Règles maillage :**
- **Append only** — ne jamais modifier le contenu existant, ajouter à la fin
- **Max 3 liens entrants ajoutés** par exécution — pas de sur-optimisation
- **Deduplicate** — si le lien href existe déjà dans sg_content, NE PAS l'ajouter
- **Ancre naturelle** — utiliser le `anchor_text` de la table, pas "cliquez ici"
- **Contexte** — utiliser le `context` de la table pour la phrase d'intro du lien
- **Garde anti-régression** — append = length augmente toujours (OK)

### 5h — Image prompts R1

Après maillage, générer les prompts image R1 si pas déjà existants :

```bash
curl -s -X POST http://localhost:3000/api/admin/r1-image-prompts/generate/{pg_alias} \
  -b cookies.txt
```

5 slots : HERO_EDITORIAL, TYPES_SCHEMA, PRICE_CHART, MOUNTING_DIAGRAM, OG_IMAGE.
G7-R1 gate : max 3 in-article sélectionnés (top richness score).
Si prompts déjà existants et `--force` non set → skip.

Les images sont rendues automatiquement dans le sg_content par le response builder
quand `rip_status = 'approved'` et `rip_image_url` est rempli.

Workflow image complet :
1. content-gen génère les prompts (step 5h)
2. Admin approuve les prompts (PATCH /approve)
3. Images générées avec Midjourney/DALL-E/ComfyUI
4. Upload vers Supabase storage (`uploads/articles/gammes-produits/r1-editorial/{pg_alias}/`)
5. Set URL (PATCH /set-image-url)
6. Response builder injecte les `<figure>` dans sg_content
7. Invalider cache Redis

---

## Mode batch

Pour traiter plusieurs gammes :

```
/content-gen --batch top20 --r1
```

Logique :
1. Charger les 20 gammes avec le plus de KW importés (`SELECT pg_id, COUNT(*) FROM __seo_keyword_results WHERE role='R1' GROUP BY pg_id ORDER BY count DESC LIMIT 20`)
2. Pour chaque gamme, exécuter les étapes 5.0 → 5f séquentiellement
3. Afficher un rapport batch en fin :

```
## Batch R1 — 20 gammes
| Gamme | Avant | Après | Score KW | Statut |
|-------|-------|-------|----------|--------|
| filtre-a-huile | 6195c | 15200c | 89/100 | ✅ |
| disque-de-frein | 1200c | 14800c | 92/100 | ✅ |
| ... | ... | ... | ... | ... |
| TOTAL | 45k | 295k | 87 avg | 18/20 OK |
```

---

## Étape 6 — Génération R3 (sections conseil)

**KW-first** : Lire `__seo_keyword_results WHERE pg_id={pg_id} AND role='R3'` en premier.
Répartir les KW par section :
- KW how_to → S3 (Dépose/repose), S4
- KW informational/entretien → S2 (Quand intervenir), S5
- KW cout → S7 (Pièces associées) ou body text
- KW PAA → S8 (FAQ) — transformer chaque KW PAA en question/réponse

À partir du RAG frontmatter + KW importés, générer 8 sections HTML :

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
Source : RAG + KW importés (Claude Code generation)

### Intégration KW
| Vol | Total KW | Intégrés | Manquants |
|-----|----------|----------|-----------|
| HIGH | 5 | 5/5 | — |
| MED | 12 | 10/12 | "filtre à huile en ligne", "filtre à huile auto" |
| LOW | 28 | 15/28 | (optionnel) |
| PAA | 7 | 4/7 → FAQ | "où acheter" non utilisé |
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

**Invalidation cache Redis** (OBLIGATOIRE après écriture) :
```bash
redis-cli DEL gamme:rpc:v2:{pg_id}
```
Sans cette étape, l'ancien contenu est servi pendant 1h (TTL cache). Toujours invalider après écriture de `sg_content`, `sg_h1`, `sg_title`, `sg_descrip` ou `sgpg_h2_overrides`.

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
