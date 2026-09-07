# XL → Large : le CPU n'a jamais été le problème. La taille de la base, si.

> Mesuré le 2026-09-07 (soirée, ~20:00 UTC) sur le projet live, **lecture seule**,
> `SET default_transaction_read_only = on`. Reproductible :
> `python3 scripts/audit/sample-db-workload.py --duration 1800`.
> Aucune mutation, aucun reset de compteur, aucune extension installée.

## Pourquoi les compteurs disaient n'importe quoi

`pg_stat_database` court depuis le **2025-06-06** — 458 jours — et
`pg_stat_statements` depuis le **2025-12-10**, saturé à 4 905/5 000 entrées
(donc en éviction). Ces deux fenêtres englobent l'ingestion TecDoc : 507 M
d'insertions, ~79 h de travail. Le résultat est un jeu de moyennes qui ne
décrivent aucun instant réel :

| grandeur | moyenne cumulée (458 j) | mesure courante (différentielle) |
|---|---|---|
| transactions/s | 8,76 | **4,2 – 5,7** |
| taux de cache | 94,17 % | **91,9 – 98,3 %** (variable par minute) |
| lectures disque | 348 To *au total* | **0,14 – 6,6 Mo/s** |

Un compteur cumulé répond à « qu'est-ce qui s'est passé depuis un an ». Il ne
répond jamais à « de quoi cette base a-t-elle besoin maintenant ». D'où
l'instrument : deux relevés espacés, et la dérivée entre les deux.

## Ce que Large change réellement

Source : [Supabase — Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)
et [How to change max database connections](https://supabase.com/docs/guides/troubleshooting/how-to-change-max-database-connections-_BQ8P5),
consultées le 2026-09-07.

| | XL (aujourd'hui) | Large (cible) | mesure courante | verdict |
|---|---|---|---|---|
| CPU | 4 cœurs ARM dédiés | 2 cœurs ARM dédiés | **0,18 session active en moyenne, 2 au pic** | ✅ très large marge |
| Mémoire | 16 Go (`shared_buffers` 4 Go) | 8 Go (`shared_buffers` ~2 Go) | cache 91,9–98,3 %, 3,0 Mo/s lus | ⚠️ **non tranché** |
| Max connections | 240 | 160 | **15 au pic** | ✅ marge ×10 |
| Pooler max clients | 1 000 | 800 | — | ✅ |
| Replication slots / WAL senders | 24 | 8 | **0 utilisé, 0 actif** | ✅ pas un bloqueur |
| Taille de base recommandée | 500 Go | **200 Go** | **240 Go** | ❌ **hors enveloppe** |
| Prix | ~210 $/mois | ~110 $/mois | — | −100 $/mois |

## Le bloqueur, et il n'est pas où on le cherchait

**La base fait 240 Go. Large en recommande 200.** Ce n'est pas une limite dure —
Supabase la présente comme une recommandation, pas un refus — mais c'est le seul
axe des sept ci-dessus qui soit hors enveloppe, et il l'est de 40 Go.

Cela **change le statut du chantier TecDoc** : ce n'est pas un travail parallèle
qui se ferait « aussi », c'est le préalable qui ramène la base dans l'enveloppe.
Les 113,5 Go des six schémas `tecdoc_*` (audit
`massdoc-tecdoc-layers-disposition-2026-09-07.md`, PR #1409) porteraient la base
de **240 Go à ~126 Go**, soit confortablement sous les 200 Go.

L'ordre est donc contraint, et il l'est par la mesure, pas par une préférence :

```
  données          disque              compute
  ───────          ──────              ───────
  sortir TecDoc    upgrade PG          XL → Large
  240 → ~126 Go    right-size le       4→2 vCPU, 16→8 Go
       │           disque alloué            │
       │                 │                  │
       └─── préalable ───┴──── préalable ───┘
```

Le disque ne rétrécit jamais tout seul : seul un upgrade de version PostgreSQL
re-dimensionne à ≈ 1,2 × la taille de la base (mesuré et instruit dans
`audit/massdoc-db-size-and-compute-2026-09-07.md`).

## Le relevé

Quatre fenêtres de 30 s, 30 ticks chacune, le 2026-09-07 à 19:57–19:59 UTC —
**heure creuse**, c'est la limite principale de ce relevé.

| fenêtre | tps | cache hit | lu disque | sessions actives (moy / p95 / max) | connexions |
|---|---|---|---|---|---|
| 1 | 4,23 | 96,94 % | 0,26 Mo/s | 0,033 / 0 / 1 | 14 |
| 2 | 4,17 | 95,51 % | 6,59 Mo/s | 0,333 / 1 / 1 | 14 |
| 3 | 5,45 | 91,93 % | 5,03 Mo/s | 0,300 / 2 / 2 | 13 |
| 4 | 5,74 | 98,33 % | 0,14 Mo/s | 0,069 / 1 / 1 | 15 |
| **résumé** | **4,9** | **min 91,93 %** | **moy 3,03 · max 6,59 Mo/s** | **0,184 / 2 / 2** | **max 15** |

**0,184 session active en moyenne sur 4 vCPU** = environ 4,6 % d'un seul cœur.
Même en admettant un facteur 10 entre cette heure creuse et le pic, deux cœurs
resteraient deux fois trop grands. Le CPU n'est pas ce qui retient XL.

### Ce que lit le disque

Différentiel de `pg_statio_user_tables` sur 90 s — **86,1 % des blocs lus
viennent d'une seule table** :

| relation | Mo lus disque | hit % | taille | part |
|---|---|---|---|---|
| `pieces_relation_type` | 55,40 | 93,9 % | 53,0 Go | **86,1 %** |
| `pieces` | 2,17 | 95,5 % | 1,85 Go | 3,4 % |
| `pieces_price` | 1,70 | 85,2 % | 0,79 Go | 2,6 % |
| `pieces_ref_search` | 1,61 | 80,1 % | 10,6 Go | 2,5 % |
| `pieces_media_img` | 1,48 | 84,4 % | 3,47 Go | 2,3 % |
| `pieces_relation_criteria` | 1,01 | 92,6 % | 32,6 Go | 1,6 % |

**Correction d'un audit antérieur du même jour** : `massdoc-db-size-and-compute-2026-09-07.md`
désignait `pieces_ref_search` (10,1 Go, 35,4 % de hit) et `___xtr_msg` (10 Go,
27,5 %) comme l'argument contre Large. Ces deux ratios sont des **cumuls sur
458 jours**. Sur la charge courante, `pieces_ref_search` pèse 2,5 % des lectures
et `___xtr_msg` **n'apparaît pas du tout**. Le working set réel est
`pieces_relation_type`. Le sens de l'erreur est le même que celui contre lequel
l'audit TecDoc mettait en garde — lire un fossile comme une mesure — et il
s'appliquait à mon propre texte.

### Le producteur de charge

`pg_stat_activity` échantillonné à 0,4 s sur 130 s : **69 ticks actifs sur 71
appartiennent à `authenticator` / `postgrest`**, dont 67 à une seule forme de
requête. Le trafic est donc du rendu de page, pas du batch.

Les gros consommateurs cumulés (`pg_stat_statements`, à lire avec la réserve
d'éviction) :

| RPC | appels | CPU cumulé | ms/appel | actif maintenant ? |
|---|---|---|---|---|
| `get_alternative_vehicles_for_gamme` | 423 002 | 1 058 h | **9 006** | **non** — batch admin (`r1-keyword-plan-batch.service.ts`) |
| `rm_get_page_complete_v2` | 8 618 759 | 654 h | 273 | oui |
| `get_pieces_for_type_gamme_v3` | 2 421 260 | 339 h | 504 | oui |
| `get_soft_404_alternatives` | 541 602 | 139 h | 926 | oui — **288 Mo de disque pour 9 appels** (~32 Mo/appel) |

`get_soft_404_alternatives` explique à elle seule les pics de lecture disque du
relevé (fenêtres 2 et 3). C'est un levier de performance indépendant de la
question du compute, et il n'est pas instruit ici.

## Effet d'observation — deux erreurs, dont une évitée de justesse

La première version de l'échantillonneur lisait `pg_stat_statements` à chaque
tick et rapportait « un fichier temporaire de 18,43 Mo toutes les 15 s ».
Vérification faite avant de le rapporter comme un défaut applicatif : **chaque
lecture de `pg_stat_statements` sur ce projet écrit 18,43 Mo de fichier
temporaire** (4 905 entrées, textes de requête matérialisés au-delà de
`work_mem` = 16 Mo). La sonde fabriquait la métrique qu'elle observait.

Mais la correction était elle-même incomplète : après suppression de toute lecture
de `pg_stat_statements` par l'instrument, **les fichiers de 18,43 Mo persistaient,
2 par minute**. Le producteur, identifié par capture de `pg_stat_activity` :
**`supabase_admin` / `postgres_exporter`** — l'agent de métriques de la plateforme
elle-même, qui scrute `pg_stat_statements` en boucle.

Conséquence chiffrée : la collecte de métriques de la plateforme génère à elle
seule de l'ordre de **37 Mo/min ≈ 53 Go/jour d'écriture de fichiers temporaires**
sur cette base, uniquement parce que `pg_stat_statements` est saturé. C'est une
charge d'I/O constante que personne n'a demandée, et elle **grossirait en Large**
si `work_mem` y est plus bas. Traitement possible (non instruit ici, hors
périmètre) : réduire `pg_stat_statements.max` ou la longueur de texte conservée.

L'instrument versionné ne lit plus jamais `pg_stat_statements` ; la raison est
écrite dans son en-tête pour que personne ne la réintroduise.

## Verdict

**Sur le CPU, les connexions et les slots de réplication : Large suffit, mesuré.**
Les marges sont d'un ordre de grandeur, pas de quelques pourcents.

**Sur la mémoire : non tranché, et ce relevé ne peut pas le trancher.** Passer de
4 Go à 2 Go de `shared_buffers` sur un working set dominé par une table de 53 Go
déjà à 93,9 % de hit augmentera les lectures disque — de combien, aucune mesure
disponible ne le dit. L'instrument qui répondrait est **`pg_buffercache`** :
disponible sur ce projet, **non installé**. L'installer est un `CREATE EXTENSION`,
donc une mutation de production — **décision owner**, hors du périmètre lecture
seule de cet audit.

**Sur la taille : hors enveloppe aujourd'hui** (240 Go vs 200 Go recommandés), et
c'est ce qui ordonne le chantier.

### Ce qu'il reste à faire, dans l'ordre

1. **Sortir TecDoc** (113,5 Go) — préalable, pas un travail parallèle. Bloqué par
   `scripts/tecdoc-mysql-to-csv.py`, absent du disque et de git, appelé en dur par
   six scripts (PR #1409). 240 Go → ~126 Go.
2. **Échantillonner aux heures de pointe** — ce relevé est de soirée. Même
   commande, `--duration 3600`, sur une fenêtre de trafic réel. Sans cela, « Large
   suffit » reste une extrapolation depuis l'heure creuse.
3. **Décision owner : `CREATE EXTENSION pg_buffercache`** — seul moyen de savoir
   quelle fraction des 4 Go de `shared_buffers` est réellement occupée et par
   quoi. Sans lui, l'axe mémoire restera non tranché quel que soit le nombre de
   relevés.
4. **Upgrade PostgreSQL** pour re-dimensionner le disque (après 1).
5. **XL → Large** (après 1, 2, 3, 4).

## Manifeste de couverture

| axe de dimensionnement | statut | preuve |
|---|---|---|
| CPU / vCPU | **Vérifié** | 4 fenêtres × 30 ticks, `pg_stat_activity` |
| Connexions | **Vérifié** | max 15 observé vs 240 configurées |
| Replication slots | **Vérifié** | `pg_replication_slots` = 0 |
| Taille de base | **Vérifié** | `pg_database_size` = 240 Go vs 200 Go doc Supabase |
| Working set (quelles tables) | **Vérifié** | différentiel `pg_statio_user_tables` |
| Mémoire / `shared_buffers` | **Non-vérifiable en l'état** | exige `pg_buffercache` (owner) |
| Comportement au pic | **Non vérifié** | relevé de soirée uniquement |
| Débit / IOPS disque | **Non vérifié** | `track_io_timing` est désactivé sur ce projet |

_Aucune action prise sur la base. Ce document mesure ; il ne tranche pas le
passage en Large, et il ne le recommande pas encore._
