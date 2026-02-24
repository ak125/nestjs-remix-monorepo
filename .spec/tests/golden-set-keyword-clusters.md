# Golden Set — SEO Keyword Clusters

> Version: 1.0 — 2026-02-24
> Gammes: disque-de-frein, filtre-a-huile, plaquette-de-frein

## Convention

Un "golden set" gamme a :
1. Row dans `__seo_keyword_cluster` avec tous les champs remplis
2. Bloc `seo_cluster` dans `/opt/automecanik/rag/knowledge/gammes/{alias}.md`
3. Briefs dans `__seo_page_brief` pour R1, R3_guide, R3_conseils, R4
4. `overlap_flags` calcules (peut etre vide si pas d'overlap)

## Invariants

| Gamme | primary_keyword | primary_volume | min_variants | roles_covered |
|-------|----------------|---------------|-------------|---------------|
| disque-de-frein | disque de frein | 50000 | 10 | R1,R3_guide,R3_conseils,R4,R5 |
| filtre-a-huile | filtre a huile | 5000 | 10 | R1,R3_guide,R3_conseils,R4,R5 |
| plaquette-de-frein | plaquettes de freins bosch | 500 | 10 | R1,R3_guide,R3_conseils,R4,R5 |

## Verification rapide

```bash
# Clusters
npx tsx scripts/seo/build-keyword-clusters.ts --all --output=json:stdout 2>/dev/null \
  | jq '[.[] | {pgAlias, status, primary: .primaryKeyword.text, vol: .primaryKeyword.volume, roles: (.rolesCovered | length)}]'

# Overlaps
npx tsx scripts/seo/audit-cross-gamme-overlap.ts --output=json:stdout 2>/dev/null \
  | jq '{pairs: .overlaps_found, flat: (.overlaps | length), high: .summary.high}'

# DB
# SELECT pg_alias, primary_keyword, primary_volume, jsonb_array_length(overlap_flags) as overlap_count
# FROM __seo_keyword_cluster ORDER BY pg_alias;
```

## Baselines

| Fichier | Date | Contenu |
|---------|------|---------|
| `snapshots/keyword-clusters-baseline-2026-02-24.json` | 2026-02-24 | 3 gammes, clusters complets |
| `snapshots/overlap-baseline-2026-02-24.json` | 2026-02-24 | 1 paire high (disque/plaquette), 4 flat entries |

## Comparaison avec baseline

```bash
diff <(jq 'sort_by(.pgAlias) | [.[].primaryKeyword.text]' .spec/tests/snapshots/keyword-clusters-baseline-2026-02-24.json) \
     <(npx tsx scripts/seo/build-keyword-clusters.ts --all --output=json:stdout 2>/dev/null | jq 'sort_by(.pgAlias) | [.[].primaryKeyword.text]')
```
