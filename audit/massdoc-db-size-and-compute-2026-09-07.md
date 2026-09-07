# Où sont les 240 Go — et ce qui est réellement récupérable

> Mesuré le 2026-09-07 sur le projet live, **lecture seule** : aucune mutation n'a été
> faite pour produire ce document. Sources : `pg_class`, `pg_stat_user_tables`,
> `pg_stat_user_indexes`, `pg_stat_database`. Les compteurs de parcours courent depuis
> le **2025-06-06** (`stats_reset`), soit 15 mois — fenêtre suffisante pour conclure.

## Verdict en une ligne

**Garder XL.** Et la cible « ≤ 185 Go avant de descendre en Large » ne produit
mécaniquement aucune économie tant qu'un upgrade de version Postgres ne suit pas :
**le disque Supabase ne rétrécit jamais**. L'ordre est donc imposé — libérer, puis
upgrader, puis seulement décider du compute.

## 1. Où sont les 240 Go

| schéma | total | heap | index | rôle |
|---|---|---|---|---|
| `public` | **123 Go** | 59 Go | **64 Go** | applicatif |
| `tecdoc_map` | **91 Go** | 57 Go | 34 Go | couche de mapping TecDoc |
| `tecdoc_raw` | **19 Go** | 18 Go | 0,9 Go | import TecDoc brut |
| `storage` | 2,3 Go | | | métadonnées objets |
| `tecdoc_doc` | 2,1 Go | | | |
| `tecdoc_rebuild` | 0,9 Go | | | pipeline de reconstruction |
| `_archive` | 0,6 Go | | | 70 relations archivées |
| autres (9) | < 0,5 Go | | | |

**Fait structurel** : `public` porte **plus d'index (64 Go) que de données (59 Go)**.

### Les 4 tables qui font 78 % du volume

| table | total | heap | index | lignes | tuples morts |
|---|---|---|---|---|---|
| `tecdoc_map.source_linkages` | **90 Go** | 56 Go | 34 Go | 339 M | 0,0 % |
| `public.pieces_relation_type` | **49 Go** | 27 Go | 22 Go | 368 M | 7,9 % |
| `public.pieces_relation_criteria` | **30 Go** | 12 Go | 18 Go | 158 M | 0,8 % |
| `tecdoc_raw.t400` | **17 Go** | 16 Go | 0,9 Go | 139 M | 0,0 % |
| **sous-total** | **186 Go** | | | | |

Puis, par ordre : `___xtr_msg` 10 Go · `pieces_ref_search` 10,1 Go ·
`pieces_criteria` 9,7 Go · `pieces_media_img` 3,3 Go · `pieces_ref_oem` 3,1 Go.

## 2. L'hypothèse « tuples morts » : mesurée, elle ne tient pas

Les trois candidats cités (`media`, `pieces_criteria`, `pieces_relation_type`) ont bien
une proportion notable de tuples morts. Convertie en octets :

| table | morts | % | espace mort estimé |
|---|---|---|---|
| `pieces_relation_type` | 31,6 M | 7,9 % | ~2,1 Go |
| `pieces_criteria` | 3,3 M | 15,6 % | ~271 Mo |
| `pieces_media_img` | 1,8 M | 16,0 % | ~120 Mo |
| `storage.objects` | 38 k | 5,0 % | ~70 Mo |
| `tecdoc_map.article_registry` | 417 k | 11,4 % | ~60 Mo |
| autres | | | ~50 Mo |
| **total** | | | **≈ 2,7 Go** |

**≈ 2,7 Go, pas 55 Go.** Et un `VACUUM` ordinaire ne rend pas cet espace au système :
il le marque réutilisable *dans* le fichier. Seul un `VACUUM FULL` / `pg_repack`
réécrit la table — au prix d'un `ACCESS EXCLUSIVE` (donc indisponible sur ces
volumes) et d'un pic disque de 2× la table pendant la copie, sur un disque qui ne
redescendra pas ensuite. Le pourcentage de tuples morts est donc un signal de santé
du vacuum, pas un gisement d'espace.

## 3. La contrainte qui commande tout : le disque ne rétrécit pas

Documentation Supabase, vérifiée : *« You can increase disk size but cannot decrease
it. »* L'auto-scaling ajoute **+50 % irréversibles** dès 90 % d'occupation. Seul un
**upgrade de version Postgres** redimensionne le disque à ≈ 1,2 × la taille de la base
(nouvelle instance + migration + brève indisponibilité).

Conséquence directe sur le plan proposé : passer de 240 Go à 185 Go **sans** upgrade
ne change ni la facture disque, ni le provisionnement. L'ordre est :
**libérer la donnée froide → upgrade Postgres → décider du compute.**

## 4. Ce qui est réellement récupérable, par ordre de certitude

### 4.1 Index prouvés redondants — ~2,7 Go, risque nul, prêt

Migration `20260907_drop_provably_redundant_indexes` — **pas encore dans le dépôt** :
le gate `block-new` (ADR-058 PR-G) la refuse faute de glob d'ownership, et
`.spec/00-canon/**` est owner-only. Le bloc exact à ajouter est en §7. Critère strict : chaque index retiré a un frère qui le couvre
**strictement**, à coût de parcours comparable.

| index | taille | parcours / 15 mois | couvert par |
|---|---|---|---|
| `idx_pc_piece_id_covering` | 1 796 Mo | **128** | PK `pieces_criteria` + `idx_pc_piece_cri` |
| `idx____xtr_msg_msg_id` | 728 Mo | 1 405 | PK `___xtr_msg_pkey`, même colonne |
| `idx_pc_cri_id` | 270 Mo | 85 476 | `idx_pieces_criteria_cri_id`, doublon exact |
| `idx_pieces_ref_search_piece_id_i_kind` | 0 (INVALIDE) | 0 | — reliquat, piège |

Aucun de ces index n'est nommé dans une migration ni dans le code : tous créés hors
bande. Les retirer par migration les ramène sous gouvernance.

### 4.2 Index à faible usage — ~3,3 Go, à observer avant de trancher

Écartés de la migration **volontairement** : ce sont des préfixes étroits d'index bien
plus larges. Le planificateur préfère à raison l'index étroit ; les retirer
échangerait du disque contre des parcours plus chers. À décider après observation,
pas au jugé.

| index | taille | parcours / 15 mois | pourquoi on hésite |
|---|---|---|---|
| `idx_pieces_relation_criteria_rcp_type_id` | 1 756 Mo | 28 504 | préfixe de la PK, mais la PK fait 15 Go |
| `idx_pieces_ref_search_kind` | 484 Mo | 996 | faible cardinalité ; sans lui, seq scan de 5 Go |
| `idx_pieces_criteria_piece_id` | 380 Mo | 72 039 | usage réel |
| `idx_pieces_criteria_pg_id` | 272 Mo | 5 195 | préfixe d'un index couvrant |
| `idx_pieces_criteria_display` | 254 Mo | 1 804 | faible cardinalité |
| `idx_pieces_criteria_piece_id_i_display` | 198 Mo | 1 667 | |

`pieces_media_img` est **exclu de toute liste de nettoyage** — zone interdite (images,
tables de sauvegarde = piste forensique). Ses 2,5 Go d'index ne sont pas un candidat.

### 4.3 Le seul endroit où 55 Go existent : les couches TecDoc

`tecdoc_map` + `tecdoc_raw` = **110 Go**, soit 46 % de la base. `source_linkages`
(90 Go) et `t400` (17 Go) n'ont pas bougé depuis mars 2026 (dernier vacuum/analyze
2026-03-2x) : ce sont des couches d'import statiques, pas des tables vivantes.

**C'est le seul gisement à l'échelle demandée.** Le préalable n'est pas de mesurer le
bloat, c'est d'**établir la reproductibilité** : ces 110 Go sont-ils régénérables depuis
les fichiers sources TecDoc ? Si oui, l'archivage hors base devient une option
gouvernée. Si non, ils sont de la donnée primaire et le sujet est clos.
L'existence de `tecdoc_rebuild` (946 Mo, pipeline de reconstruction) suggère que la
question a déjà une réponse partielle — c'est par là qu'il faut commencer, pas par le
bloat.

### 4.4 Le levier structurel de fond : 64 Go d'index pour 59 Go de données

Dans `public`, l'index pèse plus que la donnée. Deux ratios pathologiques :
`pieces_criteria` = 1,7 Go de heap pour **8,0 Go d'index** (4,6×) ;
`pieces_relation_criteria` = 12 Go de heap pour 18 Go d'index, dont une PK de 15 Go
sur 6 colonnes. Une revue d'index à l'échelle de `public` — pas au cas par cas — est
le plus gros levier après la question TecDoc.

## 5. La décision compute

D'accord pour **garder XL**, avec une raison de plus que celles déjà posées.

| élément | mesure | lecture |
|---|---|---|
| taille base | 240 Go | Large est recommandé jusqu'à ~200 Go |
| cache hit | 94,17 % | ~6 % des lectures vont au disque, déjà perfectible |
| RAM XL → Large | 16 → 8 Go | `shared_buffers` 4 → 2 Go sur un working-set de 123 Go |
| connexions actives | 1 / 240 | la charge n'est effectivement pas le sujet |
| redimensionnement | indisponibilité | coût non nul pour un gain nul sans upgrade |

Le point décisif n'est pas le CPU — c'est la mémoire. À 94,17 % de cache hit sur 16 Go,
diviser la RAM par deux augmente mécaniquement les lectures disque sur une base qui
n'aura pas rétréci. La faible activité actuelle masquerait la dégradation ; elle
réapparaîtrait au premier pic.

## 6. Prochaine étape utile

Non pas « mesurer le bloat » — c'est fait, il vaut 2,7 Go — mais **statuer sur la
reproductibilité des 110 Go TecDoc**. C'est la seule question dont la réponse change
l'ordre de grandeur. Les 2,7 Go d'index redondants partent en parallèle, sous mot
owner, parce qu'ils sont gratuits.

_Aucune action prise. Ce document mesure et instruit ; il ne tranche pas._

## 7. Ce qui attend un geste owner

**a) Glob d'ownership** pour livrer la migration d'hygiène. Le gate `block-new` la
refuse tant que `.spec/00-canon/repository-registry/ownership.yaml` (owner-only) ne
porte pas le chemin. Bloc à insérer, calqué sur les entrées voisines :

```yaml
  # Hygiène d'index : retrait d'index prouvés redondants, créés hors bande.
  # Read-only côté produit, DROP = zone STOP → mot owner à l'application.
  - glob: backend/supabase/migrations/*_drop_provably_redundant_indexes*.sql
    domain: D13
    owner: '@ak125'
    sourceConfidence: high
    risk: low
```

Les deux fichiers sont écrits et lintés (gate A5 vert, squawk 0 problème) ; ils
attendent uniquement ce glob.

**b) Application**, une fois la migration livrée :
`./ledger-reconcile.sh apply 20260907_drop_provably_redundant_indexes`.

**c) Reproductibilité TecDoc** — la seule question qui change l'ordre de grandeur (§4.3).
