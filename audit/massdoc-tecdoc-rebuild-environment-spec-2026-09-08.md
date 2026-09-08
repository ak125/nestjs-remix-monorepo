# Environnement de rebuild TecDoc isolé — spécification et plan de lots

> **Date** : 2026-09-08 · **Base** : `33d0049` (PR #1418 mergée) · **Statut** : `NO_GO`
> — le volume dédié n'existe pas encore. Le rejeu complet **n'est pas lancé**.
>
> Ce document couvre l'environnement et le découpage. Il ne traite d'aucun secret.

---

## 1. Architecture cible

```
archive TecDoc (SQL-CONVERTED.7z, 5,8 Go)
        ↓  extraction + CRC32 confronté au périmètre scellé
volume dédié /mnt/tecdoc-rebuild  (~250 Go, hors /)
        ↓
PostgreSQL 17 isolé — 127.0.0.1 uniquement, aucun accès PROD
        ↓  scripts/tecdoc_replay.py (fail-closed)
tecdoc_raw.t400 / t232
        ↓
tecdoc_map.source_linkages
        ↓  projection
réconciliation — scripts/tecdoc_replay_controls.py
```

**Aucun chemin d'écriture vers PROD n'existe dans cette chaîne.** Le container ne reçoit
aucune variable d'accès PROD, et `provision-rebuild-env.sh` **refuse de démarrer** si
`SUPABASE_DB_PASSWORD`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ou `PGPASSWORD` sont
exportées dans le shell appelant.

## 2. Chiffrage de la capacité

Mesures PROD du 2026-09-08 (lecture seule) :

| Objet | Total | dont index |
|---|---:|---:|
| `tecdoc_map.source_linkages` | 90,0 Go | 33,7 Go |
| `tecdoc_raw.t400` | 17,4 Go | 924 Mo |
| `tecdoc_raw.t232` | 1,7 Go | — |
| `tecdoc_map.source_linkage_criteria` | 356 Mo | 157 Mo |
| **Staging PROD** | **109,5 Go** | 34,7 Go |

Le rebuild charge la **source complète**, plus volumineuse que la PROD tronquée. Facteur
mesuré depuis l'artefact scellé : **×1,20** (149 DLNR chargés) et **×1,28** (110 projetés).

```
données + index en rebuild ........... ~139 Go
+ WAL, tri de construction d'index,
  scratch de parsing, archive 5,8 Go
+ marge de sécurité 20 %

besoin minimal ....................... 160 Go
besoin recommandé .................... 210 Go   ← seuil de la garde
cible de provisionnement ............. 250 Go
```

> **Borne inférieure assumée** : seuls **66/110** DLNR projetés (et 83/149 chargés) portent
> un `.meta` de parsing. Pour les autres, la valeur PROD — donc éventuellement tronquée — a
> été retenue. Le facteur source-truth réel est **supérieur** à ×1,28, et ces seuils sont
> des planchers, pas des estimations centrales.

## 3. État de la machine DEV — pourquoi c'est `NO_GO`

```
hôte ................. dev-automecanik (Hetzner Cloud vServer, instance 115238775)
disque physique ...... /dev/sda — 152,6 Go   ← total, pas disponible
partition / .......... /dev/sda1 — 150 Go, 106 Go utilisés, 39 Go libres (74 %)
espace non alloué .... 0,00 Go
volume additionnel ... aucun
```

Le disque **entier** fait 152,6 Go, soit moins que le besoin minimal de 160 Go. Même en
libérant tout `/opt/automecanik` (~38 Go), on plafonnerait vers 77 Go. **Le rebuild ne peut
pas tenir sur cette machine sans volume supplémentaire.**

## 4. Provisionnement — action hébergeur (owner)

Attacher un disque est une opération chez l'hébergeur, hors de portée d'un agent.

```bash
# 1. Créer et attacher un volume de 250 Go dans la même zone que le serveur
hcloud volume create --name tecdoc-rebuild --size 250 --server dev-automecanik --format ext4
# (ou : Console Hetzner → Volumes → Create Volume → 250 GB → attach to dev-automecanik)

# 2. Repérer le device (Hetzner l'expose sous /dev/disk/by-id/scsi-0HC_Volume_<id>)
ls -l /dev/disk/by-id/ | grep HC_Volume

# 3. Monter sur un chemin dédié — jamais sous /tmp
sudo mkdir -p /mnt/tecdoc-rebuild
sudo mount -o discard,defaults,noatime /dev/disk/by-id/scsi-0HC_Volume_<id> /mnt/tecdoc-rebuild

# 4. Rendre le montage persistant
echo '/dev/disk/by-id/scsi-0HC_Volume_<id> /mnt/tecdoc-rebuild ext4 discard,defaults,noatime,nofail 0 0' \
  | sudo tee -a /etc/fstab

# 5. Vérifier la capacité — rend GO ou NO_GO, jamais « probablement »
bash scripts/tecdoc-replay/check-rebuild-capacity.sh /mnt/tecdoc-rebuild

# 6. Provisionner (idempotent, refuse si la capacité est insuffisante)
env -u DATABASE_URL -u SUPABASE_DB_PASSWORD -u SUPABASE_SERVICE_ROLE_KEY -u PGPASSWORD \
  bash scripts/tecdoc-replay/provision-rebuild-env.sh
```

`noatime` évite des écritures inutiles pendant le chargement massif ; `nofail` empêche un
volume absent de bloquer le démarrage de la machine.

## 5. Contrat de l'environnement

| Contrainte | Mise en œuvre | Vérifiée par |
|---|---|---|
| PostgreSQL 17 | image `postgres:17-alpine` (17.11 constatée) | contrôle final du provisionnement |
| Isolé | `-p 127.0.0.1:55440:5432`, jamais d'écoute publique | `provision-rebuild-env.sh` |
| Jetable | tout l'état vit sous `/mnt/tecdoc-rebuild` | — |
| Aucun accès PROD | refus si une variable d'accès PROD est exportée | garde §2 du script |
| Volume dédié | refus si le point de montage partage le device de `/` | `check-rebuild-capacity.sh` |
| Capacité | refus sous 210 Go libres | `check-rebuild-capacity.sh` |

Arborescence créée : `pgdata/` (PGDATA, uid 70), `scratch/` (parsing), `archive/` (source),
`rapports/` (comptabilité par lot). Le mot de passe local est généré sur place (32 octets
d'entropie), stocké en `0600` sur le volume, **jamais affiché ni journalisé**.

**Réglages** : `shared_buffers=2GB`, `maintenance_work_mem=2GB`, `max_wal_size=8GB`,
`checkpoint_timeout=30min`, `synchronous_commit=off`, `--shm-size=2g`.
`fsync` reste **actif** par défaut : un crash hôte avec `fsync=off` corromprait le cluster et
ferait perdre des heures de rejeu, alors que l'idempotence par `_batch_id` permet sinon de
reprendre au DLNR près. `--rapide` l'ouvre explicitement, avec l'avertissement associé.

## 6. Plan de lots — préparé, non exécuté

Généré depuis l'artefact scellé par `generer-plan-lots.py` → `plan-lots.json`.
**110/110 DLNR couverts**, volumétrie croissante, divergents placés par poids.

| Lot | DLNR | Lignes source attendues | Divergents |
|---|---:|---:|---|
| 0 — fumée | 1 | 13 057 | — (HIDRIA, déjà validé en #1418) |
| 1 — 5 DLNR | 5 | 2 179 199 | NISSENS, PAYEN |
| 2 — 20 DLNR | 20 | 7 932 092 | RIDEX |
| 3 — divergents lourds isolés | 2 | 26 779 184 | BOSCH, FEBI |
| 4 — reste | 30 | 9 404 364 | — |
| 5 — reste | 30 | 25 567 877 | — |
| 6 — reste | 22 | 59 056 373 | — |

Les cinq divergents sont traités **tôt et par poids croissant** : ce sont les cas de
non-régression prioritaires, et les rencontrer tard signifierait découvrir un défaut après
des heures de rejeu.

**Contrat de chaque lot** :

- **Checkpoint** — `_batch_id` déterministe `(table, DLNR, CRC32, version)`. Un lot
  interrompu se reprend au DLNR près, sans doublon.
- **Comptabilité** — `émis = chargées + dédoublonnées + rejets explicites`, vérifiée
  **avant** commit. Sinon `FAIL` + `ROLLBACK` + `STOP`.
- **Rollback** — une transaction par DLNR ; aucun préfixe partiel n'est committable.
- **Rapport** — `/mnt/tecdoc-rebuild/rapports/lot-<n>.json`.
- **Condition de passage** — un lot ne s'ouvre que si le précédent est intégralement vert.

## 7. Cibles de non-régression des 5 divergents

| DLNR | Fournisseur | t400 PROD | Source émise | Delta attendu | Chargé en mars |
|---:|---|---:|---:|---:|---:|
| 123 | NISSENS | 100 | 790 974 | +790 874 | 0,01 % |
| 30 | BOSCH | 69 000 | 9 357 752 | +9 288 752 | 0,74 % |
| 101 | FEBI | 2 558 500 | 17 421 432 | +14 862 932 | 14,69 % |
| 6358 | RIDEX | 2 323 000 | 5 662 767 | +3 339 767 | 41,02 % |
| 113 | PAYEN | 1 085 500 | 1 259 429 | +173 929 | 86,19 % |
| | **Total** | **6 036 100** | **34 492 354** | **+28 456 254** | |

Le rebuild doit atteindre la colonne « source émise ». Les préfixes tronqués de `t400` sont
de la **vérité forensique historique**, jamais une cible.

## 8. Ce que ce document ne dit pas

Il ne mentionne aucun état de secret, aucune empreinte, aucune valeur : ce dépôt est public,
et y consigner l'état d'un identifiant vivant l'exposerait davantage. Ces éléments sont
transmis hors dépôt.
