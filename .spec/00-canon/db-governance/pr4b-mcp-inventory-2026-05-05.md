# PR-4B MCP Inventory — Production State Audit

> **Date** : 2026-05-05
> **Source** : MCP Supabase read-only queries (project `cxpojprgwgubzjyqzmoq`)
> **Scope** : pré-condition documentée bloquante pour PR-4B (DB schema alignment)
> **Status** : INVENTORY — décisions architecturales requises avant migration

---

## TL;DR — Le plan PR-4B original est obsolète

Le plan PR-4B initial (cf. `/home/deploy/.claude/plans/ton-architecture-canonique-est-silly-crab.md`) reposait sur :

1. Trigger `BEFORE INSERT/UPDATE` sur `__seo_page.page_role` réutilisant la PL/pgSQL `assign_page_role_from_url(url)`
2. `ALTER TYPE seo_page_role ADD VALUE IF NOT EXISTS 'R1_ROUTER'` (et autres canoniques)
3. Backfill `__seo_page.page_role` via la fonction

**Ces hypothèses sont fausses en production** :

| Hypothèse plan original | Réalité MCP 2026-05-05 |
|--------------------------|--------------------------|
| `__seo_page.page_role` existe | ❌ La colonne n'existe pas |
| `assign_page_role_from_url()` existe en PL/pgSQL | ❌ Fonction absente de `pg_proc` |
| ENUM `seo_page_role` consommé par tables | ❌ ENUM orphelin (défini, jamais utilisé) |
| 218 hits `R3_guide_howto` à migrer dans `__seo_page` | ❌ La fuite est ailleurs |

La migration `backend/supabase/migrations/20260124_add_page_role.sql` qui créait colonne + fonction + trigger n'a **jamais été appliquée en production** (vérifié via `pg_proc` + `information_schema.columns`).

---

## Inventaire détaillé

### `__seo_page` — schema réel

```
id              bigint        NOT NULL
entity_id       bigint        NULL
url             text          NOT NULL
page_type       text          NOT NULL    ← seul champ de classification
title           text          NULL
h1              text          NULL
meta_description text         NULL
meta_robots     text          NULL
canonical_url   text          NULL
status_target   integer       NOT NULL
is_indexable_hint boolean     NOT NULL
temperature     text          NULL
priority        numeric       NULL
changefreq      text          NULL
last_published_at timestamptz NULL
last_modified_at  timestamptz NULL
created_at      timestamptz   NOT NULL
updated_at      timestamptz   NOT NULL
```

Pas de `page_role`. Le champ de classification est `page_type` (text libre, pas ENUM).

### `__rag_content_refresh_log.page_type` — distribution réelle

| page_type | n |
|-----------|---|
| `R3_conseils` | 238 |
| `R1_pieces` | 218 |
| **`R3_guide_howto`** | **218** ← legacy à migrer (worker how-to) |
| `R4_reference` | 218 |
| `R6_guide_achat` | 21 |
| **TOTAL** | **913** |

CHECK constraint réel :

```sql
chk_valid_page_type CHECK (
  page_type IN (
    'R1_pieces', 'R3_guide_howto', 'R3_conseils',
    'R4_reference', 'R5_diagnostic', 'R6_guide_achat',
    'R8_vehicle'
  )
)
```

Note : la constraint accepte déjà `R8_vehicle` (le plan original disait l'inverse), mais omet `R6_SUPPORT`, `R7_BRAND`, et les variantes canoniques longues (`R1_ROUTER`, etc.).

### `__seo_reference.page_role` — 100% R4

```
{ page_role: 'R4', n: 239 }
```

Toutes les 239 lignes ont `page_role = 'R4'`. CHECK contraint hardcodé `= 'R4'` documenté dans la migration (cohérent).

**Conclusion** : `__seo_reference.page_role` n'est PAS un canal de fuite legacy — c'est un champ mono-valeur typé legacy court.

### Fonctions PL/pgSQL consommant page_role / page_type

```
fn_kp_validated_enqueue
fn_r6_kp_validated_enqueue
get_gamme_composite_scores
get_observe_only_impact_stats
sync_sitemap_p_link_to_seo_page
```

**Aucune** ne s'appelle `assign_page_role_from_url`. La fonction de la migration `20260124_add_page_role.sql` n'existe pas en prod.

### Vues consommant page_role / page_type

Aucune vue.

### ENUM `seo_page_role`

```
{R1, R2, R3, R4, R5, R6}
```

ENUM défini en prod mais **non consommé** (recherche colonne d'aucune table : 0 hits). Type orphelin issu d'une migration partielle.

### Triggers `__seo_*` et `__rag_*`

30+ triggers existants — aucun nommé `*page_role*`, `*canon*`, ou similaire. Pattern observé : `trg_write_scope_*` (RLS), `trg_auto_restore_accents_*`, `trg_warn_orphan_*`, `trg_gpc_invalidate_*`.

---

## Décision architecturale requise pour PR-4B

Trois options se présentent — **arbitrage humain bloquant** avant migration :

### Option A — Pivot complet : focus `__rag_content_refresh_log`

Le seul vrai canal de fuite legacy en prod est `__rag_content_refresh_log.page_type` (218 lignes `R3_guide_howto`). PR-4B devient :

1. Backfill `R3_guide_howto → R3_conseils` sur les 218 lignes (per `legacy-canon-map.md` v1.2.0 §1.4 : `R3_guide_howto` IS R3_CONSEILS, pas R6_GUIDE_ACHAT)
2. Ajouter trigger `BEFORE INSERT/UPDATE` qui normalise les futurs INSERT
3. Élargir CHECK pour accepter les valeurs canoniques longues (`R1_ROUTER`, `R3_CONSEILS`, etc.) en parallèle des courtes
4. **Pas** de modification `__seo_page` (colonne `page_role` n'existe pas)
5. **Pas** de création `assign_page_role_from_url` (pas nécessaire — la normalisation se base sur le mapping `PAGE_TYPE_TO_ROLE` du package)

**Avantages** : surface chirurgicale, low-risk, ciblé sur le seul canal mesurable.
**Inconvénients** : laisse l'ENUM `seo_page_role` orphelin et la migration `20260124_add_page_role.sql` non appliquée.

### Option B — Appliquer la migration manquante

Appliquer `20260124_add_page_role.sql` en prod : créer la colonne `__seo_page.page_role`, créer la fonction `assign_page_role_from_url`, populer via la fonction (49 patterns URL).

**Avantages** : aligne prod sur l'intention design originelle.
**Inconvénients** : grand changement, nombreuses surfaces touchées, risque élevé sur 9000+ lignes `__seo_page`. Justification métier ? — la fonction n'est consommée par rien aujourd'hui, recréer la colonne est un investissement sans consumer immédiat.

### Option C — Drop l'ENUM orphelin + ne rien faire d'autre

Si `__seo_page.page_role` n'existe pas et qu'aucune vue/RPC ne consomme l'ENUM `seo_page_role`, le DROP est safe. PR-4B devient un cleanup minimal :

1. `DROP TYPE seo_page_role` (orphelin)
2. Enlever les références à `assign_page_role_from_url` dans les docs et plans
3. Retirer la migration `20260124_add_page_role.sql` du dossier (ou la marquer reverted)
4. PR-4B-bis traite `__rag_content_refresh_log` séparément

**Avantages** : zéro risque, aligne docs sur réalité.
**Inconvénients** : ne traite pas la fuite legacy `R3_guide_howto`.

---

## Recommandation : **Option A** (pivot)

Justification :

1. La fuite legacy mesurable est sur `__rag_content_refresh_log.page_type` (218 lignes), PAS sur `__seo_page`
2. Recréer une fonction PL/pgSQL et une colonne dont aucun consumer n'existe est du bricolage anticipé
3. Le package `@repo/seo-roles` (PR-0A) fournit déjà `PAGE_TYPE_TO_ROLE` côté TS — la normalisation peut se faire côté backend sans recourir à PL/pgSQL
4. L'ENUM orphelin peut être documenté comme dette technique (DROP en PR-4B-cleanup ultérieure)

Le plan PR-4B révisé Option A est :
- **Plus chirurgical** : 1 table, 218 lignes, 1 trigger
- **Plus mesurable** : avant/après backfill via les compteurs `seo_role_normalization_failed_total` (PR-2)
- **Cohérent avec PR-0A/0B** : utilise le canon TS comme SoT, la DB suit

---

## Précondition pour avancer

**STOP** — PR-4B requiert validation humaine avant migration :

- [ ] Décision Option A / B / C (recommandation : A)
- [ ] Si A : valider que `R3_guide_howto → R3_conseils` est le mapping correct (cf. `legacy-canon-map.md` v1.2.0 §1.4 → confirmé : R3_guide_howto IS R3_CONSEILS, pas R6_GUIDE_ACHAT comme la migration `20260124` mappait par erreur)
- [ ] Valider l'ordre : backfill avant ou après PR-3b promotion error ?
- [ ] Vérifier qu'aucun consommateur applicatif ne pattern-match sur `R3_guide_howto` strict (audit code après)

Cet inventaire est la première étape — il rend possible la décision architecturale, mais la décision elle-même doit être humaine.
