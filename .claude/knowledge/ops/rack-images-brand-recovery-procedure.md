---
scope: Ops / Catalog images — recovery of a brand's rack-images folder after storage loss
       (TecDoc API re-fetch → Supabase Storage upload → governed pieces_media_img rebuild)
audience: human + Claude
sources:
  - scripts/recovery/tecdoc-image-recover.py                       # ingester C1 (API getArticles, httpx)
  - backend/src/modules/catalog/utils/image-urls.utils.ts          # serving contract (buildRackImageUrl)
  - frontend/app/utils/image-optimizer.ts                          # frontend mirror
  - .spec/00-canon/repository-registry/brand-folder-registry.yaml  # pm_id → folder (owner-only)
  - scripts/audit/audit-pieces-media-img-invariants.sh             # I1/I2(/I3) ratchet
  - scripts/recovery/tier-c-softhide-malformed-p1.sql              # soft-hide + flip-audit pattern (PR #699)
  - /opt/automecanik/data/tecdoc/project-core-v2.py                # pmi insert column contract (l.180-195)
  - audit/mecafilter-image-recovery-plan-2026-06-10.md             # superseded forensic plan (§3 → Option A)
last_scan: 2026-06-10
---

# Rack-Images Brand Recovery Procedure (TecDoc API re-fetch)

> **Runbook opératoire** pour récupérer les images d'une marque dont le dossier
> `rack-images/<folder>/` a perdu ses fichiers (incident **INC-2026-015 / ADR-078**).
> Flux : re-fetch des images via l'**API officielle de l'abonnement TecDoc**
> (`getArticles`) → upload Supabase Storage → **rebuild gouverné** de
> `pieces_media_img`. Générique (toute marque/DLNR) ; exemple travaillé = MECAFILTER.
> Ce runbook = la prose opératoire ; le script `tecdoc-image-recover.py` = l'exécution
> storage ; le SQL §5 = l'exécution metadata. **Supersede-et-exécute**
> [`audit/mecafilter-image-recovery-plan-2026-06-10.md`](../../../audit/mecafilter-image-recovery-plan-2026-06-10.md)
> (sa question §3 est tranchée = **Option A** : re-fetch + nom canonique + réécriture metadata).

## Règles cardinales `[CRITICAL]`

0. **Images UNIQUEMENT sur les pièces VENDABLES, et récupération COUPLÉE à l'injection
   du tarif.** On ne récupère pas les images d'une marque « en bloc » : on les récupère
   **quand le tarif fournisseur est injecté** (flux [`supplier-price-load`](../../skills/supplier-price-load/SKILL.md)
   / PricingModule), et **seulement pour les pièces rendues vendables**
   (`pieces_price.pri_dispo ∈ ('1','2','3')`). L'image est un investissement (fetch TecDoc +
   storage) qui ne va qu'aux pièces générant du chiffre — cohérent avec la doctrine
   [[feedback_pricing_is_economic_governance_not_engine]]. Concrètement : ingester
   `--sellable-only`, et la phase image vient **après** le commit tarif gouverné.
1. **Read-only par défaut.** L'ingester est `--dry-run` par défaut (fetch + manifest,
   ZÉRO write). Tout `--commit` (upload) et tout SQL mutant = **GO owner nominatif**.
2. **Séparation storage / metadata.** Le script écrit **uniquement** le storage ;
   `pieces_media_img` se reconstruit par le **SQL gouverné §5** (backup + insert stagé
   + flip transactionnel). **Le script ne fait JAMAIS d'écriture DB.**
3. **Jamais toucher `pieces` / prix / dispo / `piece_display`.** Ce runbook ne concerne
   **que l'image**.
4. **Soft-hide, jamais DELETE** sur `pieces_media_img` (pattern tier-C PR #699,
   réversible). Le hard-delete des lignes legacy = op gouvernée **séparée**, J+30.
5. **`pmi_pm_id` est INCOHÉRENT entre tranches** (voir §SQL transverse) → **tout SQL
   scope la marque via `JOIN pieces`, jamais via `m.pmi_pm_id`**.
6. **Clé objet == `pmi_name`.** Une image servie est `rack-images/<pmi_folder>/<pmi_name>`
   ([`image-urls.utils.ts:93`](../../../backend/src/modules/catalog/utils/image-urls.utils.ts)).
   Si l'objet uploadé n'est pas EXACTEMENT à la clé que `pmi_name` désigne, l'image
   reste cassée. On nomme donc l'objet `<sha256>.jpg` et on écrit `pmi_name=<sha256>.jpg`.
7. **No silent fallback.** Credentials absents → abort. Aucun repli implicite.

## Règle SQL transverse `[CRITICAL]` — scoper par `pieces`, jamais par `pmi_pm_id`

Vérifié en DB (2026-06-10) : `pieces_media_img.pmi_pm_id` n'est **pas fiable** comme clé
marque. Pour MECAFILTER (pm_id **3040**, DLNR **218**), les lignes existent en deux
tranches avec des `pmi_pm_id` différents :

| `pmi_folder` | lignes | `pmi_pm_id` | noms | fichiers storage |
|---|---|---|---|---|
| `218` | 6 383 | **`3040`** (pm_id) | `<bildname>.BMP` (`PHME_ELH4093.BMP`) | **0** (supprimés) |
| `''` (vide) | 7 094 | **`218`** (DLNR !) | `<bildname>` sans extension | 0 (inservable par design) |

> **Toujours** : `JOIN pieces p ON p.piece_id = m.pmi_piece_id_i AND p.piece_pm_id = <pm_id>`.
> Les **nouvelles** lignes écrivent `pmi_pm_id='<pm_id>'` (convention des lignes bien-formées).
> PK `pieces_media_img = (pmi_piece_id, pmi_name)` → `ON CONFLICT (pmi_piece_id, pmi_name)`.

## Outillage — statut EXISTS / TO-BUILD

| ID | Artefact | Statut | Bloque |
|----|----------|--------|--------|
| C1 | [`scripts/recovery/tecdoc-image-recover.py`](../../../scripts/recovery/tecdoc-image-recover.py) — ingester API `getArticles` (httpx) | **EXISTS** (cette PR ; dry-run validé 6/6 + test 15/15) | — |
| C4 | [`scripts/audit/audit-pieces-media-img-invariants.sh`](../../../scripts/audit/audit-pieces-media-img-invariants.sh) — ratchet I1/I2 | **EXISTS** | gate V4 |
| C5 | [`scripts/recovery/tier-c-softhide-malformed-p1.sql`](../../../scripts/recovery/tier-c-softhide-malformed-p1.sql) — pattern soft-hide + flip-audit | **EXISTS (pattern)** ; instances par marque = TO-BUILD au §5 | §5e |
| C3 | Audit élargi `brand-folder-registry` × `storage.objects` (0 fichier) × `piece_display=true` | **FAIT** (2026-06-10, voir audit plan §7) : **5 marques affichées, ~13 702 pièces, 0 image** → NK (3410/folder 127, 6 431 vendables, **priorité**), KLAXCAR (2590/387, 4 389), MECAFILTER (3040/218, 1 931), QUICK STEER (7190/4368, 707), LPR (2820/197, 244). Une seule campagne, ce runbook par marque. | — |

> **Anti-récurrence — DÉJÀ obtenue.** Le deleter `scripts/cleanup-inactive-rack-images.py`
> (qui avait purgé les dossiers de marques temporairement `piece_display=false`) a été
> **supprimé par PR #921** (2026-06-10). **Ne JAMAIS recréer** un script de purge-masse
> non gouverné. Si un nettoyage de storage devient un jour nécessaire, il DOIT : (a)
> exclure tout dossier listé dans `brand-folder-registry.yaml` même si la marque est
> masquée, (b) exclure les préfixes système `_*` (`_recover-test/`, `_trash/`), (c)
> soft-delete vers un préfixe `_trash/<date>/` au lieu de `remove()`. Par défaut, aucun
> script de ce type ne doit exister.

## 0 — Prérequis (par marque) — read-only, pas de gate

0. **Déclencheur = injection tarif.** Cette procédure se lance **après** un import tarif
   gouverné de la marque (skill `supplier-price-load`) qui a rendu des pièces **vendables**
   (`pri_dispo ∈ ('1','2','3')`). Pas de tarif injecté ⇒ pas de récupération d'images.
1. **Marque dans le registry** : `brand-folder-registry.yaml` → `pm_id → primary_folder`
   (MECAFILTER : 3040 → 218). Registry **owner-only** : si la marque manque, STOP
   (l'owner édite le registry, jamais ce runbook ni le script).
2. **Couverture ARTNR VENDABLES** (PG direct, **jamais supabase-js** — cap 1000 lignes) :
   ```sql
   SELECT count(*) FROM tecdoc_map.article_registry ar
   WHERE ar.source_dlnr = <dlnr>
     AND EXISTS (SELECT 1 FROM pieces_price pr
                 WHERE pr.pri_piece_id_i = ar.piece_id AND pr.pri_dispo IN ('1','2','3'));
   ```
   ⚠️ Le `source_dlnr` (TecDoc) peut **ne pas couvrir 100 %** des pièces vendables d'un
   `pm_id` (images réparties sur plusieurs DLNR/folders). Croiser le compte vendable
   par `pm_id` (audit) vs par `source_dlnr` avant de conclure (ex. NK : 6 431 vendables
   par pm 3410 vs 4 986 par DLNR 127 — gap à élucider au cas par cas).
3. **Snapshot baseline** (devient la référence rollback / vérification) :
   ```sql
   SELECT count(*) FROM storage.objects WHERE bucket_id='rack-images' AND name LIKE '<folder>/%';
   -- pièces affichées sans aucune image servable (cf. §6 V3)
   ```
4. **Credentials TecDoc en env** : `TECDOC_API_KEY` **ou** `TECDOC_WEB_USER` +
   `TECDOC_WEB_PASSWORD`. Absents → l'ingester abort (no silent fallback). ⚠️ Les
   credentials hardcodés dans `/tmp/tecdoc-get-image-v3.py` (vestige d'avril) **ne
   doivent jamais être copiés dans du code committé** — owner : les mettre dans
   `backend/.env` (édition `.env` = owner, guard fichier) **et faire tourner le mot de
   passe** (exposé en clair dans `/tmp`).

## 1 — Acquisition (ingester C1) — `--dry-run` par défaut

L'ingester appelle l'**API officielle de l'abonnement** (méthode `getArticles` sur
`pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint`, en-tête `x-api-key`) en **httpx
concurrent** — pas de scraping UI par article. Playwright ne sert qu'au login OAuth2
one-shot pour capturer la clé (ou clé directe via `TECDOC_API_KEY`).

```bash
# dry-run ciblé (zéro write Supabase, produit le manifest)
python3 scripts/recovery/tecdoc-image-recover.py --pm-id 3040 --dlnr 218 --folder 218 \
  --sellable-only --artnr CLR7120,EAR7004,EAR7123 --dry-run
# dry-run complet (vendables seulement — usage normal)
python3 scripts/recovery/tecdoc-image-recover.py --pm-id 3040 --dlnr 218 --folder 218 \
  --sellable-only --dry-run
```
> **`--sellable-only` = mode normal** (couplé au tarif) : ne fetch que les pièces vendables.
> Sans le flag, l'ingester couvre toutes les pièces mappées (à éviter — pose des images
> sur des pièces non vendables, cf. règle cardinale 0).

Mécanique (prouvée 2026-06-10, 15/15 réfs MECAFILTER → image 3200px) :
- boucle ARTNR (depuis `article_registry`) → `getArticles` → **filtre `dataSupplierId==<dlnr>`
  + `articleNumber==ARTNR`** (la recherche renvoie aussi les cross-réfs concurrentes) →
  `images[N].imageURL3200` (fallback résolutions inférieures) sur `digital-assets.tecalliance.services`.
- download + sha256 ; **nom objet = `<sha256>.jpg`** → **dédup automatique** : une image
  partagée entre réfs (cas type `TDMA_*`) = 1 objet, n lignes manifest (validé au test :
  un même sha256 sur EAR7004/EAR7092/EAR7219).
- **manifest** `scripts/logs/recover-manifest-pm<pm>.jsonl` + `.csv` (artnr, piece_id,
  folder, image_name, image_url, sha256, bytes, status) + **checkpoint**
  `recover-images-progress-pm<pm>.json` (`--resume` / `--retry-failed`).
- garde-fous : `--dry-run` défaut, refuse l'upload hors `<folder>`/`--test-prefix`,
  **aucune écriture DB** (lecture `article_registry` en connexion `readonly`),
  rate-limit + circuit-breaker (`--max-consecutive-failures`).

## 2 — Dry-run de revue (no gate)
Lancer le dry-run complet, vérifier le manifest : taux d'articles avec image, mapping
`piece_id` non nul, sha256 présents. `no_images` = l'article n'a réellement aucune image
TecDoc (rare pour une marque filtre — test : 0/15).

## 3 — Test-prefix — **GO-1**
```bash
python3 scripts/recovery/tecdoc-image-recover.py --pm-id 3040 --dlnr 218 --folder 218 \
  --artnr CLR7120,EAR7123 --commit --test-prefix _recover-test/218
```
Vérifier HTTP 200 + image lisible via le proxy (`/img/rack-images/_recover-test/218/<sha>.jpg`).
`_recover-test/` n'est référencé par aucun `pmi_name` → invisible sur le site. **Purger
les objets test** en fin d'étape (clés listées dans le checkpoint).

## 4 — Run storage complet — **GO-2 nominatif**
```bash
python3 scripts/recovery/tecdoc-image-recover.py --pm-id 3040 --dlnr 218 --folder 218 --commit --resume
```
**Aucune écriture DB → zéro changement d'état site** (les pièces servent toujours le
fallback `DEFAULT_IMAGE` tant que la metadata n'est pas flippée). Crash en cours = objets
inertes + checkpoint → `--resume` ou rollback libre. Échecs résiduels → `--retry-failed`
(espacer ≥ quelques heures, hygiène quota).

## 5 — Rebuild metadata (Option A) — **GO-3** puis **GO-4** (PG direct, jamais supabase-js)

> Livrer les SQL forward + `.rollback.sql` appairés sous `scripts/recovery/` (convention PR #699).

**5a. Backup (ouvre GO-3)**
```sql
CREATE TABLE pieces_media_img_backup_pm3040_20260610 AS
SELECT m.* FROM pieces_media_img m
JOIN pieces p ON p.piece_id = m.pmi_piece_id_i AND p.piece_pm_id = 3040;  -- les 2 tranches
```

**5b. Charger le manifest** dans `pieces_media_img_recover_manifest_pm3040_20260610`
(`\copy … FROM 'recover-manifest-pm3040.csv' CSV HEADER`). Dédupliquer
`(piece_id, image_name)` au chargement (re-runs append).

**5c. INSERT stagé (`pmi_display='0'`)** — colonnes du contrat
[`project-core-v2.py`](../../../../data/tecdoc/project-core-v2.py) (l.180-195), mais folder
réel + display stagé + JOIN `storage.objects` (jamais de ligne sans objet) :
```sql
INSERT INTO pieces_media_img
  (pmi_piece_id, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display, pmi_piece_id_i)
SELECT s.piece_id::text, '3040', '218', s.image_name,
       row_number() OVER (PARTITION BY s.piece_id ORDER BY s.image_name),
       '0',                       -- stagé : caché jusqu'au flip GO-4
       s.piece_id
FROM pieces_media_img_recover_manifest_pm3040_20260610 s
JOIN storage.objects o
  ON o.bucket_id='rack-images' AND o.name = '218/' || s.image_name
WHERE s.image_name IS NOT NULL
ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING;
```

**5d. Pré-flip** : `curl` 10 nouvelles URLs `/img/rack-images/218/<sha>.jpg` → 200
(le flag display n'affecte pas le service ; on valide la clé avant de rendre visible).

**5e. Flip en 1 transaction (GO-4)** — pattern tier-C (table d'audit des flips) :
```sql
BEGIN;
CREATE TABLE IF NOT EXISTS pieces_media_img_recover_flips_pm3040_20260610
  (pmi_piece_id text, pmi_name text, direction text,
   flipped_at timestamptz DEFAULT now(), PRIMARY KEY (pmi_piece_id, pmi_name));

-- (1) legacy retire = SOFT-HIDE — prédicat « objet inexistant », couvre LES DEUX tranches
WITH legacy AS (
  SELECT m.pmi_piece_id, m.pmi_name
  FROM pieces_media_img m
  JOIN pieces p ON p.piece_id = m.pmi_piece_id_i AND p.piece_pm_id = 3040
  WHERE m.pmi_display='1'
    AND NOT EXISTS (SELECT 1 FROM storage.objects o
                    WHERE o.bucket_id='rack-images'
                      AND o.name = m.pmi_folder || '/' || m.pmi_name)
)
INSERT INTO pieces_media_img_recover_flips_pm3040_20260610 (pmi_piece_id, pmi_name, direction)
SELECT pmi_piece_id, pmi_name, 'legacy_1_to_0' FROM legacy ON CONFLICT DO NOTHING;

UPDATE pieces_media_img m SET pmi_display='0'
FROM pieces_media_img_recover_flips_pm3040_20260610 f
WHERE f.direction='legacy_1_to_0' AND m.pmi_piece_id=f.pmi_piece_id
  AND m.pmi_name=f.pmi_name AND m.pmi_display='1';

-- (2) nouvelles lignes visibles ('0'→'1'), keyées manifest
UPDATE pieces_media_img m SET pmi_display='1'
FROM pieces_media_img_recover_manifest_pm3040_20260610 s
WHERE m.pmi_piece_id=s.piece_id::text AND m.pmi_name=s.image_name
  AND m.pmi_pm_id='3040' AND m.pmi_display='0';
COMMIT;
```
Pièces dont le fetch a échoué (aucune image) : 0 ligne affichée → fallback propre (état
actuel), **jamais d'image cassée** ; conservées sur la liste retry.

## 6 — Vérifications V1–V7
- **V1** storage : `SELECT count(*) FROM storage.objects WHERE bucket_id='rack-images' AND name LIKE '218/%'` ≈ nb images uniques du manifest (> 0 ; baseline 0).
- **V2** pré-flip HTTP : 10 nouvelles clés via Caddy → 200 `image/*`.
- **V3** post-flip : « pièces affichées sans image servable » (requête §8 du plan audit) vs baseline.
- **V4** ratchet : `bash scripts/audit/audit-pieces-media-img-invariants.sh` exit 0 (nouvelles lignes = folder + extension → I1/I2 OK ; le soft-hide blank-folder réduit l'exposition I1).
- **V5** runtime : fiche produit MECAFILTER en DEV → `<img>` = `/img/rack-images/218/<sha>.jpg`, 200 (pas `DEFAULT_IMAGE`). Spot-check une pièce échouée → fallback propre. **Vérifier la GALERIE/modal, pas que la 1ʳᵉ image** : la galerie vient de la RPC `get_piece_detail` (cache Redis `catalog:piece-detail:<id>`, TTL 1h). ⚠️ **Précondition** : `get_piece_detail` doit filtrer `pmi_display='1'` sur ses images (fixé 2026-06-10, migration `20260610_get_piece_detail_filter_pmi_display.sql`) — sinon le soft-hide §5e est INVISIBLE pour le modal et les lignes legacy mortes (`*.BMP` 404) s'affichent à côté des nouvelles (symptôme : « 4 slots, 2 vides »). Après le flip, **invalider le cache** (`catalog:piece-detail:*`) ou attendre le TTL ; Redis DEV et PROD sont **séparés** (PROD = flush owner via SSH si immédiat voulu).
- **V6** cache (raisonnement, pas d'action) : les 404 n'ont **jamais** été cachés 1 an (le fallback imgproxy a une TTL courte) ; l'Option A **mint des URLs neuves** (`pmi_name` = nouveau sha) jamais demandées → aucune entrée stale possible à Caddy/Cloudflare → **aucun purge requis**. Seul un cache **HTML** de page (s-maxage 86400) peut émettre l'ancienne URL jusqu'à expiration (→ fallback, pas cassé) ; purge Cloudflare ciblée optionnelle si convergence plus rapide voulue.
- **V7** observabilité : taux de fallback `/img/rack-images/218/` en logs Caddy/imgproxy en baisse post-flip.

## 7 — Rollback (par étape mutante)
| Étape | Rollback |
|---|---|
| §3 test-prefix | supprimer les clés `_recover-test/*` (checkpoint) — fait dans l'étape |
| §4 storage | objets non référencés = **inertes** (aucun rollback site nécessaire) ; suppression bulk via `uploaded_keys` du checkpoint si exigé |
| §5a/5b tables | additif — drop, ou garder (préféré, trace d'audit) |
| §5c insert | `DELETE FROM pieces_media_img m USING <manifest> s WHERE m.pmi_piece_id=s.piece_id::text AND m.pmi_name=s.image_name AND m.pmi_pm_id='3040'` |
| §5e flip | `.rollback.sql` jumeau : `legacy_1_to_0` → `'1'`, lignes manifest → `'0'` (depuis la table de flips) |

Chaque rollback = GO owner nominatif ; SQL forward+rollback appairés sous `scripts/recovery/`.

## Interdits `[CRITICAL]`
- Jamais toucher `pieces` / prix / dispo / `piece_display`.
- Pas de `DELETE` sur `pieces_media_img` (soft-hide only ; hard-delete = op J+30 séparée).
- Pas d'édition de `brand-folder-registry.yaml` (owner-only ; input read-only ici).
- Pas de credentials en dur ; ne jamais copier/committer `/tmp/tecdoc-get-image-v3.py`.
- Pas d'écriture DB depuis l'ingester ; pas de supabase-js pour compter (cap 1000 → `.range()` ou PG direct).
- **Ne jamais recréer un script de purge-masse non gouverné** (cf. §Outillage / PR #921).
- Pas d'étape `--commit` ni de SQL mutant sans son GO nominatif.

## Variantes
| Cas | Adaptation |
|-----|------------|
| Autre marque / DLNR | `--pm-id/--dlnr/--folder` (cross-checkés registry) ; SQL §5 = mêmes patterns, swap pm_id/folder |
| Marque multi-folder | traiter chaque `primary`/`alt` du registry |
| Clé API directe | `TECDOC_API_KEY` en env → pas de login navigateur |
| Archive média / API Pegasus officielle (si l'abonnement évolue) | canaux déterministes alternatifs — adapter §1 (le reste identique) |

## Worked example — MECAFILTER (pm_id 3040 / DLNR 218 / folder 218)
- **Cause** : `cleanup-inactive-rack-images.py` (supprimé #921) a purgé `rack-images/218/`
  le 2026-03-28 alors que la marque était `piece_display=false` (50 dossiers / 165 525
  fichiers ce jour-là). Metadata survivante, fichiers partis.
- **Périmètre** : 2 tranches (6 383 lignes folder 218 + 7 094 folder vide), 3 735 ARTNR,
  **1 931 pièces affichées sans image** (audit 2026-06-10), baseline storage = **0** fichier.
  MECAFILTER est 1 des **5 marques** purgées encore affichées (cf. §Outillage C3) — NK
  (folder 127, 6 431 vendables) est le plus gros ; même runbook, lancer marque par marque.
- **Méthode validée en session** : `getArticles` httpx → **15/15** API · image · download
  JPEG valide en `imageURL3200`, **0,61 s/réf** ; dédup hash confirmée (image partagée
  EAR7004/EAR7092/EAR7219 = 1 objet).
- **Exécuté 2026-06-10** : storage 3 442 objets uploadés (run complet) ; metadata flip ;
  **PUIS re-scope vendables** (règle cardinale 0) — masquage des images des 1 378 pièces
  non vendables (2 596 lignes `display=0`). Résultat : **1 928 / 1 931 pièces vendables
  affichées ont une image servable** (3 sans = no_images TecDoc). Le 1er run avait couvert
  toutes les pièces mappées (3 306) car lancé sans `--sellable-only` — corrigé a posteriori ;
  pour les marques suivantes, utiliser `--sellable-only` dès le départ.

---
_Lié : INC-2026-015 / ADR-078 (vault), `brand-folder-registry.yaml`, PR #699 (tier-C), PR #921 (suppression deleter)._
