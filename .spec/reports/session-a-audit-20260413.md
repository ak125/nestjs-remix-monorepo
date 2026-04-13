# Session A.1 — Audit des sources de mapping KTYP → type_id

> Date : 2026-04-13
> Branch : `fix/pieces-relation-type-pollution-session-a`
> Plan : `/home/deploy/.claude/plans/swirling-giggling-scott.md` §5.A.1
> Résultat : **`vehicle_registry` ne sera pas peuplée**. On utilisera directement `tecdoc_map.linkage_target_registry`.

## Contexte

Le plan initial supposait qu'il fallait peupler `tecdoc_map.vehicle_registry` comme prérequis au fix des scripts TecDoc. L'audit montre qu'une table équivalente existe déjà et est peuplée : **`tecdoc_map.linkage_target_registry`**.

## Tables candidates inventoriées

| Table | Count | Schéma utile | Verdict |
|---|---:|---|---|
| `tecdoc_map.vehicle_registry` | **0** | `source_ktypnr → type_id` | Dead wood (jamais peuplée) |
| `public.norm_vehicle` | **0** | `ktypnr → …` | Dead wood (staging vide) |
| `public.__staging_vehicle_mapping` | **0** | `stg_ktypnr → stg_type_id` | Staging vide |
| `tecdoc_map.type_id_remap` | 23 457 | `old_id → new_id` (**legacy type_id → new type_id**, PAS ktyp) | Inadapté |
| `public.auto_type.type_tmf_id_i` | 53 959 | small enum, range [1,26] | **Pas un KTYP** (malgré son nom "tmf") |
| **`tecdoc_map.linkage_target_registry`** | **43 484** | `vknzielnr → internal_id` par `vknzielart` | **✓ SOURCE RETENUE** |

## Analyse de `tecdoc_map.linkage_target_registry`

### Schéma

```
id                     integer
vknzielart             smallint      -- 2=vehicle_type, 7=axle, 14=engine, 16=cv_type
vknzielnr_raw          character     -- KTYP padding fixe
vknzielnr              integer       -- KTYP entier (source TecDoc)
internal_entity_type   character     -- type cible côté interne
internal_id            integer       -- ID interne correspondant
source_table           character     -- provenance de la résolution
mapping_confidence     character     -- high / medium / low
created_at             timestamptz
updated_at             timestamptz
```

### Distribution par kind

| `vknzielart` | `internal_entity_type` | n | `internal_id` range | confidence |
|---:|---|---:|---|---|
| 2 (PKW) | `vehicle_type` | **43 484** | [1, 146 451] | 100 % `high` |
| autres | — | 0 | — | — |

### Couverture par rapport à `auto_type`

| Check | Valeur | % |
|---|---:|---:|
| LTR total (vehicle_type) | 43 484 | 100 % |
| LTR avec un `internal_id` existant dans `auto_type` | 28 017 | 64.4 % |
| LTR avec un `internal_id` existant ET actif (`type_display=1`) | 12 615 | 29.0 % |
| LTR orphelins (internal_id pointe vers un type_id supprimé ou jamais créé) | 15 467 | 35.6 % |

**Interprétation** : 35.6 % des entrées LTR pointent vers un `type_id` inexistant. Pas grave — après rebuild, ces lignes seront filtrées naturellement par le `JOIN auto_type`. Ce n'est pas un bug de LTR mais le reflet du cycle de vie (types créés puis supprimés). Du point de vue rebuild, on ne perdra aucune information utile : on ne conservera que les `internal_id` actifs.

### Validation ponctuelle : Skoda Rapid Spaceback 1.6 TDi

```sql
SELECT vknzielart, vknzielnr, internal_entity_type, internal_id, mapping_confidence
FROM tecdoc_map.linkage_target_registry
WHERE internal_id = 52395;
```

Résultat :

| vknzielart | vknzielnr | internal_entity_type | internal_id | confidence |
|---:|---:|---|---:|---|
| 2 | **52395** | vehicle_type | **52395** | high |

Le KTYP et le `type_id` interne coïncident pour cette entrée (cas fréquent dans l'espace legacy < 60 000). La rebuild **doit** produire des relations pour ce véhicule.

## Décision

1. **Ne pas peupler `vehicle_registry`**. Cette table sera laissée vide. Si un futur workflow l'exige (`source_ktypnr → type_id`), elle pourra être alimentée depuis `linkage_target_registry` via une vue ou une synchro. Hors scope de cette session.

2. **Patcher les scripts v2 pour JOIN directement sur `tecdoc_map.linkage_target_registry`** avec :
   - `WHERE ltr.vknzielart = 2 AND ltr.internal_entity_type = 'vehicle_type'`
   - `JOIN auto_type at ON at.type_id_i = ltr.internal_id AND at.type_display = '1'` (filtre actif)
   - Le `target_internal_id` écrit dans `source_linkages` devient `ltr.internal_id`

3. **Conserver `WHERE t400.col_5 = '2'`** dans `populate-source-linkages.v2.py` comme défense en profondeur (cohérent avec le filtre `vknzielart = 2` sur LTR).

4. **Conserver aussi** le filtre `rtp_target_kind = 'vehicle_type'` dans `tecdoc-project-core.v2.py` (défense en profondeur).

## Impact estimé sur le rebuild

Scénario optimiste : pour dlnr=21 (Valeo), le rebuild dans `tecdoc_rebuild.*` devrait produire ~400k à 2M lignes (vs. ~20-40M actuellement dans `pieces_relation_type` pour ce même dlnr). Chiffres à vérifier en A.3.

**Gate attendu pour Valeo ref 671889** : 34 912 relations → **< 500** (et très probablement ~100-300 car le KTYP 671889 cast direct ne résout en LTR vers aucun internal_id valide, donc la pièce devient liée uniquement à ses vraies compatibilités).

## Ce qui change dans le plan

| Étape plan d'origine | Statut | Remplacement |
|---|---|---|
| A.1 Populate `vehicle_registry` | **Skippé** | Audit seul (ce rapport) |
| A.2 Patch scripts en JOIN `vehicle_registry` | **Modifié** | JOIN `linkage_target_registry` |
| Migration `20260413_populate_vehicle_registry.sql` | **Non créée** | Remplacée par ce rapport + commentaire dans les scripts v2 |

Aucune autre étape du plan n'est affectée. Sessions B et C inchangées — elles consommeront les mêmes sibling tables et la même logique diff.
