# massdoc — C1 : reproductibilité du staging TecDoc avant toute suppression (2026-09-02)

> **Question tranchée** : les ~111 Go de staging TecDoc froids depuis avril 2026
> (`tecdoc_map.source_linkages` 90 Go, `tecdoc_raw.t400` 17 Go, `t232` 1,8 Go,
> `tecdoc_rebuild` 946 Mo, `tecdoc_norm` 471 Mo, `source_linkage_criteria` 356 Mo)
> sont-ils **régénérables à coût nul** depuis les livraisons TecDoc + scripts, ou
> faut-il payer un dump (egress + projet scratch) avant de les supprimer ?
>
> **Verdict : régénérables, à une condition — réécrire un parseur de ~40 lignes
> qui a disparu du disque et n'a jamais été commité.** Aucun dump payant n'est
> justifié (NO-GO n° 18). Les suppressions C3/C4 restent **owner-gated** et
> conditionnées à un essai de rejeu réel (NO-GO n° 11 : « une reproductibilité
> non testée n'est pas une sauvegarde »).

## Couverture (honnêteté)

| Élément | Statut |
|---|---|
| Scripts sous `/opt/automecanik/data/tecdoc/` (hors repo git) | **Vérifié** — lus intégralement |
| Archive source `SQL-CONVERTED.7z` : présence, checksum, shards 400/232 | **Vérifié** — commandes ci-dessous |
| Parseur `scripts/tecdoc-mysql-to-csv.py` : disque + historique git complet | **Vérifié absent** |
| Consommateurs de `tecdoc_norm.*` et `source_linkage_criteria` | **Non vérifié** — aucun producteur ni lecteur trouvé dans les scripts lus ; grep exhaustif backend/scripts non fait pour ces deux objets |
| Décision documentée « prochaine livraison TecDoc » | **Non trouvée** (log-archive-2026.md non balayé) |

## Preuves

```
$ ls -la /opt/automecanik/app/.github/SQL-CONVERTED.7z /opt/automecanik/app/.archive/docs/SQL-CONVERTED.7z
-rw-rw-r-- 1 deploy deploy 6128758380 mars  15 18:27 /opt/automecanik/app/.github/SQL-CONVERTED.7z
-rw-rw-r-- 1 deploy deploy 6128758380 juin  15 01:00 /opt/automecanik/app/.archive/docs/SQL-CONVERTED.7z

$ cd /opt/automecanik/data/tecdoc && sha256sum -c manifest-checksum.txt
/opt/automecanik/app/.github/SQL-CONVERTED.7z: OK          (15,6 s)

$ 7z l /opt/automecanik/app/.github/SQL-CONVERTED.7z | grep -E '\b(400|232)\.[0-9]+\.sql$' | ... | uniq -c
   1222 232
   1198 400

$ git log --all --oneline -- scripts/tecdoc-mysql-to-csv.py          → (vide)
$ git log --all --oneline --diff-filter=A -- '*tecdoc-mysql-to-csv*'  → (vide)
$ git log --all -S'tecdoc-mysql-to-csv' --oneline
df8f5a4d3 feat(tecdoc): add import logging to __tecdoc_import_log table   (2026-03-21 ; ajoutait scripts/tecdoc-import.py, lui aussi absent aujourd'hui)
$ find /opt/automecanik -name 'tecdoc-mysql-to-csv*' -not -path '*/node_modules/*'   → (vide)
```

Les deux copies de l'archive sont `.gitignore`-ées (`*.7z`, ligne 248) — jamais dans git,
donc jamais couvertes par un clone. Le manifeste ne couvre que la copie `.github/`.

## Chaîne de production (DAG) — tout est rejouable, rien n'est one-shot

```
SQL-CONVERTED.7z ──7z e──> <table>.<DLNR>.sql (MySQL INSERT)
        │
        ├─[ scripts/tecdoc-mysql-to-csv.py  ← MANQUANT ]─> <table>.<DLNR>.csv
        │      contrat CLI (load-t400-active.py:107-115) : python3 PARSER <in.sql> -o <out.csv>
        │      colonnes de sortie t400 : col_1..col_8 (+ 5 colonnes de provenance ajoutées par le loader)
        │
        ├─ load-t400-active.py ─COPY─> tecdoc_raw.t400           (idempotent : skip par DLNR déjà chargé)
        └─ load-all-suppliers-v3.py ─COPY─> tecdoc_raw.t232, t2xx (idem ; CREATE TABLE auto)
                    │
                    ▼
        populate-source-linkages.v2.py  (+ linkage_target_registry, auto_type, __tecdoc_supplier_mapping)
                    │   ON CONFLICT DO NOTHING — JAMAIS la v1 .frozen.20260413 (pollution ~219 M lignes)
                    ▼
        tecdoc_map.source_linkages  ──> populate-linkages-genartnr.py (auto-donneur)
                    │
        project-linkages-v3.py / project-prt-remap-batch.py (+ type_id_remap)
                    ▼
        public.pieces_relation_type   [LIVE — ne lit jamais le staging en retour, sauf NOT EXISTS]
```

## Verdict par objet

| Objet | Taille | Verdict | Condition |
|---|---|---|---|
| `tecdoc_raw.t400` | 17 Go | **RÉGÉNÉRABLE** | archive intacte + loader présent + parseur **à réécrire** (~40 lignes, contrat CLI connu) |
| `tecdoc_raw.t232` | 1,8 Go | **RÉGÉNÉRABLE** | idem (1 222 shards dans l'archive) |
| `tecdoc_map.source_linkages` | 90 Go | **RÉGÉNÉRABLE (transitif)** | t400 régénéré + `populate-source-linkages.v2.py` (schéma courant `pg_id_source`) |
| `tecdoc_rebuild.*` | 946 Mo | **RÉGÉNÉRABLE — jetable par conception** | schéma d'essai « Session A » (`--target-schema tecdoc_rebuild`) |
| `tecdoc_norm.*` | 471 Mo | **NON PROUVÉ** | aucun producteur ni consommateur trouvé — ne pas supprimer sur cette preuve |
| `tecdoc_map.source_linkage_criteria` | 356 Mo | **NON PROUVÉ** | phase P5 `t410 → pieces_relation_criteria` déclarée dans `project-enrichment.py:15`, implémentation introuvable |

Total régénérable établi : **≈ 109 Go** (t400 + t232 + source_linkages + tecdoc_rebuild).

## Défauts à corriger avant tout rejeu (sinon le rejeu échoue ou pollue)

1. **Parseur manquant** — réécrire `scripts/tecdoc-mysql-to-csv.py` **dans le repo** (versionné,
   testé sur 1 shard de `extract/` où 79 fichiers `400.*` déjà parsés servent de fixture attendue),
   puis prouver le rejeu sur **un** DLNR de t400 dans un schéma d'essai avant tout drop.
2. **Deux scripts sur l'ancien nom de colonne** : `project-core-v2.py:250` et
   `populate-linkages-genartnr.py:148,183` utilisent `source_genartnr`, renommé `pg_id_source`
   le 2026-03-26. Seul `populate-source-linkages.v2.py` est à jour.
3. **Granularité de reprise = DLNR, pas ligne** : conserver t400 n'apporte **rien** pour une
   future livraison (une livraison mise à jour pour un DLNR déjà chargé serait ignorée à tort).
   Un rafraîchissement = truncate + reload de toute façon. Argument supplémentaire pour la
   suppression : garder t400 n'achète pas d'incrémental.
4. **Scripts hors git** : tout `/opt/automecanik/data/tecdoc/*.py` est non versionné, exposé à
   une perte de disque DEV. Le rapatriement dans `scripts/tecdoc/` est un préalable de bon sens à
   toute dépendance « régénérable ».

## Conséquences pour le séquencement (plan massdoc, Wave C)

- **C2 (dump payant) : NO-GO** — l'archive de 6,1 Go est sur disque, checksum OK, en deux copies.
  Un dump ne fournirait rien que l'archive n'a pas déjà.
- **C3** peut commencer par `tecdoc_rebuild` (jetable) puis, après preuve de rejeu, `t232` → `t400`.
- **C4** (`source_linkages` 90 Go, seule, en dernier) après le rejeu prouvé de t400 → source_linkages
  sur un sous-ensemble. **GO owner nominatif** par étape (invariant 9, DB destructive).
- `tecdoc_norm.*` et `source_linkage_criteria` **hors liste** tant qu'un producteur n'est pas trouvé.
- Rappel facturation : les drops ne réduisent **pas** la facture disque ; seul C5 (upgrade PG)
  right-size à 1,2 × la base.

## Note hors périmètre — disque DEV

`df` sur la machine DEV : **90 % utilisé** (130 / 150 Go). `workdir/` 8,8 Go et `extract/` 1,8 Go
sous `/opt/automecanik/data/tecdoc/` sont des caches jetables (les loaders les suppriment
fichier par fichier), et l'archive est dupliquée (`.github/` + `.archive/docs/`, 6,1 Go chacune).
Aucune action ici ; à signaler à l'owner.
