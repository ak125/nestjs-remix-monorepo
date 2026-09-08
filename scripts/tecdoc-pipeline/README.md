# Pipeline TecDoc — scripts rapatriés, **en quarantaine**

> **Ne lancez aucun script de ce répertoire en l'état.** Ils sont ici pour cesser
> d'exister uniquement sur un disque, pas pour être exécutés. Lire §« Pourquoi la
> quarantaine » avant toute tentative.

## Ce que contient ce répertoire

Les 16 scripts qui ont réalisé la campagne d'import TecDoc de mars 2026, rapatriés
**verbatim** depuis `/opt/automecanik/data/tecdoc/` le 2026-09-08. Aucun octet modifié :
chaque fichier a le SHA256 de son original, vérifié à la copie (16/16 identiques).

La fidélité prime ici sur la propreté. Ces scripts sont la seule description exécutable
de ce qui a produit l'état actuel de la base ; les corriger en les rapatriant aurait
détruit leur valeur de preuve, et la campagne de mars ne serait plus reconstituable.
La correction est une phase distincte — voir §« Récupération ≠ modernisation ».

Un dix-septième script du même répertoire DEV, `fix-vehicles-massdoc.py`, n'est **pas**
ici : il est déjà versionné sous `scripts/fix-vehicles-massdoc.py`, dans une version
**postérieure** à la copie DEV. Voir §« Le cas fix-vehicles-massdoc ».

## Inventaire

| script | étape | SHA256 (12) | modifié | statut |
|---|---|---|---|---|
| `load-all-suppliers.py` | 1 · RAW | `3f0ae0006e29` | 2026-03-21 | **OBSOLÈTE** — v1, supplanté par v3 |
| `load-all-suppliers-v2.py` | 1 · RAW | `b9b973c386bf` | 2026-03-21 | **OBSOLÈTE** — v2, supplanté par v3 |
| `load-all-suppliers-v3.py` | 1 · RAW | `ba905d4e361e` | 2026-03-22 | **REQUIS** — chargeur RAW générique des 32 shards |
| `load-t400-active.py` | 1 · RAW | `9861e9e20bcd` | 2026-03-23 | **REQUIS** — chargeur du shard 400 (liaisons) |
| `load-vehicle-tables.py` | 1 · RAW | `9a118a074d65` | 2026-03-23 | **REQUIS** — charge les 7 tables véhicules |
| `create-vehicles-p4a.py` | 2 · véhicules | `6a0f28430235` | 2026-03-23 | **REQUIS** — crée `auto_modele` / `auto_type` |
| `register-and-create-pieces.py` | 3 · pièces | `d4f3af483633` | 2026-03-23 | **REQUIS** — `article_registry` + `pieces` |
| `populate-source-linkages.v2.py` | 4 · staging | `a5d01433e62a` | 2026-04-13 | **REQUIS** — v2 corrective (voir §pollution) |
| `populate-linkages-genartnr.py` | 4 · staging | `5b4a54800701` | 2026-03-26 | **OBSOLÈTE** — héritage GENARTNR, 3ᵉ chemin d'activation |
| `project-core-v2.py` | 5 · projection | `fd0c48cba4d0` | 2026-03-22 | **REQUIS** — projection cœur 4 phases |
| `project-new-data.py` | 5 · projection | `35d0b93d4379` | 2026-03-22 | **OBSOLÈTE** — supplanté 2 h 16 plus tard par `project-core-v2` |
| `project-enrichment.py` | 5 · projection | `423d46c433eb` | 2026-04-12 | **REQUIS** — OEM, refs, médias, critères |
| `project-linkages-v3.py` | 5 · projection | `de3a06004263` | 2026-03-24 | **OBSOLÈTE** — ignore `type_id_remap` |
| `project-linkages-retry.py` | 5 · projection | `4536d237b138` | 2026-03-22 | **OBSOLÈTE** — reprise one-shot de 17 chunks |
| `project-prt-remap-batch.py` | 5 · projection | `f08b10468c69` | 2026-03-28 | **INCERTAIN** — dernier écrivain connu de `pieces_relation_type` |
| `activate-pieces-v1.py` | 6 · activation | `7c840b61e43b` | 2026-03-24 | **REQUIS** — bascule `pieces.piece_display` |

Provenance : `/opt/automecanik/data/tecdoc/<nom>.py`, machine DEV. Dates = `mtime` du
fichier source. `git log` ne peut rien en dire : aucun n'a jamais été versionné.

## Pourquoi la quarantaine

Six défauts structurels, constatés dans le code, rendent une exécution telle quelle
dangereuse pour l'état actuel de la base :

1. **Le comportement se recalcule à chaque exécution, depuis des drapeaux d'affichage
   marchand.** Ce n'est pas seulement le périmètre fournisseur : **9 des 16** lisent au
   moins un drapeau de visibilité vivant pour décider quoi traiter.

   | drapeau | ce qu'il gouverne réellement | scripts |
   |---|---|---|
   | `pieces_marque.pm_display` | quels fournisseurs sont chargés/projetés | 5 en direct + 1 via `v_projection_scope_*` |
   | `auto_marque.marque_display` | quelles marques reçoivent des véhicules | 1 |
   | `auto_type.type_display` | quels véhicules reçoivent des liaisons | 4 |
   | `pieces.piece_display` | quelles pièces sont activées | 5 |

   Cinq autres scripts dérivent leur périmètre de `__tecdoc_supplier_mapping` sans filtre
   d'affichage — donc du contenu vivant de cette table, lui aussi muable.

   Conséquence : le résultat de mars 2026 n'est pas reproductible. La même commande,
   aujourd'hui, traite 109 fournisseurs au lieu des 110 projetés en mars — et un
   changement de vitrine sur une marque suffit à déplacer la frontière, sans trace.

2. **Aucune comptabilité lu/écrit.** Aucun script ne compare ce qu'il a lu à ce qu'il a
   écrit, ni ne compte ses rejets. `load-t400-active.py` additionne les lignes *envoyées*
   au `COPY` sans jamais lire `cur.rowcount`, et sort toujours en code 0.

3. **Un chargement partiel devient définitif.** Le saut « déjà chargé » est à la
   granularité du DLNR : dès qu'une seule ligne existe, le shard est réputé complet et
   ne sera jamais rechargé. C'est ce qui a rendu permanente la perte de 99,99 % des
   lignes NISSENS.

4. **Les preuves sont détruites après coup.** `load-t400-active.py` supprime les `.sql`
   et `.csv` intermédiaires même après un chargement partiel.

5. **Des chemins concurrents et contradictoires.** Trois scripts écrivent le même booléen
   `pieces.piece_display` avec des critères d'éligibilité **différents et non
   réconciliés** ; trois autres portent le même `INSERT` vers `pieces_relation_type`.
   Lequel fait autorité n'est écrit nulle part.

6. **Aucun ordonnancement.** Aucun des 16 n'a d'appelant : ni cron, ni unité systemd, ni
   wrapper shell, ni référence dans le dépôt. L'ordre d'exécution de mars 2026 n'existait
   que dans la tête de l'opérateur. Les dépendances reconstituées ci-dessus viennent de
   la lecture du code, pas d'un orchestrateur.

## Récupération ≠ modernisation

Cette PR fait la **récupération**. La **modernisation** est instrumentée mais non
appliquée : les modules qu'un futur rejeu devra utiliser existent, sont testés, et
attendent d'être câblés.

| besoin | module | garantie |
|---|---|---|
| périmètre figé, deux modes disjoints | [`scripts/tecdoc_scope.py`](../tecdoc_scope.py) | `--scope-mode historical` exige l'artefact scellé ; aucun repli vers `current` |
| perte de lignes impossible | [`scripts/tecdoc_load_guard.py`](../tecdoc_load_guard.py) | `émis == chargées + dédoublonnées + rejets motivés`, sinon STOP |
| identités jamais réattribuées | [`scripts/tecdoc_identity_guard.py`](../tecdoc_identity_guard.py) | dérive, réemploi et collision refusés |
| patrimoine applicatif intact | [`scripts/tecdoc_preservation.py`](../tecdoc_preservation.py) | 9 ensembles comparés au manifeste scellé |
| données neuves en quarantaine | [`scripts/tecdoc_reconcile.py`](../tecdoc_reconcile.py) | `NEW_FROM_SOURCE` et `CONFLICT` jamais activés |
| sceau unique | [`scripts/tecdoc_seal.py`](../tecdoc_seal.py) | une seule définition de la canonicalisation |

Tests : `bash scripts/test-tecdoc-scope.sh` (24) et `bash scripts/test-tecdoc-guards.sh` (26).

Le patch type, à appliquer script par script lors de la phase de modernisation :

```python
# AVANT — le périmètre dépend d'un drapeau d'affichage marchand, muable
def get_active_dlnrs():
    cur.execute("""
    SELECT sm.dlnr FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    ORDER BY sm.dlnr""")
    return [r[0] for r in cur.fetchall()]

# APRÈS — le mode est explicite, l'artefact est vérifié, aucun repli n'est possible
from tecdoc_scope import ajouter_arguments_perimetre, resoudre_dlnr

ajouter_arguments_perimetre(parser)              # --scope-mode / --scope-file
dlnrs = resoudre_dlnr(args.scope_mode, args.scope_file,
                      selection=args.scope_selection)
```

## Le cas `fix-vehicles-massdoc.py`

La copie DEV (`4bd8d29f2f39`, 2026-03-26 19:29) est **antérieure** à la version
versionnée (commit `756e619c4`, 2026-03-27 21:32) et **plus dangereuse** : elle contient
`DROP TABLE IF EXISTS tecdoc_map.modele_id_remap` suivi d'un `CREATE` + `INSERT` qui
réattribue les identifiants de modèle par `ROW_NUMBER`. La version versionnée a retiré
cette phase — son en-tête le dit explicitement : *« PAS de remap modele_id »*.

La copie DEV n'est donc **pas** rapatriée : elle serait une régression, et
`tecdoc_map.modele_id_remap` fait partie des registres d'identité intouchables.

La version versionnée portait par ailleurs un mot de passe de base de production en
clair, depuis le 2026-03-27, sur un dépôt public. Il a été retiré dans cette PR et
remplacé par une lecture d'environnement. **Retirer la valeur du fichier ne réduit pas
l'exposition passée** : l'historique git public la conserve. Voir
[`audit/massdoc-tecdoc-pipeline-recovery-2026-09-08.md`](../../audit/massdoc-tecdoc-pipeline-recovery-2026-09-08.md).

## La pollution de 2026-04-13

`/opt/automecanik/data/tecdoc/DO-NOT-RUN-FROZEN.md` gèle deux scripts responsables de
~219 M lignes fantômes dans `pieces_relation_type` (60 % de la table), pour avoir casté
`t400.col_6::int` directement en `target_internal_id` sans passer par
`tecdoc_map.vehicle_registry`. `populate-source-linkages.v2.py`, présent ici, est la
version corrective : il résout via `linkage_target_registry`.

Deux constats sur ce gel, vérifiés le 2026-09-08 :

- le script gelé `populate-source-linkages.py.frozen.20260413` existe toujours sur DEV
  et n'est **pas** rapatrié ici — le gel est respecté ;
- son jumeau `tecdoc-project-core.py.frozen.20260413` et le rapport de pollution
  `.spec/reports/pieces-relation-type-pollution-2026-04-13.md` que la note référence
  **n'existent plus**, ni sur disque ni dans git. La note de gel a survécu à ses preuves.
