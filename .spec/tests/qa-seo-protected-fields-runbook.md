# Runbook QA — Protection des champs SEO (DB-first)

> **Version** : v1.1 — 2026-02-19
> **Auteur** : QA/Release Engineer (Claude Code)
> **Status** : Baseline 140/140 gammes, 0 mutations, GO permanent actif

---

## A) Cartographie des champs

### Champs PROTEGES (NE DOIVENT JAMAIS changer après refresh)

| Table | Colonne | Rôle HTML | Enricher y écrit ? |
|-------|---------|-----------|-------------------|
| `__seo_gamme` | `sg_title` | `<title>` | **JAMAIS** |
| `__seo_gamme` | `sg_h1` | `<h1>` | **JAMAIS** |
| `__seo_gamme` | `sg_descrip` | `<meta description>` | **JAMAIS** |
| `__seo_gamme_purchase_guide` | `sgpg_h1_override` | H1 override optionnel | **JAMAIS** (read-only) |
| `__seo_reference` | `title` | R4 title | INSERT draft only |
| `__seo_reference` | `meta_description` | R4 meta desc | INSERT draft only |
| `__seo_reference` | `canonical_url` | R4 canonical | INSERT draft only |

### Champs OVERLAY (écrits par RAG enrichers — c'est normal)

| Table | Colonnes |
|-------|----------|
| `__seo_gamme_purchase_guide` | `sgpg_intro_*`, `sgpg_risk_*`, `sgpg_timing_*`, `sgpg_arg*`, `sgpg_how_to_choose`, `sgpg_symptoms`, `sgpg_faq`, `sgpg_anti_mistakes`, `sgpg_selection_criteria`, `sgpg_decision_tree`, `sgpg_use_cases` |
| `__seo_gamme_conseil` | `sgc_content`, `sgc_title` |
| `__seo_reference` | `role_mecanique`, `confusions_courantes`, `symptomes_associes`, `regles_metier`, `content_html` |

---

## B) Runbook 6 étapes (S1..S6)

### S1 — Snapshot BEFORE (baseline des champs protégés)

```sql
-- Exécuter AVANT tout refresh.
-- Stocke les hashes dans la table permanente __qa_protected_meta_hash.
INSERT INTO "__qa_protected_meta_hash"
  (pg_alias, pg_id, seo_hash, ref_hash, h1_override_hash, snapshot_at, verified_by)
SELECT
  pg.pg_alias,
  pg.pg_id,
  md5(coalesce(sg.sg_title,'') || '||' || coalesce(sg.sg_h1,'') || '||' || coalesce(sg.sg_descrip,'')),
  (SELECT md5(coalesce(r.title,'') || '||' || coalesce(r.meta_description,'') || '||' || coalesce(r.canonical_url,''))
   FROM "__seo_reference" r WHERE r.slug = pg.pg_alias),
  (SELECT md5(coalesce(g.sgpg_h1_override,''))
   FROM "__seo_gamme_purchase_guide" g WHERE g.sgpg_pg_id = pg.pg_id::text),
  now(),
  'qa_runbook_v1_before'
FROM pieces_gamme pg
JOIN "__seo_gamme" sg ON sg.sg_pg_id = pg.pg_id::text
WHERE pg.pg_alias IN ('disque-de-frein','plaquette-de-frein','etrier-de-frein','amortisseur','turbo')
ON CONFLICT (pg_alias) DO UPDATE SET
  seo_hash = EXCLUDED.seo_hash, ref_hash = EXCLUDED.ref_hash,
  h1_override_hash = EXCLUDED.h1_override_hash,
  snapshot_at = now(), verified_by = 'qa_runbook_v1_before';
```

### S2 — Trigger refresh

```bash
for ALIAS in disque-de-frein plaquette-de-frein etrier-de-frein amortisseur turbo; do
  curl -s -X POST "$BASE/api/admin/content-refresh/trigger" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pgAlias\": \"$ALIAS\"}"
  echo " -> triggered $ALIAS"
done

echo "Waiting 60s for BullMQ..."
sleep 60

# Vérifier que tous les jobs sont terminés
curl -s "$BASE/api/admin/content-refresh/status?limit=25" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq '[.data[] | select(.pg_alias | test("disque|plaquette|etrier|amortisseur|turbo")) | {pg_alias, page_type, status, quality_score}]'
```

### S3 — Snapshot AFTER + comparaison hash

```sql
-- REQUETE DE VERIFICATION — Tout "FAIL" = incident SEO
SELECT
  h.pg_alias,
  h.pg_id,
  -- CHECK 1 : __seo_gamme (title + h1 + descrip)
  h.seo_hash AS baseline_seo,
  md5(coalesce(sg.sg_title,'') || '||' || coalesce(sg.sg_h1,'') || '||' || coalesce(sg.sg_descrip,'')) AS current_seo,
  CASE
    WHEN h.seo_hash = md5(coalesce(sg.sg_title,'') || '||' || coalesce(sg.sg_h1,'') || '||' || coalesce(sg.sg_descrip,''))
    THEN 'PASS' ELSE '** FAIL: SEO_GAMME_MUTATED **'
  END AS seo_verdict,
  -- CHECK 2 : __seo_reference (title + meta_desc + canonical)
  CASE
    WHEN h.ref_hash IS NULL THEN 'N/A'
    WHEN h.ref_hash = (
      SELECT md5(coalesce(r.title,'') || '||' || coalesce(r.meta_description,'') || '||' || coalesce(r.canonical_url,''))
      FROM "__seo_reference" r WHERE r.slug = h.pg_alias
    ) THEN 'PASS' ELSE '** FAIL: REF_META_MUTATED **'
  END AS ref_verdict,
  -- CHECK 3 : sgpg_h1_override
  CASE
    WHEN h.h1_override_hash IS NULL THEN 'N/A'
    WHEN h.h1_override_hash = (
      SELECT md5(coalesce(g.sgpg_h1_override,''))
      FROM "__seo_gamme_purchase_guide" g WHERE g.sgpg_pg_id = h.pg_id::text
    ) THEN 'PASS' ELSE '** FAIL: H1_OVERRIDE_MUTATED **'
  END AS h1_override_verdict,
  -- VERDICT GLOBAL
  CASE
    WHEN h.seo_hash = md5(coalesce(sg.sg_title,'') || '||' || coalesce(sg.sg_h1,'') || '||' || coalesce(sg.sg_descrip,''))
     AND (h.ref_hash IS NULL OR h.ref_hash = (
       SELECT md5(coalesce(r.title,'') || '||' || coalesce(r.meta_description,'') || '||' || coalesce(r.canonical_url,''))
       FROM "__seo_reference" r WHERE r.slug = h.pg_alias))
     AND (h.h1_override_hash IS NULL OR h.h1_override_hash = (
       SELECT md5(coalesce(g2.sgpg_h1_override,''))
       FROM "__seo_gamme_purchase_guide" g2 WHERE g2.sgpg_pg_id = h.pg_id::text))
    THEN 'GO' ELSE '** NO-GO **'
  END AS global_verdict
FROM "__qa_protected_meta_hash" h
JOIN "__seo_gamme" sg ON sg.sg_pg_id = h.pg_id::text
ORDER BY h.pg_alias;
```

### S4 — Vérifier que l'overlay a bien écrit du contenu

```sql
-- Gammes AVEC doc RAG : contenu overlay doit être non vide
SELECT
  sgpg_pg_id AS pg_id,
  sgpg_intro_role IS NOT NULL AS has_intro,
  sgpg_symptoms IS NOT NULL AS has_symptoms,
  sgpg_faq IS NOT NULL AS has_faq,
  sgpg_anti_mistakes IS NOT NULL AS has_anti_mistakes,
  sgpg_is_draft
FROM "__seo_gamme_purchase_guide"
WHERE sgpg_pg_id IN ('82','402','854')
ORDER BY sgpg_pg_id;

-- Gammes SANS doc RAG : refresh doit être 'skipped', pas 'failed'
SELECT pg_alias, page_type, status, quality_score, quality_flags
FROM "__rag_content_refresh_log"
WHERE pg_alias IN ('etrier-de-frein','turbo')
  AND created_at > now() - interval '10 minutes'
  AND status = 'failed'
  AND quality_flags::text LIKE '%NO_RAG_DATA_AVAILABLE%';
-- ATTENDU : 0 rows (zéro faux positifs)
```

### S5 — Fallback HTML diff (si SQL indisponible)

```bash
# Capturer les meta AVANT refresh (exécuter avant S2)
for SLUG in disque-de-frein plaquette-de-frein etrier-de-frein amortisseur turbo; do
  HTML=$(curl -sL "$BASE/pieces/freinage/$SLUG" 2>/dev/null)
  [ -z "$HTML" ] && HTML=$(curl -sL "$BASE/pieces/suspension/$SLUG" 2>/dev/null)
  [ -z "$HTML" ] && HTML=$(curl -sL "$BASE/pieces/moteur/$SLUG" 2>/dev/null)
  echo "$HTML" | grep -oP '(<title>[^<]+</title>|<h1[^>]*>[^<]+</h1>|content="[^"]{20,}"|rel="canonical" href="[^"]+")' \
    > "/tmp/qa_meta_before_${SLUG}.txt"
done

# Capturer APRÈS refresh (exécuter après S2 + 60s)
for SLUG in disque-de-frein plaquette-de-frein etrier-de-frein amortisseur turbo; do
  HTML=$(curl -sL "$BASE/pieces/freinage/$SLUG" 2>/dev/null)
  [ -z "$HTML" ] && HTML=$(curl -sL "$BASE/pieces/suspension/$SLUG" 2>/dev/null)
  [ -z "$HTML" ] && HTML=$(curl -sL "$BASE/pieces/moteur/$SLUG" 2>/dev/null)
  echo "$HTML" | grep -oP '(<title>[^<]+</title>|<h1[^>]*>[^<]+</h1>|content="[^"]{20,}"|rel="canonical" href="[^"]+")' \
    > "/tmp/qa_meta_after_${SLUG}.txt"
done

# Comparer
ALLPASS=true
for SLUG in disque-de-frein plaquette-de-frein etrier-de-frein amortisseur turbo; do
  DIFF=$(diff "/tmp/qa_meta_before_${SLUG}.txt" "/tmp/qa_meta_after_${SLUG}.txt")
  if [ -z "$DIFF" ]; then
    echo "PASS: $SLUG"
  else
    echo "** FAIL **: $SLUG"
    echo "$DIFF"
    ALLPASS=false
  fi
done
$ALLPASS && echo "=== GLOBAL: GO ===" || echo "=== GLOBAL: NO-GO ==="
```

### S6 — Garde-fou permanent (déjà actif)

La table `__qa_protected_meta_hash` est créée et la baseline posée.

**Pour étendre à toutes les gammes** (221) :
```sql
INSERT INTO "__qa_protected_meta_hash"
  (pg_alias, pg_id, seo_hash, ref_hash, h1_override_hash, verified_by)
SELECT
  pg.pg_alias, pg.pg_id,
  md5(coalesce(sg.sg_title,'') || '||' || coalesce(sg.sg_h1,'') || '||' || coalesce(sg.sg_descrip,'')),
  (SELECT md5(coalesce(r.title,'') || '||' || coalesce(r.meta_description,'') || '||' || coalesce(r.canonical_url,''))
   FROM "__seo_reference" r WHERE r.slug = pg.pg_alias),
  (SELECT md5(coalesce(g.sgpg_h1_override,''))
   FROM "__seo_gamme_purchase_guide" g WHERE g.sgpg_pg_id = pg.pg_id::text),
  'qa_runbook_v1_full'
FROM pieces_gamme pg
JOIN "__seo_gamme" sg ON sg.sg_pg_id = pg.pg_id::text
WHERE pg.pg_display = '1'
ON CONFLICT (pg_alias) DO UPDATE SET
  seo_hash = EXCLUDED.seo_hash, ref_hash = EXCLUDED.ref_hash,
  h1_override_hash = EXCLUDED.h1_override_hash,
  snapshot_at = now(), verified_by = 'qa_runbook_v1_full';
```

---

## C) Matrice GO/NO-GO

### Checklist PASS/FAIL

| # | Test | Méthode | PASS | FAIL | Poids |
|---|------|---------|------|------|-------|
| P1 | `sg_title` intact | SQL S3 seo_verdict | hash_before = hash_after | hash mismatch | **BLOQUANT** |
| P2 | `sg_h1` intact | SQL S3 seo_verdict | inclus dans seo_hash | hash mismatch | **BLOQUANT** |
| P3 | `sg_descrip` intact | SQL S3 seo_verdict | inclus dans seo_hash | hash mismatch | **BLOQUANT** |
| P4 | `__seo_reference.title` intact (update path) | SQL S3 ref_verdict | hash identique | hash mismatch | **BLOQUANT** |
| P5 | `__seo_reference.meta_description` intact | SQL S3 ref_verdict | inclus dans ref_hash | hash mismatch | **BLOQUANT** |
| P6 | `__seo_reference.canonical_url` intact | SQL S3 ref_verdict | inclus dans ref_hash | hash mismatch | **BLOQUANT** |
| P7 | `sgpg_h1_override` intact | SQL S3 h1_override_verdict | hash identique | hash mismatch | **BLOQUANT** |
| P8 | Overlay non vide sur gammes avec RAG | SQL S4 | >=1 has_intro=true | tout NULL | MAJEUR |
| P9 | 0 faux failed (NO_RAG) dans nouveaux logs | SQL S4 | 0 rows | >=1 row | MAJEUR |
| P10 | HTML diff vide (fallback) | Bash S5 | diff vide | diff non vide | FALLBACK |

### Seuils

- **GO** = P1-P7 tous PASS + P8 PASS + P9 PASS
- **NO-GO** = un seul P1-P7 FAIL
- **WARNING** = P8 FAIL (pipeline enrichment cassé, mais pas de régression SEO)

---

## D) Actions correctives immédiates (sans refactor)

### Si P1/P2/P3 FAIL (sg_title / sg_h1 / sg_descrip muté)

| Étape | Action | Commande |
|-------|--------|----------|
| 1 | Identifier le champ modifié | Comparer `baseline_seo` vs `current_seo` dans S3 |
| 2 | Restaurer depuis la baseline | `UPDATE "__seo_gamme" SET sg_title = '<valeur baseline>', sg_h1 = '...', sg_descrip = '...' WHERE sg_pg_id = '<pg_id>';` |
| 3 | Bloquer les refreshes | `docker exec nestjs-remix-monorepo-prod env CONTENT_REFRESH_DISABLED=true` ou arrêter le worker BullMQ |
| 4 | Trouver le coupable | `grep -rn 'sg_title\|sg_h1\|sg_descrip' backend/src/modules/admin/services/ backend/src/workers/` — aucun enricher ne doit écrire dans `__seo_gamme` |
| 5 | Corriger | Retirer l'écriture fautive dans l'enricher, redéployer, re-run S3 |

### Si P4/P5/P6 FAIL (reference title/meta/canonical muté sur UPDATE)

| Étape | Action |
|-------|--------|
| 1 | Vérifier `reference.service.ts:413-428` — le `.update()` ne doit contenir QUE : `role_mecanique`, `confusions_courantes`, `symptomes_associes`, `regles_metier`, `content_html`, `updated_at` |
| 2 | Si `title`/`meta_description`/`canonical_url` sont dans le `.update()` → les retirer |
| 3 | Restaurer : `UPDATE "__seo_reference" SET title = '<baseline>', meta_description = '...', canonical_url = '...' WHERE slug = '<alias>';` |

### Si P7 FAIL (sgpg_h1_override muté)

| Étape | Action |
|-------|--------|
| 1 | `grep -rn 'h1_override' backend/src/modules/admin/services/` — actuellement 0 écriture (read-only) |
| 2 | Si un enricher écrit dans `sgpg_h1_override` → retirer l'écriture |
| 3 | Restaurer : `UPDATE "__seo_gamme_purchase_guide" SET sgpg_h1_override = '<baseline>' WHERE sgpg_pg_id = '<pg_id>';` |

### Si P9 FAIL (faux failed NO_RAG dans nouveaux logs)

| Étape | Action |
|-------|--------|
| 1 | Vérifier `content-refresh.processor.ts:108-113` — le case `refResult.skipped` doit mettre `ragSkipped = true` |
| 2 | Cleanup SQL : `UPDATE "__rag_content_refresh_log" SET status = 'skipped', quality_score = NULL WHERE status = 'failed' AND quality_flags::text LIKE '%NO_RAG_DATA_AVAILABLE%' AND created_at > now() - interval '1 hour';` |

---

## E) Baseline de référence (2026-02-19 00:41 UTC)

| pg_alias | pg_id | seo_hash | ref_hash | h1_override_hash |
|----------|-------|----------|----------|------------------|
| amortisseur | 854 | `120e563049367ced1fa522a463dd9716` | `6c8479c7b0d9fe3c8b03a57549cbcf35` | `d41d8cd98f00b204e9800998ecf8427e` |
| disque-de-frein | 82 | `bb979de8697034675a8bc6577fc0c06b` | `27e5b69a2a8ab386bcd2951332772660` | `f659394e0c07db190d75a4799e43db49` |
| etrier-de-frein | 78 | `87d9bec642e26aaadaebd322058f83fa` | `a7534aecb9e461b61fef7acc2e2c0210` | `c4abae2033c944a849a0bd955e72e181` |
| plaquette-de-frein | 402 | `9a054f041bf6dfea7cbdcb19cfda915b` | `4ddf71372ebbc5479dc9a05848d57db1` | `8b9bbd12fa4ed81668f458baf6c8a0ee` |
| turbo | 2234 | `e79ab1fc3b0650ad193d3e0fe48c33ae` | `aae102433914e776936bb013b5384723` | `d41d8cd98f00b204e9800998ecf8427e` |

### Vérifications

**v1.0 (2026-02-19 00:41 UTC) — 5 gammes pilotes**
```
amortisseur      → seo:PASS  ref:PASS  h1:PASS  → GO
disque-de-frein  → seo:PASS  ref:PASS  h1:PASS  → GO
etrier-de-frein  → seo:PASS  ref:PASS  h1:PASS  → GO
plaquette-de-frein → seo:PASS  ref:PASS  h1:PASS  → GO
turbo            → seo:PASS  ref:PASS  h1:PASS  → GO
```

**v1.1 (2026-02-19 00:50 UTC) — 140 gammes scope B (toutes SEO actives)**
```
baseline_rows=140  scope_rows=140  missing=0
seo_mutations=0    ref_mutations=0  h1_override_mutations=0
VERDICT: GO
```
