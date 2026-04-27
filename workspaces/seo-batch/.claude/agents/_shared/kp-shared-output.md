# Shared Output — Keyword Planner UPSERT Pattern

> Utilise par tous les agents keyword planner (R1, R3, R5, R6, R7, R8).
> Chaque agent adapte le prefix de colonnes et la table cible.

## Principe

Chaque keyword planner DOIT persister son resultat dans la table `__seo_{role}_keyword_plan` via un UPSERT SQL.
Le resultat ne doit JAMAIS rester uniquement dans `__agentic_branches.output`.

## UPSERT Pattern

```sql
INSERT INTO __seo_{role}_keyword_plan (
  {prefix}_pg_id, {prefix}_pg_alias, {prefix}_gamme_name,
  {prefix}_primary_intent, {prefix}_secondary_intents, {prefix}_boundaries,
  {prefix}_heading_plan, {prefix}_section_terms, {prefix}_query_clusters,
  {prefix}_quality_score, {prefix}_status, {prefix}_version,
  {prefix}_built_by, {prefix}_built_at, {prefix}_pipeline_phase
) VALUES (
  {pg_id}, '{pg_alias}', '{gamme_name}',
  '{primary_intent}'::jsonb, '{secondary_intents}'::jsonb, '{boundaries}'::jsonb,
  '{heading_plan}'::jsonb, '{section_terms}'::jsonb, '{query_clusters}'::jsonb,
  {quality_score}, 'draft', 1,
  '{built_by}', NOW(), '{pipeline_phase}'
)
ON CONFLICT (rkp_pg_id, rkp_version) DO UPDATE SET
  {prefix}_pg_alias = EXCLUDED.{prefix}_pg_alias,
  {prefix}_gamme_name = EXCLUDED.{prefix}_gamme_name,
  {prefix}_primary_intent = EXCLUDED.{prefix}_primary_intent,
  {prefix}_secondary_intents = EXCLUDED.{prefix}_secondary_intents,
  {prefix}_boundaries = EXCLUDED.{prefix}_boundaries,
  {prefix}_heading_plan = EXCLUDED.{prefix}_heading_plan,
  {prefix}_section_terms = EXCLUDED.{prefix}_section_terms,
  {prefix}_query_clusters = EXCLUDED.{prefix}_query_clusters,
  {prefix}_quality_score = EXCLUDED.{prefix}_quality_score,
  {prefix}_pipeline_phase = EXCLUDED.{prefix}_pipeline_phase,
  {prefix}_built_by = EXCLUDED.{prefix}_built_by,
  {prefix}_built_at = NOW()
WHERE EXCLUDED.{prefix}_quality_score >= COALESCE(__seo_{role}_keyword_plan.{prefix}_quality_score, 0);
```

## Regles

1. **Jamais ecraser un plan `validated` avec un score inferieur** — le WHERE protege
2. **Status initial = `draft`** — le passage a `validated` est manuel ou via gate backend
3. **Version = 1** par defaut — incrementer si plusieurs versions coexistent
4. **`built_by`** = identifiant de l'agent ou du run (ex: `agentic-run-{run_id}`, `claude-r1-kp`)

## Tables par role

| Role | Table | Prefix | Unique constraint |
|------|-------|--------|-------------------|
| R1 | `__seo_r1_keyword_plan` | `rkp_` | `(rkp_pg_id, rkp_version)` |
| R3 | `__seo_r3_keyword_plan` | `skp_` | `(skp_pg_id)` |
| R5 | `__seo_r5_keyword_plan` | `dkp_` | `(dkp_pg_id)` |
| R6 | `__seo_r6_keyword_plan` | `r6kp_` | `(r6kp_pg_id)` |
| R7 | `__seo_r7_keyword_plan` | `r7kp_` | `(r7kp_pg_id)` |
| R8 | `__seo_r8_keyword_plan` | `r8kp_` | `(r8kp_type_id)` |

## Anti-cannibalisation obligatoire (pre-write)

Avant l'UPSERT, le planner DOIT verifier le Jaccard score avec les plans des roles adjacents :

```sql
-- Exemple R1 vs R3
SELECT skp_section_terms FROM __seo_r3_keyword_plan
WHERE skp_pg_id = {pg_id} AND skp_status = 'validated';
```

Calculer le Jaccard sur les `include_terms` de toutes les sections. Si > 0.15, retirer les termes en commun du plan courant.

## Vehicle enrichment (si applicable)

Pour les sections compatibilite (R1_S5_COMPAT, R3 S3, R6 compatibility), injecter les top vehicules :

```sql
SELECT am.marque_name, amod.modele_name, COUNT(*) AS cnt
FROM __cross_gamme_car_new cgc
JOIN auto_marque am ON am.marque_id::text = cgc.cgc_marque_id
JOIN auto_modele amod ON amod.modele_id::text = cgc.cgc_modele_id
WHERE cgc.cgc_pg_id = '{pg_id}'
GROUP BY am.marque_name, amod.modele_name
ORDER BY cnt DESC
LIMIT 6;
```

Injecter les resultats comme `include_terms` dans la section compatibilite :
- Format : `"{gamme_alias} {marque} {modele}"` (ex: `"cable embrayage Clio II"`)
