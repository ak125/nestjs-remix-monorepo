# Les 113 Go TecDoc : ce qu'ils sont, qui les lit, et ce qui peut sortir

> Mesuré le **2026-09-07** sur le projet live, **lecture seule stricte**. Aucun DDL,
> aucune suppression, aucun `VACUUM`, aucun resize. Toutes les requêtes sont des
> `SELECT` sur les catalogues système, `pg_stat_*` et `pg_stat_statements`.
>
> Ce document **étend** `audit/massdoc-c1-tecdoc-reproducibility-2026-09-02.md`
> (reproductibilité) et `audit/massdoc-db-size-and-compute-2026-09-07.md` (disque et
> compute). Il ne les rejoue pas : il les vérifie, corrige trois points, et traite ce
> qu'aucun des deux ne couvrait — **la dépendance runtime**.

## Le résultat en une phrase

Les couches TecDoc ne sont **atteignables par aucun chemin runtime** : les rôles de
l'API (`anon`, `authenticated`, **et `service_role`**) n'ont pas `USAGE` sur les six
schémas, et aucune ligne du code applicatif ne les nomme. Le site est servi par
`public`, qui est une **projection** de ces couches, pas un lecteur.

## 1. Périmètre réel — six schémas, pas quatre

| schéma | taille | tables | rôle | dernière activité vacuum |
|---|---:|---:|---|---|
| `tecdoc_map` | **91 Go** | 15 + 3 mv + 1 v | mapping source → identités MassDoc | 2026-03-26 |
| `tecdoc_raw` | **19 Go** | 2 | import brut des livraisons | 2026-04-12 |
| `tecdoc_doc` | 2 098 Mo | 3 | images et modules documentaires | 2026-03-22 |
| `tecdoc_rebuild` | 946 Mo | 2 | schéma d'essai de rejeu | 2026-04-13 |
| `tecdoc_norm` | 471 Mo | 7 | normalisation (abandonnée ?) | 2026-03-16 |
| `tecdoc_ext` | 20 Mo | 5 | registres d'appoint | 2026-03-21 |
| **total** | **≈ 113,5 Go** | | | **rien depuis le 2026-04-13** |

Deux schémas manquaient au périmètre annoncé : **`tecdoc_norm`** et **`tecdoc_ext`**.

### Tables ≥ 100 Mo

| table | total | heap | index | lignes |
|---|---:|---:|---:|---:|
| `tecdoc_map.source_linkages` | **90 Go** | 56 Go | 34 Go | 312 M |
| `tecdoc_raw.t400` | **17 Go** | 16 Go | 924 Mo | 139 M |
| `tecdoc_doc.graphics_registry` | 1 982 Mo | 1 285 Mo | 697 Mo | 9,4 M |
| `tecdoc_raw.t232` | 1 770 Mo | 1 770 Mo | 0 | 14,1 M |
| `tecdoc_map.article_registry` | 924 Mo | 522 Mo | 402 Mo | 3,2 M |
| `tecdoc_rebuild.source_linkages` | 662 Mo | 435 Mo | 228 Mo | 2,6 M |
| `tecdoc_map.source_linkage_criteria` | 356 Mo | 198 Mo | 157 Mo | 1,6 M |
| `tecdoc_norm.t200` | 296 Mo | | | 1,9 M |
| `tecdoc_rebuild.pieces_relation_type` | 284 Mo | | | 2,2 M |
| `tecdoc_map.v_projection_scope_linkages` (mv) | 185 Mo | | | 5,3 M |
| `tecdoc_doc.article_info_modules` | 111 Mo | | | 562 k |

Les ~15 autres tables de `tecdoc_map` pèsent **≈ 14 Mo au total** — dont
`type_id_remap` (3 Mo), qui est la seule à compter pour le runtime (§3).

## 2. La chaîne réelle, prouvée depuis le dépôt et la base

```
  SQL-CONVERTED.7z   (6,13 Go, 2 copies, checksum vérifié le 2026-09-07 : OK)
        │             1 198 shards « 400.* » · 1 222 shards « 232.* »
        │
        ├── scripts/tecdoc-mysql-to-csv.py     ◄── ABSENT DU DISQUE ET DE GIT
        │       exigé par 6 scripts : load-t400-active.py · load-all-suppliers{,-v2,-v3}.py
        │       · load-vehicle-tables.py · scripts/tecdoc-import.py (celui-ci EST dans git,
        │       mais il appelle le parseur en sous-processus — il ne l'embarque pas)
        ▼
  tecdoc_raw.t400 / t232            ← COPY par les loaders, idempotent par DLNR
        │
        ▼
  tecdoc_map.source_linkages        ← populate-source-linkages.v2.py, ON CONFLICT DO NOTHING
        │                              puis populate-linkages-genartnr.py
        ▼
  public.pieces_relation_type       ← project-linkages-v3.py / project-prt-remap-batch.py
        │                              (49 Go, 368 M lignes) — C'EST LA TABLE SERVIE
        ▼
  API / site
```

Le sens de la flèche est à sens unique : `public` ne relit **jamais** le staging, sauf
une sonde `NOT EXISTS` du script de peuplement (887 appels, 838 lignes rendues).

**Les 17 scripts de pipeline vivent hors git**, sous `/opt/automecanik/data/tecdoc/`.
C'est le second risque structurel après le parseur.

## 3. Dépendance runtime — six chemins vérifiés, tous fermés

| chemin possible | vérification | résultat |
|---|---|---|
| Code applicatif | grep `backend/src`, `frontend/app`, `packages/*/src` | **0** référence aux schémas `tecdoc_*`. Les 29 fichiers qui disent « tecdoc » parlent de provenance (`source: 'tecdoc'`) ou de préfixes de cache (`ext:tecdoc:`) |
| Client Supabase | grep `.schema(` hors `public` | **aucun** |
| API PostgREST | `has_schema_privilege` pour `anon`, `authenticated`, `service_role` sur les 6 schémas | **`false` partout** — seul `postgres` a `USAGE` |
| Fonctions SQL | `pg_proc.prosrc ~* 'tecdoc_'` sur toute la base | **3 fonctions**, dont **aucune** ne cite `source_linkages` |
| Vues | `pg_depend` via `pg_rewrite` | 4 vues dépendent de `source_linkages`, **aucune n'est accordée à `anon`/`authenticated`** |
| Jobs planifiés | `cron.job` filtré | **0 sur 18** |
| Clés étrangères | `pg_constraint contype='f'` | **1 seule**, interne : `source_linkage_criteria → source_linkages`. Aucune FK `public → tecdoc_*` |
| Triggers | `pg_trigger` non-internes sur `tecdoc*` | **aucun** |

**La seule porte runtime ouverte** est `public.resolve_type_id_remap` : `SECURITY DEFINER`,
`EXECUTE` accordé à `PUBLIC`/`anon`/`authenticated`/`service_role`, appelée par
`backend/src/modules/vehicles/services/vehicle-rpc.service.ts:265`. Elle lit
**`tecdoc_map.type_id_remap`** — 3 Mo, 23 457 lignes. Le DEFINER contourne le refus de
`USAGE`, ce qui est le but.

> Donc `tecdoc_map` **ne peut pas être supprimé en bloc**. Une table de 3 Mo dans ce
> schéma est servie. Les 90 Go, eux, ne le sont pas.

À signaler séparément : `public.__load_tecdoc_raw` est aussi `SECURITY DEFINER` avec
`EXECUTE` à `PUBLIC`, et **écrit** dans `tecdoc_raw.t200` — une table qui **n'existe
pas**. Chemin d'écriture exposé et cassé ; hors périmètre de cet audit, à traiter.

## 4. Ce que disent les statistiques — et ce qu'elles ne disent pas

**Limite à énoncer d'abord.** `pg_stat_user_tables` court depuis le **2025-06-06**
(15 mois) ; `pg_stat_statements` depuis le **2025-12-10**, date exacte du dernier
redémarrage. Ces compteurs sont **cumulés**, pas courants : ils mélangent la
construction de mars-avril 2026 et l'exploitation qui a suivi. De plus
`pg_stat_statements` est **saturé — 4 905 entrées sur 5 000** : l'éviction est active,
donc l'absence d'une requête n'y prouve rien.

C'est pourquoi la conclusion du §3 ne repose sur **aucun compteur** : elle repose sur
les grants, le code et le catalogue, qui sont des faits structurels.

Cela dit, les compteurs corroborent :

| indice | mesure | lecture |
|---|---|---|
| `source_linkages` : 1,07 **milliard** d'`idx_scan` | 562 M sur la clé unique, 500 M sur la PK, 8,2 M sur `idx_sl_dlnr_artnr` | signature d'`INSERT … ON CONFLICT` (507 M insertions), pas de lecture applicative |
| `source_linkages` : `n_tup_upd` = 0, `n_tup_del` = 0 | | table append-only, jamais mise à jour |
| toutes les entrées `pg_stat_statements` citant `source_linkages`/`t400` | INSERT batch, projections `INSERT … SELECT`, une sonde `NOT EXISTS` | **aucune** requête de page |
| `idx_sl_pg_id_source_dlnr` | **20 337** scans pour **2 336 Mo** | index quasi mort, 2,3 Go |
| coût mesuré du peuplement de `source_linkages` | 13 919 appels, 168,7 M lignes, **285 470 s ≈ 79 h** | le rejeu se compte en jours |

## 5. Reproductibilité — vérifiée, avec trois corrections

L'audit du 2026-09-02 concluait « régénérable, à condition de réécrire un parseur ».
Vérification du 2026-09-07 :

| affirmation de l'audit C1 | état réel au 2026-09-07 |
|---|---|
| archive `SQL-CONVERTED.7z` présente en 2 copies, checksum OK | **confirmé** — 6 128 758 380 octets ×2, `sha256sum -c` : OK |
| `scripts/tecdoc-mysql-to-csv.py` absent du disque et de git | **confirmé** |
| « `scripts/tecdoc-import.py` lui aussi absent aujourd'hui » | **FAUX** — il est présent (17 756 o) **et suivi par git** |
| scripts de pipeline hors git | **confirmé** — 17 fichiers `.py` sous `/opt/automecanik/data/tecdoc/`, aucun versionné |
| `tecdoc_norm` / `source_linkage_criteria` : aucun producteur ni consommateur | **confirmé et étendu** — `tecdoc_ext` est dans le même cas |

Le parseur manquant est un point de défaillance unique : **six** scripts l'appellent
par le chemin en dur `/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py`. Son contrat
CLI est connu (`python3 PARSER <in.sql> -o <out.csv>`) et 79 fichiers déjà parsés dans
`extract/` servent de fixture attendue.

### Verdict de reproductibilité par couche

| couche | reconstructible | preuve |
|---|---|---|
| `tecdoc_raw.t400`, `t232` | **OUI, conditionnel** | archive + loaders présents ; **parseur à réécrire** |
| `tecdoc_map.source_linkages` | **OUI, transitif** | dépend de t400 régénéré + `populate-source-linkages.v2.py` |
| `tecdoc_rebuild.*` | **OUI — jetable par conception** | schéma d'essai `--target-schema tecdoc_rebuild` |
| `tecdoc_doc.*` | **PARTIELLEMENT** | `project-new-data.py` réécrit `graphics_registry` depuis t231/t232 ; `article_info_modules` : producteur non trouvé |
| `tecdoc_norm.*`, `tecdoc_ext.*` | **NON PROUVÉ** | aucun producteur ni consommateur dans les 17 scripts |
| `tecdoc_map` registres (14 Mo) | **NON PROUVÉ** | `type_id_remap` porte l'allocation d'identités MassDoc — **jamais reconstructible à l'identique**, c'est un registre d'attribution, pas une projection |

> `type_id_remap` mérite l'attention : `allocate_massdoc_type_id` y attribue des ids via
> une séquence. Le rejouer donnerait **d'autres ids**. Ce registre est une donnée
> **primaire**, pas dérivée. Il doit rester, et être sauvegardé comme tel.

## 6. `tecdoc_rebuild` reconstruit-il vraiment ? — **REBUILD PARTIEL**

Ce que le schéma contient : `source_linkages` (2,6 M lignes contre 312 M en prod) et
`pieces_relation_type` (2,2 M contre 368 M). Ce sont des **échantillons d'essai**, pas
une reconstruction complète. `populate-source-linkages.v2.py` accepte
`--target-schema tecdoc_rebuild` : le schéma est le bac à sable du script, pas un
pipeline autonome.

**Verdict : REBUILD PARTIEL.** La chaîne complète existe et est prouvée sur échantillon,
mais aucune reconstruction intégrale depuis une base vide n'a jamais été exécutée, et
elle est **impossible aujourd'hui** faute de parseur.

## 7. Tableau de disposition

| couche / table | taille | runtime ? | reconstructible ? | peut sortir de PROD ? | risque |
|---|---:|---|---|---|---|
| `tecdoc_map.source_linkages` | **90 Go** | **NON** — 0 grant API, 0 code, 0 cron, 4 vues admin | OUI (transitif, ~79 h + parseur) | **OUI**, en dernier, après rejeu prouvé | moyen — rejeu long, parseur à écrire |
| `tecdoc_raw.t400` | **17 Go** | **NON** | OUI (parseur) | **OUI** | faible — granularité DLNR, aucun incrémental perdu |
| `tecdoc_raw.t232` | 1 770 Mo | **NON** | OUI (parseur) | **OUI** | faible |
| `tecdoc_rebuild.*` | 946 Mo | **NON** | OUI — jetable par conception | **OUI, en premier** | **nul** |
| `tecdoc_map.source_linkage_criteria` | 356 Mo | **NON** | **NON PROUVÉ** — phase P5 déclarée, implémentation introuvable | **NON** tant que le producteur est inconnu | élevé si supprimé |
| `tecdoc_doc.graphics_registry` | 1 982 Mo | **NON** — lu par 2 scripts de pipeline seulement | PARTIELLEMENT | **NON** pour l'instant | moyen |
| `tecdoc_doc.article_info_modules` | 111 Mo | **NON** | **NON PROUVÉ** | **NON** | moyen |
| `tecdoc_norm.*` | 471 Mo | **NON** | **NON PROUVÉ** | **NON** | élevé si supprimé |
| `tecdoc_ext.*` | 20 Mo | **NON** | **NON PROUVÉ** | **NON** | élevé si supprimé |
| `tecdoc_map.article_registry` | 924 Mo | **NON** au runtime ; lu par 2 vues admin | OUI (transitif) | **NON** — ancre `piece_id ↔ ARTNR/DLNR` | élevé |
| `tecdoc_map.type_id_remap` | 3 Mo | **OUI** — `resolve_type_id_remap`, DEFINER, appelé par `vehicle-rpc.service.ts:265` | **NON** — registre d'attribution | **NON, jamais** | critique |
| autres registres `tecdoc_map` | ~11 Mo | non vérifié individuellement | — | **NON** | — |

## 8. Scénarios

**Option A — tout garder.** Défendable seulement si l'on refuse d'écrire le parseur.
Coût : 113,5 Go immobilisés, dont 107 Go de staging strictement froid depuis 5 mois.

**Option B — sortir `tecdoc_raw` (19 Go).** Cohérente. Le staging brut n'apporte
**aucun incrémental** : la reprise se fait par DLNR, donc une livraison mise à jour pour
un DLNR déjà chargé serait ignorée à tort. Un rafraîchissement = purge + rechargement de
toute façon. Garder t400 n'achète rien.

**Option C — `tecdoc_raw` + `source_linkages` (109 Go).** Le gros du gain. Exige le
rejeu prouvé de bout en bout, car sans t400 **ni** `source_linkages`, toute nouvelle
livraison repart de l'archive.

**Option D — séparer le pipeline du serving.** L'architecture le permet déjà : le
pipeline est un jeu de scripts Python qui se connectent en `postgres`, et `public` ne
relit jamais le staging. Rien dans le code applicatif ne s'y oppose. Deux préalables :
rapatrier les 17 scripts dans git, et écrire le parseur.

## 9. Gains

| catégorie | contenu | volume |
|---|---|---:|
| **sûr** | `tecdoc_rebuild` (jetable par conception, 0 consommateur) | **946 Mo** |
| **probable** | + `tecdoc_raw` (t400 + t232), après parseur et rejeu prouvé sur 1 DLNR | **19,7 Go** |
| **théorique max** | + `source_linkages` + `source_linkage_criteria` | **≈ 110 Go** |

Base après le gain théorique maximum : **240 − 110 ≈ 130 Go**.

**Ces soustractions ne sont pas une recommandation.** Le gain « probable » n'est
atteignable qu'après avoir écrit le parseur et prouvé un rejeu réel ; le gain maximum
exige en plus d'accepter un rejeu de l'ordre de plusieurs jours.

## 10. Trois problèmes distincts, à ne pas confondre

1. **Réduire la donnée** — c'est ce que permet cet audit : jusqu'à ~110 Go.
2. **Réduire le disque provisionné** — un `DROP` ne le fait **pas**. Seul un upgrade de
   version Postgres right-size le disque à ≈ 1,2 × la base. L'ordre est donc :
   libérer la donnée **puis** upgrader.
3. **Réduire le compute** — indépendant des deux premiers, voir §11.

## 11. Impact sur XL → Large : **NE CHANGE PAS**

Retirer 110 Go de TecDoc **ne modifie pas le working set d'un octet**, pour une raison
simple : ces couches ne sont pas lues au runtime, donc elles ne sont déjà pas en cache.
Le compute sert `public`, et `public` ne bouge pas.

Le working set mesuré (E/S cumulées, `pg_statio_user_tables`) :

| table | taille | E/S cumulées | taux de cache |
|---|---:|---:|---:|
| `public.pieces_relation_type` | 49 Go | 2 478 To | 89,4 % |
| `public.pieces_criteria` | 9,7 Go | 2 119 To | 99,4 % |
| `public.pieces` | 1,8 Go | 383 To | 99,6 % |
| `tecdoc_map.source_linkages` | 90 Go | 176 To | 96,2 % |
| `public.pieces_ref_search` | 10,1 Go | 36 To | **35,4 %** |
| `public.___xtr_msg` | 10 Go | 16 To | **27,5 %** |

Configuration actuelle : `shared_buffers` = **4 Go**, `effective_cache_size` = 12 Go,
taux de cache global 94,17 %.

Deux tables chaudes de 10 Go tournent déjà à **35 %** et **27 %** de cache — elles
lisent le disque en permanence avec 4 Go de `shared_buffers`. Passer en Large diviserait
ce budget par deux. L'argument contre Large ne vient donc **pas** de la taille du disque,
mais de cette pression mesurée ; et il ne serait pas levé par la suppression de TecDoc.

**Conclusion : la disposition TecDoc est orthogonale à la décision de compute.** Elle
sert le levier n° 1 (donnée) et prépare le n° 2 (disque, via l'upgrade). Elle
n'améliore ni ne dégrade le n° 3.

## Ce qui bloque encore

1. **Le parseur `tecdoc-mysql-to-csv.py` n'existe pas.** Sans lui, aucune couche
   `tecdoc_raw` n'est régénérable — et donc `source_linkages` non plus.
2. **Aucun rejeu réel n'a jamais été exécuté.** Une reproductibilité non testée n'est
   pas une sauvegarde.
3. **Les 17 scripts de pipeline sont hors git**, sur un disque DEV à 90 % d'occupation.
4. **`source_linkage_criteria`, `tecdoc_norm`, `tecdoc_ext`, `article_info_modules` :
   producteur inconnu.** Ne rien supprimer sur cette base.
5. **Deux scripts utilisent l'ancien nom de colonne** `source_genartnr`, renommé
   `pg_id_source` le 2026-03-26 : `project-core-v2.py:250`,
   `populate-linkages-genartnr.py:148,183`.

## Architecture cible

```
   ┌─────────────────── PIPELINE (hors PROD) ───────────────────┐
   │  SQL-CONVERTED.7z  (archive froide, 6,1 Go, 2 copies)      │
   │         │                                                  │
   │         ▼   scripts/tecdoc/*.py   ← RAPATRIÉS DANS GIT      │
   │  base d'import temporaire (projet scratch ou PG local)      │
   │         │    tecdoc_raw → tecdoc_map.source_linkages        │
   │         ▼                                                   │
   │  export des projections uniquement                          │
   └────────────────────────┬───────────────────────────────────┘
                            │  (seulement lors d'une livraison)
   ┌────────────────────────▼───────────────────────────────────┐
   │              PRODUCTION — MassDoc serving                   │
   │  public.pieces_relation_type   49 Go   ← SERVI              │
   │  public.pieces_criteria         9,7 Go ← SERVI              │
   │  public.pieces, auto_*, …              ← SERVI              │
   │  tecdoc_map.type_id_remap       3 Mo   ← SERVI (DEFINER)    │
   │  tecdoc_map.article_registry  924 Mo   ← ancre d'identité   │
   └─────────────────────────────────────────────────────────────┘
```

## Verdict

**SORTIR `tecdoc_rebuild`, PUIS `tecdoc_raw`, PUIS `source_linkages` — dans cet ordre,
et pas avant d'avoir écrit le parseur et prouvé un rejeu réel.**

Ce n'est pas « sortir TecDoc ». `tecdoc_map` contient une table de 3 Mo qui est servie
en production et un registre d'attribution d'identités qui n'est pas reconstructible.
La formulation exacte est : **sortir le staging froid, garder les registres**.

Séquence proposée, chaque étape sous accord nominatif :

| # | action | gain | préalable |
|---|---|---:|---|
| 0 | écrire `scripts/tecdoc/tecdoc-mysql-to-csv.py` + rapatrier les 17 scripts | 0 | — |
| 1 | prouver le rejeu d'**un** DLNR de t400 dans un schéma d'essai | 0 | étape 0 |
| 2 | supprimer `tecdoc_rebuild` | 946 Mo | aucun |
| 3 | supprimer `tecdoc_raw` | 19 Go | étapes 0-1 |
| 4 | supprimer `tecdoc_map.source_linkages` | 90 Go | rejeu complet prouvé |
| 5 | upgrade Postgres → right-size du disque | — | étapes 2-4 |
| 6 | décider du compute | — | mesure post-upgrade |

_Aucune action prise. Ce document mesure et instruit ; il ne tranche pas les
suppressions, qui sont owner-gated (invariant 9, DB destructive)._
