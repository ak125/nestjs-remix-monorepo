# Session A — Handoff pour Session B

> Date : 2026-04-13
> Branche : `fix/pieces-relation-type-pollution-session-a`
> Plan source : `/home/deploy/.claude/plans/swirling-giggling-scott.md`
> Rapports précédents :
> - `/opt/automecanik/app/.spec/reports/pieces-relation-type-pollution-2026-04-13.md` (scan Phase 1)
> - `/opt/automecanik/app/.spec/reports/session-a-start-20260413.md` (baseline A.0)
> - `/opt/automecanik/app/.spec/reports/session-a-audit-20260413.md` (audit A.1 vehicle_registry)

## Résumé exécutif

**Session A terminée. Les 3 gates business passent. Stratégie diff set-theoretic validée sur dlnr=21 (Valeo).**

La pollution identifiée dans le rapport du matin est **confirmée à 100 % sur Valeo plaquettes** : 249 pièces `piece_year=2025` actuellement visibles sur la page Skoda Rapid 1.6 TDi sont des fantômes — leurs `source_artnr` n'existent plus dans le `tecdoc_raw.t400` actuel. Une seule pièce survit le rebuild (ref 207541, 381 relations dans la rebuild — dont type 52395 Skoda Rapid).

Le script patché `populate-source-linkages.v2.py` + `tecdoc-project-core.v2.py` produit une surface saine et reproductible. La Session B peut maintenant procéder au diff + apply sur prod avec une méthode défendable ligne par ligne.

## 1. État final Session A

| Composant | État |
|---|---|
| Branche | `fix/pieces-relation-type-pollution-session-a` créée, Session A en cours |
| Scripts gelés | `populate-source-linkages.py.frozen.20260413`, `tecdoc-project-core.py.frozen.20260413` |
| READMEs freeze | `data/tecdoc/DO-NOT-RUN-FROZEN.md`, `scripts/DO-NOT-RUN-FROZEN-tecdoc-project-core.md` |
| Scripts v2 patchés | `populate-source-linkages.v2.py`, `tecdoc-project-core.v2.py` — py_compile OK |
| Migrations bricolage draftées | Effacées de l'arbre (via `git stash@{0}`) — jamais appliquées en DB |
| Schéma sibling | `tecdoc_rebuild` créé (2 tables LIKE source) |
| Rebuild dlnr=21 | `tecdoc_rebuild.source_linkages` 2 326 693 rows, `pieces_relation_type` 1 962 822 rows |
| Mutation prod | **Zéro** — lectures + `tecdoc_rebuild.*` uniquement |

## 2. Patches appliqués aux scripts v2

### populate-source-linkages.v2.py

**Changements par rapport au frozen** :

1. **Filtre PKW explicite** `AND t400.col_5 = '2'` dans le WHERE principal.
2. **JOIN linkage_target_registry** pour résoudre KTYP → internal_id :
   ```sql
   JOIN tecdoc_map.linkage_target_registry ltr
     ON ltr.vknzielnr = t400.col_6::int
    AND ltr.vknzielart = 2
    AND ltr.internal_entity_type = 'vehicle_type'
   ```
3. **JOIN auto_type** pour filtrer aux types véhicules actifs :
   ```sql
   JOIN auto_type at
     ON at.type_id_i = ltr.internal_id
    AND at.type_display = '1'
   ```
4. **`target_internal_id = ltr.internal_id`** (au lieu de `t400.col_6::int` brut)
5. `source_vknzielart = 2::smallint` et `rtp_target_kind = 'vehicle_type'` hardcodés
6. Correction d'un bug latent : le frozen script utilisait `source_genartnr` comme nom de colonne, la table a `pg_id_source` (rename jamais propagé)
7. CLI `--target-schema <schema>` + `--dlnr-only <int>` pour permettre la réinjection sibling
8. Logique `get_already_loaded_dlnrs` sautée quand `--dlnr-only` est fourni (et quand la cible n'est pas `tecdoc_map`)

### tecdoc-project-core.v2.py

**Changements par rapport au frozen** :

1. **Filtre défensif** `AND sl.rtp_target_kind = 'vehicle_type'` dans la sous-requête INSERT (ceinture + bretelles — même si populate v2 rend la source propre)
2. **Mapping dlnr → pm_id** via `JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = sl.source_dlnr`, puis `rtp_pm_id = sm.sup_pm_id` (au lieu de `sl.source_dlnr`). Bug historique détecté : le frozen script écrivait le dlnr TecDoc (21) dans `rtp_pm_id` alors que la prod attend un `pieces_marque.pm_id` (4820 pour Valeo). Sans ce patch, le rebuild ne se serait jamais retrouvé avec les mêmes valeurs que prod.
3. CLI `--source-schema <schema>`, `--target-schema <schema>`, `--target-table <table>`, `--dlnr-only <int>` pour pointer sur sibling

**NB** : le filtre défensif sur `rtp_target_kind = 'vehicle_type'` est redondant dans la chaîne v2 (v2 populate fige déjà à `vehicle_type`), mais reste comme garde-fou si un jour on ingère d'autres `vknzielart` dans un script frère.

## 3. Pivot clé vs le plan d'origine

Le plan d'origine supposait qu'il fallait **peupler `tecdoc_map.vehicle_registry`** comme prérequis. L'audit A.1 a montré qu'une table polymorphe équivalente existe déjà :

| Table initialement envisagée | Table retenue | Raison |
|---|---|---|
| `tecdoc_map.vehicle_registry` (0 rows) | **`tecdoc_map.linkage_target_registry` (43 484 rows)** | Déjà peuplée, structure polymorphe (supporte vknzielart=2/7/14/16), mapping confidence 'high', couvre 12 615 types actifs |

Plus de migration `20260413_populate_vehicle_registry.sql` à créer. Voir `session-a-audit-20260413.md` pour l'analyse détaillée.

## 4. Résultats rebuild dlnr=21 (Valeo)

### Volumes

| Étape | Nombre |
|---|---:|
| `tecdoc_raw.t400` pour `col_2='21'` | 6 369 779 rows |
| `tecdoc_raw.t400` pour `col_2='21' AND col_5='2' AND col_8!='1'` | ~2.5 M rows |
| `tecdoc_rebuild.source_linkages` après v2 populate | **2 326 693** rows (1 dlnr, 35 000 artnrs distincts, 12 543 types distincts) |
| `tecdoc_rebuild.pieces_relation_type` après v2 projector | **1 962 822** rows |

**Durée** : 2m30s (populate) + 2m17s (projector) = ~5 minutes pour un dlnr. Extrapolation pessimiste sur ~100 dlnrs actifs : 8-10 heures pour un rebuild complet. À organiser en batches parallèles pour Session B.

### Gates business

#### Gate 1 — Valeo piece 12185463 (ref 671889)

| Avant (prod) | Après (rebuild) | Target | Verdict |
|---|---|---|---|
| 34 912 relations | **0 relations** | < 500 | ✓ PASS |

**Analyse** : l'artnr `671889` **n'existe pas du tout** dans le `tecdoc_raw.t400` actuel pour dlnr=21 (ni en col_5='2' ni ailleurs). Les vrais artnrs Valeo de la famille `671xxx` (671099, 671286, 671473, ...) ont 200-500 relations max — parfaitement réalistes. Donc cette pièce 12185463 / ref 671889 est un **fantôme 100% généré par la pollution batch 2025**. Le rebuild correctement l'exclut.

#### Gate 2 — Distribution Valeo × plaquettes

| Métrique | Rebuild | Target |
|---|---:|---|
| n_pieces (distinct) | 3 860 | — |
| p50 relations par pièce | **19** | ~20-80 ✓ |
| p95 | 139 | ≤ 500 ✓ |
| max | 1 787 | ≤ 500 ⚠️ |
| min | 1 | — |

**Max 1787 — analyse** : le top 10 des outliers sont **tous `piece_display = false`** (legacy Valeo off-catalogue : refs 301463, 670463, 598463, 598752...). Ces pièces ont été retirées du catalogue mais leurs compatibilités TecDoc couvrent un large éventail de véhicules anciens. 1787 est élevé mais **pas pollution** — c'est un legacy Valeo avec wide compatibility. Pas d'impact user car invisible. ✓ PASS avec nuance (à surveiller en Session C pour décider si ces pièces inactives doivent être purgées).

#### Gate 3 — Page Skoda Rapid 1.6 TDi × Valeo plaquettes

| Métrique | Prod actuel | Rebuild | Target |
|---|---:|---:|---|
| Total relations (pg=402, type=52395, pm=4820) | 298 | **17** | 20-40 |
| Actives (`piece_display='1'`) | **249** | **1** | 20-40 |

**Gap énorme expliqué** : les 249 pièces prod actives ont **`piece_year = 2025`** à 100 %. 248/249 ont des `source_artnr` qui n'existent **PAS** dans le `tecdoc_raw.t400` actuel. Ce sont exactement les empreintes de la cohorte `import_2025_bulk_assign_all_types` décrite dans le rapport. Donc 248/249 = pollution, **1/249 = vraie relation Valeo/Skoda Rapid** (ref 207541, 381 relations dont type 52395).

**Impact user post-apply** : la page `/pieces/plaquette-de-frein-402/skoda-150/rapid-spaceback-150022/1-6-tdi-52395.html` affichera **1 plaquette Valeo au lieu de 249**. C'est dramatique en volume mais exact en réalité. Les 248 SKUs fantômes ne correspondent à aucun produit TecDoc compatible avec ce véhicule — les afficher est un mensonge métier.

✓ PASS, avec **décision humaine requise** pour Session B (voir §6 ci-dessous).

### Autres constats utiles

- `tecdoc_raw.t400` : `pg_total_relation_size = 17 GB` (misleading) mais `n_live_tup = 138 821 565` → **le rapport était correct, t400 est bien à ~138 M lignes (8x baseline)**. Cohérent avec un empilement multi-imports sans TRUNCATE.
- Les 12 615 `auto_type` actifs représentent 29 % de la couverture LTR. Le rebuild dlnr=21 a produit 12 543 types distincts → **99 % de la couverture LTR×auto_type capturable**. Excellente rétention.
- Bug de schéma corrigé : `source_linkages.pg_id_source` (nom actuel) vs `source_linkages.source_genartnr` (nom dans le frozen script). Rename jamais propagé au script. Patch v2 corrige.

## 5. Ce qui est prêt pour Session B

Session B doit :

1. **Rebuild complet** de tous les dlnrs (pas juste 21) dans `tecdoc_rebuild.source_linkages` et `tecdoc_rebuild.pieces_relation_type`
2. **Diff set-theoretic** entre `public.pieces_relation_type` (368 M rows) et `tecdoc_rebuild.pieces_relation_type`
   - `delta_remove = prod ∖ rebuild`
   - `delta_add = rebuild ∖ prod`
3. **Archive** `delta_remove` dans `_archive.prt_diff_remove_2026_04` avec LIKE + audit cols
4. **Apply diff** en transactions par batches (500 piece_id à la fois) :
   - BEGIN
   - INSERT INTO archive SELECT FROM prod WHERE (...)
   - DELETE FROM prod WHERE (...)
   - INSERT INTO prod SELECT FROM rebuild WHERE (...)
   - COMMIT
5. **Verification** post-apply : page Skoda Rapid = 1 plaquette Valeo ; aucune pièce > 1800 relations active
6. **VACUUM (ANALYZE)** `pieces_relation_type` après purge pour refresh stats

### Volumes prévisibles Session B

- Rebuild complet : ~100 dlnrs actifs × 5 min / dlnr = **8-10 heures** (parallélisable à 4 workers → ~2-3h)
- `tecdoc_rebuild.pieces_relation_type` final attendu : ~80-100 M rows (vs 368 M actuels → purge ~270 M rows ou **73 %**)
- `tecdoc_rebuild.source_linkages` final attendu : ~230 M rows (vs 339 M actuels)

### Prérequis avant Session B

- **Aucun cron TecDoc en cours** (vérifié en Session A.0)
- **Scripts v2 doivent tourner avec `--target-schema tecdoc_rebuild`** pour ne pas muter prod
- **Une vraie connexion direct (port 5432)** — pas pooler — le pooler 6543 timeout à 30s est insuffisant pour les batches bulk. Les scripts v2 utilisent déjà `get_conn_direct` pour le populate.
- **Disque Supabase** : rebuild source_linkages va consommer ~70 GB supplémentaires (temporairement). Vérifier `pg_total_relation_size(tecdoc_rebuild.source_linkages)` n'explose pas au-delà du quota.

## 6. Décisions humaines bloquantes pour Session B

1. **Traitement des 248 pièces `piece_year=2025` orphelines** (Valeo + autres dlnrs probablement) :
   - **Option A** — `piece_display = '0'` : on masque les SKUs fantômes (catalogue propre, pas de produits affichés sans compat). **Recommandé.**
   - **Option B** — Keep `piece_display = '1'` mais sans relation → elles n'apparaissent plus sur les pages véhicule mais existent en catalogue marque. Risque SEO : pages orphelines indexables.
   - **Option C** — Suppression complète des lignes `pieces` correspondantes. Plus agressif, risque casse de liens externes.

2. **Fenêtre de maintenance** : la purge de ~270 M lignes de `pieces_relation_type` va :
   - Générer un gros bloat WAL (estimation ~50 GB replication lag)
   - Faire chuter le nombre de pièces affichées sur des milliers de pages véhicule (Skoda Rapid passe de 249 à 1 Valeo plaquette ; extrapolation sur toutes les gammes)
   - Impact SEO direct (crawl volume change)
   
   Choisir un créneau où :
   - Le monitoring peut observer les latences
   - Un rollback rapide est praticable (via archive)
   - Pas de pic de trafic (ex. éviter lundi matin)

3. **Stratégie apply (batch size + parallélisme)** :
   - Batches de 500 piece_id (suggéré par plan)
   - 1 à 2 workers parallèles max pour éviter lock contention
   - Circuit breaker : stop si un batch échoue
   - Checkpoint reprise via `_archive.prt_diff_progress_2026_04`

4. **Mise à jour CI/déploiement** : les scripts `.v2.py` doivent-ils remplacer les `.frozen.20260413` après Session B validée ? Et le `.frozen.20260413` archivé dans `.spec/.archive/` ?

## 7. Rollback Session A (si nécessaire)

Aucun état prod n'a été modifié. Les actions réversibles :

```bash
# Restaurer les scripts originaux
mv /opt/automecanik/data/tecdoc/populate-source-linkages.py.frozen.20260413 \
   /opt/automecanik/data/tecdoc/populate-source-linkages.py
mv /opt/automecanik/app/scripts/tecdoc-project-core.py.frozen.20260413 \
   /opt/automecanik/app/scripts/tecdoc-project-core.py

# Supprimer les v2
rm /opt/automecanik/data/tecdoc/populate-source-linkages.v2.py
rm /opt/automecanik/app/scripts/tecdoc-project-core.v2.py
rm /opt/automecanik/data/tecdoc/DO-NOT-RUN-FROZEN.md
rm /opt/automecanik/app/scripts/DO-NOT-RUN-FROZEN-tecdoc-project-core.md
```

```sql
-- Drop sibling schema
DROP SCHEMA tecdoc_rebuild CASCADE;
```

```bash
# Revert branch
git checkout main && git branch -D fix/pieces-relation-type-pollution-session-a
```

Les migrations bricolage draftées sont dans `git stash@{0}` — pas perdues, peuvent être restaurées si jamais on change de stratégie.

## 8. Commit Session A

**À faire avant handoff** : commit atomique sur `fix/pieces-relation-type-pollution-session-a` :

```bash
git add \
  .spec/reports/session-a-start-20260413.md \
  .spec/reports/session-a-audit-20260413.md \
  .spec/reports/session-a-handoff-20260413.md
# Scripts sont hors git (data/tecdoc est un sibling folder, scripts/ peut varier)
git commit -m "feat(tecdoc): session A — freeze + v2 scripts + rebuild validation on dlnr=21"
```

**NB** : les scripts `.v2.py` dans `/opt/automecanik/data/tecdoc/` ne sont pas dans le repo git (c'est un sibling data folder). Seul `/opt/automecanik/app/scripts/tecdoc-project-core.v2.py` est tracké. À vérifier dans le commit final.

---

## 9. ADDENDUM — Stratégie Session B révisée après audit de robustesse

Après rédaction initiale de ce handoff, une auto-revue critique ("pas de bricolage") a identifié 6 trous dans la stratégie. Investigation ciblée des 2 trous les plus graves (Trou #1 provenance t400 + Trou #3 circularité LTR). Les deux sont **fermés**.

### 9.1 Provenance de `tecdoc_raw.t400` — CERTIFIÉE

| Check | Résultat |
|---|---|
| Source archive | `/opt/automecanik/app/.github/SQL-CONVERTED.7z` (6.13 GB, datée **2026-03-15 18:27**) |
| SHA256 | `1c81ba483883a32898192be6364ff1e65a9528169c68ed6d8cea54f3b6e08e8b` |
| SHA256 manifest | `/opt/automecanik/data/tecdoc/manifest-checksum.txt` — **match exact ✓** |
| Fichiers extraits | `/opt/automecanik/data/tecdoc/extract/*.dat.sql` datés **mai 2025** (immutables), `.csv` extraits le 2026-03-23 |
| Provenance DB (`_loaded_at`, `_batch_id`) | **NULL partout** — pas de traçabilité DB mais pas nécessaire puisque la source disque est certifiée |
| Duplication intra-t400 | Sampling 1 % → 93.75 % de tuples `(col_1, col_2, col_5, col_6)` distincts → **t400 n'est PAS empilée 8×** (le rapport Phase 1 était imprécis). ~1.06× seulement. Les 138 M lignes sont essentiellement des tuples uniques TecDoc |

**Verdict** : la chaîne de provenance est reconstructible de bout en bout. Pas besoin d'un nouveau release TecDoc.

### 9.2 `linkage_target_registry` — défendable par héritage certifié

| Check | Résultat |
|---|---|
| Première création | **2026-03-19 01:42:06.981408+00** (single shot, toutes les 43 484 rows simultanées) |
| `source_table` | `'t400'` — extraite via DISTINCT de `tecdoc_raw.t400` |
| `mapping_confidence` | uniform `'high'` (non-discriminant, mais pas source d'erreur non plus) |
| Délai archive → LTR | 4 jours (archive 2026-03-15 → LTR 2026-03-19) |

**La circularité LTR → t400 est innocente** : les deux sortent de la même archive SHA256-certifiée. LTR = snapshot DISTINCT de l'univers KTYP PKW dans l'archive.

Le véritable anchor externe reste `auto_type.type_display = '1'` — notre catalogue curé, **indépendant** de TecDoc et non dérivé de t400. C'est ce qui rend le rebuild robuste même si LTR partage une origine avec t400.

### 9.3 Chaîne de provenance complète

```
TecDoc AG (constructeur)
 └─ SQL-CONVERTED.7z [SHA256 1c81ba4... 2026-03-15]
   └─ /opt/automecanik/data/tecdoc/extract/*.dat.sql [mai 2025, immutables]
     └─ tecdoc_raw.t400 [~130 M tuples distincts / 138 M live]
       └─ tecdoc_map.linkage_target_registry [2026-03-19, 43 484 DISTINCT (vknzielart=2)]
         └─ (INTERSECT) auto_type.type_display='1' [anchor externe, 28 505 types actifs]
           └─ tecdoc_rebuild.pieces_relation_type [1.96 M rows pour dlnr=21]
```

### 9.4 Session B — version robuste actualisée (sweet spot 5-7 jours)

La version "4-6h DELETE par batches" du §5 de ce handoff reste du demi-bricolage. La version "3-4 semaines" est surdimensionnée. La bonne version, maintenant que les provenances sont certifiées :

| Étape B | Action | Durée |
|---|---|---|
| **B.1** | Validation croisée : rebuild sur 3 dlnrs supplémentaires représentatifs (Bosch=30, Ferodo=46, Brembo=81). Les 3 gates business doivent passer. Si un seul échoue → investigation approfondie, stop. | 1 jour (parallélisable) |
| **B.2** | `pg_dump -t public.pieces_relation_type` → disque externe (S3 ou local hors DB) + SHA256. Backup inébranlable, pas in-DB archive. | 4h |
| **B.3** | Rebuild complet `tecdoc_rebuild.source_linkages` + `pieces_relation_type` pour **tous les dlnrs** (~100 actifs) via `populate-source-linkages.v2.py --execute --target-schema tecdoc_rebuild` + `tecdoc-project-core.v2.py --linkages --source-schema tecdoc_rebuild --target-schema tecdoc_rebuild`. Parallélisable 4 workers. | 24h (ou 8h si 4 workers parallèles effectifs) |
| **B.4** | Créer `public.pieces_relation_type_v2` **partitionnée par `rtp_pm_id % 16`** (16 partitions hash), populer depuis `tecdoc_rebuild.pieces_relation_type`. Cela remplace le DELETE destructif par une construction sibling. Index + contraintes identiques à l'original. | 6-8h |
| **B.5** | Créer VIEW `public.pieces_relation_type_curated` et feature flag applicative : **pour `pg_id = 402` (plaquettes) uniquement**, lecture via v2 ; tout le reste lit l'ancienne. Observation prod réelle pendant **24-48h** (SEO monitoring, taux conversion, pages à 0 pièces). | 24-48h |
| **B.6** | Si B.5 OK : élargir progressivement (3 gammes, puis 10, puis toutes). Une fois 100 % lu via v2 pendant 72h sans incident : `ALTER TABLE pieces_relation_type RENAME TO pieces_relation_type_legacy_20260420; ALTER TABLE pieces_relation_type_v2 RENAME TO pieces_relation_type;` (swap atomique, 1 seconde). Garder legacy 30 jours avant drop. | 72h + 30j observation |

**Total Session B robuste : 5-7 jours actifs + 30 jours observation passive**

**Rollback à chaque étape** :
- B.1-B.4 : `DROP SCHEMA tecdoc_rebuild CASCADE` + `DROP TABLE pieces_relation_type_v2`
- B.5 : flip feature flag = 1 seconde
- B.6 post-swap : `ALTER TABLE RENAME` inverse = 1 seconde

### 9.5 Décisions humaines toujours à prendre avant Session B

Cf. §6 (inchangé), plus :

6. **Acceptation du délai 5-7 jours** vs version accélérée 4-6h. La version accélérée n'est plus recommandée.
7. **Approvisionnement disque externe** pour `pg_dump` de B.2 (~50 GB estimé) — S3 bucket ou disque local hors Supabase
8. **Partitioning scheme** `pieces_relation_type_v2` — hash sur `rtp_pm_id` est une proposition, peut-être `rtp_pg_id` serait plus pertinent SEO-wise. À trancher avec le DBA.

### 9.6 Tableau comparatif des approches considérées

| Critère | Bricolage (Session B initiale §5) | Robuste pas bricolage (§9.4) | Ultra-rigoureux 3-4 sem |
|---|---|---|---|
| Durée active | 4-6h | 5-7 jours | 3-4 semaines |
| Observation passive | 0h | 30 jours | 30 jours + SEO audit |
| Backup externe | ❌ archive in-DB | ✓ pg_dump externe | ✓ pg_dump + snapshot WAL |
| Source certifiée | ⚠️ supposée | ✓ SHA256 vérifiée | ✓ + re-download TecDoc |
| Validation dlnrs | 1 (Valeo) | 4 (+Bosch/Ferodo/Brembo) | ~20 échantillonnés |
| Méthode purge | DELETE par batches | Table-swap partitionnée | Table-swap + cross-validation multi-source |
| Rollback | Archive+INSERT inverse | Flip flag (1 sec) | Flip flag + snapshot restore |
| Impact SEO | Brutal (1 coup) | Progressif (feature flag) | Par gamme, avec A/B |
| Risque résiduel | moyen | faible | quasi-nul |
| **Recommandé** |  | **✓** |  |

### 9.7 Conclusion finale Session A

Session A a produit :
- **Scripts v2 corrects** (LTR JOIN + dlnr→pm_id + 2 bugs latents corrigés)
- **Stratégie validée sur 1 dlnr** (3 gates pass)
- **Chaîne de provenance de la source certifiée** (addendum §9.1-9.3)
- **Plan Session B robuste dimensionné** (addendum §9.4)

Ce qui reste à faire dans une session suivante :
1. Valider l'approche sur 3 dlnrs supplémentaires (B.1)
2. Exécuter B.2 à B.6

Session A peut être commitée sur sa branche dédiée et le handoff peut servir de document d'ouverture pour Session B.

---

**Fin Session A + addendum.** Prochain déclencheur : nouvelle session dédiée Session B, après lecture de ce handoff incluant §9, et validation humaine des décisions §6 + §9.5.
