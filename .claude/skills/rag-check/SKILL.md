---
name: rag-check
description: "Vérification couverture RAG par rôle R* pour une gamme. Identifie la matière manquante (procédure, encyclopédie, diagnostic, FAQ) et génère un prompt Chrome pour compléter. Usage : /rag-check <pg_alias> [--fix] [--batch top10]"
argument-hint: "<pg_alias ou pg_id> [--fix] [--batch top10]"
---

# RAG Check — Skill v1.1

## Usage
- `/rag-check filtre-a-huile` — diagnostic couverture RAG par rôle
- `/rag-check filtre-a-huile --fix` — diagnostiquer + backfill automatique RAG↔DB
- `/rag-check filtre-a-huile --diff` — comparer avec le dernier check
- `/rag-check --batch top10` — 10 gammes avec le plus de gaps RAG

## Projet Supabase
`cxpojprgwgubzjyqzmoq`

## Différence avec /kp et /seo-gamme-audit

- `/kp` = **quoi cibler** (keywords SEO, intentions, H1/H2) → fichier SEO
- `/rag-check` = **avec quoi générer** (matière source technique) → fichier RAG .md
- `/seo-gamme-audit` = **ce qui est produit** (contenu final, scores, liens) → audit output

---

## Procédure

### Étape 1 — Résoudre la gamme

```sql
SELECT pg_id, pg_alias, pg_name FROM pieces_gamme
WHERE pg_alias = '{input}' OR pg_id::text = '{input}';
```

### Étape 2 — Lire le fichier RAG gamme

```
Read /opt/automecanik/rag/knowledge/gammes/{pg_alias}.md
```

Parser le frontmatter YAML complet. Extraire TOUTES les sections :
- `domain` (role, must_be_true, confusion_with, related_parts, composition, norms, cross_gammes)
- `maintenance` (interval, wear_signs, good_practices)
- `selection` (criteria, anti_mistakes, cost_range)
- `diagnostic` (symptoms, causes, quick_checks, depose_steps)
- `rendering` (faq, arguments, risk)
- `seo_cluster` (primary_keyword)

Si le fichier n'existe pas → status = ❌ NO_RAG_FILE, toute la gamme est BLOCKED.

### Étape 2b — Détection contenu brut vs structuré

Pour chaque champ array, classifier les items :
- **Structuré** : item court (<200 chars), sans "Source:", sans "##", sans "http"
- **Brut** : item contenant "(Source:", "##", "#" en début, ou URL

Afficher séparément :
```
criteria: 5 structurés + 7 bruts (contenu web enrichi)
```

Score de qualité par champ :
- **HIGH** : >80% structurés
- **MEDIUM** : 50-80% structurés
- **LOW** : <50% structurés (majorité brut)

### Étape 3 — Vérifier fichier diagnostic séparé

```
Read /opt/automecanik/rag/knowledge/diagnostic/{pg_alias}.md
```

Si existe → `diag_file = true`. Sinon → `diag_file = false`.

### Étape 4 — Vérifier docs RAG en DB

```sql
SELECT count(*) as rag_docs,
  count(*) FILTER (WHERE length(content) < 500) as thin_docs,
  count(*) FILTER (WHERE business_pool_admissible = true) as admissible,
  avg(length(content))::int as avg_len
FROM __rag_knowledge WHERE status = 'active' AND gamme_aliases @> ARRAY['{pg_alias}'];
```

### Étape 4b — Validation croisée RAG ↔ DB

Comparer les données du frontmatter avec ce qui est réellement en DB :

```sql
-- Confusions en DB vs RAG
SELECT array_length(confusions_courantes, 1) as db_confusions
FROM __seo_reference WHERE pg_id = {pg_id_int};

-- Timing en DB vs RAG
SELECT sgpg_timing_km, sgpg_timing_years
FROM __seo_gamme_purchase_guide WHERE sgpg_pg_id = '{pg_id}';
```

Si RAG dit 3 confusions mais DB en a 2 → signaler **DESYNC RAG↔DB**.
Si DB a un timing mais RAG n'en a pas → signaler **DB_AHEAD_OF_RAG**.

### Étape 4c — Score de fraîcheur RAG

Lire `updated_at` dans le frontmatter du fichier gamme.

```
Fraîcheur :
- 🟢 frais (<30j)
- 🟡 vieillissant (30-90j)
- 🔴 stale (>90j)
```

Comparer avec la date du dernier refresh de contenu :
```sql
SELECT sg_updated_at FROM __seo_gamme WHERE sg_pg_id = '{pg_id}';
```

Si le contenu a été rafraîchi APRÈS le RAG → signaler **CONTENT_NEWER_THAN_RAG** (le RAG ne reflète peut-être plus le contenu actuel).

### Étape 5 — Analyser la couverture par rôle

**RÈGLE CRITIQUE** : Parser exhaustivement le frontmatter. Chaque champ a des ALIAS — si au moins 1 alias contient des données, le champ est considéré OK. Ne JAMAIS réclamer une doc si le champ existe sous un autre nom.

Pour chaque rôle, vérifier les champs du frontmatter. **Afficher les valeurs trouvées avec leur compte exact.**

**Distinguer les champs vides des champs absents** :
- `norms: []` → **EMPTY** (existait, vidé — possible régression)
- pas de clé `norms` → **ABSENT** (jamais rempli)

**R1 — Router (sélection véhicule)**
| Champ | Alias acceptés | Seuil |
|-------|---------------|-------|
| `domain.role` | — | non-null et >10 chars |
| Résultat : ✅ OK si gamme.md existe avec domain.role |

**R3 — Conseils (how-to)**
| Champ | Alias acceptés | Seuil |
|-------|---------------|-------|
| `maintenance.interval` | `interval` | non-null |
| `maintenance.wear_signs` | — | ≥2 items |
| `selection.anti_mistakes` | `anti_mistakes` | ≥2 items |
| `maintenance.good_practices` | — | ≥2 items |
| Procédure S4 | `procedures`, `depose_steps`, `diagnostic.depose_steps`, `steps` | ≥1 item pour activer S4 |
| Résultat : ✅ OK si interval + anti_mistakes + (procedures OU depose_steps). ⚠️ PARTIAL SEULEMENT si AUCUN alias de procédure n'existe. ❌ BLOCKED si interval absent |

**R4 — Référence (encyclopédie)**
| Champ | Alias acceptés | Seuil |
|-------|---------------|-------|
| Rôle mécanique | `domain.role` | >50 chars |
| Composition/pièces | `domain.composition`, `domain.related_parts`, `selection.criteria` (si contient données techniques enrichies) | ≥3 items au total |
| Confusions | `domain.confusion_with` (compter items avec `term:`) | ≥3 paires |
| Normes | `domain.norms` | ≥1 norme (RECOMMANDÉ) |
| Assertions | `domain.must_be_true` | ≥2 (RECOMMANDÉ) |
| Résultat : ✅ OK si role >50c + (composition OU related_parts ≥3) + confusion ≥3. ⚠️ PARTIAL seulement si confusion <3 ET aucun alias n'atteint le seuil |

**R5 — Diagnostic (symptômes)**
| Champ | Alias acceptés | Seuil |
|-------|---------------|-------|
| Symptômes | `diagnostic.symptoms` (compter items avec `id: S*` ou `- label:`) | **≥3 BLOQUANT** |
| Causes | `diagnostic.causes` (compter items array) | ≥2 RECOMMANDÉ |
| Dépose steps (= check) | `diagnostic.depose_steps`, `diagnostic.quick_checks` | ≥1 RECOMMANDÉ |
| Fichier diagnostic séparé | `/diagnostic/{alias}.md` | existe RECOMMANDÉ |
| Résultat : ✅ OK si ≥3 symptômes + ≥2 causes. ❌ BLOCKED seulement si <3 symptômes ET aucun fichier diagnostic |

**R6 — Guide d'achat (choix)**
| Champ | Alias acceptés | Seuil |
|-------|---------------|-------|
| Critères | `selection.criteria` | ≥3 critères **structurés** (pas bruts) **BLOQUANT** |
| Anti-erreurs | `selection.anti_mistakes`, `anti_mistakes` | ≥2 erreurs **BLOQUANT** |
| Fourchette prix | `selection.cost_range`, `cost_range` | non-null RECOMMANDÉ |
| Arguments | `rendering.arguments` | ≥2 RECOMMANDÉ |
| Résultat : ✅ OK si criteria ≥3 + anti_mistakes ≥2 + cost_range existe. ⚠️ PARTIAL si cost_range absent. ❌ BLOCKED si criteria OU anti_mistakes absent |

**FAQ**
| Champ | Requis | Seuil |
|-------|--------|-------|
| `rendering.faq` | RECOMMANDÉ | ≥5 questions |
| Résultat : ✅ OK si ≥5. ⚠️ PARTIAL si 1-4. ❌ MISSING si 0 |

### Étape 5b — Comparaison avec gammes sœurs

Identifier le domaine de la gamme depuis `domain.role` ou la catégorie, puis comparer :

```sql
SELECT pg.pg_alias,
  (SELECT count(*) FROM __rag_knowledge rk
   WHERE rk.gamme_aliases @> ARRAY[pg.pg_alias] AND rk.status = 'active') as docs
FROM pieces_gamme pg
WHERE pg.pg_alias IN ({aliases_gammes_soeurs})
ORDER BY docs DESC;
```

Les gammes sœurs par domaine :
- **filtration** : filtre-a-air, filtre-a-huile, filtre-a-carburant, filtre-d-habitacle
- **freinage** : disque-de-frein, plaquette-de-frein, machoires-de-frein, etrier-de-frein
- **distribution** : kit-de-distribution, kit-de-chaine-de-distribution, courroie-d-accessoire
- **embrayage** : kit-d-embrayage, volant-moteur, butee-hydraulique
- **suspension** : amortisseur, ressort-de-suspension, rotule, silent-bloc
- **allumage** : bougie-d-allumage, bobine-d-allumage
- **refroidissement** : pompe-a-eau, thermostat, radiateur

Afficher : "Gammes sœurs : filtre-a-air (8 docs), filtre-a-carburant (4 docs) — cette gamme : 9 docs (dans la moyenne)"

### Étape 6 — Calculer le score de couverture

```
score = (nombre de rôles OK × 20) + (nombre de rôles PARTIAL × 10)
# sur 100 (5 rôles × 20 = 100 si tous OK)
```

### Étape 6b — Readiness pour /kp

| Score | Readiness |
|-------|-----------|
| ≥ 80 | 🟢 Prêt pour `/kp` — lancer `/kp {alias}` |
| 50-79 | 🟡 Partiel — `/kp` possible mais qualité limitée |
| < 50 | 🔴 Bloqué — compléter le RAG avant `/kp` |

### Étape 7 — Afficher le rapport

```
## RAG Check — {pg_name} (pg_id={pg_id})

### Couverture RAG par rôle

| Rôle | Matière présente (compte) | Qualité | Status | Ce qui manque |
|------|--------------------------|---------|--------|--------------|
| R1 | domain.role ✅ (145c) | HIGH | ✅ OK | — |
| R3 | interval ✅, anti_mistakes ✅ (5), depose_steps ✅ (4) | HIGH | ✅ OK | — |
| R4 | composition ✅ (6), confusions ✅ (3), norms ❌ | MEDIUM | ⚠️ PARTIAL | Normes ISO |
| R5 | symptoms ✅ (5), causes ✅ (4), diag_file ✅ | HIGH | ✅ OK | — |
| R6 | criteria ✅ (5s+7b), anti_mistakes ✅ (5), cost_range ✅ | MEDIUM | ✅ OK | — |
| FAQ | faq ✅ (6) | HIGH | ✅ OK | — |

### Validation croisée RAG ↔ DB
| Champ | RAG | DB | Status |
|-------|-----|----| -------|
| confusions | 3 | 3 | ✅ SYNC |
| timing_km | 10000-30000 | 10000-30000 | ✅ SYNC |
| cost_range | 3-15€ | null | ⚠️ RAG_AHEAD |

### Pool RAG DB
- Docs totales : {N} ({admissible} admissibles)
- Thin docs (<500c) : {N}
- Taille moyenne : {avg_len}c
- Fraîcheur RAG : 🟢 {updated_at} ({age}j)
- Fraîcheur contenu : {content_updated}

### Gammes sœurs
{tableau comparaison}

### Score couverture : {score}/100
### Readiness /kp : {readiness}

### Actions recommandées
{liste auto-générée selon les gaps}
```

### Étape 8 — Générer le prompt Chrome (par rôle manquant)

**IMPORTANT** : Générer un prompt ciblé uniquement pour les rôles PARTIAL ou BLOCKED, pas un prompt global.

Si R5 est le seul gap → le prompt ne demande que les symptômes/diagnostic.

```
## Matière RAG manquante — Prompt à copier dans Claude (chrome)

{UNIQUEMENT les sections correspondant aux rôles PARTIAL/BLOCKED}
```

### Étape 9 — Mode --fix (backfill bidirectionnel RAG ↔ DB)

Si `--fix` est passé :

**Fix A — Backfill DB → RAG frontmatter**
Si la DB a des données que le RAG n'a pas (ex: confusions en DB mais pas dans le .md) :
- Lire les valeurs DB
- Ajouter dans le frontmatter via `Edit`
- Signaler : "Backfill DB→RAG : +{N} confusions"

**Fix B — Backfill RAG → DB**
Si le RAG a des données que la DB n'a pas (ex: cost_range dans .md mais pas en DB) :
```sql
UPDATE __seo_gamme_purchase_guide
SET sgpg_risk_cost_range = '{cost_range}'
WHERE sgpg_pg_id = '{pg_id}' AND sgpg_risk_cost_range IS NULL;
```
Signaler : "Backfill RAG→DB : cost_range = {value}"

**Fix C — Enrichissement depuis docs web ingérés**
Chercher dans les docs RAG web si des normes/cost_range sont mentionnés :
```sql
SELECT content FROM __rag_knowledge
WHERE gamme_aliases @> ARRAY['{pg_alias}'] AND status = 'active'
  AND (content ILIKE '%ISO%' OR content ILIKE '%norme%' OR content ILIKE '%€%');
```
Si trouvé → extraire et proposer l'ajout dans le frontmatter.

**Fix D — Après enrichissement → relancer /rag-check**
Afficher : "Fixes appliqués : {N}. Relancer `/rag-check {alias}` pour vérifier."

### Étape 10 — Stocker le résultat en DB

```sql
CREATE TABLE IF NOT EXISTS __rag_check_history (
  id SERIAL PRIMARY KEY,
  pg_id INTEGER NOT NULL,
  pg_alias TEXT NOT NULL,
  check_date TIMESTAMPTZ DEFAULT now(),
  coverage_score INTEGER,
  r1_status TEXT,
  r3_status TEXT,
  r4_status TEXT,
  r5_status TEXT,
  r6_status TEXT,
  faq_status TEXT,
  desync_count INTEGER DEFAULT 0,
  fixes_applied INTEGER DEFAULT 0,
  skill_version TEXT DEFAULT 'v1.1'
);

INSERT INTO __rag_check_history (pg_id, pg_alias, coverage_score, r1_status, r3_status, r4_status, r5_status, r6_status, faq_status, desync_count, fixes_applied)
VALUES ({pg_id}, '{pg_alias}', {score}, '{r1}', '{r3}', '{r4}', '{r5}', '{r6}', '{faq}', {desync}, {fixes})
ON CONFLICT DO NOTHING;
```

### Mode --diff

Si `--diff` est passé :
```sql
SELECT check_date, coverage_score, r1_status, r3_status, r4_status, r5_status, r6_status, faq_status, fixes_applied
FROM __rag_check_history
WHERE pg_alias = '{pg_alias}'
ORDER BY check_date DESC
LIMIT 2;
```

Afficher :
```
## RAG Check Diff — {pg_name}

| Métrique | Précédent | Actuel | Delta |
|----------|----------|--------|-------|
| Score | 80 | 100 | +20 |
| R4 | PARTIAL | OK | ✅ amélioré |
| Desyncs | 2 | 0 | ✅ résolu |
```

---

## Mode batch

### `--batch top10`

```sql
SELECT pg.pg_alias, pg.pg_id,
  (SELECT count(*) FROM __rag_knowledge rk
   WHERE rk.gamme_aliases @> ARRAY[pg.pg_alias] AND rk.status = 'active') as rag_docs,
  CASE WHEN EXISTS (
    SELECT 1 FROM __rag_knowledge rk
    WHERE rk.gamme_aliases @> ARRAY[pg.pg_alias] AND rk.status = 'active'
  ) THEN 1 ELSE 0 END as has_rag
FROM pieces_gamme pg
WHERE pg.pg_id IN (SELECT DISTINCT sg_pg_id::int FROM __seo_gamme WHERE sg_content IS NOT NULL)
ORDER BY rag_docs ASC
LIMIT 10;
```

Pour chaque gamme, lire le fichier RAG et afficher un tableau compact :

| # | Gamme | RAG docs | R1 | R3 | R4 | R5 | R6 | FAQ | Score | Readiness /kp |
|---|-------|---------|----|----|----|----|----|----|-------|---------------|

---

## Règles

1. **Ne jamais inventer de matière** — le skill diagnostique et réclame, il ne génère pas
2. **Séparer SEO et RAG** — le fichier SEO (/kp) et la matière RAG (/rag-check) sont indépendants
3. **Le prompt Chrome est ciblé par rôle** — ne demander que ce qui manque, pas tout
4. **Distinguer absent vs vide** — `norms: []` ≠ pas de clé `norms`
5. **Distinguer structuré vs brut** — compter séparément
6. **Comparer RAG ↔ DB** — signaler les desyncs
7. **Score couverture = métrique objective** — pas de jugement subjectif
8. **BLOCKED = le rôle ne peut pas être généré** — pas "il sera moins bon"
9. **Stocker chaque check en DB** — pour le mode --diff
10. **Afficher la readiness /kp** — pour guider l'utilisateur vers la prochaine étape