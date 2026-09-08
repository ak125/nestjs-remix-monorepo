# Pipeline TecDoc fail-closed — démonstration sur un DLNR en PostgreSQL jetable

> **Date** : 2026-09-08 · **Base** : `053c1e58b` (PR #1417) · **Périmètre** : rendre le
> pipeline récupéré *fail-closed* et le démontrer sur un petit DLNR dans un PostgreSQL
> jetable. **Le rejeu complet n'est pas exécuté par cette mission.**
>
> Principe directeur : **une perte de ligne, une dérive d'identité ou une différence de
> scope ne peut plus produire un run vert.**

---

## 0. Priorité 0 — `BLOCKED_BY_SECRET_ROTATION` (non levé)

**Le mot de passe `postgres` PROD exposé publiquement sur GitHub depuis 2026-03-27 n'a
pas été tourné.** Vérifié le 2026-09-08 par comparaison d'empreintes SHA-256 tronquées
entre la valeur littérale de `scripts/fix-vehicles-massdoc.py` avant sa purge (parent de
`053c1e58b`) et `SUPABASE_DB_PASSWORD` du `.env` courant : **empreintes identiques**.

La valeur n'a été ni affichée, ni copiée, ni journalisée, et aucun secret n'a été modifié.
C'est une action **owner**, hors du mandat de cette mission.

> Une première passe de vérification, par balayage `git log -S` large, avait conclu
> « rotation effectuée ». Elle avait matché une chaîne sans rapport dans un commit de
> #1417 ; le contrôle ciblé sur le fichier réellement fautif la contredit. Seul le second
> verdict est retenu.

**Décision de poursuite** : les travaux ci-dessous s'exécutent intégralement dans un
PostgreSQL jetable. Les seuls accès à MassDoc PROD sont des `SELECT` de comparaison
(§6, §7). Aucun n'utilise le compte `postgres` en écriture.

---

## 1. Implémentation de référence — et une correction à PR #1417

### 1.1 Correction : l'attribution publiée dans #1417 était trop affirmative

**PR #1417 §3 attribuait la perte de mars 2026 au filtre `if len(row) >= 8` de
`load-t400-active.py`. C'est réfuté.** La colonne `_source_row_no`, remplie par le
parseur avec un compteur incrémental, le prouve directement :

| DLNR | lignes en base | `_source_row_no` | `count(distinct)` | forme |
|------|---------------:|------------------|------------------:|-------|
| 4523 (HIDRIA, sain) | 13 057 | `[1, 13057]` | 13 057 | préfixe contigu |
| 30 (divergent) | 69 000 | `[1, 69000]` | 69 000 | préfixe contigu |
| 123 (divergent) | 100 | `[1, 100]` | 100 | préfixe contigu |

**Un filtre disperse les pertes ; il ne tronque pas.** Si `len(row) >= 8` avait éliminé
des lignes, les numéros survivants seraient troués. Ils sont contigus de 1 à N : le
chargement s'est **arrêté net**.

### 1.2 Le loader qui a réellement écrit `t400`

`T400_COLUMNS` (L119-122 de `load-t400-active.py`) mappe les 13 champs du CSV, dont
`_source_filename`, `_source_row_no` et `_raw_hash`. Aucun autre loader candidat ne les
écrit : `load-all-suppliers-v3.py` remplit ses colonnes par position avec `None`. Mesure
en PROD : ces trois colonnes sont remplies à **100 %** sur les trois DLNR ci-dessus,
tandis que `_batch_id` et `_loaded_at` sont **NULL partout**. Cette signature est celle
de `load-t400-active.py`, et d'aucun autre. Il est donc bien l'implémentation de
référence — mais pour des raisons différentes de celles avancées en #1417.

### 1.3 Le mécanisme réel — trois lignes de code

```python
conn.autocommit = True                     # L33 — chaque COPY est committé isolément
...
    except Exception as e:                 # L155
        log(f"  ERROR DLNR={dlnr}: {e}")   # L156 — avalée, jamais re-levée
    ...
    return total                           # L161 — rend les lignes DÉJÀ committées
```

Une interruption en cours de fichier laisse un **préfixe committé**, l'exception est
journalisée puis oubliée, et `process_dlnr` annonce `DLNR=X: +N rows`. Le script sort
avec le code 0. Aucune comparaison n'est faite avec `rows_emitted` du `.meta` :
9 357 752 émises et 69 000 chargées coexistent sans alerte.

**Reste ouvert et assumé** : l'arithmétique exacte des points d'arrêt (69 000 et 100 ne
sont multiples ni de `CHUNK_SIZE = 50000`, ni l'un de l'autre) n'est pas reproductible
depuis le code seul. Ce n'est pas nécessaire : le correctif ne dépend pas de la cause de
l'interruption, il rend toute interruption **fatale et non committée**.

### 1.4 Décision

| Statut | Script | Raison |
|--------|--------|--------|
| **Retenu comme modèle** | `load-t400-active.py` | Seul loader dont la signature de provenance corresponde à `t400` en PROD. Sert de **modèle**, pas de base : il reste en quarantaine, inchangé, comme pièce à conviction. |
| **Chemin canonique** | **`scripts/tecdoc_replay.py`** (nouveau) | Réécriture fail-closed. Une transaction par lot, comptabilité vérifiée **avant** commit, aucune exception avalée. |
| Déprécié | `load-all-suppliers.py`, `-v2`, `-v3` | N'ont pas écrit `t400` en PROD. Périmètre dérivé de `__tecdoc_supplier_mapping`, lots de 500 en autocommit, `finally` qui efface le `.meta` — la seule preuve d'émission. |
| Auxiliaires | `tecdoc-mysql-to-csv.py` (parseur), `load-vehicle-tables.py` | Le parseur est conservé **tel quel** : c'est lui qui produit `rows_emitted` et `_source_row_no`, les deux termes de la garde. |

---

## 2. Périmètre scellé, câblé et obligatoire

`tecdoc_replay.py` n'accepte que `--scope-mode historical` avec `--scope-file`. Trois
refus explicites, tous éprouvés (§10) :

- `historical` sans artefact → `PerimetreManquant`, **jamais** de repli sur le vivant ;
- artefact altéré d'une seule valeur → `SceauInvalide` ;
- `--scope-mode current` → **refusé pour ce script** : le mode vivant ne porte ni le nom
  du shard ni son CRC32, donc rien n'y prouverait que la source rejouée est celle de
  mars 2026.

S'y ajoute un contrôle que le périmètre seul ne donnait pas : le **CRC32 du shard extrait
est comparé à celui scellé** avant toute analyse. Une source qui ne correspond pas au
sceau n'est pas la source de mars 2026.

## 3. Garde de comptabilité, câblée avant le commit

`verifier_lot(emis, charges, dedoublonnes, rejets)` est appelée **à l'intérieur de la
transaction**, avant `conn.commit()`. `emis` vient du `.meta` du parseur ; `charges` est
recompté **en base**, jamais depuis un compteur en mémoire. L'absence du `.meta` est
fatale : sans lui, l'égalité n'a pas de terme gauche.

Trois contrôles supplémentaires portent sur ce que la base contient réellement — ce
qu'aucun compteur en mémoire ne peut prouver : `count(*)` conforme, numéros de ligne
source **distincts**, borne max ≤ `rows_emitted`. L'égalité
`émis = chargées + dédoublonnées + rejetées` reste portée par `verifier_lot` **et par lui
seul** : y ajouter un second détecteur créerait la SoT dupliquée que l'invariant #2 interdit.

## 4. Skips silencieux supprimés — quatre états, pas de cinquième

Toute branche qui écartait une ligne rend désormais un état nommé :

| Branche historique | État désormais |
|--------------------|----------------|
| `if len(row) >= 8:` (sinon rien) | `rejeté[colonnes_insuffisantes]`, compté |
| numéro de ligne absent / non entier | `rejeté[numero_de_ligne_source_absent_ou_non_entier]` |
| empreinte de ligne absente | `rejeté[empreinte_de_ligne_absente]` |
| `except Exception: log(...)` | **fatal** — rollback, rien n'est committé |
| `SKIP: file not found`, `CSV parse failed` | **fatal** |

Le dédoublonnage n'a lieu que sur `--dedoublonner-identiques`, explicite, et il est
**compté séparément**. Par défaut, toute ligne source est chargée.
`tecdoc_load_guard.RAISONS_INTERDITES` refuse par ailleurs les motifs fourre-tout
(`autre`, `erreur`, `divers`…) qui permettraient de solder n'importe quel écart.

## 5 à 7. Identité, conservation, réconciliation

`scripts/tecdoc_replay_controls.py` est la **porte à franchir avant toute projection**.

- **Identité** — compare les cinq registres protégés entre le rejeu et la référence.
  Un registre que le rejeu n'a pas encore peuplé rend `non_applicable`, **jamais `OK`** :
  annoncer conforme une absence de contrôle ferait passer un vide pour une preuve.
- **Conservation** — `tecdoc_preservation` sur le manifeste scellé. `--manifeste` absent
  = code 3, refus de déclarer le contrôle passé.
- **Réconciliation** — classe chaque ligne en `EXISTING_PROD` / `NEW_FROM_SOURCE` /
  `CONFLICT` / `UNKNOWN`. Les trois dernières partent en **quarantaine** :
  `a_activer()` ne rend que `EXISTING_PROD`, et lève si on lui demande la quarantaine.
  L'inclusion **PROD ⊆ REBUILD** est vérifiée ; un `CONFLICT` la rompt.

## 8. DLNR de test et environnement jetable

**DLNR 4523 — HIDRIA.** Le plus petit candidat satisfaisant tous les critères : 13 057
lignes `t400`, 119 140 liaisons présentes, shards `400` et `232` dans l'archive, `.meta`
présent et concordant, **hors des 5 fournisseurs massivement divergents**.

Environnement : `postgres:17-alpine` (PostgreSQL **17.11**), container dédié, **tmpfs**
(rien ne survit à sa suppression), écoute `127.0.0.1` uniquement. Schéma calqué sur le DDL
réel relevé en PROD, `_loaded_at DEFAULT now()` compris. **La base MassDoc partagée n'est
jamais utilisée.**

## 9. Rejeu minimal, reproductible

```
$ python3 tecdoc_replay.py --scope-mode historical --scope-file <artefact> \
      --dlnr 4523 --table 400 --cible-dsn <jetable> --workdir <tmp>
OK  DLNR 4523 : 13057 emis = 13057 charges  (100.00% charge)
    lot 5df6aa4716dd1944fbf3746d5890852c · 400.4523.sql · CRC32 79F794A2
```

Réconciliation contre MassDoc PROD (lecture seule) :

```json
{ "identites_conservees": 13057, "absentes_de_prod": 0, "en_trop_dans_prod": 0,
  "conflits": 0, "indecidables": 0, "candidats_en_quarantaine": 0,
  "inclusion_respectee": true }
```

Les 13 057 lignes rejouées portent les **mêmes numéros de ligne source et les mêmes
empreintes** que celles servies en PROD. Le rejeu source-truth reproduit PROD à
l'identique sur ce fournisseur.

Conservation, mesurée contre PROD le même jour : **9 ensembles figés intacts** (7,2 s).

## 10. Injections de panne — le vert ne se prouve que par le rouge

`scripts/test-tecdoc-replay.sh`, **hermétique** (monte son propre PostgreSQL 17, ne lit
jamais PROD, n'exige aucun secret) : **24 assertions, 0 rouge, 36 s.**

| # | Injection | Attendu | Obtenu |
|---|-----------|---------|--------|
| 1 | **Perte de lignes** — CSV tronqué à 5 000, `.meta` intact | échec + **0 ligne committée** | code 5, 0 ligne ✓ |
| 2 | **Source altérée** — un octet ajouté au shard | échec avant tout chargement | code 3, base vide ✓ |
| 3 | **Périmètre** — sans artefact / DLNR hors scope / mode `current` | refus | code 4 ×3 ✓ |
| 3b | **Sceau** — une valeur modifiée dans l'artefact | refus | code 2 ✓ |
| 4 | **Dérive d'identité** — un `new_id` changé, puis un identifiant réemployé | refus | code 6 ×2 ✓ |
| 5 | **Conservation rompue** — une ligne retirée d'un ensemble figé | refus | code 7 ✓ |
| 6 | **Inclusion rompue** — ligne servie absente du rejeu, puis contenu contredit | refus | code 8 ×2 ✓ |

L'injection 1 est la reproduction fidèle du défaut de mars 2026 : le parseur rend compte
de 13 057 lignes émises, la base n'en reçoit que 5 000. **Le rejeu s'arrête, et la
transaction est annulée — pas une ligne n'est committée.** C'était l'inverse en mars.

## 11. Idempotence — mécanisme par étape, pas un `ON CONFLICT` global

| Étape | Mécanisme | Rejouer deux fois |
|-------|-----------|-------------------|
| Extraction | CRC32 + taille vérifiés contre le sceau | même octet, ou fatal |
| Analyse | parseur déterministe, `.meta` regénéré | même CSV |
| **Chargement** | **`_batch_id` déterministe** = `sha256(table\|dlnr\|crc32\|version)[:32]` | **refus explicite** (code 3), base inchangée |

`_batch_id` existe dans le schéma depuis l'origine et **n'a jamais été écrite** — la
remplir étend l'existant au lieu d'inventer un registre parallèle. Elle répond à « ce lot
est-il déjà chargé ? » là où `SELECT DISTINCT col_2` répondait « oui » dès la première
ligne présente : c'est ce qui a **figé** les chargements tronqués de mars, jamais retentés.

Vérifié : après un second rejeu identique, `13057` lignes, **1 seul lot**.
Effet de bord acquis : `_batch_id` et `_loaded_at` sont désormais remplies à 100 %, alors
que PROD les porte NULL partout (le loader historique poussait un NULL explicite, ce qui
**écrase** le `DEFAULT now()` au lieu de le laisser s'appliquer).

## 12. Rapport de réconciliation

Tous les nombres se recoupent : `13057 = 13057 + 0 + 0 + 0`, quarantaine vide, inclusion
respectée, `activables_sans_decision_humaine = 13057` — c'est-à-dire exactement les
lignes déjà servies par PROD, et rien d'autre.

## 13-14. Ce qui n'a pas été fait

**Zéro écriture PROD.** Aucun `INSERT` / `UPDATE` / `DELETE` / `DROP` / `TRUNCATE` /
`VACUUM` / `REINDEX` / migration / rejeu. Les seuls accès PROD sont des `SELECT` de
comparaison : structure des tables, provenance de trois DLNR, réconciliation du DLNR 4523,
et les 9 empreintes de conservation.

**Zéro DROP.** `tecdoc_rebuild`, `tecdoc_raw`, `source_linkages` et
`source_linkage_criteria` sont intacts. Le seul `DELETE` du banc porte sur son propre
PostgreSQL jetable.

**Rejeu complet non exécuté**, conformément au mandat.

## 15. CI et gouvernance

`.github/workflows/tecdoc-failclosed-guard.yml` — deux jobs :

1. **Ratchet** `scripts/lint/check-tecdoc-failclosed-ratchet.sh`
   - **R1** aucun script vivant ne dérive son périmètre du merchandising vivant ;
   - **R2** aucune écriture dans `tecdoc_raw` sans `verifier_lot` ;
   - **R3** la quarantaine reste une quarantaine — R3 vise les références
     **exécutables** (import, `sys.path`, invocation d'un `.py`), jamais la prose : citer
     les scripts historiques pour les expliquer reste légitime.
   Le garde **ne lint pas** `scripts/tecdoc-pipeline/**`, conservé tel quel comme pièce à
   conviction, et ne doit jamais être étendu pour le faire.
2. **Suites hermétiques** — `test-tecdoc-scope.sh` (24) + `test-tecdoc-guards.sh` (26).

Le banc `test-tecdoc-replay.sh` **n'est pas exécuté en CI** : il exige Docker et l'archive
source de 6 Go, absents d'un runner GitHub. Le déclarer « passé » ferait d'un skip une
preuve — précisément le vert-mais-faux que ce chantier corrige. C'est un geste DEV, et ses
relevés sont ci-dessus.

### Exemptions — motivées, vivantes, symétriques

`scripts/lint/tecdoc-failclosed-allowlist.txt`, format de
`tecdoc-api-surface-allowlist.txt` (motif obligatoire). Le ratchet **échoue aussi sur une
exemption morte** : une exemption qui ne correspond plus à rien étoufferait la règle le
jour où quelqu'un retire le correctif.

| Règle | Fichier | Nature |
|-------|---------|--------|
| R1 | `tecdoc_scope.py` | Fournisseur du mode `current` — porte la requête par construction |
| R1 | `tecdoc-scope-build/build_scope.py` | Producteur de l'artefact ; enregistre `pm_display` comme donnée d'époque |
| R1 | `tecdoc-import.py` | **Dette réelle**, préexistante (`df8f5a4d3`) |
| R2 | `tecdoc-batch-load.py` | **Dette réelle**, écrit `tecdoc_raw` sans garde (#1412) |

> Les deux dernières sont des **dettes**, pas des exemptions de confort. Tant qu'elles ne
> sont pas soldées, le principe « une perte de ligne ne peut plus produire un run vert »
> vaut pour le **chemin canonique**, pas pour tout le dépôt. Les solder — câbler
> `resoudre_dlnr` et `verifier_lot` — sort du périmètre de cette mission.

Preuve que le ratchet mord (les deux sens) : un script de test violant R1+R2 le fait
passer rouge (2 violations) ; une entrée d'allowlist volontairement morte aussi (1
violation). Les deux ont été exécutés puis retirés.

---

## Verdict — 11 points

| # | Point | Verdict |
|---|-------|---------|
| 1 | Rotation du secret PROD | **`BLOCKED_BY_SECRET_ROTATION` — non levé.** Empreintes identiques. Action owner. |
| 2 | Implémentation de référence | **Tranchée.** `load-t400-active.py` = modèle ; `tecdoc_replay.py` = chemin canonique. Attribution de #1417 **corrigée**. |
| 3 | Périmètre scellé obligatoire | **Vérifié.** 4 refus éprouvés, plus le CRC32 du shard. |
| 4 | Garde de comptabilité | **Vérifié.** Appelée avant `commit`, `charges` recompté en base. |
| 5 | Skips silencieux | **Vérifié.** 4 états, pas de cinquième ; motifs fourre-tout refusés. |
| 6 | Identité / conservation / réconciliation | **Vérifié**, dont 9 ensembles figés intacts contre PROD. Un registre non peuplé rend `non_applicable`, pas `OK`. |
| 7 | Environnement jetable | **Vérifié.** PG 17.11 sur tmpfs, local-only. MassDoc jamais utilisée. |
| 8 | Rejeu de bout en bout | **Vérifié.** 13 057 = 13 057, identique à PROD (numéros + empreintes). |
| 9 | Injections de panne | **Vérifié.** 24 assertions, 0 rouge ; les 6 familles échouent **avant** toute projection. |
| 10 | Idempotence | **Vérifié.** `_batch_id` déterministe, 2ᵉ rejeu refusé, base inchangée. |
| 11 | Rejeu complet | **Non exécuté** — conforme au mandat. |

**Couverture** : Vérifié — §1 à §12, §15 (74 assertions + relevés PROD reproduits ci-dessus).
Partiellement vérifié — §15, deux dettes réelles exemptées et nommées.
Non-vérifiable ici — l'arithmétique exacte des points d'arrêt de mars 2026 (§1.3), et la
rotation du secret, qui n'appartient pas à cette mission.
