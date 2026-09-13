# Plan de suppression — `tecdoc_map.source_linkages`

> **Statut : PLAN, non exécuté.** Après #1463, `source_linkages = SAFE_DROP_CANDIDATE`.
> **DROP réel = HOLD** jusqu'à un GO nominatif de l'owner, distinct de l'approbation de ce plan.
> **Décisions owner D1 à D4 fixées le 2026-09-11 (§10). D5 — le GO de la migration — n'est PAS donné.**
>
> Mesures : 2026-09-11, 14:50 → 14:56 UTC, base PROD, chaque requête dans `BEGIN READ ONLY`.
> Catalogue PostgreSQL, parcours d'index bornés, deux échantillons `TABLESAMPLE`. Aucune écriture.

## Résumé

- **Ce qui part** : une table de **90,00 Gio**, trois vues de diagnostic et `source_linkage_criteria`
  (356 Mo). Les critères sont d'abord exportés dans un artefact scellé (**D1-B**).
- **Ce qui reste** : la séquence partagée, les registres, les tables finales, les archives et les
  preuves (§6). Liste fermée.
- **Base** : 239,71 Gio → **149,36 Gio**. Le disque provisionné, lui, ne bouge pas.
- **Rien de servi** ne dépend de la table.
- **Bloquant avant tout GO** : la preuve des sauvegardes Supabase (**D3**), puis les deux exports
  vérifiés (**D2**, **D1-B**).
- **Après le DROP** : 48 h d'observation, sans aucun redimensionnement du disque (**D4**).

## 1. Base de décision

| Élément | Référence |
|---|---|
| Containment 110/110 | `audit/massdoc-tecdoc-containment-proof-2026-09-11.json`, sceau `66f8e98d071c9d45…` |
| Caractérisation C4 | `audit/massdoc-tecdoc-c4-characterisation-2026-09-11.json`, sceau `c66440d22bd3e2ff…` |
| Préservation C4C | `audit/massdoc-tecdoc-c4c-preservation-2026-09-11.json`, sceau `8ba92e7a1a778108…` |
| Prémisse C1 (PROD ⊆ archive) | les 7 preuves `audit/massdoc-tecdoc-lot*-proof-2026-09-10.json` |
| Décisions owner du 2026-09-11 | C4C PRESERVE_EXTERNALLY · C4B et C3 OWNER_ACCEPTED_ABANDON |

Vérifié après le merge de #1463 : les blobs Git des trois fichiers sur `main` sont identiques au
commit scellé, et les trois sceaux se vérifient depuis `main`.

## 2. Gel vérifié — la table mesurée est bien celle qui a été prouvée

| Fait | Valeur | Conséquence |
|---|---|---|
| DLNR présents (parcours d'index par sauts) | **110**, exactement ceux du registre scellé | aucune ligne hors preuve |
| `source_dlnr` nul | 0 (colonne `NOT NULL`) | idem |
| `n_tup_upd` / `n_tup_del` | 0 / 0 | aucune modification depuis le chargement |
| `n_tup_ins` | 507 209 168 | identique à la mesure du 2026-09-10 |
| `max(source_linkage_id)` | 518 352 249 | repère d'insertion |
| dernier autoanalyze | 2026-03-26 12:45 UTC | table figée depuis |
| remise à zéro des statistiques | 2025-06-06 | compteurs continus depuis |
| sessions tenant un verrou sur les cibles | 0 | — |

Le nombre exact de lignes est **339 249 945** : c'est la somme scellée sur les 110 DLNR, et la table
n'en contient pas d'autre. Le `n_live_tup` de 339 262 790 n'est qu'une estimation statistique.

**Repère de lecture T0 (14:56:34 UTC)**, pris après la dernière lecture de ce plan :
`source_linkages` seq_scan 1 528 · idx_scan 1 071 920 726 ;
`source_linkage_criteria` seq_scan 12 · idx_scan 1 616 380.

## 3. Objets supprimés — liste fermée

| Objet | Nature | Taille | Pourquoi il part |
|---|---|---:|---|
| `tecdoc_map.source_linkages` | table | **90,00 Gio** (heap 56,30 · index 33,69 · toast 0) | la cible |
| ses 4 index (dont 2 portés par la PK et la clé unique), 2 contraintes, 4 défauts, type ligne ; les 2 triggers RI de la FK | dépendances `auto` | incluses | disparaissent avec la table |
| `public.v_tecdoc_unlinked_pieces_reason` | vue `security_invoker`, lue par postgres et dev_readonly | 0 | lit `source_linkages` |
| `public.v_tecdoc_dlnr_reconciliation` | vue `security_invoker`, lue par postgres et dev_readonly | 0 | lit `source_linkages` |
| `tecdoc_map.v_tecdoc_dlnr_reconciliation` | vue sans droit accordé | 0 | lit `source_linkages` |
| `tecdoc_map.source_linkage_criteria` et sa FK `ON DELETE NO ACTION` | table | 356 Mo | ses critères n'ont d'autre clé que `source_linkage_id` ; exportés et scellés avant (**D1-B**, §5) |
| `tecdoc_map.source_linkage_criteria_id_seq` | séquence | — | ne sert qu'à `source_linkage_criteria.id` ; valeur consignée en annexe A.3 |

Le détail des index : clé unique métier 20,85 Gio · PK 7,96 Gio · `idx_sl_dlnr_artnr` 2,60 Gio ·
`idx_sl_pg_id_source_dlnr` (partiel) 2,28 Gio.

**Explicitement NON supprimée : `tecdoc_map.source_linkages_id_seq`.** Elle n'appartient à aucune
colonne, donc un `DROP TABLE` ne l'emporte pas, et elle sert aussi de défaut à
`tecdoc_rebuild.source_linkages.source_linkage_id`. `last_value` = 520 960 875.

## 4. Dépendances — vérifiées absentes ou sans effet

**Base de données**

| Contrôle | Résultat |
|---|---|
| vues dépendantes, récursivement | les 3 vues du §3, aucune vue de profondeur 2 |
| vues matérialisées dépendantes | 0 (`v_projection_scope_linkages` ne dépend pas de la table) |
| clés étrangères entrantes | 1 — `source_linkage_criteria` |
| triggers non internes · policies · RLS | 0 · 0 · désactivée |
| droits accordés sur la table | aucun (propriétaire `postgres` seul) |
| publications | `supabase_realtime` n'est pas `FOR ALL TABLES` et ne contient pas la table |
| fonctions dont le corps cite `source_linkage` | 0 |
| jobs `pg_cron` | 0 |
| colonnes homonymes ailleurs | `source_linkage_criteria.source_linkage_id` (la FK) · `tecdoc_rebuild.source_linkages.source_linkage_id` (table indépendante, séquence partagée) |
| event triggers | `pgrst_ddl_watch` et `pgrst_drop_watch` se déclenchent : **rechargement du cache de schéma PostgREST**, bref et observable. `tecdoc_map` n'est pas exposé. |

**Dépôt (`origin/main`)**

| Référence | Effet du DROP |
|---|---|
| code applicatif (`backend/src`, `frontend/app`, `packages`) | 0 référence à la table ni aux vues, hors types générés |
| `packages/database-types` | déclare les 2 vues de `public` → **à régénérer** (projection, jamais éditée à la main) |
| `scripts/tecdoc_scope.py`, `scripts/tecdoc_replay_wave.py` | lisent le périmètre **scellé**, pas la table → rejeu intact |
| `scripts/tecdoc-scope-build/build_scope.py` | générateur ponctuel ; il ne pourra plus être relancé, mais sa sortie scellée reste (`audit/massdoc-tecdoc-import-scope-2026-03.json`) |
| `scripts/tecdoc-pipeline/*` (7 scripts) | pipeline historique déjà hors usage ; échoueraient si relancés — suite à décider, hors plan |
| `scripts/lint/check-tecdoc-api-surface.sh` | refuse seulement de redonner des droits sur les vues : un DROP ne le déclenche pas |
| `scripts/db/test-tecdoc-api-surface-lockdown.sh` + fixture | environnement Docker autonome, non affecté |
| `.spec/00-canon/tecdoc-integration-roadmap-v3.md`, `docs/security/…` | documents historiques, inchangés |

## 5. Décision D1 — `tecdoc_map.source_linkage_criteria` (356 Mo)

| Fait mesuré | Valeur |
|---|---|
| lignes · linkages distincts | 1 614 421 · 1 095 153 |
| DLNR 6358 (RIDEX, tronqué) | 1 059 853 lignes · 663 681 linkages |
| DLNR 253 (DIEDERICHS) | 554 568 lignes · 431 472 linkages |
| écriture | deux instructions, le 2026-03-19 à 02:19 et 02:20 UTC ; 0 UPDATE, 0 DELETE depuis |
| linkages parents dans la preuve | **100 % C1** sur ces deux DLNR |
| table source TecDoc des critères dans l'archive | **non vérifié** : l'inventaire scellé ne couvre que les tables 400 et 232 |
| producteur | introuvable (classée UNKNOWN_BLOCKER le 2026-09-10) |

Les critères n'ont d'autre clé que `source_linkage_id`. Sans la table parente, ils ne se rattachent
plus à aucun article ni véhicule.

| Option | Contenu | Taille libérée en plus | Ce qu'elle suppose |
|---|---|---:|---|
| **D1-A** | supprimer avec la table parente | 0,35 Gio | l'owner accepte l'abandon, comme pour C3 et C4B |
| **D1-B — retenue par l'owner** | export verbatim scellé — critères + clé métier parente (DLNR, ARTNR, gamme, type de cible, KTYP) — **puis** suppression | 0,35 Gio | un artefact scellé, indépendant de l'export complet |
| **D1-C** | conserver la table, retirer seulement la FK, exporter la correspondance `source_linkage_id → clé métier` | 0 | 356 Mo restent en base |

D1-B applique la même règle que C4C : ce dont on ignore la provenance ne se jette pas sans trace.

**L'artefact des critères (D1-B)**, exigé par l'owner :

- il est traité comme C4C : scellé, **indépendant** de l'export complet de `source_linkages`, pour
  permettre une restauration ciblée même si l'export complet existe ;
- il contient toutes les colonnes de `source_linkage_criteria`, plus la clé métier de la ligne parente
  et tout ce qu'une restauration exige ;
- ses contrôles : 1 614 421 lignes, 1 095 153 linkages, répartition 6358/253 identique au §5,
  `id` unique, sceau vérifié ;
- son stockage : le heap seul pèse 198 Mo, au-delà d'un fichier raisonnable pour Git. Le fichier
  scellé est donc stocké hors dépôt ; son manifeste et son sceau sont versionnés. Point à confirmer
  au moment de l'export.

## 6. Liste KEEP — figée pour cette opération

**`tecdoc_map`, hors cible**

| Relation | Taille | Motif |
|---|---:|---|
| `article_registry` | 924 Mo | KEEP_ABSOLUTELY — ARTNR/DLNR → `piece_id` ; nécessaire pour relire C2 et C4C |
| `type_id_remap` | 3 Mo | KEEP_ABSOLUTELY — servie au runtime via `resolve_type_id_remap` |
| `linkage_target_registry` | 6,5 Mo | registre d'identité |
| `gamme_registry` | 2,0 Mo | `pg_id_source` → gamme MassDoc (utilisé par l'export C4C) |
| `v_projection_scope_linkages`, `v_projection_scope_pieces`, `v_projection_scope_suppliers` | 190 Mo | vues matérialisées indépendantes de la table |
| `engine_type_ga`, `search_node_ga`, `modele_id_remap`, `supplier_registry`, `activation_log`, `pg_id_remap`, `losch_log`, `vehicle_registry`, `sync_batch` | ≈ 2,5 Mo | registres |
| `source_linkages_id_seq` | — | **KEEP (validé owner)** — séquence partagée avec `tecdoc_rebuild.source_linkages` |
| `linkage_target_registry_id_seq` | — | séquence du registre |

**Hors périmètre de ce plan, conservés** : `tecdoc_raw` (19,1 Gio, REGENERABLE_STAGING — décision
séparée) · `tecdoc_doc` (2,05 Gio) · `tecdoc_rebuild` (0,92 Gio) · `tecdoc_norm` (0,46 Gio) ·
`tecdoc_ext` (0,02 Gio). Les autres UNKNOWN_BLOCKER (`graphics_registry`, `article_info_modules`,
`tecdoc_norm`, `tecdoc_ext`) ne dépendent pas de `source_linkages` : ils ne sont pas concernés.

**Tables finales — intouchables** : `public.auto_marque`, `auto_modele`, `auto_type`, `pieces`,
`pieces_gamme`, `pieces_relation_type`, `pieces_relation_criteria`, `pieces_criteria`,
`pieces_ref_search`, `pieces_ref_oem`, `pieces_media_img*`.

**Hors base** : l'archive source TecDoc et ses manifestes (référencés dans le périmètre scellé),
les preuves `audit/massdoc-tecdoc-*` et `scripts/tecdoc_seal.py`.

**Cardinaux à retrouver à l'identique après exécution** : `article_registry` 3 240 177 ·
`type_id_remap` 23 457 · `linkage_target_registry` 43 484 · `gamme_registry` 10 678.

## 7. Tailles avant / après

| Mesure | Avant | **Après — D1-B retenue** | pour mémoire : D1-C écartée |
|---|---:|---:|---:|
| `pg_database_size` | 257 389 751 443 o · **239,71 Gio** | 160 376 671 379 o · **149,36 Gio** | 160 749 620 371 o · 149,71 Gio |
| schéma `tecdoc_map` | 91,45 Gio | 1,10 Gio | 1,45 Gio |
| disque provisionné | — | **inchangé** | inchangé |

- **Disque** : sur Supabase il ne rétrécit jamais. Seul un upgrade de version PostgreSQL le
  redimensionne, à ≈ 1,2 × la base. L'espace libéré reste réutilisable par la base.
- **Espace** : un `DROP TABLE` le rend au système de fichiers sans `VACUUM` (le `VACUUM FULL` reste
  interdit). WAL généré négligeable.
- **Compute** : inchangé — la table n'est pas lue, donc pas en cache.

## 8. Restauration et rollback

**R0 — observation, en deux temps.**

- **Avant le DROP — garde de lecture.** On compare `seq_scan` et `idx_scan` au repère de lecture. Les
  exports vont les faire bouger : un nouveau repère **T1** est donc pris après eux, et la migration
  refuse de s'exécuter si la table a été lue depuis (garde G3, §9).
- **Après le DROP — 48 h (D4).** Aucun redimensionnement du disque pendant cette fenêtre. On surveille :
  - les erreurs PostgreSQL `42P01` visant un objet supprimé (attendu : 0) ;
  - les erreurs runtime et API, comparées à leur niveau d'avant ;
  - la santé des services et les logs ;
  - les cardinaux KEEP du §6.

**R1 — export logique complet, vérifié, avant DROP (D2 = OUI) : la restauration table par table.**

| Élément | Valeur |
|---|---|
| volume estimé | texte `COPY` ≈ 65,5 Go (61,0 Gio) ; compressé gzip-6 ≈ **18,4 Go (17,2 Gio)** |
| méthode d'estimation | échantillon `TABLESAMPLE SYSTEM (0.01)` de 34 616 lignes : 192,9 octets par ligne, taux de compression 0,282. **Estimation, pas mesure.** |
| format | un fichier par DLNR (110), `COPY … TO STDOUT` compressé, plus un manifeste (lignes, sha256) |
| connexion | session (port 5432 ou connexion directe) ; pas le pooler en mode transaction (6543) |
| destination | **hors base et hors machine DEV** (12 Go libres < 17 Gio) — à préparer (étape 4 du §9) |
| vérification exigée (D2) | **checksum** sha256, **taille** et **nombre de lignes** par fichier au manifeste ; lignes par DLNR = `total_brut` du registre scellé ; **restauration testée** d'un DLNR sur une base jetable |

**R1-bis — artefact scellé des critères (D1-B)**, indépendant de R1 : voir §5. Il permet de restaurer
`source_linkage_criteria` seule, sans rejouer les 17 Gio.

Procédure de restauration :

1. recréer la table (DDL de l'annexe A) sans ses index ;
2. `COPY … FROM` fichier par fichier, en contrôlant les lignes par DLNR contre le manifeste ;
3. recréer la PK, la clé unique et les 2 index, puis `ANALYZE` ;
4. ne jamais faire reculer la séquence partagée : `last_value` est déjà ≥ `max(id)` ;
5. si les critères doivent revenir : recréer leur séquence (annexe A.3), leur table depuis R1-bis,
   puis leur FK ;
6. recréer les 3 vues (DDL, options et droits en annexe A).

Il faut ≈ 90 Gio libres. Ils le restent tant que le disque n'est pas redimensionné. **Après un upgrade
qui le ramène à ≈ 1,2 × 150 Gio, une restauration complète sur place ne tiendrait plus.** D'où D4 :
aucun redimensionnement pendant l'observation, et la réflexion sur le disque seulement après. La durée
de restauration n'est pas mesurée : si un délai de reprise est exigé, la mesurer d'abord sur une base
jetable.

**R2 — sauvegardes Supabase : BLOQUANT AVANT DROP (D3).** Restaurer le projet sur place effacerait
toutes les écritures postérieures (commandes, etc.) : ce n'est pas un rollback de table. Une
restauration vers un **nouveau projet**, suivie d'un export de la seule table, le serait.

Non vérifiable depuis cette session (pas d'accès au dashboard). À prouver par l'owner, **sans quoi
aucun GO** :

- la rétention ;
- la PITR ;
- la restauration vers un nouveau projet ;
- la fenêtre de restauration effectivement disponible.

**Ce qui n'est pas une voie de restauration** : un rejeu depuis l'archive ne recrée que la part C1
(29,40 %). C2, C3 et C4B ne se reconstruisent pas, et aucune reconstruction n'est prévue.

## 9. Séquence d'exécution — fixée par l'owner le 2026-09-11

| # | Étape | Porte |
|---|---|---|
| 1 | PR de ce plan, un seul fichier | owner |
| 2 | merge | owner |
| 3 | **vérifier D3** : sauvegardes Supabase — rétention, PITR, restauration vers nouveau projet, fenêtre disponible | **bloquant** |
| 4 | préparer la destination externe des exports (hors base, hors machine DEV) | GO owner « sauvegardes/exports » |
| 5 | export complet de `source_linkages` (R1) | idem |
| 6 | export scellé de `source_linkage_criteria` (R1-bis) | idem |
| 7 | vérifier restauration, checksums et comptes ; prendre le repère de lecture T1 | preuve versionnée |
| 8 | revenir devant l'owner pour le **GO nominatif D5** | **owner** |
| 9 | seulement alors, migration DROP (squelette ci-dessous), relue en PR | **D5** |
| 10 | observation 48 h (D4) : aucun redimensionnement disque ; lectures et runtime, erreurs, logs | mesure |
| 11 | seulement après : réflexion sur le redimensionnement du disque | owner |

La régénération de `packages/database-types` (2 vues retirées) accompagne l'étape 9 : c'est une
projection, jamais éditée à la main.

Squelette de l'étape 9, dans la forme de `20260907_tecdoc_api_surface_lockdown.sql` (pas de `BEGIN` :
le runner ouvre la transaction). **Ce n'est pas un fichier de migration** : il ne figure dans aucune
PR tant que D5 n'est pas donné.

```sql
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $guard$
DECLARE n_dlnr int; v_max int; v_ins bigint; v_upd bigint; v_del bigint; v_seq bigint; v_idx bigint; n_dep int;
BEGIN
  -- G1 : les 110 DLNR scelles, et eux seuls
  WITH RECURSIVE d AS (
    (SELECT source_dlnr FROM tecdoc_map.source_linkages ORDER BY source_dlnr LIMIT 1)
    UNION ALL
    SELECT (SELECT s.source_dlnr FROM tecdoc_map.source_linkages s WHERE s.source_dlnr > d.source_dlnr ORDER BY 1 LIMIT 1)
      FROM d WHERE d.source_dlnr IS NOT NULL)
  SELECT count(*) INTO n_dlnr FROM d WHERE source_dlnr IS NOT NULL;
  IF n_dlnr <> 110 THEN RAISE EXCEPTION 'ABORT G1 : % DLNR au lieu de 110', n_dlnr; END IF;

  -- G2 : aucune ecriture depuis la preuve
  SELECT max(source_linkage_id) INTO v_max FROM tecdoc_map.source_linkages;
  SELECT n_tup_ins, n_tup_upd, n_tup_del INTO v_ins, v_upd, v_del
    FROM pg_stat_user_tables WHERE relid = 'tecdoc_map.source_linkages'::regclass;
  IF v_max <> 518352249 OR v_ins <> 507209168 OR v_upd <> 0 OR v_del <> 0 THEN
    RAISE EXCEPTION 'ABORT G2 : la table a change depuis la preuve (max=%, ins=%, upd=%, del=%)', v_max, v_ins, v_upd, v_del;
  END IF;

  -- G3 : aucune lecture depuis le repere T1. <T1_…> = valeurs litterales a figer a l'etape 7 ;
  -- non remplacees, elles font echouer la migration a l'analyse (fermee par defaut).
  SELECT seq_scan, idx_scan INTO v_seq, v_idx FROM pg_stat_user_tables WHERE relid = 'tecdoc_map.source_linkages'::regclass;
  IF v_seq <> <T1_SEQ_SCAN> OR v_idx <> <T1_IDX_SCAN> THEN RAISE EXCEPTION 'ABORT G3 : lecture depuis T1'; END IF;

  -- G4 : dependances normales exactement celles du plan (3 vues + 1 FK). DISTINCT obligatoire :
  -- une vue s'inscrit une fois par colonne lue (mesure : 5 lignes brutes pour 4 objets).
  SELECT count(DISTINCT (classid, objid)) INTO n_dep FROM pg_depend
   WHERE refclassid = 'pg_class'::regclass AND refobjid = 'tecdoc_map.source_linkages'::regclass AND deptype = 'n';
  IF n_dep <> 4 THEN RAISE EXCEPTION 'ABORT G4 : % dependances normales au lieu de 4', n_dep; END IF;
END
$guard$;

DROP VIEW public.v_tecdoc_unlinked_pieces_reason;
DROP VIEW public.v_tecdoc_dlnr_reconciliation;
DROP VIEW tecdoc_map.v_tecdoc_dlnr_reconciliation;

-- D1-B (retenue) : artefact scelle des criteres verifie AVANT cette migration (etape 6-7)
DROP TABLE tecdoc_map.source_linkage_criteria;
DROP SEQUENCE tecdoc_map.source_linkage_criteria_id_seq;

DROP TABLE tecdoc_map.source_linkages;  -- RESTRICT : toute dependance imprevue fait echouer la migration
-- tecdoc_map.source_linkages_id_seq CONSERVEE : defaut de tecdoc_rebuild.source_linkages
```

Notes sur ce squelette :

- **squawk** : `ban-drop-table` est actif (`fail_on_violations = true`). L'exemption doit citer le
  verdict de la règle, la décision owner et les preuves (garde-fous, passe 5). On ne la pose pas
  sans cela.
- **G4** compte les dépendances `n` mesurées : 3 règles `_RETURN` de vues + 1 FK. Il s'évalue avant
  toute suppression, donc la FK des critères est encore là. Il faut le recompter à l'étape 7.

**Contrôles immédiats après l'étape 9** (avant la fenêtre de 48 h) :

- `to_regclass` renvoie NULL pour les objets supprimés ;
- `pg_database_size` a baissé d'≈ 97,0 Go (tables et index des deux relations) ;
- la séquence partagée et `tecdoc_rebuild.source_linkages` sont intactes ;
- les cardinaux du §6 sont inchangés ;
- `resolve_type_id_remap` répond (appelée par `vehicle-rpc.service.ts`) ;
- PostgREST est sain après le rechargement du cache de schéma.

## 10. Décisions owner — fixées le 2026-09-11

| # | Décision de l'owner | Exigences |
|---|---|---|
| **D1** | `source_linkage_criteria` → **B : exporter puis supprimer** | export scellé **avant** le DROP ; clé métier et données nécessaires à la restauration conservées ; petit artefact indépendant de l'export complet, comme C4C |
| **D2** | export complet de `source_linkages` → **OUI** | hors base, hors machine DEV ; checksum, taille et nombre de lignes ; restauration testable |
| **D3** | sauvegardes Supabase → **BLOQUANT AVANT DROP** | dans le dashboard : rétention, PITR, restauration vers nouveau projet, fenêtre disponible ; aucun GO tant que ce n'est pas prouvé |
| **D4** | fenêtre d'observation → **48 h après le DROP** | aucun redimensionnement disque pendant la fenêtre ; lectures et runtime, erreurs, logs |
| **D5** | GO de la migration → **séparé, PAS DONNÉ** | — |

**Choix techniques validés par l'owner** : séquence `source_linkages_id_seq` → KEEP ·
`source_linkage_criteria` → export avant suppression.

**Statut** : `source_linkages` = SAFE_DROP_CANDIDATE · **DROP réel = HOLD**. Le prochain GO attendu
n'est pas le DROP : c'est celui de préparer et vérifier les sauvegardes et les exports (étapes 3 à 7).

_Aucune action prise : aucun `DROP`, `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE`, `VACUUM`, export,
ni changement de compute. Ce document mesure et prépare._

## Annexe A — DDL capturé (restauration)

Capturé le 2026-09-11 depuis le catalogue (`pg_attribute`, `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_viewdef`). Ordre de restauration : table → données → contraintes et index → FK des critères → vues.

### A.1 `tecdoc_map.source_linkages`

```sql
CREATE TABLE tecdoc_map.source_linkages (
  source_linkage_id integer NOT NULL DEFAULT nextval('tecdoc_map.source_linkages_id_seq'::regclass),
  source_artnr character varying(22) NOT NULL,
  source_dlnr integer NOT NULL,
  pg_id_source integer NOT NULL,
  source_vknzielart smallint NOT NULL,
  source_vknzielnr_raw character(9) NOT NULL,
  source_vknzielnr integer NOT NULL,
  target_internal_id integer,
  rtp_target_kind character varying(20),
  deduplicated boolean NOT NULL DEFAULT false,
  source_business_key character(64) NOT NULL,
  batch_id integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE tecdoc_map.source_linkages ADD CONSTRAINT source_linkages_artnr_dlnr_pgid_vknzielart_vknzielnr_key UNIQUE (source_artnr, source_dlnr, pg_id_source, source_vknzielart, source_vknzielnr);
ALTER TABLE tecdoc_map.source_linkages ADD CONSTRAINT source_linkages_pkey PRIMARY KEY (source_linkage_id);
CREATE INDEX idx_sl_dlnr_artnr ON tecdoc_map.source_linkages USING btree (source_dlnr, source_artnr);
CREATE INDEX idx_sl_pg_id_source_dlnr ON tecdoc_map.source_linkages USING btree (pg_id_source, source_dlnr) WHERE (source_vknzielart = 2);
```

### A.2 `tecdoc_map.source_linkage_criteria` (utile seulement si D1-A ou D1-B, puis restauration)

```sql
CREATE TABLE tecdoc_map.source_linkage_criteria (
  id integer NOT NULL DEFAULT nextval('tecdoc_map.source_linkage_criteria_id_seq'::regclass),
  source_linkage_id integer NOT NULL,
  source_kritnr integer NOT NULL,
  source_kritwert character varying(200),
  source_business_key character(64) NOT NULL,
  batch_id integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE tecdoc_map.source_linkage_criteria ADD CONSTRAINT source_linkage_criteria_pkey PRIMARY KEY (id);
ALTER TABLE tecdoc_map.source_linkage_criteria ADD CONSTRAINT source_linkage_criteria_source_linkage_id_fkey FOREIGN KEY (source_linkage_id) REFERENCES tecdoc_map.source_linkages(source_linkage_id);
ALTER TABLE tecdoc_map.source_linkage_criteria ADD CONSTRAINT source_linkage_criteria_source_linkage_id_source_kritnr_sou_key UNIQUE (source_linkage_id, source_kritnr, source_kritwert);
CREATE INDEX idx_slc_source_linkage_id ON tecdoc_map.source_linkage_criteria USING btree (source_linkage_id);
```

### A.3 Séquences

| séquence | last_value au 2026-09-11 | utilisée par | sort |
|---|---:|---|---|
| `tecdoc_map.source_linkages_id_seq` | 520 960 875 | `tecdoc_map.source_linkages`, `tecdoc_rebuild.source_linkages` | **KEEP** — ne jamais la recréer ni la faire reculer |
| `tecdoc_map.source_linkage_criteria_id_seq` | 1 616 353 | `tecdoc_map.source_linkage_criteria` | supprimée avec sa table (D1-B) |

Pour restaurer les critères, recréer d'abord leur séquence :

```sql
CREATE SEQUENCE tecdoc_map.source_linkage_criteria_id_seq START 1616354;
```

### A.4 Vues

**`tecdoc_map.v_tecdoc_dlnr_reconciliation`** — options : `aucune` · droits : `aucun (propriétaire seul)`

```sql
CREATE VIEW tecdoc_map.v_tecdoc_dlnr_reconciliation AS
 SELECT sm.dlnr,
    pm.pm_name,
    pm.pm_display,
    (EXISTS ( SELECT 1
           FROM tecdoc_raw.t400
          WHERE (t400.col_2 = (sm.dlnr)::text)
         LIMIT 1)) AS has_t400,
    (EXISTS ( SELECT 1
           FROM tecdoc_map.source_linkages
          WHERE (source_linkages.source_dlnr = sm.dlnr)
         LIMIT 1)) AS has_sl,
    ( SELECT count(*) AS count
           FROM pieces
          WHERE ((pieces.piece_pm_id = pm.pm_id) AND (pieces.piece_year = 2025))) AS pieces_2025
   FROM (__tecdoc_supplier_mapping sm
     JOIN pieces_marque pm ON ((pm.pm_id = sm.sup_pm_id)))
  WHERE (sm.dlnr IS NOT NULL)
  ORDER BY pm.pm_display DESC, pm.pm_name;
```

**`public.v_tecdoc_dlnr_reconciliation`** — options : `security_invoker=true` · droits : `{postgres=arwdDxtm/postgres,dev_readonly=r/postgres}`

```sql
CREATE VIEW public.v_tecdoc_dlnr_reconciliation WITH (security_invoker=true) AS
 SELECT sm.dlnr,
    pm.pm_name,
    pm.pm_display,
    (EXISTS ( SELECT 1
           FROM tecdoc_raw.t400
          WHERE (t400.col_2 = (sm.dlnr)::text)
         LIMIT 1)) AS has_t400,
    (EXISTS ( SELECT 1
           FROM tecdoc_map.source_linkages
          WHERE (source_linkages.source_dlnr = sm.dlnr)
         LIMIT 1)) AS has_sl,
    ( SELECT count(*) AS count
           FROM pieces
          WHERE ((pieces.piece_pm_id = pm.pm_id) AND (pieces.piece_year = 2025))) AS pieces_2025
   FROM (__tecdoc_supplier_mapping sm
     JOIN pieces_marque pm ON ((pm.pm_id = sm.sup_pm_id)))
  WHERE (sm.dlnr IS NOT NULL)
  ORDER BY pm.pm_display DESC, pm.pm_name;
```
```sql
REVOKE ALL ON public.v_tecdoc_dlnr_reconciliation FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_tecdoc_dlnr_reconciliation TO dev_readonly;
```

**`public.v_tecdoc_unlinked_pieces_reason`** — options : `security_invoker=true` · droits : `{postgres=arwdDxtm/postgres,dev_readonly=r/postgres}`

```sql
CREATE VIEW public.v_tecdoc_unlinked_pieces_reason WITH (security_invoker=true) AS
 SELECT p.piece_id,
    p.piece_ref,
    pm.pm_name,
    pg.pg_alias,
        CASE
            WHEN (NOT (EXISTS ( SELECT 1
               FROM tecdoc_map.article_registry ar
              WHERE (ar.piece_id = p.piece_id)))) THEN 'no_registry'::text
            WHEN (NOT (EXISTS ( SELECT 1
               FROM (tecdoc_map.source_linkages sl
                 JOIN tecdoc_map.article_registry ar ON ((((ar.source_artnr)::text = (sl.source_artnr)::text) AND (ar.source_dlnr = sl.source_dlnr))))
              WHERE (ar.piece_id = p.piece_id)))) THEN 'no_source_linkage'::text
            WHEN (NOT (EXISTS ( SELECT 1
               FROM pieces_relation_type prt
              WHERE (prt.rtp_piece_id = p.piece_id)))) THEN 'no_prt_linkage'::text
            WHEN (NOT (EXISTS ( SELECT 1
               FROM (pieces_relation_type prt
                 JOIN auto_type at2 ON (((at2.type_id_i = prt.rtp_type_id) AND (at2.type_display = '1'::text))))
              WHERE (prt.rtp_piece_id = p.piece_id)))) THEN 'linkage_to_hidden_vehicle'::text
            ELSE 'unknown'::text
        END AS reason
   FROM ((pieces p
     JOIN pieces_marque pm ON ((pm.pm_id = p.piece_pm_id)))
     LEFT JOIN pieces_gamme pg ON ((pg.pg_id = p.piece_pg_id)))
  WHERE ((p.piece_year = 2025) AND (p.piece_display = false) AND (NOT (EXISTS ( SELECT 1
           FROM v_tecdoc_activation_candidates vc
          WHERE (vc.piece_id = p.piece_id)))));
```
```sql
REVOKE ALL ON public.v_tecdoc_unlinked_pieces_reason FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_tecdoc_unlinked_pieces_reason TO dev_readonly;
```
