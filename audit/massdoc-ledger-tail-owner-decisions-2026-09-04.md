# Queue du ledger — les 2 décisions owner restantes

> Mesuré le 2026-09-04 sur le projet live. Lecture seule : aucune mutation n'a été faite
> pour produire ce document. Après #1382/#1391/#1392/#1393, 5 migrations restent en
> attente ; 2 sont prêtes techniquement, 1 était en `failed` (incident du 2026-09-04, correctif
> #1395 mergé puis **reprise réussie** le 2026-09-07, run 34080251591), 2 attendent un arbitrage **produit/données** qui n'est pas le mien. Ce document instruit ces 2 arbitrages, il ne les tranche pas.

## État de la queue

| migration | statut | ce qui manque |
|---|---|---|
| `20260529_xtr_msg_crm_indexes` | **`applied`** 2026-09-07 (run 34080251591, `--retry`, 173 516 ms) | CLOS — 2 index `valid/ready/live`, note ledger = ancien échec (run 33839602437, `statement_timeout=60s` hérité du rôle `postgres`) ; la file n'est plus bloquée (0 failed / 0 applying) |
| `20260605_vlevel_capture_db_only_functions` | **`applied`** 2026-09-07 (run 34084270158, `--only`, 277 ms) | CLOS — vérifié contre l'état d'avant : `proconfig`/`proacl` conformes, 3 fonctions inchangées + COMMENT versionné |
| `20260611_quality_features_r3_guide_semantics` | **`applied`** 2026-09-07 (run 34084270158, `--only`, 289 ms) | CLOS — vérifié contre l'état d'avant : `proconfig`/`proacl` conformes, `get_page_quality_features` 59 → 66 colonnes, ACL reconstruite ; types générés à resynchroniser (PR dédiée) |
| `20260520_supplier_truth_v1` | bloquée | décision produit (§1) |
| `20260623_seo_event_log_r2_order_placed_idempotency` | bloquée | décision données (§2) |

---

## §1 — `20260520_supplier_truth_v1` : décision produit

**Ce que fait la migration.** 3 tables neuves + 2 index. Strictement additif :
`supplier_inventory_snapshots` (Layer 2, append-only), `supplier_truth_projection`
(Layer 3, 1 ligne canonique par `piece_id`), `supplier_runtime_profile`. RLS activé,
service-role uniquement, aucune politique anon. Ne touche ni SEO/URLs, ni paiement,
ni `piece_display`.

**État réel mesuré.**

| fait | vérification |
|---|---|
| les 3 tables sont **absentes** | `to_regclass` → `false` ×3 |
| `SupplierTruthModule` est **chargé dans l'app** | `app.module.ts:242` |
| aucun feature flag ne le garde | aucun `supplier.?truth` dans `feature-flags.service.ts` |
| aucun code ne gère `42P01` | `git grep '42P01'` côté supplier-truth → vide |

Lecteurs réels des tables absentes : `supplier-truth.repository.ts`,
`supplier-sync.processor.ts`, `workers/run-supplier-sync-once{,.guard}.ts`.
Le module est décrit en commentaire comme « read-only observability … the inert-gated
sync runtime lives in WorkerModule ».

**Ce qui est en jeu.** Appliquer est techniquement à faible risque (création pure, rien
d'existant n'est touché) et supprime un `42P01` latent sur la surface d'observabilité
admin. Ne pas appliquer laisse le module chargé au-dessus de tables inexistantes, sans
gestion d'erreur dédiée.

**La question owner** — voulez-vous la surface supplier-truth vivante ? C'est un choix
produit sur le chantier Supplier Availability Truth V1, pas un choix technique.

---

## §2 — `20260623_seo_event_log_r2_order_placed_idempotency` : décision données

**Ce que fait la migration.** Un `CREATE UNIQUE INDEX` partiel sur
`__seo_event_log ((payload->>'order_id')) WHERE event_type = 'r2_order_placed'` —
défense en profondeur derrière l'exactly-once de `mark_order_paid_atomic.wasPaid`.

**L'en-tête du fichier est périmé.** Il affirme que le sous-ensemble « compte 0 ligne
aujourd'hui ». Mesure du 2026-09-04 : **15 lignes, 7 `order_id` distincts**, du
2026-07-22 au 2026-09-03.

| order_id | n | fenêtre | écart | `revenue_cents` | `item_count` | `session_id` | `referrer` |
|---|---|---|---|---|---|---|---|
| `954687` | 1 | 08-08 | — | 25597 | 1 | `1025fe01…` | **other** |
| `954687` | 6 | 08-11 → 08-25 | 16 j | 25597 | 1 | `1025fe01…` | **direct** |
| `9S6209586J404615P` | 1 | 07-22 | — | 4030 | 1 | `455fb28b…` | **other** |
| `9S6209586J404615P` | 2 | 07-24 → 07-27 | 4 j | 4030 | 1 | `455fb28b…` | **direct** |
| 5 autres | 1 chacun | 08-03 → 09-03 | — | — | — | — | — |

**Diagnostic.** Deux `order_id` seulement sont dupliqués, et ils sont anciens : les cinq
commandes les plus récentes — dont celle du 2026-09-03 — sont propres. Montant, panier et
`session_id` sont **identiques** au sein de chaque groupe ; seul `referrer` bascule de
`other` à `direct`. Des écarts de 4 et 16 **jours** excluent la redélivrance d'événement
ou le callback rejoué (qui dupliquent en secondes). C'est la signature d'un **beacon
client re-tirant lors d'un retour direct sur la page de confirmation** — exactement le
« lossy client beacon » que l'en-tête dit vouloir remplacer.

**Impact chiffré sur le funnel** : 6 × 255,97 € + 2 × 40,30 € = **1 616,42 €** de
chiffre d'affaires fantôme sur juillet-août.

**Pourquoi la migration ne peut pas s'appliquer telle quelle** : l'index est UNIQUE et
les doublons existent → échec au build (23505).

**Contexte d'activation** — `feature-flags.service.ts` fixe l'ordre :
*« apply the idempotency-index migration → land the payments `emit(ORDER_EVENTS.PAID)`
→ flip this flag »*. `FUNNEL_SERVER_EMIT_ENABLED` vaut **`false`** : le beacon client est
toujours l'émetteur actif. Cette migration est l'étape 1 sur 3.

**Effet de bord à connaître si l'index est construit avant le basculement.** Le chemin du
beacon (`funnel-events.controller.ts` `@Post('event')` → `funnelEvents.record()`) ne gère
**pas** le 23505 — seul `recordOnce()`, utilisé par le listener serveur, le traite comme
un skip bénin. Conséquence : pas de 500 pour l'utilisateur (le contrôleur est `@HttpCode(202)`
et renvoie `{ok:false}`), mais **un log de niveau `error` à chaque re-tir**, mal classé.

### Options

| | option | histoire des ventes | débloque ? | remarque |
|---|---|---|---|---|
| **A** | supprimer les 8 lignes surnuméraires | **réécrite** | oui | heurte « never DELETE sales history » |
| **B** | ajouter un plancher de date au prédicat partiel (`AND created_at >= '<bascule>'`) | **intacte** | oui | la garde protège l'avenir ; les doublons passés restent visibles |
| **C** | laisser en attente jusqu'au retrait du beacon | intacte | non | la sonde de fraîcheur reste rouge |

**Recommandation : B.** Elle est la seule qui débloque sans réécrire l'historique des
ventes, et elle place la garde exactement là où le nouvel émetteur serveur opère. Le
CA fantôme de juillet-août reste alors un fait visible à corriger séparément — jamais en
silence. **B implique une modification du fichier de migration** : c'est un changement de
design sur un chantier gouverné (Commerce-Loop V1 PR-A), donc votre appel, pas le mien.

Si B est retenue, le correctif du chemin beacon (faire passer `record()` par la même
tolérance 23505 que `recordOnce()`) devrait partir dans la même PR — sinon chaque
re-tir produira un faux `error` en log jusqu'au basculement du flag.

## Observations hors file (2026-09-07, vérification adversariale de la clôture de `20260529`) — à arbitrer, aucune action prise

| Objet | Constat (lecture seule, catalogue PROD) | Recommandation |
|---|---|---|
| `idx_xtr_msg_crm_status_active` ↔ `/admin/leads` | Le service (`leads.service.ts`, filtre `msg_crm_status IS NOT NULL` + `count: 'exact'`, tri `msg_date DESC`) n'implique jamais le prédicat partiel `NOT IN ('won','lost')` → l'index n'est utilisé que sur un filtre `status = 'x'` ; la liste par défaut lit `idx____xtr_msg_msg_date` à rebours, le `count` fait un seq scan de 7,9 GB sous le `statement_timeout` 60 s du rôle. Colonnes CRM jamais analysées (dernier autoanalyze 2026-02-17). `msg_date` est de type `text` (tri lexical). | Décision produit : (a) aligner la requête sur « leads actifs » (`NOT IN won/lost`), ou (b) nouvelle migration : prédicat partiel réduit à `msg_crm_status IS NOT NULL` (quelques lignes, couvre liste + count + filtre) ; puis `ANALYZE public.___xtr_msg (msg_crm_status, msg_date, msg_crm_next_follow_up_at)` (owner). |
| `idx_pieces_ref_search_piece_id_i_kind` | Index **INVALIDE** pré-existant (`indisvalid=false`, 0 octet, sur `pieces_ref_search` 5 GB), créé hors migration (aucun fichier ne le porte) — même classe de défaut que l'incident 20260529 ; piège pour un futur `CREATE INDEX IF NOT EXISTS`. | `DROP INDEX CONCURRENTLY` (owner ; DROP = zone STOP), puis recréer par migration gouvernée si l'index est voulu. |
| `idx____xtr_msg_msg_id` | 728 MB, doublon exact de la PK `___xtr_msg_pkey` (`msg_id`) — legacy. | Candidat `DROP INDEX CONCURRENTLY` après vérification `idx_scan` (owner). |
| `20260603_seo_cwv_aggregation_cron.{sql,down.sql}` | Fichiers **non suivis** dans le checkout DEV (commit `01cf3edc2` cité dans le fichier), différents du `20260626_*` appliqué. Hors `origin/main`. | S'ils sont committés, ils deviennent une 5ᵉ migration pending : décider (committer / supprimer). |
| Types générés | **#1401 mergé** (`bade3e8de199`) : resync MCP (278 → 686 tables) + 8 retraits dans les compagnons manuels. Aucun gate CI ne compare les types générés à la base. | CLOS. Suivi à part : `schemas.ts` (Zod, `@generated`) n'est plus reproductible — réparer `generate-zod-schemas.ts` (lire les alias `TableRow<'x'>`) ou retirer l'en-tête `@generated`. |
| Objets `public` déplacés dans `_archive` | 55 des 72 relations disparues du schéma `public` existent encore dans `_archive` (cohorte `__seo_*` / sitemap-v10, `SET SCHEMA`, pas de DROP). Pas de trace de migration dans le repo (DDL hors bande). | Décider : archivage définitif (DROP gouverné par migration) ou restauration si un chemin servi en dépend. |
| 3 RPC appelées mais absentes de `public` | `callRpc('get_stabilize_pages')`, `callRpc('get_sitemap_urls_by_temperature')`, `callRpc('count_sitemap_urls_by_temperature')` (sitemap v10) : fonctions absentes de `public` (0 ligne `pg_proc`), toujours listées dans `rpc.json` (dérivé des migrations, pas de la base). | Même arbitrage que les appels `.from()` morts : retirer les chemins ou recréer par migration. |
| Enum `seo_event_type` | 26 valeurs en base, 27 dans les migrations : `crux_fetch_run` absent (et toute relation `__seo_crux%` absente de tous les schémas). Un insert avec cette valeur → 22P02. | Vérifier si un producteur émet `crux_fetch_run` ; sinon documenter l'écart, sinon migration additive `ADD VALUE IF NOT EXISTS`. |
| Appels runtime à des objets disparus | `.from('__seo_entity_score_v10')` ×3 (`risk-flags-engine`, `sitemap-v10-data`, `sitemap-v10-scoring`) et `.from('v_seo_temperature_stats')` ×2 (`sitemap-v10-scoring`, `sitemap-v10`) : ces objets ont quitté `public` (déplacés dans `_archive`) → 42P01 latent, invisible au typecheck (client non typé `Database`). Les 4 services sont `LIVE` au registry et branchés (`sitemap-unified.controller`, `sitemap-v10.controller`, `seo-dashboard.controller`, `seo-cockpit`) ; non vérifié : si ces méthodes précises sont servies en PROD (logs 42P01 sur la box PROD, action différée). | Décider : chemins morts à retirer ou objets à recréer par migration — zone SEO indexée (sitemap), donc owner. |

---

# État au 2026-09-07 — ce qui est clos, ce qui reste à vous

## Clos par une PR (en attente de CI/merge)

| point | PR | ce qui a été fait |
|---|---|---|
| §2 — idempotence `r2_order_placed` | **#1404** | Option **B** retenue et implémentée : plancher `AND created_at >= '2026-09-01'` sur le prédicat partiel, `DROP INDEX CONCURRENTLY IF EXISTS` avant le `CREATE`, timeouts à 0 explicites. `record()` délègue à `recordOnce()` : un seul insert, une seule politique d'erreur, plus de faux `error` au re-tir du beacon. Le CA fantôme de 1 616,42 € reste visible et intact. |
| Observation `idx_xtr_msg_crm_status_active` | **#1405** | Option **(b)** : les deux prédicats réalignés sur `msg_crm_status IS NOT NULL`, clés `(msg_crm_status, msg_date DESC)` et `(msg_crm_next_follow_up_at)`, plus `ANALYZE public.___xtr_msg (…)` en fin de migration — les colonnes CRM n'avaient pas été analysées depuis le 2026-02-17. |
| Question disque / compute 240 Go | **#1406** | Mesure complète. La contrainte décisive manquait : **le disque Supabase ne rétrécit jamais**. Descendre à 185 Go sans upgrade Postgres ne libère rien. Garder XL est le bon appel, pour une raison de mémoire, pas de disque. |
| Cause racine derrière plusieurs observations ci-dessus | **#1407** | **270 des 300 lignes `applied` du ledger sont des baselines jamais vérifiées.** 24 relations, 10 fonctions, 3 types et 1 valeur d'enum déclarés par des migrations « appliquées » sont absents de tous les schémas ; 10 de ces relations portent 27 appels `.from()` vivants. Les observations « objets déplacés dans `_archive` », « 3 RPC sitemap v10 absentes », « enum `crux_fetch_run` » et « appels runtime à des objets disparus » sont toutes des instances de ce même défaut. |

## §1 `20260520_supplier_truth_v1` — l'arbitrage a une réponse, et elle est « retirer »

Au 2026-09-04 la question était posée comme un choix produit ouvert. La lecture du code
la referme : **le dépôt a déjà tranché, et pas en faveur de ces tables.**

`supplier-truth.repository.ts:16-22` nomme la table canonique et disqualifie explicitement
celles de la migration :

> *Canonical per-supplier price+availability observation timeline (pricing H2, 20260523
> migration) […] This is the SoT observation store the live-portal connectors write to —
> **NOT the (unapplied, parallel) `supplier_inventory_snapshots`**.*

`supplier_offer_snapshot` existe, est partitionnée, porte un trigger anti-mutation, et
c'est elle que le runtime alimente. Les méthodes qui lisent les 3 tables de la migration
sont annotées « Kept for the future » (l.121) et « DEFERRED (H3, not wired) »
(`supplier-sync.processor.ts:18`).

**Donc appliquer la migration créerait une seconde source de vérité parallèle à celle qui
est déjà canonique** — exactement la SoT dupliquée que l'invariant 2 interdit. Le fait que
ce soit « techniquement à faible risque » ne change pas la nature du geste.

**Ce qui reste vraiment à décider**, et qui est bien de votre ressort : les deux routes
`GET /api/admin/supplier-truth/status` et `/projection/:pieceId`
(`supplier-truth.controller.ts`, `@UseGuards(IsAdminGuard)`, surface admin uniquement,
aucune exposition publique ni SEO) lisent `supplier_truth_projection` et
`supplier_runtime_profile`. Tant que ces tables n'existent pas, ces deux routes renvoient
un 42P01. Retirer la migration suppose donc de **retirer aussi ces deux routes**, ou de les
repointer vers `supplier_offer_snapshot`. C'est un choix de surface produit, pas de
plomberie — je ne le prends pas.

## `20260603_seo_cwv_aggregation_cron` — décidé : supprimer, pas committer

Le moteur énumère `MIGRATIONS_DIR.iterdir()` (l.357), **le système de fichiers et non
l'index git**. Ces deux fichiers non suivis comptent donc déjà comme une migration pending
sur la box DEV, alors que la CI, qui part d'un clone propre, ne les voit pas — une
divergence qui n'existe que sur la box.

Ils sont **byte-identiques** à ceux de `origin/feat/cwv-aggregation-cron` (branche poussée,
non mergée) et **supersédés** par `20260626_seo_cwv_aggregation_cron.sql`, appliqué, qui
ajoute les contrôles d'ownership. La suppression est donc sans perte et réversible :

```bash
rm backend/supabase/migrations/20260603_seo_cwv_aggregation_cron.sql \
   backend/supabase/migrations/20260603_seo_cwv_aggregation_cron.down.sql
# récupération à tout moment :
git show origin/feat/cwv-aggregation-cron:backend/supabase/migrations/20260603_seo_cwv_aggregation_cron.sql
```

Je n'ai pas exécuté ce `rm` : la suppression de fichiers de migration est refusée par le
garde-fou d'exécution de la session. La commande ci-dessus est à jouer telle quelle.

## Hygiène d'index — écrite, retenue par le gate `block-new`

`20260907_drop_provably_redundant_indexes.sql` est écrite et lintée (A5 vert, squawk 0).
Elle retire quatre index prouvés inutiles : `idx____xtr_msg_msg_id` (728 Mo, doublon exact
de la PK), `idx_pc_cri_id` (270 Mo, doublon exact), `idx_pc_piece_id_covering` (1 796 Mo,
128 scans en 15 mois) et `idx_pieces_ref_search_piece_id_i_kind` (0 octet, INVALIDE).

Elle ne peut pas être poussée : aucun glob d'`ownership.yaml` ne couvre son nom, et
`ownership.yaml` est owner-only. Le bloc YAML exact à ajouter est en §7 de
`audit/massdoc-db-size-and-compute-2026-09-07.md` (PR #1406). Une fois le glob en place,
la migration part en PR normale, puis `./ledger-reconcile.sh apply 20260907_drop_provably_redundant_indexes`.

## Défaut découvert aujourd'hui — le builder registry n'est pas déterministe vis-à-vis de l'état de build

En régénérant les projections pour #1404/#1405, le rebuild a produit **384 lignes** de
dérive sans rapport avec la PR : les specifiers `@repo/database-types` et `@repo/seo-roles`
réécrits en `packages/*/dist/index.d.ts`. Cause : le builder résout un specifier d'espace de
travail vers un chemin réel **seulement si le `dist` du package existe**. Le runner CI
n'en construit aucun ; une box de dev en a construit certains.

Conséquence : deux machines au même commit produisent deux `files.json` différents. Le step
« Determinism check (V1-2) » ne peut pas l'attraper — il rejoue deux fois dans le **même**
environnement. C'est un vert qui ne prouve pas ce qu'il annonce.

Contournement utilisé ici, et vérifié : mettre les `dist` de côté avant le rebuild reproduit
l'état CI **byte pour byte** — `files.json` → `2cde5d2e…` et `canonical.json` → `e3bde163…`,
exactement les sha256 qu'avait imprimés le runner en échec. Le correctif de fond appartient
au builder et n'a pas été fait ici : hors périmètre, et une garde se répare chez elle.
