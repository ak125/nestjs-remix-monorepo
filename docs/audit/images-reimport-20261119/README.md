# Réimport des images TecDoc — relevé de préparation (mandat DC, 19/11/2026)

Préparation seulement : **aucune image importée**, aucune connexion au catalogue
TecDoc, aucune écriture en base ni dans le bucket, aucun identifiant posé ou lu.

| | |
|---|---|
| Worktree | `/home/deploy/worktrees/claude-dc-images-reimport-20261119` |
| Branche | `feat/mandat-dc-images-reimport-tecdoc-20261119` |
| Base | `origin/main` = `3600225ce2136a6102e8948d74097344a631936f` |
| Dépendance | PR #2191 (mandat CT), tête relevée `32a7ee22d` — définition SQL unique « vendable » |
| Lecture base | transaction `READ ONLY`, `statement_timeout` 60 s |

Règle de l'owner (Marwane, 19/11/2026 06:45) : on importe uniquement les images
des pièces vendues sur le site ; import après la 1re mise à jour du tarif ;
aux mises à jour suivantes, contrôle des images manquantes.

## 1. Ce que faisait le module (code + journaux d'avril)

`scripts/recover-tecdoc-images.py` (version d'avant ce mandat, 423 lignes) :
connexion Playwright au catalogue web TecDoc, recherche de chaque article,
capture de la réponse `pegasus … TecdocToCat`, filtre sur le fournisseur TecDoc
(DLNR = `pmi_folder`), égalité stricte `fileName == pmi_name`, téléchargement
CDN (taille 800), envoi dans `rack-images/<pmi_folder>/<pmi_name>`.

Journal relu : `scripts/logs/recover-all-v4.log` du checkout partagé (lecture
seule, 15 745 601 octets, sha256 `2ac2d6e0…5767ab988f`), exécution `--commit` du
2026-04-11 18:28 au 2026-04-23 21:52. Analyse : `analyse_journaux_avril.py`
→ `journaux-avril-par-dossier.csv`, `journaux-avril-resume.txt`.

| | Images |
|---|---|
| Manquantes annoncées | 58 379 |
| Articles cherchés | 41 390 |
| Récupérées | 18 724 (32,1 %) |
| Échouées selon le script | 39 655 |
| — dont recherche en erreur (19 168 recherches, toutes `Locator.clear: Timeout 30000ms exceeded`), avalée et comptée « introuvable » | 26 820 |
| — dont article sans image pour ce DLNR | 4 325 |
| — dont nom sans correspondance (jpg 8 332, bmp 167, sans extension 2, gif 1) | 8 502 |
| — dont envoi refusé (`InvalidKey`, crochets dans le nom) | 7 |

Après la première recherche en erreur d'un dossier, **plus aucune réussite
jusqu'à la fin de ce dossier** (session morte, jamais revérifiée) : dossiers 33,
10, 65, 140, 62, 89, 123, 101, 13, 30. Bosch (dossier 30) : 13 960 manquantes,
3 884 récupérées, 10 076 échouées dont 8 925 par recherche en erreur à partir du
2026-04-21 10:06:40. Le fichier de progression n'a jamais écrit `failed` ni
`cdn_mappings`.

## 2. Défauts et traitement

| # | Défaut (avant) | Traitement | État |
|---|---|---|---|
| 1 | Sélection de toutes les images manquantes, pièces non vendables comprises | Requête unique `scripts/recover-tecdoc-images.sql` : images affichables manquantes des pièces vendables, via `public.piece_est_vendable` (#2191), aucune condition recopiée | corrigé, testé (hors ligne) |
| 2 | Inventaire PostgREST ligne à ligne, O(n²) | Une requête SQL par lot de 50 000 `piece_id`, lecture seule | corrigé ; mesuré (§3) avec substitution |
| 3 | URL Supabase codée en dur, clé lue dans `backend/.env` | Environnement seulement (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TECDOC_EMAIL`, `TECDOC_PASS`), jamais affichés ; erreurs de base réduites à la classe et au `pgcode` | corrigé, testé (sentinelles) |
| 4 | Erreur de recherche avalée, comptée « introuvable », course à vide après expiration de session | Erreur de recherche distincte ; revérification de la session et reconnexion ; disjoncteur après N échecs à la suite (code 3, état enregistré) | corrigé, testé (faux portail) |
| 5 | Réponses JSON illisibles ignorées (`except: pass`) | Comptées et journalisées | corrigé |
| 6 | « already exists » compté comme récupéré | `deja_present` compté à part | corrigé, testé |
| 7 | Type MIME jpeg/png seulement (bmp, gif envoyés en jpeg) | Type annoncé par le CDN, sinon extension (jpg, png, gif, bmp, webp, tiff) | corrigé, testé |
| 8 | Noms à crochets refusés à l'envoi | Pré-contrôle du jeu de caractères Storage : signalés au rapport, jamais renommés | corrigé, testé |
| 9 | Égalité stricte seulement, aucun diagnostic | Exacte ; casse différente = candidat (envoyé seulement avec `--accepter-casse`, objet nommé `pmi_name`) ; même radical = candidat signalé ; 10 noms vus par article gardés | corrigé, testé |
| 10 | Progression tous les 10 articles, non atomique, `failed` jamais écrit | Nouvel état `scripts/logs/recover-tecdoc-images-etat.json` (format v2), écriture atomique après chaque article, cause par image, reprise des causes techniques seulement ; verrou contre deux exécutions | corrigé, testé |
| 11 | `--dry-run` sans effet, liste de DLNR codée en dur | Rapport à blanc par défaut (JSON + CSV par fournisseur) ; `--commit` exige `--marque` ou `--dossier` ; dossiers déduits de l'inventaire, noms du registre marque → dossier | corrigé, testé |
| 12 | Imports en tête : impossible de lancer sans Playwright ni supabase-py | Imports au besoin ; envoi par l'API Storage (requests), supabase-py retiré | corrigé, testé |
| 13 | Dépendances non déclarées | `scripts/requirements-recover-tecdoc-images.txt` | corrigé |
| 14 | Codes de sortie absents | 0 / 1 / 2 / 3 / 4 / 5 (en-tête du script) | corrigé, testé |
| 15 | Pièce vendable sans ligne `pieces_media_img` : invisible au script | Classe `sans_image_affichable` au rapport ; non récupérable par nom | signalé |
| 16 | 289 images à dossier vide (VENEPORTE 268, SEIM 21) — invariant I1 de `audit-pieces-media-img-invariants.sh` | Signalées `dossier_vide`, jamais cherchées | signalé ; correction de données hors mandat |
| 17 | Aucun workflow ne lance ces tests | Workflow = fichier réservé : patch `patch-workflow-recover-tecdoc-images.yml.diff`, non appliqué | proposé |

Chemins et noms d'objets **inchangés** : `rack-images/<pmi_folder>/<pmi_name>`,
nom brut de `pieces_media_img`, ni renommage ni conversion.

## 3. Inventaire du lot vendable sans image

Mesure du **2026-11-19, 06:02:34 → 06:03:12 UTC**, 83 lots, tous `rc=0`,
98 032 lignes (`mesure/journal.txt`, `mesure/bornes.txt`).

Méthode : `requetes/mesure_inventaire.sh` exécute `scripts/recover-tecdoc-images.sql`
lot par lot. La fonction `public.piece_est_vendable` de #2191 n'étant pas encore
en base, le script de **mesure** (et lui seul) remplace son appel par le corps
de la fonction tel que publié dans #2191 (tête `32a7ee22d`, migration sha256
`49b64d6c…3e83b4b8`). Le module livré n'a aucun repli : sans la fonction, il
s'arrête en code 2. **À refaire sans substitution après application de #2191.**
Agrégation : `requetes/agreger_inventaire.py` → `inventaire-par-marque.csv`
(55 marques) ; détail : `mesure/inventaire-detail.csv.gz`.

| | |
|---|---|
| Pièces vendables sans image servie | **57 869** |
| — dont sans aucune image affichable (pas de ligne `pmi`) | 22 846 |
| Images affichables manquantes dans `rack-images` | **75 186** |
| — à chercher (hors dossier vide et nom invalide) | 74 891, en 49 503 recherches |

Principales marques (`inventaire-par-marque.csv`) :

| pm_id | Marque | Dossier | Sans image servie | dont sans image affichable | Images manquantes |
|---|---|---|---|---|---|
| 730 | BOSCH | 30 | 7 975 | 2 734 | 19 113 |
| 4980 | WALKER | 13 | 780 | 3 | 7 198 |
| 4670 | TRW | 161 | 5 319 | 1 490 | 6 190 |
| 1780 | FEBI | 101 | 4 018 | 34 | 4 371 |
| 1270 | DELPHI | 89 | 3 165 | 213 | 3 623 |
| 1190 | CORTECO | 140 | 4 950 | 2 325 | 3 187 |

KLAXCAR (2590) figure dans la mesure (8 128 / 6 819) mais est **hors périmètre**
(réimport non accepté) : ne jamais lancer `--marque 2590`.

### Fournisseurs passés par une 1re mise à jour complète du tarif

- **Selon le code** (`backend/src/modules/pricing/config/supplier-sale-rules.ts`,
  décision 51) : `premiereMajCompleteLe` est `null` pour tous les fournisseurs —
  **aucun** n'est daté.
- **Selon la base** (lots gouvernés `price_import_batches` au statut
  `COMMITTED`, `supplier_id` = pm_id de la marque) :

| pm_id | Marque | Sans image servie | dont sans image affichable | Images manquantes |
|---|---|---|---|---|
| 4900 | VENEPORTE | 332 | 5 | 595 (dont 268 à dossier vide) |
| 4200 | SEIM | 146 | 143 | 21 (toutes à dossier vide) |
| 2860 | LUK (lot de retrait de dispo seulement) | 63 | 27 | 38 |
| 3040 | MECAFILTER | 3 | 3 | 0 |
| 3410 | NK | 2 | 2 | 0 |
| 71 | (absent de `pieces_marque`) | — | — | — |

**Écarts à trancher par Marwane :**
1. Bosch (accepté pour le réimport, premier à lancer) n'a **aucun lot tarif
   gouverné** : la règle « après la 1re mise à jour du tarif » ne le couvre pas
   encore. Lancer Bosch avant son tarif est une décision de l'owner.
2. La fraîcheur (décision 51) est indexée par distributeur (`pri_frs`), les
   images par marque (dossier TecDoc). La règle doit dire laquelle déclenche
   l'import ; le script travaille par marque (`--marque`).

## 4. Pas de source de restauration

Aucune version archivée dans `rack-images` (721 520 objets, 0 version), le
bucket de sauvegarde ne contient pas d'images (relevé CO,
`docs/audit/r2-images-20261118/`). Le runbook de septembre
(`docs/audit/recovered-tecdoc-2026-09-07/runbook-reimport-tecdoc-images.md`)
part du paquet média TecDoc et convertit en WebP avec mise à jour de `pmi_name` :
il contredit la règle « noms inchangés » et n'est pas la voie retenue.

## 5. Contrôle « pièce sans image » (décision 49) — où il doit vivre

Le contrat du département 10 (`.spec/00-canon/ai-registry/agent-operating-map.yaml`,
surveillance « Anomalies sur le lot vendable », producteur de KPI en attente)
rattache le contrôle à la fonction `catalog.integrity`, servie par
`backend/src/modules/catalog/services/catalog-data-integrity.service.ts`, dont le
champ `pieces_with_image_percent` est aujourd'hui une constante `0`. Proposition :

- source unique = `scripts/recover-tecdoc-images.sql` (même requête que l'import) ;
- en attendant le câblage, le rapport à blanc du script (`--rapport`) donne par
  fournisseur la ligne « pièce sans image » ;
- le câblage dans `catalog.integrity` (remplacer la constante) est un changement
  backend distinct, après #2191, sans nouveau mécanisme ni cron. Le script
  `scripts/audit/audit-pieces-media-img-invariants.sh` (« nightly ratchet » non
  câblé) reste l'outil des invariants de forme (I1/I2), pas du lot vendable.

État : **proposé**, non implémenté.

## 6. Preuves

| Preuve | Fichier |
|---|---|
| Tests sans réseau ni base (37) | `preuves/pytest.txt` |
| Rapport à blanc hors ligne, jeu d'essai | `a-blanc/essai-fixture*.{csv,out}` |
| Rapport à blanc hors ligne, inventaire mesuré | `a-blanc/inventaire-reel*.{csv,json,out}` |
| Mesure de l'inventaire | `mesure/journal.txt`, `mesure/bornes.txt`, `mesure/inventaire-detail.csv.gz` |
| Journaux d'avril | `journaux-avril-par-dossier.csv`, `journaux-avril-resume.txt` |
| Empreintes | `SHA256SUMS` |

## 7. Réservé à Marwane

Changement du mot de passe TecDoc et pose des identifiants ; fusion ; exécutions
réelles fournisseur par fournisseur (Bosch d'abord, après décision sur l'écart 1) ;
ratification du texte ajouté à la procédure (§6 bis, §7) et au skill
`supplier-price-load` (étapes 10 bis, 11).
