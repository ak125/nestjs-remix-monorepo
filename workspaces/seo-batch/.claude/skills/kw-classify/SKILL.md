---
name: kw-classify
description: "Classifie les keywords bruts Google Ads KP (__seo_keywords) en rôles R1..R8 + intent + vol percentile, via le canon déterministe @repo/seo-roles. Délègue au script scripts/seo/classify-keywords.ts (zéro classification à la main). Usage : /kw-classify <pg_alias|--all> [--write]"
argument-hint: "<pg_alias ou --all> [--write]"
allowed-tools: Bash, Read, mcp__supabase__execute_sql, Glob
---

# KW Classifier — Skill /kw-classify v2.0 (canon-delegating)

## Principe (CHANGEMENT v2.0 — fin du bricolage)

La classification keyword→rôle n'est **plus faite à la main** dans ce skill.
Elle passe par le **SoT canonique déterministe** `classifyKeywordToRole`
(`@repo/seo-roles`) via le script `scripts/seo/classify-keywords.ts`.

**Pourquoi** : les anciennes règles markdown de ce skill divergeaient du canon
(ex. « prix → R1 » alors que le canon dit `prix → R2_PRODUCT`). Résultat
historique : 88 % des KW en R1, **0 R2, 0 R5** (transactionnel + diagnostic
effondrés). Le canon sépare correctement R1..R8 — *drift impossible by
construction* (cf. docstring du package). Aucun LLM dans ce chemin : déterministe.

Le rangement par tranche de volume (HIGH/MED/LOW) et l'écriture idempotente
(`__seo_keyword_results`, rebuild scopé `source='google-ads-kp'`) sont gérés
par le script.

## Projet Supabase
`cxpojprgwgubzjyqzmoq`

## Pré-requis

Les KW bruts doivent déjà être importés (filtre de pertinence RAG appliqué à
l'import) :
```
python3 scripts/seo/import-gads-kp.py data/keywords/inbox/{pg_alias}_{date}.csv
```
Si `__seo_keywords` est vide pour la gamme, le script l'indique (`[SKIP]`).

## Procédure

### Étape 1 — Aperçu (toujours en premier, lecture seule)

```bash
npx tsx scripts/seo/classify-keywords.ts --pg-alias {pg_alias}    # une gamme
npx tsx scripts/seo/classify-keywords.ts --all                    # toutes les gammes importées
```

Affiche, par gamme : `{n} raw → {n} classified [R1:.. R2:.. R5:.. ...]` +
le nombre de lignes `google-ads-kp` déjà présentes. **Rien n'est écrit.**

### Étape 2 — Écriture (rebuild idempotent)

Après vérification de l'aperçu, ajouter `--write` :

```bash
npx tsx scripts/seo/classify-keywords.ts --pg-alias {pg_alias} --write
npx tsx scripts/seo/classify-keywords.ts --all --write
```

`--write` fait un **rebuild scopé** : supprime les lignes `source='google-ads-kp'`
de la gamme puis réinsère le rangement canonique. Re-jouable à l'infini, jamais
de doublon. Les lignes d'autres sources (`claude_chrome`, `keyword-engine`) ne
sont **jamais** touchées.

### Étape 3 — Vérification (optionnelle)

```sql
SELECT role, COUNT(*) FROM __seo_keyword_results
WHERE pg_id = {pg_id} AND source = 'google-ads-kp'
GROUP BY role ORDER BY role;
```

Attendu : R2 et R5 non nuls si la gamme a des KW transactionnels / diagnostic.

## Notes

- **Taxonomie** : le canon produit R1..R8 (R2=achat, R5=panne, R6=guide d'achat).
  Les anciennes notes « R1/R3/R4/R6 » de la v1 sont obsolètes.
- **Exclusion sémantique** : faite à l'import (`import-gads-kp.py` applique
  `domain.must_not_contain` / `confusion_with` du RAG). Le canon ne ré-exclut pas.
- **Code** : `scripts/seo/lib/classify-row.ts` (mapping pur, testé),
  `scripts/seo/lib/volume-buckets.ts` (percentiles, testé),
  `scripts/seo/classify-keywords.ts` (orchestration DB).
- **Contrat DB** : `__seo_keyword_results` formalisée
  (`20260521_formalize_seo_keyword_results.sql`) + déclarée dans
  `.spec/00-canon/repository-registry/db.yaml` (D3, seo-team).
