# Périmètre TecDoc de mars 2026 — reconstruction, scellement, conditions de retrait

> Mission lecture seule sur PROD. Aucune mutation, aucune suppression, aucun rejeu.
> Objet : transformer un périmètre historique implicite en artefact explicite, versionné et haché.

## 1. Scope mars 2026 — **RECONSTRUIT AVEC CONFIANCE HAUTE**

La reconstruction ne repose sur aucune extrapolation. Les trois cardinaux structurants sont
énumérés exactement, et la complétude est prouvée arithmétiquement : la somme des comptages par
DLNR sur `tecdoc_raw.t400` vaut **138 815 762** lignes contre **138 815 760** estimées par le
catalogue — un écart de 2 sur 139 millions, soit le bruit normal de `reltuples`. Aucune ligne de
`t400` ne tombe hors des 149 DLNR identifiés.

La règle de nommage des shards est **prouvée, pas inférée** : sur les 149 DLNR de `t400`,
**149/149** ont un `_source_filename` exactement égal à `400.<dlnr sur 4 chiffres>.sql` ; sur
`t232`, **811/811**. C'est ce qui établit que `tecdoc_raw.t400.col_2` **est** le DLNR.

## 2. Nombre de DLNR

| catégorie | nombre | fondement |
|---|---:|---|
| **historique prouvé — chargé** | **149** | parcours d'index clairsemé sur `idx_t400_col2_col4`, somme des comptages = total de la table |
| **historique prouvé — projeté** | **110** | énumération sur `idx_sl_dlnr_artnr`, corroborée indépendamment par `pg_stats.n_distinct = 110` |
| historique prouvé — images (`t232`) | 811 | `GROUP BY dlnr` sur la table entière |
| fournisseurs enregistrés | 836 | `tecdoc_map.supplier_registry`, insertion unique du 2026-03-18 18:15:43 |
| **incertain** | **0** | aucun DLNR n'est en état indéterminé |

Les 110 projetés sont un **sous-ensemble strict** des 149 chargés : zéro orphelin, aucune liaison
ne provient d'un DLNR absent de `t400`.

## 3. Artefacts créés

| fichier | SHA256 |
|---|---|
| [`audit/massdoc-tecdoc-import-scope-2026-03.json`](massdoc-tecdoc-import-scope-2026-03.json) | `97cfbc4f77ec39c70d7c74f244be7c54f0b92b4b5a92c2275be1c3910c9fed0c` |
| [`audit/massdoc-tecdoc-preservation-manifest-2026-03.json`](massdoc-tecdoc-preservation-manifest-2026-03.json) | `9c946a8401da1e660346901d23c817e9b47524e00b2fc2d3d01782ab864cacce` |

Sérialisation canonique : JSON UTF-8, `sort_keys=True`, séparateurs `(',', ':')`, bloc `seal`
retiré avant hachage, **aucun horodatage de génération dans la zone hachée**. Le hash est donc
reproductible : deux exécutions du générateur produisent un fichier identique au bit près,
vérifié.

## 4. Sources de preuve, classées par solidité

| # | source | ce qu'elle prouve | ce qu'elle ne prouve pas |
|---|---|---|---|
| 1 | `tecdoc_raw.t400` | quels DLNR chargés, volumes exacts, nom de shard | **quand** — `_loaded_at` et `_batch_id` NULL à 100 % |
| 2 | `tecdoc_map.source_linkages` | quels DLNR réellement projetés ; fenêtre 2026-03-19 → 03-26 via `created_at` | le lot d'import (`batch_id` NULL) |
| 3 | archive `SQL-CONVERTED.7z` | disponibilité + CRC32 des 298 shards du périmètre | lequel a été chargé — date interne uniformément 2025-05-19 |
| 4 | `workdir/400.*.meta` (66 fichiers) | volumes réellement émis par le parseur | la date de chargement ; le mtime date le **parse** |
| 5 | `tecdoc_map.supplier_registry` | mapping `dlnr → pm_id` figé au 2026-03-18 | le nom fournisseur (`source_hernr` NULL partout) |
| 6 | `public.__tecdoc_supplier_mapping` | mapping chargé le 2026-03-16, 0 override manuel | l'état de `pm_display` **à cette date** — seul l'état courant est lisible |
| 7 | `tecdoc_map.gamme_registry` | filiation gamme source → `pg_id`, figée au 2026-03-18 | quelles gammes ont été **créées** |
| — | `tecdoc_map.sync_batch` | **rien : table vide (0 ligne)** | le journal d'import prévu n'a jamais été alimenté |
| — | `tecdoc_map.activation_log` | 413 activations les 24-25 mars, 57 376 gammes | **le périmètre fournisseur — `dlnr` est NULL sur les 413 lignes** |

## 5. Écarts avec le scope actuel — et leur cause racine

`tecdoc_map.v_projection_scope_suppliers` n'est pas une table de périmètre : c'est une vue sur
`public.__tecdoc_supplier_mapping` jointe à `pieces_marque` **avec le filtre `pm_display = '1'`**.
`load-t400-active.py:50-62` exécute littéralement la même requête.

| ensemble | cardinal | |
|---|---:|---|
| communs | 108 | |
| **seulement aujourd'hui** | **1** | DLNR **4836** — VDO, `pm_id` 10330, `pm_display='1'`, mais **aucun shard `400.4836.sql` jamais chargé** |
| **seulement en mars** | **2** | DLNR **253** DIEDERICHS (`pm_display` passé à `'5'`) et **6358** RIDEX (passé à `'0'`) |

Un rejeu piloté par la configuration vivante **perdrait 4 763 696 liaisons et 4 778 677 lignes de
`t400`**, et chercherait un fournisseur sans matière première.

**Le périmètre de reconstruction technique est donc gouverné par un drapeau d'affichage
commercial.** Masquer une marque sur le site la retire silencieusement du périmètre de rejeu.
C'est la cause racine, et elle explique aussi les 39 DLNR chargés sans projection : **tous** ont
`pm_display` valant 0, 2 ou 5 — **aucun** ne vaut 1. Cela représente **36 339 870 lignes, soit
26,2 % de `t400`, chargées pour rien** (HELLA, ZF, PAGID, VICTOR REINZ, JURID, KONI, VARTA,
HENGST FILTER, METZGER, TRISCAN…).

## 6. Ce que la reconstruction a révélé en plus

### 6.1 `t400` n'est pas une copie fidèle de la source pour 5 fournisseurs

Les 66 fichiers `.meta` du parseur retrouvés sur disque déclarent **`rows_rejected=0` partout**.
61 concordent exactement avec la base. **5 divergent, toujours dans le même sens** :

| DLNR | marque | émis par le parseur | présent dans `t400` | perdu |
|---:|---|---:|---:|---:|
| 123 | NISSENS | 790 974 | **100** | 99,99 % |
| 30 | BOSCH | 9 357 752 | **69 000** | 99,26 % |
| 101 | FEBI | 17 421 432 | 2 558 500 | 85,31 % |
| 6358 | RIDEX | 5 662 767 | 2 323 000 | 58,98 % |
| 113 | PAYEN | 1 259 429 | 1 085 500 | 13,81 % |

Le parseur n'ayant rien rejeté, **la perte s'est produite au chargement**. Un rejeu fidèle à
`t400` reproduirait le défaut ; un rejeu fidèle à la source produirait *plus* de données que la
PROD actuelle. Ce choix appartient à l'owner et doit être tranché avant tout rejeu.

### 6.2 Le volume réel de `source_linkages` était sous-estimé de 27 millions

Comptage exact par DLNR : **339 249 945** lignes. `reltuples` annonçait 312 049 024 — **8,7 %
d'erreur**. Les audits antérieurs, y compris les miens, citaient l'estimation périmée.
`n_live_tup` (339 262 790) était juste à 12 845 près.

### 6.3 La provenance des gammes ne se lit pas dans leur nom

`pieces_gamme` n'a aucune colonne de date, mais se scinde en **deux bandes disjointes** : 8 843
gammes sous 10000, et **876 de 60000 à 61103** — rien entre les deux. C'est la même convention de
bande réservée que `auto_type` (60000–83456). La campagne a donc créé **876 gammes**, dont
**18 seulement** portent « TecDoc » dans leur nom. Filtrer sur le libellé en manquerait **858**.

## 7. Scripts encore manquants — **16 sur 17 toujours hors git**

`/opt/automecanik/data/tecdoc/` héberge 17 scripts `.py`. La PR #1412 a rapatrié le **parseur** et
le **chargeur de lots**, mais **aucun** de ceux-ci :

| script | statut | rôle dans le rebuild |
|---|---|---|
| `load-t400-active.py` | **DEV_ONLY** | charge `t400` — **porte la requête vivante à remplacer** |
| `load-all-suppliers.py`, `-v2`, `-v3` | **DEV_ONLY** | chargement fournisseurs |
| `load-vehicle-tables.py` | **DEV_ONLY** | chargement tables véhicules |
| `populate-source-linkages.v2.py` | **DEV_ONLY** | construit `source_linkages` |
| `populate-linkages-genartnr.py` | **DEV_ONLY** | liaisons par GENARTNR |
| `project-core-v2.py` | **DEV_ONLY** | projection cœur |
| `project-enrichment.py` | **DEV_ONLY** | enrichissement |
| `project-linkages-v3.py`, `project-linkages-retry.py` | **DEV_ONLY** | projection liaisons + reprise |
| `project-new-data.py` | **DEV_ONLY** | projection données neuves |
| `project-prt-remap-batch.py` | **DEV_ONLY** | remap `pieces_relation_type` |
| `register-and-create-pieces.py` | **DEV_ONLY** | création des pièces |
| `create-vehicles-p4a.py` | **DEV_ONLY** | création des véhicules |
| `activate-pieces-v1.py` | **DEV_ONLY** | activation |
| `fix-vehicles-massdoc.py` | **DIVERGENT** | existe sous git avec un **contenu différent** |

Ces scripts vivent sur un disque à **74 % d'occupation**, hors sauvegarde versionnée.

## 7bis. Le patch à appliquer au rapatriement

`scripts/tecdoc_scope.py` existe pour que ces scripts cessent d'interroger la configuration
vivante. Le remplacement est mécanique — dans `load-t400-active.py` et partout où le motif
`get_active_dlnrs()` se répète :

```python
# AVANT — le périmètre dépend d'un drapeau d'affichage marchand, muable
def get_active_dlnrs():
    cur.execute("""
    SELECT sm.dlnr FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    ORDER BY sm.dlnr
    """)
    return [r[0] for r in cur.fetchall()]

# APRÈS — le périmètre vient de l'artefact scellé, la base n'est plus consultée
from tecdoc_scope import charger_perimetre          # scripts/ dans le PYTHONPATH

def get_active_dlnrs(chemin_scope):
    return charger_perimetre(chemin_scope).dlnr_projetes()   # 110, figés
```

Le chemin arrive par `--scope-file`, sans valeur par défaut : un rejeu qui oublie l'argument
doit échouer, pas retomber silencieusement sur la base. `charger_perimetre` lève
`SceauInvalide` si l'artefact a été modifié, ce qui interdit un rejeu sur un périmètre
retouché à la main. `dlnr_charges()` (149) sert au rejeu du chargement `t400` ;
`dlnr_projetes()` (110) au rejeu de la projection.

Vérification disponible avant de lancer quoi que ce soit :

```bash
python3 scripts/tecdoc_scope.py \
  --scope-file audit/massdoc-tecdoc-import-scope-2026-03.json \
  --comparer-au-vivant   # sort en 4 et détaille les écarts si la config a encore bougé
```

## 8. Rejeu complet possible maintenant ? — **NON**

Raison principale unique : **16 des 17 scripts du pipeline de reconstruction ne sont pas sous
git.** Le périmètre est désormais figé et la source est intégralement disponible, mais la chaîne
qui transforme l'une en l'autre n'est pas versionnée.

## 9. Suppression des ~110 Go autorisable maintenant ? — **NON**

Aucune case bloquante de la checklist §10 n'est verte au-delà des trois premières.

## 10. Checklist de GO pour un futur DROP

```
[x] scope DLNR historique figé              — 149 chargés / 110 projetés, artefact scellé
[x] sources correspondantes présentes       — 149/149 shards 400 ET 232 dans l'archive
[x] checksums validés                       — CRC32 des 298 shards + SHA256 de l'archive
[x] parseur sous git                        — scripts/tecdoc-mysql-to-csv.py (PR #1412)
[x] scope utilisable par le pipeline        — scripts/tecdoc_scope.py, 18 tests verts
[x] mappings identitaires sauvegardés       — manifest de préservation, 9 ensembles scellés
[ ] scripts nécessaires sous git            — 16 sur 17 MANQUANTS (§7)
[ ] arbitrage owner sur les 5 divergences   — rejouer fidèle à t400 ou fidèle à la source ? (§6.1)
[ ] rejeu complet hors PROD exécuté         — jamais tenté
[ ] comparaison rebuild / PROD conforme     — sans objet tant que le rejeu n'a pas eu lieu
[ ] dump de sécurité effectué               — non planifié
```

Le `DROP` reste interdit tant que ces cinq cases ne sont pas vertes.

## 11. Invariant de conservation

Le manifest [`massdoc-tecdoc-preservation-manifest-2026-03.json`](massdoc-tecdoc-preservation-manifest-2026-03.json)
fige 9 ensembles applicatifs par empreinte `md5(string_agg(clé ORDER BY clé))`, calculée côté
serveur. Rejouer la même requête après nettoyage et comparer constitue le test
**AVANT == APRÈS**. Toutes les mesures de référence de l'owner ont été **recomptées et
confirmées au chiffre près** :

| ensemble | cardinal | empreinte |
|---|---:|---|
| `auto_type` `type_id_i` 60000–83456 | 23 457 | `8c0370a62481a77810d7b9d6ff3f743b` |
| `auto_modele` `modele_is_new=1` | 7 088 | `b3a824a363dd655a4543a2dd56b9fa5b` |
| `pieces` `piece_year=2025` | 119 702 | `1dc356832e4282d505fa6c3185c0c503` |
| `pieces` 2025 + affichées | 84 033 | `573f3dbb18e6a87306522c7de869a74f` |
| `pieces_gamme` `pg_id>=60000` | 876 | `3ff8875e19000315dabe88f23b67317e` |
| `tecdoc_map.type_id_remap` | 23 457 | `5dec18e5dc69765d998beda5680b418f` |
| `tecdoc_map.gamme_registry` mappées | 9 702 | `0a2ef785f1b820e7405f375819450a96` |
| `tecdoc_map.linkage_target_registry` | 43 484 | `30c9a6f68a2dbd74020d35c9a146abda` |
| `tecdoc_map.article_registry` (rollup) | 3 240 177 | `8f1183fcb7aa9c71ac9ac6c485c943b8` |

Écart annexe relevé : `auto_marque` compte **117** marques, pas les 114 de `reltuples`.

**Lacune assumée** : les identifiants ne sont pas stockés en clair, seule leur empreinte l'est. Si
un contrôle APRÈS échoue, l'empreinte dit *que* l'ensemble a changé, pas *lesquels* manquent.
Exporter les listes complètes avant tout DROP si ce niveau de diagnostic est voulu.

**Non mesuré** : les cardinalités exactes des 6 grosses tables de relations. Compter la cohorte
2025 dans `pieces_relation_type` exigerait un parcours séquentiel de 49 Go — le planificateur
l'annonce explicitement (`Parallel Seq Scan`, coût 6 058 859, ~90,7 M lignes concernées). Non
lancé : hors budget de requête autorisé. `n_live_tup` en tient lieu, et c'est une estimation.

## 12. Prochaine action unique

**Rapatrier sous git les 16 scripts DEV_ONLY de `/opt/automecanik/data/tecdoc/`**, dans une PR
dédiée sur le modèle de #1412 : provenance, SHA256, expurgation des identifiants, et lecture du
périmètre via `scripts/tecdoc_scope.py --scope-file` en remplacement de `get_active_dlnrs()`.

---

## Annexe — méthode et coût des requêtes

`statement_timeout` vaut 1 minute pour le rôle `postgres`. Les agrégations ont donc été conçues
pour tenir dedans plutôt que de contourner la garde :

- **`t400`** (139 M lignes, un seul index `idx_t400_col2_col4`) : un `GROUP BY col_2` global
  expire. Énumération des valeurs distinctes par **parcours d'index clairsemé** (149 descentes),
  puis comptages par lots de 20 à 30 DLNR.
- **`source_linkages`** (339 M lignes, index `idx_sl_dlnr_artnr` de 2 664 Mo,
  `relallvisible` = 96,2 %) : comptages par lots pondérés. Le DLNR 21 (VALEO) pèse à lui seul
  **50 695 220** liaisons, soit 15 % de la table — il faisait expirer tout lot le contenant.
- **`pieces_relation_type`** : mesuré par `EXPLAIN` avant exécution, puis **non exécuté**.

Les facteurs d'expansion `t400 → source_linkages` vont de **×0,67** (MTS) à **×139** (HC CARGO) :
le volume brut ne prédit en rien le volume projeté.
