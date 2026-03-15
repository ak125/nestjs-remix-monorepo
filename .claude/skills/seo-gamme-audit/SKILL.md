---
name: seo-gamme-audit
description: "Audit SEO complet d'une gamme : métriques R1-R8, couverture RAG, scores qualité, vocabulaire interdit, maillage, historique, score composite, détail sections R3, actions recommandées + auto-fix. Usage : /seo-gamme-audit <pg_alias ou pg_id> [--batch top20|worst|ready] [--fix]"
argument-hint: "<pg_alias ou pg_id> [--batch top20|worst|ready] [--fix] [--history]"
---

# SEO Gamme Audit — Skill v3.3

## Usage
- `/seo-gamme-audit filtre-a-huile` — audit complet d'une gamme
- `/seo-gamme-audit 7` — par pg_id
- `/seo-gamme-audit filtre-a-huile --fix` — audit + correction automatique des gaps
- `/seo-gamme-audit filtre-a-huile --history` — historique des scores d'une gamme
- `/seo-gamme-audit --batch top20` — 20 gammes avec le plus de gaps
- `/seo-gamme-audit --batch worst` — gammes avec les pires scores
- `/seo-gamme-audit --batch ready` — gammes prêtes pour publication
- `/seo-gamme-audit --batch top20 --fix` — audit + fix sur les 20 pires gammes

## Exécution DB

**TOUTES les requêtes SQL doivent être exécutées via `mcp__supabase__execute_sql`** avec `project_id: cxpojprgwgubzjyqzmoq`. Ne JAMAIS utiliser psql, pg_dump ou connexion directe.

## Fichiers RAG
Les fichiers .md sont dans `/opt/automecanik/rag/knowledge/` (gammes/, diagnostic/, guides/).
Utiliser l'outil `Read` pour lire les fichiers .md et parser le frontmatter YAML.

---

## Mode single gamme

### Optimisation des requêtes

**IMPORTANT** : Pour minimiser les appels MCP, regrouper les étapes en 2-3 requêtes combinées :
- **Requête A** (R1+R6+maillage+leaks+historique) : JOIN `__seo_gamme` + `__seo_gamme_purchase_guide`, colonnes R1 + R6 + ILIKE maillage + leaks en une seule requête
- **Requête B** (R3+R4+RAG+R2+corpus+QPS) : UNION ALL de sous-requêtes R3, R4, RAG, R2, corpus moyennes, __quality_page_scores
- **Requête C** (readiness) : `__rag_readiness`
- **Fichiers RAG** : lire gamme .md + vérifier diagnostic .md en parallèle

### Étape 0 — Résoudre la gamme
```sql
SELECT pg_id, pg_alias, pg_name, pg_name_url FROM pieces_gamme
WHERE pg_alias = '{input}' OR pg_id::text = '{input}';
```
Stocker `pg_id` (int), `pg_alias` (string), `pg_name`.

### Étape 1 — R1 metrics (page gamme router)
```sql
SELECT sg_pg_id, length(sg_content) as r1_chars,
  array_length(regexp_split_to_array(sg_content, '\s+'), 1) as r1_words,
  (SELECT count(*) FROM regexp_matches(sg_content, '<h2', 'g')) as r1_sections,
  (SELECT count(*) FROM regexp_matches(sg_content, '<a\s', 'g')) as r1_links,
  sg_h1, length(sg_h1) as h1_len, length(sg_title) as title_len, length(sg_descrip) as descrip_len,
  sg_updated_at as r1_updated
FROM __seo_gamme WHERE sg_pg_id = '{pg_id}';
```

### Étape 2 — R3 metrics (conseils)
```sql
SELECT count(*) as r3_sections, sum(length(sgc_content)) as r3_total_chars,
  sum(array_length(regexp_split_to_array(sgc_content, '\s+'), 1)) as r3_total_words,
  avg(sgc_quality_score)::int as r3_avg_quality, min(sgc_quality_score) as r3_min_quality,
  count(*) FILTER (WHERE sgc_quality_score >= 85) as r3_high_sections,
  (SELECT count(*) FROM regexp_matches(string_agg(sgc_content, ' '), '<a\s', 'g')) as r3_links
FROM __seo_gamme_conseil WHERE sgc_pg_id = '{pg_id}';
```

### Étape 3 — R4 metrics (référence)
```sql
SELECT id, title, length(definition) as def_chars, length(role_mecanique) as role_meca_chars,
  length(role_negatif) as role_neg_chars,
  array_length(composition, 1) as composition_items,
  array_length(confusions_courantes, 1) as confusion_items,
  array_length(regles_metier, 1) as regles_items,
  length(scope_limites) as scope_chars
FROM __seo_reference WHERE pg_id = {pg_id_int};
```

### Étape 4 — R6 metrics (guide d'achat)
```sql
SELECT sgpg_pg_id, sgpg_gatekeeper_score as r6_score,
  length(sgpg_intro_role) as intro_len, length(sgpg_risk_explanation) as risk_len,
  length(sgpg_how_to_choose) as choose_len,
  sgpg_timing_km, sgpg_timing_years, sgpg_updated_at as r6_updated
FROM __seo_gamme_purchase_guide WHERE sgpg_pg_id = '{pg_id}';
```

### Étape 5 — RAG coverage
```sql
SELECT count(*) as rag_docs,
  count(*) FILTER (WHERE truth_level = 'L1') as l1,
  count(*) FILTER (WHERE truth_level = 'L2') as l2,
  count(*) FILTER (WHERE truth_level = 'L3') as l3,
  count(*) FILTER (WHERE length(content) < 500) as thin_docs,
  count(*) FILTER (WHERE business_pool_admissible = true) as admissible,
  avg(length(content))::int as avg_doc_len,
  max(updated_at) as newest_doc
FROM __rag_knowledge WHERE status = 'active' AND gamme_aliases @> ARRAY['{pg_alias}'];
```

### Étape 6 — R5 diagnostic (symptômes)
La table `__seo_observable` n'existe pas. Utiliser les sources alternatives :

**6a** — Vérifier si le fichier diagnostic RAG existe :
```
Read /opt/automecanik/rag/knowledge/diagnostic/{pg_alias}.md
```
Si le fichier existe → `diag_file_exists = true`. Compter les `###` headings dans la section "Symptomes" pour estimer le nombre de symptômes documentés.

**6b** — Compter les symptômes dans le fichier gamme RAG :
```
Read /opt/automecanik/rag/knowledge/gammes/{pg_alias}.md
```
Parser la section `diagnostic.symptoms[]` du frontmatter. Compter les items avec `id: S*`.

**6c** — Vérifier l'article R3 conseils (contenu réel) :
```sql
SELECT ba_id, ba_title, ba_alias, length(ba_content) as content_len
FROM __blog_advice WHERE ba_pg_id = '{pg_id}' LIMIT 1;
```
Si `content_len` = 0 ou NULL → R3 existe mais vide.

**Output R5** :
- `diag_file_exists` : oui/non
- `rag_symptoms_count` : nombre de S* dans le fichier gamme
- `r3_content_len` : longueur du contenu R3 (0 = vide)

### Étape 7 — R2 product (produits disponibles)
```sql
SELECT count(*) as product_count,
  round(avg(pri_vente_ttc_n)::numeric, 2) as avg_price,
  min(pri_vente_ttc_n) as min_price, max(pri_vente_ttc_n) as max_price
FROM pieces p
JOIN pieces_price pp ON pp.pri_piece_id_i = p.piece_id
WHERE p.piece_ga_id = {pg_id_int} AND pri_vente_ttc_n > 0;
```

### Étape 8 — Maillage inter-rôles (dans sg_content R1)
```sql
SELECT
  (sg_content ILIKE '%/reference-auto/%')::int as has_link_r4,
  (sg_content ILIKE '%/diagnostic-auto/%')::int as has_link_r5,
  (sg_content ILIKE '%/blog-pieces-auto/guide-achat/%')::int as has_link_r6,
  (sg_content ILIKE '%/blog-pieces-auto/conseils/%' OR sg_content ILIKE '%/blog-pieces-auto/{pg_alias}%')::int as has_link_r3
FROM __seo_gamme WHERE sg_pg_id = '{pg_id}' AND sg_content IS NOT NULL;
```

### Étape 9 — Vocabulaire interdit cross-rôle
```sql
-- R1 content leaks (exclure les liens <a>)
SELECT
  (regexp_replace(sg_content, '<a[^>]*>[^<]*</a>', '', 'g') ILIKE '%symptôme%'
   OR regexp_replace(sg_content, '<a[^>]*>[^<]*</a>', '', 'g') ILIKE '%symptome%')::int as r1_leak_r5,
  (regexp_replace(sg_content, '<a[^>]*>[^<]*</a>', '', 'g') ILIKE '%démonter%'
   OR regexp_replace(sg_content, '<a[^>]*>[^<]*</a>', '', 'g') ILIKE '%demonter%')::int as r1_leak_r3,
  (regexp_replace(sg_content, '<a[^>]*>[^<]*</a>', '', 'g') ILIKE '%ajouter au panier%')::int as r1_leak_r2
FROM __seo_gamme WHERE sg_pg_id = '{pg_id}' AND sg_content IS NOT NULL;
```

### Étape 10 — Comparaison avec moyennes corpus
```sql
SELECT
  round(avg(length(sg_content))) as avg_r1_chars,
  round(avg(array_length(regexp_split_to_array(sg_content, '\s+'), 1))) as avg_r1_words,
  count(*) as total_gammes_with_r1
FROM __seo_gamme WHERE sg_content IS NOT NULL AND sg_content != '';
```

### Étape 11 — Readiness RAG (si table __rag_readiness existe)
```sql
SELECT canonical_role, readiness_status, role_score, usage_level
FROM __rag_readiness WHERE pg_alias = '{pg_alias}'
ORDER BY canonical_role;
```

### Étape 7b — R7 brand coverage (si table existe)
Pas de table `__seo_r7_*` actuellement. Reporter "R7 non implémenté" et passer.

### Étape 7c — R8 vehicle pages
```sql
SELECT count(*) as r8_pages,
  count(DISTINCT brand) as r8_brands,
  count(DISTINCT model) as r8_models
FROM __seo_r8_pages
WHERE page_key ILIKE '%{pg_alias}%' OR page_key ILIKE '%{pg_name}%';
```
Si 0 → "R8 aucune page véhicule pour cette gamme".

### Étape 14 — Keyword coverage (depuis RAG gamme .md)
1. Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`, extraire `seo_cluster.primary_keyword.text`
2. Vérifier la présence du keyword dans :
```sql
SELECT
  (sg_h1 ILIKE '%{keyword}%')::int as keyword_in_h1,
  (sg_title ILIKE '%{keyword}%')::int as keyword_in_title,
  (sg_descrip ILIKE '%{keyword}%')::int as keyword_in_descrip,
  (sg_content ILIKE '%{keyword}%')::int as keyword_in_content
FROM __seo_gamme WHERE sg_pg_id = '{pg_id}';
```
**Seuils** : keyword doit être dans h1 + title + content (minimum 3/4). Si < 3/4 → ⚠️ WARN.

### Étape 15 — Duplication inter-rôles
Détecter le texte copié entre surfaces. Comparer les 50 premiers mots de sg_content (R1) avec :
- `sgpg_intro_role` (R6) — s'il y a >80% de similarité → duplication R1/R6
- `ba_preview` (R3) — s'il y a >80% de similarité → duplication R1/R3

Méthode simple : extraire les 100 premiers caractères de chaque surface et comparer manuellement.
```sql
SELECT
  left(sg.sg_content, 200) as r1_start,
  left(sgpg.sgpg_intro_role, 200) as r6_start,
  left(ba.ba_preview, 200) as r3_start
FROM __seo_gamme sg
LEFT JOIN __seo_gamme_purchase_guide sgpg ON sgpg.sgpg_pg_id = sg.sg_pg_id
LEFT JOIN __blog_advice ba ON ba.ba_pg_id = sg.sg_pg_id
WHERE sg.sg_pg_id = '{pg_id}';
```
Si les débuts sont quasi-identiques → signaler "⚠️ Duplication détectée R1/R{X}".

---

## Seuils de qualité

| Rôle | Critère | Seuil READY | Seuil WARNING |
|------|---------|-------------|---------------|
| R1 | chars | >500 | 300-500 |
| R1 | words | 80-150 | <80 |
| R1 | sections H2 | ≥3 | 1-2 |
| R1 | liens internes | ≥3 | 1-2 |
| R1 | h1_len | ≤70 | >70 |
| R1 | title_len | ≤60 | >60 |
| R1 | descrip_len | 120-155 | <120 ou >160 |
| R3 | sections | ≥8 | 4-7 |
| R3 | avg_quality | ≥80 | 60-79 |
| R3 | total_chars | >5000 | 2000-5000 |
| R3 | total_words | >700 | 300-700 |
| R4 | def_chars | >800 | 200-800 |
| R4 | composition | ≥3 | 1-2 |
| R4 | confusions | ≥3 | 1-2 |
| R4 | role_meca | >200 | <200 |
| R4 | regles_metier | ≥3 | 1-2 |
| R6 | choose_len | >1000 | 200-1000 |
| R6 | r6_score | ≥70 | 50-69 |
| R2 | product_count | >10 | 1-10 |
| R5 | observables | ≥3 | 1-2 |
| RAG | docs admissibles | ≥3 | 1-2 |
| RAG | thin_docs | =0 | >0 |

---

## Output — Mode single

Produire un rapport structuré avec :

### 1. En-tête
```
## Audit SEO — {pg_name} (pg_id={pg_id}, alias={pg_alias})
Date : {date}
```

### 2. Tableau par rôle
| Rôle | Status | Score/Détail | Dernière MAJ |
|------|--------|-------------|--------------|

Status = ✅ READY / ⚠️ NEEDS_WORK / ❌ MISSING / 🔒 BLOCKED

### 3. Métriques détaillées par rôle
Pour chaque rôle existant, afficher le détail des métriques vs seuils.

### 4. Maillage inter-rôles
| Lien | Présent | Status |
|------|---------|--------|
| R1 → R4 (référence) | oui/non | ✅/❌ |
| R1 → R5 (diagnostic) | oui/non | ✅/❌ |
| R1 → R3 (conseils) | oui/non | ✅/❌ |
| R1 → R6 (guide achat) | oui/non | ✅/❌ |

### 5. Vocabulaire interdit (fuites cross-rôle)
| Fuite | Détectée | Sévérité |
|-------|----------|----------|
| R5→R1 (symptôme) | oui/non | BLOCK/OK |
| R3→R1 (démonter) | oui/non | BLOCK/OK |
| R2→R1 (panier) | oui/non | BLOCK/OK |

### 6. Quality Page Scores (si disponibles)
| Page type | Score | Gate | Status |
|-----------|-------|------|--------|
Afficher les scores de `__quality_page_scores` pour ce pg_id. Si aucun score → "Aucun score QPS — lancer compute-quality-scores".

### 7. R8 vehicle pages
| Métrique | Valeur |
|----------|--------|
| Pages R8 | {count} |
| Marques | {brands} |
| Modèles | {models} |
Si 0 → "Aucune page véhicule R8 pour cette gamme".

### 8. Keyword coverage
| Cible | h1 | title | descrip | content |
|-------|-----|-------|---------|---------|
| {keyword} | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |

Score : {N}/4 — si < 3 → ⚠️ WARN

### 9. Duplication inter-rôles
| Paire | Détectée | Sévérité |
|-------|----------|----------|
| R1/R6 | oui/non | WARN/OK |
| R1/R3 | oui/non | WARN/OK |

### 10. Comparaison corpus
| Métrique | Cette gamme | Moyenne corpus | Delta |
|----------|------------|---------------|-------|
| R1 chars | X | Y | +/-Z% |
| R1 words | X | Y | +/-Z% |

### 7. Actions recommandées (auto-générées)

Générer automatiquement les actions selon les gaps :

- Si RAG docs = 0 → "🔴 Ingérer 2-3 URLs constructeur/technique pour cette gamme"
- Si RAG thin_docs > 0 → "🟡 {N} docs RAG trop courtes (<500c) — enrichir ou supprimer"
- Si R1 manquant → "🔴 Lancer force-enrich pour générer le contenu R1"
- Si R3 sections < 8 → "🟡 Enrichir les sections conseils (actuellement {N}/8)"
- Si R4 confusions < 3 → "🟡 Ajouter {3-N} confusions courantes dans la référence"
- Si R4 def_chars < 200 → "🔴 Définition R4 trop courte ({N}c) — enrichir"
- Si R6 score null → "🟡 Lancer force-enrich pour scorer le guide d'achat"
- Si R6 choose_len < 1000 → "🟡 Guide d'achat trop court — enrichir how_to_choose"
- Si R5 observables = 0 → "🟡 Aucun symptôme documenté — ajouter via ingestion diagnostic"
- Si R2 products = 0 → "⚠️ Aucun produit référencé pour cette gamme"
- Si maillage R1→R4 absent → "🟡 Ajouter lien vers /reference-auto/{alias} dans sg_content"
- Si leak R5→R1 → "🔴 Vocabulaire diagnostic détecté dans R1 — refresh requis"
- Si R1 updated > 90j → "🟡 Contenu R1 stale (>{days}j) — planifier refresh"

### 8. Export JSON (en fin de rapport)

```json
{
  "pg_id": 7,
  "pg_alias": "filtre-a-huile",
  "audit_date": "2026-03-15",
  "roles": {
    "R1": { "status": "READY", "chars": 1061, "words": 129, "sections": 3, "links": 3, "updated": "..." },
    "R3": { "status": "READY", "sections": 10, "total_chars": 10588, "avg_quality": 90 },
    "R4": { "status": "NEEDS_WORK", "def_chars": 1550, "confusions": 2 },
    "R6": { "status": "NEEDS_WORK", "score": null, "choose_len": 14014 },
    "R5": { "status": "MISSING", "observables": 0 },
    "R2": { "status": "READY", "products": 245, "avg_price": 12.50 }
  },
  "rag": { "docs": 9, "admissible": 8, "thin": 1, "l1": 0, "l2": 9 },
  "maillage": { "r1_to_r4": true, "r1_to_r5": false, "r1_to_r3": true, "r1_to_r6": true },
  "leaks": { "r5_to_r1": false, "r3_to_r1": false, "r2_to_r1": false },
  "actions": ["..."],
  "overall_readiness": "NEEDS_WORK"
}
```

---

## Mode batch

### Étape 0b — Charger les gammes actives du catalogue

**IMPORTANT** : Les gammes actives sont celles retournées par l'API catalog families (221 gammes), PAS les 9682 entrées de `pieces_gamme`.

```bash
# Extraire les pg_id actifs
curl -s http://localhost:3000/api/catalog/families | jq '[.families[].gammes[].pg_id] | unique | join(",")' -r
```

Stocker la liste de pg_ids pour filtrer toutes les requêtes batch.
Si l'API n'est pas disponible, utiliser le filtre SQL : `WHERE pg.pg_id IN (SELECT DISTINCT sg_pg_id::int FROM __seo_gamme WHERE sg_content IS NOT NULL)` comme fallback.

### `--batch top20` — Gammes actives avec le plus de gaps
```sql
SELECT pg.pg_alias, pg.pg_id,
  CASE WHEN sg.sg_content IS NOT NULL AND sg.sg_content != '' THEN 1 ELSE 0 END as has_r1,
  (SELECT count(*) FROM __seo_gamme_conseil sgc WHERE sgc.sgc_pg_id = pg.pg_id::text AND sgc.sgc_content IS NOT NULL) as r3_sections,
  CASE WHEN EXISTS (SELECT 1 FROM __seo_reference r WHERE r.pg_id = pg.pg_id) THEN 1 ELSE 0 END as has_r4,
  (SELECT count(*) FROM __rag_knowledge rk WHERE rk.gamme_aliases @> ARRAY[pg.pg_alias] AND rk.status = 'active') as rag_docs,
  (SELECT count(*) FROM pieces p WHERE p.piece_ga_id = pg.pg_id) as products
FROM pieces_gamme pg
LEFT JOIN __seo_gamme sg ON sg.sg_pg_id = pg.pg_id::text
WHERE pg.pg_id IN ({active_pg_ids})
ORDER BY rag_docs ASC, has_r1 ASC, r3_sections ASC
LIMIT 20;
```

### `--batch worst` — Gammes actives avec les pires scores R3
```sql
SELECT pg.pg_alias, pg.pg_id,
  min(sgc.sgc_quality_score) as worst_r3_score,
  count(sgc.*) as r3_sections,
  (SELECT count(*) FROM __rag_knowledge rk WHERE rk.gamme_aliases @> ARRAY[pg.pg_alias] AND rk.status = 'active') as rag_docs
FROM pieces_gamme pg
JOIN __seo_gamme_conseil sgc ON sgc.sgc_pg_id = pg.pg_id::text
WHERE sgc.sgc_quality_score IS NOT NULL AND pg.pg_id IN ({active_pg_ids})
GROUP BY pg.pg_alias, pg.pg_id
ORDER BY worst_r3_score ASC
LIMIT 20;
```

### `--batch ready` — Gammes actives prêtes pour publication
```sql
SELECT pg.pg_alias, pg.pg_id,
  length(sg.sg_content) as r1_chars,
  (SELECT count(*) FROM __seo_gamme_conseil sgc WHERE sgc.sgc_pg_id = pg.pg_id::text AND sgc.sgc_content IS NOT NULL) as r3_sections,
  (SELECT avg(sgc.sgc_quality_score) FROM __seo_gamme_conseil sgc WHERE sgc.sgc_pg_id = pg.pg_id::text) as r3_avg_quality,
  CASE WHEN EXISTS (SELECT 1 FROM __seo_reference r WHERE r.pg_id = pg.pg_id AND length(r.definition) > 200) THEN 1 ELSE 0 END as r4_ready,
  (SELECT count(*) FROM __rag_knowledge rk WHERE rk.gamme_aliases @> ARRAY[pg.pg_alias] AND rk.status = 'active') as rag_docs
FROM pieces_gamme pg
JOIN __seo_gamme sg ON sg.sg_pg_id = pg.pg_id::text
WHERE sg.sg_content IS NOT NULL AND length(sg.sg_content) > 500 AND pg.pg_id IN ({active_pg_ids})
ORDER BY r3_sections DESC, rag_docs DESC
LIMIT 20;
```

### Output batch
Tableau compact :
| # | Gamme | R1 | R3 | R4 | R6 | RAG | Produits | Priorité |
|---|-------|----|----|----|----|-----|----------|----------|

---

## Étape 12 — Historique & tendance (fraîcheur par rôle)

```sql
SELECT
  sg.sg_updated_at as r1_updated,
  extract(day from now() - sg.sg_updated_at)::int as r1_age_days,
  (SELECT max(sgc_created_at) FROM __seo_gamme_conseil WHERE sgc_pg_id = '{pg_id}') as r3_last_update,
  extract(day from now() - (SELECT max(sgc_created_at) FROM __seo_gamme_conseil WHERE sgc_pg_id = '{pg_id}'))::int as r3_age_days,
  sgpg.sgpg_updated_at as r6_updated,
  extract(day from now() - sgpg.sgpg_updated_at)::int as r6_age_days
FROM __seo_gamme sg
LEFT JOIN __seo_gamme_purchase_guide sgpg ON sgpg.sgpg_pg_id = sg.sg_pg_id
WHERE sg.sg_pg_id = '{pg_id}';
```

### Output historique
| Rôle | Dernière MAJ | Âge (jours) | Tendance |
|------|-------------|-------------|----------|

Tendance :
- 🟢 frais (<30j)
- 🟡 vieillissant (30-90j)
- 🔴 stale (>90j)
- ⚫ jamais rafraîchi

---

## Étape 2b — R3 détail par section

```sql
SELECT sgc_id, sgc_section_key, sgc_heading,
  length(sgc_content) as chars,
  array_length(regexp_split_to_array(sgc_content, '\s+'), 1) as words,
  sgc_quality_score as quality,
  (SELECT count(*) FROM regexp_matches(sgc_content, '<a\s', 'g')) as links
FROM __seo_gamme_conseil WHERE sgc_pg_id = '{pg_id}'
ORDER BY sgc_id;
```

### Output détail R3
| # | Section | Chars | Mots | Score | Liens | Status |
|---|---------|-------|------|-------|-------|--------|

Status par section :
- ✅ si score ≥ 85 ET chars > 300
- ⚠️ si score < 85 OU chars < 300
- ❌ si score < 60

---

## Score composite (0-100)

Calculer un score unique par gamme pour classer les gammes entre elles.

### Formule de pondération

```
score_composite = R1_score * 0.20 + R3_score * 0.25 + R4_score * 0.15 + R6_score * 0.20 + RAG_score * 0.20
```

### Calcul par rôle — Préférer __quality_page_scores (QPS)

Vérifier d'abord si des scores QPS existent pour cette gamme :
```sql
SELECT page_type, quality_score FROM __quality_page_scores WHERE pg_id = {pg_id};
```

**R1_score** (sur 100) :
- Si QPS `R1_pieces` existe → utiliser `quality_score` directement
- Sinon fallback manuel : (chars > 500) +30, (words >= 80) +20, (sections >= 3) +20, (links >= 3) +15, (h1_len <= 70) +15
- Si R1 absent → 0

**R3_score** (sur 100) :
- Si QPS `R3_conseils` existe → utiliser `quality_score`
- Sinon si `sgc_quality_score` dispo → utiliser `avg_quality`
- Sinon → `(sections / 8) * 50 + min(total_chars / 5000, 1) * 50`
- Si R3 absent → 0

**R4_score** (sur 100) :
- Si QPS `R4_reference` existe → utiliser `quality_score`
- Sinon fallback : (def_chars > 200) +30, (composition >= 3) +20, (confusions >= 3) +20, (regles_metier >= 3) +20, (scope_chars > 0) +10
- Si R4 absent → 0

**R6_score** (sur 100) :
- Si QPS `R3_guide` existe → utiliser `quality_score` (note: R6 guide achat = R3_guide dans QPS)
- Sinon si `gatekeeper_score` dispo → utiliser directement
- Sinon → `(choose_len > 1000) * 50 + (intro_len > 100) * 25 + (risk_len > 100) * 25`
- Si R6 absent → 0

**RAG_score** (sur 100) :
- `min(admissible / 3, 1) * 50 + (thin_docs == 0) * 25 + (l1_docs > 0 OR l2_docs >= 3) * 25`
- Note : L2 est considéré haute confiance (même tier que L1 dans le code)
- Si 0 docs → 0

### Output
```
### Score composite : {score}/100
   R1={r1_score} R3={r3_score} R4={r4_score} R6={r6_score} RAG={rag_score}
```

Ajouter dans le JSON export : `"composite_score": 72`

---

## overall_readiness

Calculer automatiquement :
- **READY** : composite_score ≥ 70 ET R1 + R3 + R4 + RAG tous présents
- **NEEDS_WORK** : composite_score 40-69 OU au moins 1 rôle existant mais sous les seuils
- **MISSING** : R1 ou R3 absent ET composite_score < 40
- **BLOCKED** : 0 RAG docs + 0 contenu

---

## Étape 13 — Auto-fix (mode --fix uniquement)

**Pré-requis** : l'argument `--fix` est présent. Sans `--fix`, afficher uniquement le rapport + actions recommandées.

Toutes les requêtes via `mcp__supabase__execute_sql` avec `project_id: 'cxpojprgwgubzjyqzmoq'`.
Les fichiers RAG via l'outil `Read` pour lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`.

### Fix 1 — Quarantine thin docs RAG
**Condition** : thin_docs > 0
```sql
UPDATE __rag_knowledge
SET retrievable = false, status = 'quarantined',
    quarantine_reason = 'auto_thin_gate_lt500'
WHERE gamme_aliases @> ARRAY['{pg_alias}']
  AND status = 'active' AND length(content) < 500;
```
Reporter le nombre de docs quarantinées.

### Fix 2 — Sync confusions RAG → __seo_reference
**Condition** : R4 confusion_items < 3

**Étape 1** : Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`, parser `domain.confusion_with[]`.
**Étape 2** : Comparer avec `confusions_courantes` dans `__seo_reference`.
**Étape 3** : Si RAG a plus de confusions que DB → array_append les manquantes.
**Étape 4** : Si après sync on a toujours < 3, utiliser le dictionnaire ci-dessous pour proposer une confusion pertinente par domaine.

```sql
UPDATE __seo_reference
SET confusions_courantes = array_append(confusions_courantes,
  '{term} : {difference}')
WHERE pg_id = {pg_id}
  AND NOT (confusions_courantes @> ARRAY['{term} : {difference}']);
```

**Dictionnaire de confusions candidates par domaine** (à utiliser quand RAG insuffisant) :

| Domaine | Confusion candidate | Différence |
|---------|-------------------|------------|
| freinage | disque de frein ≠ disque d'embrayage | Le disque de frein ralentit le véhicule, le disque d'embrayage transmet le couple moteur |
| freinage | plaquette ≠ garniture de frein à tambour | La plaquette est externe (étrier), la garniture est interne (tambour) |
| filtration | filtre à huile moteur ≠ filtre à huile boîte | Le filtre moteur filtre l'huile de lubrification, le filtre boîte filtre l'huile de transmission |
| filtration | filtre à air moteur ≠ filtre d'habitacle | Le filtre moteur filtre l'air admission, le filtre habitacle filtre l'air ventilation |
| suspension | amortisseur ≠ ressort | L'amortisseur freine les oscillations, le ressort supporte le poids du véhicule |
| suspension | rotule ≠ silent-bloc | La rotule autorise la rotation, le silent-bloc absorbe les vibrations |
| distribution | courroie de distribution ≠ courroie d'accessoires | La distribution synchronise le moteur, les accessoires entraînent alternateur/clim/DA |
| embrayage | disque d'embrayage ≠ volant moteur | Le disque transmet le couple, le volant lisse les à-coups moteur |
| allumage | bougie d'allumage ≠ bougie de préchauffage | L'allumage enflamme le mélange essence, le préchauffage chauffe la chambre diesel |
| refroidissement | thermostat ≠ calorstat | Synonymes (le calorstat est l'ancien terme pour thermostat) |
| direction | crémaillère ≠ boîtier de direction | La crémaillère est à pignon, le boîtier est à vis (véhicules anciens/utilitaires) |
| échappement | catalyseur ≠ filtre à particules | Le catalyseur traite les gaz (CO, NOx), le FAP retient les particules solides |

### Fix 2bis — Sync confusion vers fichier RAG .md (bidirectionnel)
**Condition** : une confusion a été ajoutée en DB par Fix 2 mais n'existe pas dans le fichier gamme .md
1. Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`
2. Si la confusion ajoutée en DB n'est pas dans `domain.confusion_with[]` du frontmatter
3. Ajouter l'entrée dans le fichier .md via `Edit` :
```yaml
    - term: {term}
      difference: {difference}
```
Cela garantit la cohérence RAG ↔ DB.

### Fix 3 — Maillage R1 (liens manquants)
**Condition** : has_link_rX = 0 ET la surface cible existe

Pour chaque lien manquant, vérifier d'abord que la surface cible existe :

**R3 manquant** :
```sql
SELECT ba_alias, ba_title FROM __blog_advice WHERE ba_pg_id = '{pg_id}' LIMIT 1;
```
Si résultat :
```sql
UPDATE __seo_gamme
SET sg_content = sg_content || chr(10) ||
  '<p>🔧 <a href="/blog-pieces-auto/conseils/' || '{ba_alias}' || '">' || '{ba_title}' || '</a></p>'
WHERE sg_pg_id = '{pg_id}';
```

**R4 manquant** :
```sql
-- Vérifier existence
SELECT 1 FROM __seo_reference WHERE pg_id = {pg_id};
```
Si existe :
```sql
UPDATE __seo_gamme
SET sg_content = sg_content || chr(10) ||
  '<p class="mt-3 text-sm"><a href="/reference-auto/{pg_alias}">En savoir plus sur {pg_name}</a></p>'
WHERE sg_pg_id = '{pg_id}';
```

**R5 manquant** :
Vérifier si fichier `/opt/automecanik/rag/knowledge/diagnostic/{pg_alias}.md` existe via `Read`.
Si existe, ajouter lien diagnostic.

**R6 manquant** :
```sql
SELECT 1 FROM __seo_gamme_purchase_guide WHERE sgpg_pg_id = '{pg_id}';
```
Si existe :
```sql
UPDATE __seo_gamme
SET sg_content = sg_content || chr(10) ||
  '<p class="mt-3 text-sm"><a href="/blog-pieces-auto/guide-achat/{pg_alias}">Guide d''achat {pg_name}</a></p>'
WHERE sg_pg_id = '{pg_id}';
```

### Fix 4 — Meta description courte
**Condition** : descrip_len < 120
```sql
UPDATE __seo_gamme
SET sg_descrip = sg_descrip || ' Pièces vérifiées et compatibilité garantie.'
WHERE sg_pg_id = '{pg_id}' AND length(sg_descrip) < 120;
```

### Fix 5 — Scoring R6
**Condition** : aucune ligne dans `__quality_page_scores` pour ce pg_id
```sql
SELECT count(*) FROM __quality_page_scores WHERE pg_id = {pg_id};
```
Si 0 :
```bash
curl -s -X POST http://localhost:3000/api/internal/buying-guides/compute-quality-scores \
  -H "X-Internal-Key: $(grep INTERNAL_API_KEY /opt/automecanik/app/backend/.env | cut -d= -f2)" \
  -H "Content-Type: application/json"
```
Note : score toutes les gammes. En mode batch, n'exécuter qu'une seule fois.

### Fix 6 — Sync timing depuis RAG
**Condition** : sgpg_timing_km IS NULL OU sgpg_timing_years IS NULL
1. Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`, section `maintenance.interval`
2. Extraire `interval.value` (ex: "10000-30000 km") → sgpg_timing_km
3. Extraire les années depuis `interval.note` : chercher le pattern `X an(s)` ou `X-Y ans` dans la note. Exemples :
   - "Essence 10 000 km ou 1 an" → "1 an"
   - "Se change à chaque vidange" + intervalle 60000-80000 km → estimer "4-5 ans" (60000÷15000/an)
   - Si note mentionne "Longlife" → "2-3 ans"
4. Si aucune info années dans le RAG, estimer : `timing_years = round(timing_km_max / 15000)` ans (base 15000 km/an usage mixte)
```sql
UPDATE __seo_gamme_purchase_guide
SET sgpg_timing_km = COALESCE(sgpg_timing_km, '{interval_value}'),
    sgpg_timing_years = COALESCE(sgpg_timing_years, '{years_estimated}')
WHERE sgpg_pg_id = '{pg_id}';
```

### Fix 7 — Enrichir role_mecanique court
**Condition** : role_meca_chars < 200 ET fichier RAG a domain.role + must_be_true

1. Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`
2. Extraire : `domain.role`, `domain.must_be_true[]`, `domain.related_parts[]`, `domain.norms[]`
3. Rédiger un texte technique de 400-700c qui inclut :
   - **Position dans le système** : où la pièce s'insère (ex: "entre la pompe et les organes moteur")
   - **Principe de fonctionnement** : comment elle agit (friction, filtration, transmission, etc.)
   - **Paramètres clés** : valeurs numériques si dispo (pression, température, vitesse)
   - **Variantes** : types principaux (ventilé/plein, spin-on/cartouche, etc.)
   - **Interaction pièces** : lien avec related_parts (1-2 phrases)
   - **Norme** : si norms[] existe, mentionner (ex: "conforme ECE R90")
4. Style : technique, factuel, pas de conseil achat ni de diagnostic
```sql
UPDATE __seo_reference
SET role_mecanique = '{enriched_role_text}'
WHERE pg_id = {pg_id} AND length(role_mecanique) < 200;
```

### Fix 8 — Créer fichier diagnostic manquant
**Condition** : fichier `/opt/automecanik/rag/knowledge/diagnostic/{pg_alias}.md` n'existe pas ET fichier gamme a section `diagnostic.symptoms`
1. Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`
2. Extraire `diagnostic.symptoms[]` et `diagnostic.causes[]`
3. Générer le fichier diagnostic .md avec le template standard :
```yaml
---
category: {category}
doc_family: diagnostic
site_section: diagnostic
source_type: diagnostic
title: Diagnostic - {pg_name}
truth_level: L2
updated_at: {today}
verification_status: verified
---
```
4. Écrire via l'outil `Write` dans `/opt/automecanik/rag/knowledge/diagnostic/{pg_alias}.md`

### Fix 9 — Enrichir risk_explanation court
**Condition** : risk_len < 100
1. Lire `/opt/automecanik/rag/knowledge/gammes/{pg_alias}.md`, section `diagnostic.causes[]`
2. Rédiger une explication de risque de 100-200c basée sur les causes et conséquences
3. Style : factuel, conséquences techniques, pas alarmiste
```sql
UPDATE __seo_gamme_purchase_guide
SET sgpg_risk_explanation = '{enriched_risk}'
WHERE sgpg_pg_id = '{pg_id}' AND length(sgpg_risk_explanation) < 100;
```

### Fix 10 — Force-enrich après corrections
**Condition** : au moins 1 fix appliqué (fixes_applied > 0)
Lancer le force-enrich pour régénérer le contenu avec les données corrigées :
```bash
curl -s -X POST http://localhost:3000/api/admin/rag/pdf-merge/force-enrich \
  -b tests-curl/.cookies \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"{pg_alias}"}'
```
Note : en mode batch, regrouper les force-enrich à la fin (pas après chaque gamme).

---

## Rapport fix (après Étape 13)

Afficher un tableau récapitulatif des corrections appliquées :

| Fix | Appliqué | Détail |
|-----|----------|--------|
| 1. Thin docs | ✅/⏭️ | {N} docs quarantinées |
| 2. Confusions sync | ✅/⏭️ | +{N} confusions ajoutées |
| 3. Liens R1 | ✅/⏭️ | R3:{oui/non} R4:{oui/non} R5:{oui/non} R6:{oui/non} |
| 4. Meta description | ✅/⏭️ | {old_len}c → {new_len}c |
| 5. Scoring R6 | ✅/⏭️ | score={X} |
| 6. Timing sync | ✅/⏭️ | km={val}, years={val} |
| 7. Role mécanique | ✅/⏭️ | {old_len}c → {new_len}c |
| 8. Fichier diagnostic | ✅/⏭️ | créé/existant |
| 9. Risk explanation | ✅/⏭️ | {old_len}c → {new_len}c |
| 10. Force-enrich | ✅/⏭️ | queued / aucun fix appliqué |

Légende : ✅ = corrigé, ⏭️ = pas nécessaire (déjà conforme)

Puis relancer le calcul du score composite pour montrer l'amélioration :
```
Score avant fix : {old_score}/100
Score après fix : {new_score}/100 (+{delta})
```

---

## Étape 16 — Stocker l'audit en DB

Après chaque audit (avec ou sans --fix), sauvegarder le résultat :
```sql
INSERT INTO __seo_audit_history (pg_id, pg_alias, audit_date, composite_score, r1_score, r3_score, r4_score, r6_score, rag_score, overall_readiness, fixes_applied, skill_version)
VALUES ({pg_id}, '{pg_alias}', now(), {composite_score}, {r1_score}, {r3_score}, {r4_score}, {r6_score}, {rag_score}, '{overall_readiness}', {fixes_applied}, 'v3.3')
ON CONFLICT DO NOTHING;
```

Si la table n'existe pas, la créer :
```sql
CREATE TABLE IF NOT EXISTS __seo_audit_history (
  id SERIAL PRIMARY KEY,
  pg_id INTEGER NOT NULL,
  pg_alias TEXT NOT NULL,
  audit_date TIMESTAMPTZ DEFAULT now(),
  composite_score INTEGER,
  r1_score INTEGER,
  r3_score INTEGER,
  r4_score INTEGER,
  r6_score INTEGER,
  rag_score INTEGER,
  overall_readiness TEXT,
  fixes_applied INTEGER DEFAULT 0,
  skill_version TEXT DEFAULT 'v3.3'
);
```

---

## Mode --history

Si `--history` est passé, afficher l'historique des scores au lieu de l'audit complet :
```sql
SELECT audit_date, composite_score, r1_score, r3_score, r4_score, r6_score, rag_score, overall_readiness, fixes_applied, skill_version
FROM __seo_audit_history
WHERE pg_alias = '{pg_alias}'
ORDER BY audit_date DESC
LIMIT 10;
```

### Output --history
```
## Historique SEO — {pg_name} ({pg_alias})

| Date | Score | R1 | R3 | R4 | R6 | RAG | Readiness | Fixes | Version |
|------|-------|----|----|----|----|-----|-----------|-------|---------|
| 2026-03-15 | 95 | 100 | 91 | 100 | 88 | 100 | READY | 0 | v3.3 |
| 2026-03-14 | 79 | 85 | 91 | 60 | 70 | 75 | NEEDS_WORK | 5 | v3.0 |

Tendance : ↗️ +16 pts sur 1 jour
```
