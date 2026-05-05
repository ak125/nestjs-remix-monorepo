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

ENUM défini en prod, **consommé par `__seo_observable.page_role`** (table introduite par migration `20260126_create_seo_observable.sql:18`).

Distribution `__seo_observable.page_role` :
- `R5` : 1176 lignes (100%)

Mono-valué (DEFAULT 'R5', tous les rows sont R5). Comme `__seo_reference.page_role = 'R4'`, c'est un champ strict-typé legacy court avec une seule valeur, pas un canal de mismatch canon-incompatible.

**Conséquence** : l'ENUM `seo_page_role` n'est pas orphelin — il a 1 consumer, donc **DROP TYPE seo_page_role n'est pas safe**. Plan de cleanup ENUM à reconsidérer.

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

## Recommandation finale : **Option C** (cleanup minimal)

> **Première itération recommandait Option A** (backfill `__rag_content_refresh_log`).
> Reflexion approfondie : Option A serait du bricolage. Voici pourquoi.

### Réfutation de l'Option A : `R3_guide_howto` n'est PAS une fuite

L'analyse initiale a confondu **vocabulaire worker** et **canon R0..R8** :

```
Pipeline réel :
  DB (__rag_content_refresh_log.page_type = "R3_guide_howto")
    ↓ TS @repo/seo-roles : PAGE_TYPE_TO_ROLE.R3_guide_howto = RoleId.R3_CONSEILS
    ↓ UI : getRoleDisplayLabel('R3_guide_howto') → "R3 · Conseils"
  
  ✅ Aucune fuite : la couche TS traduit correctement.
```

`R3_guide_howto` est un identifiant **worker page_type** (vocabulaire du pipeline content-refresh), pas un rôle canonique. Le package `@repo/seo-roles` (PR-0A) sépare intentionnellement les deux vocabulaires :

- **`WorkerPageType`** : `R1_pieces | R2_product | R3_conseils | R3_guide_howto | R4_reference | R5_diagnostic | R6_guide_achat | R7_brand | R8_vehicle` — utilisé par les workers pour identifier le type de contenu à rafraîchir
- **`RoleId`** (canonical) : `R0_HOME | R1_ROUTER | R2_PRODUCT | R3_CONSEILS | R4_REFERENCE | R5_DIAGNOSTIC | R6_GUIDE_ACHAT | R6_SUPPORT | R7_BRAND | R8_VEHICLE` — utilisé pour le SEO output

Le mapping `pageTypeToRoleId()` (du package) traduit l'un vers l'autre. **La DB stocke worker, le TS expose canon. C'est la séparation architecturale prévue, pas une fuite.**

Migrer `R3_guide_howto → R3_conseils` dans la DB serait du bricolage :
- Casserait la sémantique worker (`R3_guide_howto` ≠ `R3_conseils` dans le vocab worker — l'un est how-to, l'autre est conseil pédagogique)
- Aplatit deux concepts distincts qui partagent un canon (R3_CONSEILS) mais ont des sources/traitements différents
- Aucune fuite mesurable côté UI (tests PR-1 prouvent que getRoleDisplayLabel transforme correctement)

### Recommandation : Option C affinée — **No migration needed**

> **Itération 2** : la première version d'Option C proposait DROP TYPE seo_page_role
> orphelin. Vérification approfondie : l'ENUM **n'est pas orphelin** (consommé
> par `__seo_observable.page_role` introduit par migration `20260126_create_seo_observable.sql`).

PR-4B devient un **no-op architectural** :

1. **Pas de DROP TYPE** : l'ENUM a 1 consumer (`__seo_observable`, mono-valué R5)
2. **Pas de migration `__rag_content_refresh_log`** : worker vocab intentionnel
3. **Pas de recréation `assign_page_role_from_url`** : pas de consumer, dupliquerait `pageTypeToRoleId()` côté TS
4. **Pas d'application de `20260124_add_page_role.sql`** : architecture obsolète (DB stocke canon direct vs DB stocke short forms + TS traduit)

### Action concrète unique : annoter la migration jamais-appliquée

Modification minimale safe : ajouter un commentaire en tête de `backend/supabase/migrations/20260124_add_page_role.sql` indiquant que :
- Cette migration n'a jamais été appliquée en prod
- Son hypothèse architecturale est obsolète (DB stocke canon direct vs séparation worker/canon actuelle)
- Voir `pr4b-mcp-inventory-2026-05-05.md` pour le contexte complet

Ce commentaire empêche un futur contributeur d'appliquer la migration par erreur. Pas de DDL prod, pas de behavior change, juste un guardrail documentaire.

### Conséquences pour le plan stratégique global

- **Plan original PR-4B → PR-5 (drop legacy DB ≥30j)** doit être révisé : il n'y a pas de "legacy DB" canon-incompatible à drop
- **Couche DB d'enforcement (couche 4 du plan)** est **non applicable** : pas de CHECK strict canonique parce que la DB n'est pas censée stocker canonique
- **Le canon R0..R8 vit côté TS uniquement** (package `@repo/seo-roles`), enforced via PR-3a/3b lint + branded type compile-time
- **Le worker vocab vit côté DB** sans contrainte canon, traduction TS au boundary

Le plan stratégique se simplifie : 4 couches d'enforcement effectives (TypeScript branded, Zod runtime, lint statique, observability) — la couche DB devient un **commentaire architectural**, pas un mur.

### Précondition révisée pour avancer

- [ ] Validation humaine : Option C accepté ?
- [ ] Si oui : préparer migration cleanup (DROP TYPE) avec backup + test rollback
- [ ] Si non : justifier pourquoi Option A est préférable malgré l'analyse de séparation worker vs canon
- [ ] Mettre à jour le plan stratégique original (`/home/deploy/.claude/plans/ton-architecture-canonique-est-silly-crab.md`) pour retirer la couche 4 DB CHECK et clarifier que canon R0..R8 vit côté TS uniquement

L'Option C est l'aboutissement du principe "no bricolage" appliqué récursivement à l'analyse elle-même : avant de migrer, vérifier que la migration adresse une vraie fuite, pas une apparente.

---

## Précondition pour avancer

**STOP** — PR-4B requiert validation humaine avant migration :

- [ ] Décision Option A / B / C (recommandation : A)
- [ ] Si A : valider que `R3_guide_howto → R3_conseils` est le mapping correct (cf. `legacy-canon-map.md` v1.2.0 §1.4 → confirmé : R3_guide_howto IS R3_CONSEILS, pas R6_GUIDE_ACHAT comme la migration `20260124` mappait par erreur)
- [ ] Valider l'ordre : backfill avant ou après PR-3b promotion error ?
- [ ] Vérifier qu'aucun consommateur applicatif ne pattern-match sur `R3_guide_howto` strict (audit code après)

Cet inventaire est la première étape — il rend possible la décision architecturale, mais la décision elle-même doit être humaine.
