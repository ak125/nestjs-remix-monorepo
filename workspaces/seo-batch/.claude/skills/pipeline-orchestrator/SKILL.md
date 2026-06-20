---
name: pipeline-orchestrator
description: "Détecteur READ-ONLY d'état des pipelines SEO. Interroge la DB, affiche un dashboard de couverture (R1/R3/R4/R6/R7) et la prochaine action recommandée. Ne génère AUCUN contenu — la doctrine 'comment produire du contenu' = skill seo-content-loop."
argument-hint: "[status|next]"
disable-model-invocation: false
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Glob, Grep
version: "1.0"
---

# Pipeline Orchestrator — Détecteur READ-ONLY d'état des pipelines SEO

> **⚠️ Skill READ-ONLY (détecteur d'état/couverture).** Ce skill **n'orchestre plus**
> et **ne génère aucun contenu**. Il interroge la DB et affiche un dashboard de
> couverture (`status`) + la prochaine action recommandée (`next`). Les anciennes
> sous-commandes `run R3/R4/R6/R7` ont été **retirées** : elles pilotaient des
> content-batch lisant le RAG comme **source de contenu**, chemin **mort**
> (**ADR-031 / ADR-046** : RAG = consommateur de retrieval pour le **chatbot
> uniquement**, jamais source de vérité ni générateur de contenu).
>
> **Doctrine canonique « quoi produire ensuite »** = skill **`seo-content-loop`**.
> Toute génération de contenu DOIT suivre la boucle **SCRAPING → RAW → WIKI →
> projection (consumer)**, jamais RAG-as-content. Ce skill se limite à **mesurer**
> l'état ; il **ne déclenche aucune écriture**.

Tu es un détecteur léger d'état pour les pipelines SEO d'AutoMecanik. Tu interroges la DB (lecture seule) pour determiner l'etat de chaque pipeline et afficher la couverture.

**Projet Supabase** : `cxpojprgwgubzjyqzmoq`

---

## Pipelines observés (carte de couverture)

Référence des grains mesurés par ce détecteur (les tables KP/contenu suivies par
pipeline). Ce skill ne pilote aucun de ces agents — la production de contenu suit
la doctrine `seo-content-loop`.

```
R1 : grain transactionnel (__seo_r1_keyword_plan)
R3 : grain conseils       (__seo_r3_keyword_plan)
R4 : grain reference      (__seo_r4_keyword_plan)
R6 : grain guide d'achat  (__seo_r6_keyword_plan)
R7 : grain constructeurs  (__seo_r7_keyword_plan)
```

## Tables de reference

| Pipeline | Table KP | Table Contenu | Colonne status |
|----------|----------|---------------|----------------|
| R1 | `__seo_r1_keyword_plan` | `__seo_gamme_purchase_guide` | `rkp_status` |
| R3 | `__seo_r3_keyword_plan` | `__seo_gamme_conseil` | `skp_status` |
| R4 | `__seo_r4_keyword_plan` | `__seo_reference` | `r4kp_status` |
| R6 | `__seo_r6_keyword_plan` | `__seo_gamme_purchase_guide` | `r6kp_status` |
| R7 | `__seo_r7_keyword_plan` | — | `r7kp_status` |

---

## Sous-commande : `status`

Executer ces requetes et afficher un dashboard :

```sql
-- Gammes totales
SELECT COUNT(*) AS gammes_total FROM __seo_gamme_purchase_guide;

-- R4 coverage
SELECT
  (SELECT COUNT(*) FROM __seo_reference WHERE is_published = true) AS r4_ref_total,
  (SELECT COUNT(*) FROM __seo_r4_keyword_plan) AS r4_kp_total,
  (SELECT COUNT(*) FROM __seo_r4_keyword_plan WHERE r4kp_status = 'validated') AS r4_kp_validated,
  (SELECT COUNT(*) FROM __seo_r4_keyword_plan WHERE r4kp_page_pack IS NOT NULL) AS r4_content_done,
  (SELECT COUNT(*) FROM __seo_reference r
   LEFT JOIN __seo_r4_keyword_plan kp ON kp.r4kp_pg_id = r.pg_id
   WHERE r.is_published = true AND kp.r4kp_id IS NULL) AS r4_no_kp,
  (SELECT COUNT(*) FROM __seo_reference WHERE is_published = true
   AND (variants IS NULL OR key_specs IS NULL OR common_questions IS NULL OR takeaways IS NULL)) AS r4_sections_vides;

-- R3 coverage
SELECT
  COUNT(*) AS r3_kp_total,
  COUNT(*) FILTER (WHERE skp_status = 'validated') AS r3_kp_validated,
  COUNT(*) FILTER (WHERE skp_status = 'draft') AS r3_kp_draft
FROM __seo_r3_keyword_plan;

-- R6 coverage
SELECT
  COUNT(*) AS r6_kp_total,
  COUNT(*) FILTER (WHERE r6kp_status = 'validated') AS r6_kp_validated
FROM __seo_r6_keyword_plan;

-- R1 coverage
SELECT
  COUNT(*) AS r1_kp_total,
  COUNT(*) FILTER (WHERE rkp_status = 'validated') AS r1_kp_validated
FROM __seo_r1_keyword_plan;

-- R7 coverage (table peut ne pas exister)
SELECT COUNT(*) AS r7_kp_total,
  COUNT(*) FILTER (WHERE r7kp_status = 'validated') AS r7_kp_validated
FROM __seo_r7_keyword_plan;
-- Si erreur 42P01 (table inexistante) → afficher "Table non creee" dans le dashboard
```

**Format de sortie** :

```
## Dashboard SEO Pipelines

| Pipeline | KP Total | KP Validated | Content Done | Gap |
|----------|----------|-------------|-------------|-----|
| R4 Reference | X | X | X | X gammes sans KP |
| R3 Conseils | X | X | — | — |
| R6 Guide Achat | X | X | — | — |
| R1 Transactional | X | X | — | — |
| R7 Constructeurs | X | X | — (pas de content-batch) | — |

### R4 Detail
- Sections vides (variants/key_specs/faq/takeaways) : X / Y
- Mode skip-kp disponible : X gammes
```

---

## Sous-commande : `next`

Détecter (lecture seule) le plus gros gap de couverture et **recommander** la prochaine
gamme à traiter. Cette commande **ne lance rien** : elle pointe vers la doctrine
`seo-content-loop` (boucle SCRAPING → RAW → WIKI → projection). Priorités d'observation :

1. **R4 sans keyword plan** — gammes publiées sans KP (le plus gros gap)
2. **R4 KP validé sans page_pack** — gammes avec KP validated mais sans page_pack
3. **R3 sans KP** — gammes sans R3 keyword plan
4. **R6 sans KP** — gammes sans R6 keyword plan
5. **R7 sans KP** — constructeurs sans R7 keyword plan

Pour chaque priorité, vérifier s'il reste des gammes non couvertes. Recommander (sans lancer) la première priorité non-vide.

**Query pour trouver la prochaine gamme R4 skip-kp** :
```sql
SELECT r.pg_id, r.slug, g.pg_name, g.pg_alias
FROM __seo_reference r
JOIN pieces_gamme g ON g.pg_id = r.pg_id
LEFT JOIN __seo_r4_keyword_plan kp ON kp.r4kp_pg_id = r.pg_id
WHERE r.is_published = true AND kp.r4kp_id IS NULL
ORDER BY (r.key_specs IS NULL)::int + (r.common_questions IS NULL)::int + (r.variants IS NULL)::int + (r.takeaways IS NULL)::int DESC
LIMIT 1;
```

**Format de sortie** :

```
## Prochaine action recommandee (observation, lecture seule)

**Pipeline** : R4 Reference
**Gamme prioritaire** : {{gamme_name}} (pg_id={{pg_id}}, slug={{slug}})
**Raison** : {{X}} gammes sans keyword plan, {{Y}} sections vides

> Pour produire le contenu : suivre la doctrine canonique **`seo-content-loop`**
> (SCRAPING → RAW → WIKI → projection). Ce skill ne déclenche aucune génération.
```

---

## Regles

1. **Lecture seule** : ce skill interroge la DB et affiche un état ; il ne déclenche
   **aucune écriture** ni génération de contenu.
2. TOUJOURS interroger la DB avant d'afficher un dashboard ou une recommandation.
3. La doctrine « comment produire du contenu » vit dans le skill **`seo-content-loop`**
   (boucle SCRAPING → RAW → WIKI → projection). Le contenu ne se génère **jamais**
   depuis le RAG (ADR-031 / ADR-046 : RAG = retrieval chatbot uniquement).
4. Après `status`, proposer `/pipeline-orchestrator next` pour la prochaine observation.
