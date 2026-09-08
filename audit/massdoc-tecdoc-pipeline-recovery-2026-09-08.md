# Pipeline TecDoc — rapatriement sous Git et préparation d'un rejeu source-truth

> Mission lecture seule sur PROD. Aucune mutation, aucune suppression, aucun rejeu.
> Base : PR #1416 mergée (`0a7999a1242bc76d0c599fdc1fbc0b48b2c7da74`).

---

## 0. Incident de sécurité découvert en cours de mission — action owner requise

**Le mot de passe superutilisateur PostgreSQL de la PROD MassDoc est publié en clair sur
GitHub depuis le 2026-03-27, et il est toujours valide.**

| | |
|---|---|
| Emplacement | `scripts/fix-vehicles-massdoc.py:46`, sur `origin/main` |
| Introduit par | commit `756e619c4`, 2026-03-27 21:32 |
| Exposition | **dépôt public**, ~5,5 mois |
| Compte | `postgres` sur `db.<project-ref>.supabase.co:5432`, connexion directe |
| Toujours actif ? | **OUI** — l'empreinte SHA256 du littéral publié est identique à celle du `SUPABASE_DB_PASSWORD` courant de `backend/.env` (comparé sans afficher les valeurs) |

### Pourquoi aucune garde n'a parlé — diagnostiqué, pas supposé

Le job gitleaks existait depuis le 2026-02-22, soit **avant** la fuite. Mais le
`.gitleaks.toml` de l'époque n'avait **pas** de bloc `[extend] useDefault = true`. Une
configuration gitleaks personnalisée **remplace** le jeu de règles par défaut au lieu de
l'étendre : le job tournait donc **sans aucune règle**. Même fichier, même binaire 8.21.2 :

```
config du 2026-03-27  →  no leaks found
config actuelle       →  leaks found: 1   (generic-api-key, ligne 46, entropie 3.58)
```

`[extend] useDefault = true` a été ajouté le 2026-05-07 par #380. Le job était donc
**vacant par construction** du 2026-02-22 au 2026-05-07, et la fuite tombe dans cette
fenêtre. Depuis mai, la garde voit la fuite — mais le scan par PR est *incrémental* et ne
re-scanne jamais un commit déjà mergé, et le scan hebdomadaire d'historique est
`continue-on-error: true`. Son exécution du 2026-09-07 affiche **`leaks found: 394`** et
se conclut en `success`.

Ce n'est pas une exemption abusive : ni `.gitleaksignore` ni l'allowlist ne couvrent ce
fichier. C'est une garde qui n'a jamais eu de règles, puis une garde qui mesure sans
assurer.

### Ce que cette PR fait, et ce qu'elle ne peut pas faire

Le littéral est retiré du fichier et remplacé par une lecture d'environnement, sur le
modèle déjà en place dans `scripts/tecdoc-batch-load.py`. **Cela ne réduit en rien
l'exposition passée** : l'historique git public conserve la valeur. Seule une **rotation
du credential** ferme la brèche. Elle n'a pas été faite — c'est une action owner.

Deux suites, hors périmètre de cette PR :

1. **Rotation du mot de passe `postgres`**, puis mise à jour de `backend/.env`, des
   secrets GitHub Actions et de tout runtime qui l'utilise.
2. **Triage des 394 findings** du scan hebdomadaire. Ce scan est non bloquant depuis sa
   création ; personne ne lit son SARIF. Tant qu'il reste `continue-on-error: true` sans
   revue, il ne protège de rien.

---

## 1. Réconciliation des 17 scripts historiques

| script historique | sur DEV | dans Git | requis au rebuild | statut |
|---|:-:|:-:|:-:|---|
| `load-all-suppliers.py` | ✅ | ➕ cette PR | non | **DOUBLON** (v1 de v3) |
| `load-all-suppliers-v2.py` | ✅ | ➕ cette PR | non | **DOUBLON** (v2 de v3) |
| `load-all-suppliers-v3.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `load-t400-active.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `load-vehicle-tables.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `create-vehicles-p4a.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `register-and-create-pieces.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `populate-source-linkages.v2.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `populate-linkages-genartnr.py` | ✅ | ➕ cette PR | non | **OBSOLETE** |
| `project-core-v2.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `project-new-data.py` | ✅ | ➕ cette PR | non | **OBSOLETE** (supplanté 2 h 16 plus tard) |
| `project-enrichment.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `project-linkages-v3.py` | ✅ | ➕ cette PR | non | **OBSOLETE** (ignore `type_id_remap`) |
| `project-linkages-retry.py` | ✅ | ➕ cette PR | non | **OBSOLETE** (reprise one-shot) |
| `project-prt-remap-batch.py` | ✅ | ➕ cette PR | incertain | **VERSIONNÉ**, rôle à trancher |
| `activate-pieces-v1.py` | ✅ | ➕ cette PR | **oui** | **VERSIONNÉ** |
| `fix-vehicles-massdoc.py` | ✅ | déjà sur `main` | **oui** | **VERSIONNÉ** — copie DEV **OBSOLETE et dangereuse** |

**16 rapatriés dans cette PR. 17/17 désormais sous Git. 0 manquant.**

La copie DEV de `fix-vehicles-massdoc.py` (`4bd8d29f2f39`, 2026-03-26 19:29) est
**antérieure** au commit `756e619c4` (2026-03-27 21:32) et contient
`DROP TABLE IF EXISTS tecdoc_map.modele_id_remap` suivi d'un `CREATE` + `INSERT` qui
réattribue les identifiants de modèle par `ROW_NUMBER`. La version versionnée a retiré
cette phase — son en-tête dit *« PAS de remap modele_id »*. La copie DEV n'est donc pas
rapatriée : ce serait réintroduire dans le dépôt un script qui détruit un registre
d'identité que l'étape 8 déclare intouchable.

Deux scripts gelés par `DO-NOT-RUN-FROZEN.md` ne sont pas rapatriés, le gel est respecté.
À noter : le jumeau `tecdoc-project-core.py.frozen.20260413` et le rapport de pollution
`.spec/reports/pieces-relation-type-pollution-2026-04-13.md` que la note référence
**n'existent plus**, ni sur disque ni dans git. La note a survécu à ses preuves.

---

## 2. Ce que la lecture des 16 a établi

Détail par script : [`scripts/tecdoc-pipeline/README.md`](../scripts/tecdoc-pipeline/README.md).

### 2.1 Le pipeline entier est piloté par des drapeaux d'affichage marchand

Neuf des seize lisent au moins un drapeau de visibilité **vivant** pour décider quoi faire :

| drapeau | ce qu'il gouverne réellement | scripts |
|---|---|---|
| `pieces_marque.pm_display` | quels fournisseurs sont chargés/projetés | 5 direct + 1 via vue |
| `auto_marque.marque_display` | quelles marques reçoivent des véhicules | 1 |
| `auto_type.type_display` | quels véhicules reçoivent des liaisons | 4 |
| `pieces.piece_display` | quelles pièces sont activées | 5 |

Cinq autres dérivent leur périmètre de `__tecdoc_supplier_mapping` sans filtre
d'affichage. Le problème dépasse donc le périmètre fournisseur identifié en #1416 : la
frontière de ce qui est reconstruit dépend, à chaque étage, de décisions de vitrine.

### 2.2 Aucun script n'a d'appelant

Ni cron, ni unité systemd, ni wrapper shell, ni référence dans le dépôt. Vérifié sur les
16. L'ordre d'exécution de mars 2026 n'existait que dans la tête de l'opérateur ; les
dépendances documentées dans le README ont été reconstituées par lecture du code.

### 2.3 Des chemins concurrents et contradictoires

- **Trois** scripts écrivent `pieces.piece_display` avec des critères d'éligibilité
  **différents et non réconciliés** (`activate-pieces-v1`, `populate-linkages-genartnr`,
  `project-prt-remap-batch`). Un seul journalise dans `activation_log` et offre un
  `--dry-run`.
- **Trois** portent le même `INSERT` vers `pieces_relation_type`
  (`project-linkages-v3`, `project-linkages-retry`, `project-prt-remap-batch`).

Lequel fait autorité n'est écrit nulle part.

---

## 3. La perte de mars 2026 : mécanisme établi

L'audit #1416 constatait la perte sans l'expliquer. Elle l'est maintenant, par une
mesure sur `_source_row_no` — le numéro de ligne source, écrit par le parseur :

| DLNR | marque | émis par le parseur | en base | plage `_source_row_no` | contigu |
|---:|---|---:|---:|---|:-:|
| 123 | NISSENS | 790 974 | **100** | 1 → 100 | ✅ |
| 30 | BOSCH | 9 357 752 | **69 000** | 1 → 69 000 | ✅ |
| 113 | PAYEN | 1 259 429 | **1 085 500** | 1 → 1 085 500 | ✅ |

**Les lignes chargées sont un préfixe contigu à partir de la ligne 1, sans trou.** Ce
n'est ni un filtrage métier, ni un échantillonnage, ni une déduplication.

Le mécanisme se déduit du code (`load-t400-active.py:124-165`) :

1. Les 100 lignes de NISSENS sont **inférieures** à `CHUNK_SIZE = 50000` : elles ne
   peuvent provenir que du *flush* final, placé **après** la boucle.
2. Ce flush est **à l'intérieur** du `try` : il n'est atteint que si la boucle s'est
   terminée **sans exception**.
3. Le `.meta` du parseur déclare pourtant `rows_emitted=790974`, `rows_rejected=0`.

Donc : la boucle a lu le fichier **entier, sans erreur**, et seules les 100 premières
lignes ont franchi le filtre `if len(row) >= 8` de la ligne 140. Ce filtre n'a **ni
`else`, ni compteur, ni log**. Les 790 874 lignes restantes ont été jetées en silence, et
le script est sorti en code 0.

Trois candidats expliquent le décrochage du parsing à cette ligne précise — fin de ligne
non neutralisée (`open()` sans `newline=''`, L135), limite de champ `csv` de 131 072
octets, ou octet NUL restitué par le parseur. **Départager les trois exigerait de
re-parser le shard**, ce que cette mission ne fait pas.

**L'amplificateur, lui, est certain** : le saut « déjà chargé » (L69 + L230-231) est à la
granularité du DLNR. Dès qu'une seule ligne existe, le shard est réputé complet et ne
sera jamais rechargé. C'est ce qui a rendu la perte permanente et invisible.

### 3.1 La comptabilité existait déjà — elle n'a jamais été comparée

Le parseur écrit un sidecar `.meta` (`rows_parsed`, `rows_emitted`, `rows_rejected`) et
imprime `SUMMARY|<fichier>|rows=N|errors=E` sur stderr. **Le chargeur ne lit rien de tout
cela** : il ne consulte que `returncode` (L114), et se contente de le journaliser avant de
charger le CSV quand même.

La garde livrée ici ne crée donc pas une capacité nouvelle : elle ferme une boucle qui
était déjà à moitié construite.

---

## 4. Décision source-truth — confirmée et inscrite

```
NISSENS → source complète
BOSCH   → source complète
FEBI    → source complète
RIDEX   → source complète
PAYEN   → source complète
```

Le futur pipeline reproduit la **source TecDoc**, jamais l'état tronqué de `t400`.
`t400` reste la vérité **forensique** de ce qui s'est passé ; il n'est pas la vérité
**fonctionnelle** du rebuild. Aucune troncature volontaire ne sera introduite pour imiter
l'état actuel.

Conséquence mécanique, portée par `tecdoc_reconcile.py` : le rejeu produira **plus** de
lignes que la PROD. L'invariant vérifié est donc `PROD ⊆ REBUILD`, pas `PROD == REBUILD`.

---

## 5. Ce que la PR livre — instrumenté et testé, pas appliqué

Séparation **RÉCUPÉRATION / MODERNISATION** demandée à l'étape 3 : les 16 scripts sont
rapatriés **verbatim** (16/16 SHA256 identiques à l'original), et les modules qu'un futur
rejeu devra utiliser sont écrits et testés, **sans être câblés**.

| besoin | module | garantie |
|---|---|---|
| périmètre figé, modes disjoints | `scripts/tecdoc_scope.py` (étendu) | `--scope-mode historical` exige l'artefact scellé ; **aucun repli** vers `current` |
| perte de lignes impossible | `scripts/tecdoc_load_guard.py` | `émis == chargées + dédoublonnées + rejets motivés`, sinon STOP |
| identités jamais réattribuées | `scripts/tecdoc_identity_guard.py` | dérive, réemploi, collision refusés |
| patrimoine intact | `scripts/tecdoc_preservation.py` | 9 ensembles comparés au manifeste scellé |
| données neuves en quarantaine | `scripts/tecdoc_reconcile.py` | `NEW_FROM_SOURCE` / `CONFLICT` jamais activés |
| sceau unique | `scripts/tecdoc_seal.py` | une seule canonicalisation, partagée |

`tecdoc_seal.py` extrait une logique qui existait déjà en trois exemplaires (lecteur de
périmètre, deux générateurs) et était sur le point d'en avoir une quatrième. La
règle-de-trois est franchie ; l'extraction réduit l'entropie au lieu de l'augmenter.

### 5.1 Une dérivation devinée, prise en défaut puis remplacée

Le vérificateur de conservation construisait d'abord ses requêtes en dérivant la forme
documentée dans le manifeste. Confrontée à la base, cette dérivation **échouait sur
`gamme_registry`** : ordonner par l'expression texte `pg_id_source||'>'||pg_id` donne
`64816aa0…`, alors que le manifeste porte `0a2ef785…`, obtenu en ordonnant par
`pg_id_source` **numérique** — un tri texte place « 1000 » avant « 2 ». Même cardinal
(9 702), empreinte différente.

Sur `type_id_remap`, la dérivation tombait juste **par accident** : tous les `old_id` ont
six chiffres, donc ordre texte == ordre numérique.

Une requête devinée qui tombe juste sur 8 cas sur 9 est plus dangereuse qu'une table
écrite : elle aurait un jour fait échouer un contrôle de conservation sur une base
pourtant intacte, et l'écart aurait été imputé à la donnée. La dérivation est donc
remplacée par **9 requêtes explicites, chacune vérifiée contre la PROD le 2026-09-08**.

---

## 6. Preuves d'exécution

### Scope figé, deux modes disjoints

```
$ bash scripts/test-tecdoc-scope.sh
  PASS  historical + artefact = les 110 projetes
  PASS  historical + selection charges = les 149
  PASS  historical SANS scope-file est REFUSE
  PASS  historical sur artefact altere est REFUSE
  PASS  current + scope-file est REFUSE (sources contradictoires)
  PASS  un mode inconnu est REFUSE
PASS=24  FAIL=0
```

### Gardes chargement / identité / conservation / quarantaine

```
$ bash scripts/test-tecdoc-guards.sh
=== garde de completude du chargement ===
  PASS  emis == charges : accepte
  PASS  perte massive (BOSCH mars 2026) : REFUSE
  PASS  perte d'UNE seule ligne : REFUSE
  PASS  dedoublonnage explicitement compte : accepte
  PASS  rejets motives et comptes : accepte
  PASS  rejet non explique (categorie fourre-tout) : REFUSE
  PASS  rejet a raison vide : REFUSE
  PASS  plus de lignes chargees qu'emises : REFUSE
  PASS  rapport a zero lot n'est pas un succes
=== garde d'identite ===
  PASS  mapping conserve + cle nouvelle : accepte
  PASS  un identifiant existant qui change : REFUSE
  PASS  un identifiant existant donne a une AUTRE cle : REFUSE
  PASS  rejeu partiel : identite intacte, absences signalees
=== conservation applicative (sur le manifeste reel, sans base) ===
  PASS  avant == apres : conservation intacte (exit 0)
  PASS  suppression simulee d'une gamme : REFUSE (exit 7)
  PASS  suppression simulee d'un vehicule : REFUSE (exit 7)
  PASS  suppression simulee d'une piece : REFUSE (exit 7)
  PASS  un ensemble non mesure est un ECHEC, pas un saut (exit 7)
  PASS  manifeste altere : REFUSE (exit 2)
=== reconciliation et quarantaine ===
  PASS  source-truth qui AJOUTE (cas BOSCH) : inclusion respectee
  PASS  les ajouts partent en quarantaine, pas en activation
  PASS  a_activer ne rend que EXISTING_PROD
  PASS  activer la quarantaine : REFUSE
  PASS  une cle servie en PROD que le rejeu perd : inclusion ROMPUE
  PASS  une valeur qui diverge : CONFLICT, inclusion ROMPUE
  PASS  valeur manquante d'un cote : UNKNOWN, jamais activee
PASS=26  FAIL=0
```

Les cas négatifs sont le cœur de ces suites : **une garde qu'on n'a jamais vue refuser
n'a pas été testée, elle a seulement été vue se taire**.

### Conservation vérifiée contre la PROD du jour

Les 9 requêtes d'empreinte rejouées en lecture seule le 2026-09-08 reproduisent
**exactement** les 9 empreintes scellées dans le manifeste de #1416 :

```
$ python3 scripts/tecdoc_preservation.py \
    --manifest audit/massdoc-tecdoc-preservation-manifest-2026-03.json \
    --mesures  mesures-prod-2026-09-08.json
conservation intacte — 9 ensembles applicatifs identiques au manifeste.
```

Les 23 457 véhicules, 7 088 modèles, 119 702 pièces, 876 gammes, 23 457 mappings
d'identité, 43 484 cibles de liaison et le rollup des 3 240 177 articles sont donc
**inchangés** entre le 2026-09-08 (mesure #1416) et aujourd'hui.

### Aucun secret dans le lot rapatrié

```
$ gitleaks dir scripts/tecdoc-pipeline --config .gitleaks.toml
INF scan completed  ·  INF no leaks found
```

Les 16 scripts lisent tous leur mot de passe depuis `backend/.env` — aucun n'en contient
en dur. Ils codent en dur des identifiants d'infrastructure (hôte, port, référence de
projet), ce qui est la convention déjà en vigueur dans `scripts/tecdoc-batch-load.py`
et une valeur explicitement déclarée non-secrète dans `.gitleaks.toml`.

---

## 7. Idempotence — état réel, par étape

Aucune étape n'est idempotente au sens fort. Le tableau dit ce qui est protégé, et ce qui
ne l'est pas.

| étape | doublons | réattribution d'ID | reprise après échec partiel | verdict |
|---|---|---|---|---|
| extract (7z) | s.o. | s.o. | code retour de `7z` **jamais lu** | **non protégé** |
| parse | s.o. | s.o. | `.meta` + `SUMMARY` émis, **jamais lus** | **non protégé** |
| load raw | `copy_from` sans `ON CONFLICT` ni clé unique ; seule protection = le saut « déjà chargé » | non | **impossible** : ≥ 1 ligne ⇒ shard réputé complet à jamais | **NON IDEMPOTENT** |
| source_linkages | clé métier sha256 + `ON CONFLICT DO NOTHING` + `DISTINCT` | non | **impossible** : même saut DLNR-granulaire | **partiel** — sûr à la ligne, pas à la reprise |
| project relations | `ON CONFLICT DO NOTHING` | `project-linkages-v3` **ignore `type_id_remap`** | dépend d'un run antérieur | **partiel** |
| project enrichments | `ON CONFLICT DO NOTHING` (une cible non spécifiée) | non | aucune | **partiel** |

Trois défauts transverses :

- **`ON CONFLICT` nu**, sans cible, dans plusieurs scripts : il absorbe les conflits de
  *n'importe quelle* contrainte d'unicité, y compris plus étroite que la clé métier. Un
  effondrement massif de lignes serait invisible, `cur.rowcount` ne comptant que l'inséré.
- **Le snapshot « déjà chargé » est pris une seule fois** avant le pool de workers, sans
  verrou d'avis : deux exécutions concurrentes chargeraient les mêmes shards en doublon.
- **Le périmètre dépend de l'état vivant** : même `t400`, autre jour, autre volume, sans
  aucune trace de l'écart.

Ce que le futur pipeline doit fournir, et qui n'existe nulle part aujourd'hui : une
reprise fondée sur **complétude prouvée** (compte attendu par shard, via l'artefact
scellé et le `.meta`) plutôt que sur la présence d'au moins une ligne.

---

## 8. Identités et conservation — ce qui est garanti

`tecdoc_identity_guard.py` refuse les trois interdits — **dérive** (une clé mappée change
de valeur), **réemploi** (un identifiant pris est donné à une autre clé), **collision**.
Une clé nouvelle recevant un identifiant libre reste légitime : c'est ainsi qu'un rejeu
source-truth ajoute ce que mars avait perdu.

Registres couverts : `type_id_remap`, `article_registry`, `linkage_target_registry`,
`pg_id_remap`, `modele_id_remap`.

`tecdoc_preservation.py` couvre les 11 tables applicatives via les 9 ensembles scellés,
et **échoue** si un ensemble n'est pas mesuré — ne pas mesurer n'est pas conserver.

Rappel inscrit dans les deux modules : la campagne a créé **876 gammes**, dont 18
seulement portent « TecDoc » dans leur nom. Le manifeste les identifie par **bande
d'identifiants** (`pg_id >= 60000`), jamais par libellé.

---

## 9. Nouvelles données — quarantaine, quatre catégories

| catégorie | définition | activation |
|---|---|---|
| `EXISTING_PROD` | même clé, même valeur des deux côtés | **automatique** |
| `NEW_FROM_SOURCE` | clé absente de la PROD | **quarantaine** |
| `CONFLICT` | même clé, valeurs différentes | **quarantaine** — arbitrage humain |
| `UNKNOWN` | valeur manquante d'un côté | **quarantaine** |

`a_activer()` ne rend que `EXISTING_PROD`. Le drapeau `inclure_quarantaine=True` existe
uniquement pour que la demande soit **écrite dans le code appelant et visible en revue** —
il lève systématiquement.

Une cinquième grandeur est rapportée à part : `absentes_du_rejeu`, les clés servies en
PROD que le rejeu ne reproduit pas. Ce n'est pas une catégorie de quarantaine mais le
signal qui rend `inclusion_respectee` faux.

---

## 10. Rejeu hors PROD et sauvegarde forensique — plans, non exécutés

### Chaîne de rejeu isolée

```
SQL-CONVERTED.7z (6,1 Go, hors git, machine DEV)
   ↓ parse            scripts/tecdoc-mysql-to-csv.py  (versionné)
   ↓ load raw         → schéma tecdoc_replay_<date>   (JAMAIS tecdoc_raw)
   ↓ source_linkages  → schéma tecdoc_replay_<date>
   ↓ projections      → schéma tecdoc_replay_<date>
   ↓ comparaison      tecdoc_reconcile.py vs manifeste PROD (lecture seule)
```

`populate-source-linkages.v2.py` accepte déjà `--target-schema`, ce qui rend l'isolation
possible sans le modifier. **Piège identifié** : `--dlnr-only` court-circuite le périmètre
**et écrit par défaut dans `tecdoc_map`** — un mode « test » qui vise la cible réelle.
À corriger avant tout essai.

Aucun essai n'a été lancé dans cette mission : la cible isolée n'existe pas, et la créer
sur la base partagée serait une mutation PROD.

### Sauvegarde forensique avant tout futur DROP

Tailles réelles mesurées le 2026-09-08 :

| objet | lignes | taille |
|---|---:|---:|
| `tecdoc_map.source_linkages` | 339 249 945 (exact) | **90 Go** |
| `tecdoc_raw.t400` | 138 815 762 (exact) | **17 Go** |
| `tecdoc_raw.t232` | 14 498 915 (exact) | 1 770 Mo |
| `tecdoc_rebuild.source_linkages` | ~2 608 718 | 662 Mo |
| `tecdoc_map.source_linkage_criteria` | ~1 614 421 | 356 Mo |
| `tecdoc_rebuild.pieces_relation_type` | ~2 225 804 | 284 Mo |
| **total** | | **≈ 110 Go** |

Format proposé : `COPY … TO PROGRAM 'zstd -19'` en CSV, un fichier par table, shardé par
DLNR pour `t400` et `source_linkages` afin qu'une restitution partielle reste possible.
Compression attendue 8–12× sur ce type de données très répétitives, soit **9 à 14 Go**.
Chaque shard accompagné de son SHA256 et d'un manifeste listant compte, bornes et
empreinte — le même contrat que le manifeste de conservation, pour que la restitution
soit **vérifiable** et pas seulement possible.

Emplacement : **hors** de la base et hors du disque DEV (occupé à 74 %). La destination
n'est pas décidée — c'est une décision owner, avec un coût de stockage.

**Non exécuté** : un dump de 110 Go n'est pas nécessaire dans cette PR, et le lancer
consommerait de l'I/O sur la base de production.

---

## 11. Verdicts

### Rejeu complet possible maintenant ? — **NON**

Raison principale unique : **aucun environnement isolé n'existe**, et les scripts
rapatriés ne sont pas câblés aux gardes. Ils sont sous git — c'est ce qui bloquait avant
— mais les lancer aujourd'hui reproduirait le défaut de mars : périmètre vivant,
comptabilité absente, saut « déjà chargé » qui fige toute perte.

### DROP des ~110 Go autorisable ? — **NON**

```
[x] scope figé et scellé                      #1416
[x] sources présentes et vérifiées            149/149 shards, CRC32
[x] parseur sous git                          scripts/tecdoc-mysql-to-csv.py
[x] scripts du pipeline sous git              17/17 — CETTE PR
[x] décision source-truth tranchée            owner, 2026-09-08
[x] gardes chargement/identité/conservation   50 assertions vertes
[x] conservation vérifiée contre la PROD      9/9 empreintes identiques
[ ] scripts câblés aux gardes                 MODERNISATION, non faite
[ ] rejeu complet hors PROD exécuté           jamais tenté
[ ] comparaison rebuild/PROD conforme         sans objet tant que 9 est rouge
[ ] dump de sécurité effectué                 planifié, non exécuté
[ ] mot de passe PROD tourné                  ACTION OWNER — §0
```

7 vertes, 5 rouges. Le `DROP` reste interdit.

### Prochaine action unique

**Tourner le mot de passe `postgres` de la PROD MassDoc.** Ce n'est pas la suite logique
du chantier TecDoc, et c'est pourtant la seule action dont le report coûte quelque chose
chaque jour : un superutilisateur de la base de production est lisible publiquement depuis
5,5 mois. Tout le reste du chantier peut attendre ; cela, non.

L'action suivante, une fois la rotation faite : câbler `load-t400-active.py` aux gardes
comme implémentation de référence, et prouver le patch sur un DLNR minuscule dans un
schéma jetable.
