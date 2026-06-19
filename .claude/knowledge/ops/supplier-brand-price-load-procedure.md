---
scope: Ops / Pricing — supplier tariff load into pieces_price (via the governed PricingModule)
audience: human + Claude
sources:
  - backend/src/modules/pricing/                      # Pricing Control Plane V1 (SoT cost import)
  - backend/src/modules/pricing/controllers/pricing-import.controller.ts
  - backend/supabase/migrations/20260522_pricing_control_plane_v1_functions.sql
  - .claude/skills/supplier-price-load/SKILL.md        # canonical operator flow (PR #849)
  - backend/src/workers/supplier-price-verify.ts            # read-only portal price spot-check (N-sample)
  - backend/src/workers/supplier-availability-classify.ts   # read-only full-feed availability classifier (bulk /search, generic)
  - backend/src/modules/supplier-truth/connectors/inoshop-search-parse.ts  # bulk-search parser + activation classifier (brand-generic)
  - backend/src/modules/supplier-truth/connectors/supplier-registry.ts
  - /opt/automecanik/data/tecdoc/
last_scan: 2026-06-10
---

# Supplier Brand Price-Load Procedure

> **Runbook opératoire du chargement d'un tarif marque/fournisseur dans
> `pieces_price`.** Le flux canonique passe par le **module gouverné**
> `PricingModule` (Pricing Control Plane V1) piloté par le skill
> [`supplier-price-load`](../../skills/supplier-price-load/SKILL.md) (PR #849).
> Ce runbook = la prose opératoire ; le skill = l'exécution.

## Règles cardinales `[CRITICAL]`

1. **`pieces_price` reste le SoT du coût** (achat/vente). Aucune autre table ne le remplace.
2. **JAMAIS lire `supplier_offer_snapshot` comme prix.** C'est la couche
   d'observation fournisseur (sentinelle `supplier-truth`), pas une source de prix.
3. **JAMAIS d'INSERT/UPDATE direct dans `pieces_price`** (worker/script/SQL
   standalone). Toute écriture passe par `PricingModule`
   (`/api/admin/pricing/import/{dry-run,commit,rollback}`) — invariants L2,
   historique `pieces_price_history`, commit atomique, rollback gouverné.
4. **Aucune écriture sans dry-run validé.** Aucun commit sans owner GO.
5. **Aucune activation bulk d'une marque sans owner GO**, et **précédée d'une
   vérif dispo ciblée** sur les références **réellement affichables/vendables**
   (voir §Garde-fou storefront).

## ⚠️ Flux SUPERSEDED (ne plus utiliser)

Le 1er run NK (worker `feed-commit-nk.ts` / `supplier-price-commit.ts`) faisait un
**INSERT direct** dans `pieces_price` avec `pri_dispo=null`, **hors module
gouverné** : pas d'invariants L2, pas d'historique, pas de rollback gouverné, et
— `pri_dispo=null` étant filtré par **tous** les chemins de lecture de prix
(`='1'` côté search/products, `IN ('1','2','3')` côté RPC R2) — les **30 621 prix
sont restés invisibles** (load inerte).
C'était un **système parallèle** (anti-pattern). **Superseded** par le flux
gouverné ci-dessous. Remédiation NK = import gouverné **sans activation**, puis
activation des seules réfs à dispo **confirmée** (voir §Garde-fou storefront).
Le worker `feed-commit-nk.ts` (+ les scratch DCA-spécifiques `feed-verify-dca.ts` /
`verify-dca-prices.ts`) ont été **supprimés** (consolidation 2026-06-08) : le commit
passe **uniquement** par `POST /api/admin/pricing/import/commit`.

## Garde-fou storefront `[CRITICAL]` — 3 couches : coût ≠ dispo ≠ vendable

Séparer **trois** états, jamais les confondre :

1. **Coût fournisseur connu** = une ligne `pieces_price` existe (quel que soit `pri_dispo`).
2. **Disponibilité vérifiée** = dispo confirmée au portail (étape 2) / par la sentinelle.
3. **Vendable sur le site** = couche 1 **ET** 2.

La règle robuste — qui remplace le dangereux « prix présent ⇒ vendable » :

> **`can_sell = price_exists && pri_dispo IN ('1','2','3')`** (disponibilité
> commerciale confirmée), modélisé sans nouveau champ :
> - **`'1'`** = en stock confirmé · **`'2'`** = stock faible confirmé ·
>   **`'3'`** = sur commande / PREORDER confirmé → **vendable**.
> - **`'0'`, `null`, absence de prix** = **non vendable**. La nuance (raison) va
>   dans **`pricing_state_reason`** (`pending_stock_check` / `portal_unavailable` /
>   `review`). **Pas de champ `supplier_stock_status` parallèle** — `pri_dispo`
>   (+ `pricing_state_reason`) le porte déjà.

**Import ≠ activation commerciale.** Un import met le **coût** en base ; il ne
doit PAS rendre la pièce vendable tant que la dispo n'est pas vérifiée. Donc :

- **Importer** en **pending** (`pri_dispo` **∉ ('1','2','3')**, `pricing_state_reason='pending_stock_check'`) → coût connu, **non vendable**.
- **Activer uniquement les réfs CONFIRMED, avec le statut réel** : `'1'` en stock,
  `'2'` stock faible, `'3'` sur commande. **Rupture confirmée → `'0'`** (non vendable).
  **Doute / non vérifié → pending** (non vendable).
- **Priorité de vérification** : les réfs **réellement affichables/vendables**
  (storefront), pas un top-N générique — pas besoin de couvrir 100 % du fichier.

> ✅ **Livré** (`ImportRequest.activate`, défaut **false** = PENDING — prouvé
> MECAFILTER + VENEPORTE) : le commit écrit `pri_dispo='0'` + `pending_stock_check`
> (INSERT) / préserve la dispo (UPDATE) → coût en base, **non vendable**.
> `activate:true` reste owner-gated (réfs portal-CONFIRMED uniquement). Rendre
> vendable = endpoint séparé `POST /api/admin/pricing/activate/{dry-run,commit,rollback}`.

> ⚠️ **Dette storefront — traitée par #850** : `hasStockAvailable()` était hardcodé
> `true` (« flux tendu ») → une pièce affichée sans prix vendable apparaissait à
> **0,00 €** avec « Ajouter » actif (prix 0). #850 enforce
> **`can_sell = price_exists && pri_dispo IN ('1','2','3')`** (sinon « Indisponible »,
> non-achetable). Toute activation commerciale bulk d'une marque reste **gated**
> derrière ce gate + l'owner GO.

`pri_dispo` ne se laisse jamais à `null` pour un prix **vendable** ; et un prix
**non encore vérifié** ne doit pas être vendable. La rupture se demote **après**,
réactivement, via le toggle admin `working-stock` / la sentinelle.

---

## 0 — Prérequis (par fournisseur)

- Fournisseur **avec portail** → entrée
  [`supplier-registry.ts`](../../../backend/src/modules/supplier-truth/connectors/supplier-registry.ts)
  (`spl_id`, `platform`, `baseUrl`, env creds). *Variante : inoshop (DCA),
  ASP.NET WebForms (CAL)…*
- **Fichier tarif** fournisseur sous `/opt/automecanik/data/tecdoc/` (PAS `.archive/docs`).
- **Profil gouverné** `supplier_price_profiles` actif pour le `supplierId`
  (sinon le module refuse : `BadRequestException`). Convention + dérivation :
  `DIRECT_NET` (feed déjà en achat), `REMISE_ON_BRUT` (`px_base` brut + remise par
  sous-famille), `REMISE_ON_PUBLIC`, `MARGE_ON_NET`. Transforms whitelistées
  (`none/trim/decimalComma/percent`) — pas de DSL. **Profil = donnée gouvernée,
  owner-confirmée.**

## 1 — Préparer le fichier
Feed préparé sous `/opt/automecanik/data/tecdoc/`, **convention de nommage
générique** `<fournisseur>-<marque>-<AAAAMM>-feed.csv` (ex. `dca-nk-202606-feed.csv`),
colonnes minimales `ref,ean,achat_ht` (le classifier n'a besoin que de `ref`+`ean`).
Formule canon (module L1, en cents) : `achat = px_base×(1−remise)` ;
`vente_ht = round(achat×(1+marge))` ; remise par (marque×sous-famille) ;
grille = `MARGE_NEW_2021.xls`. ⚠️ **Valider l'unité `px_base`** (pack vs pièce).

### 1bis — EAN-13 : reconstruire le check digit depuis la DB `[CRITICAL]`

`pieces_ref_ean.pre_code_ean` stocke l'EAN-13 **SANS chiffre de contrôle** (12
chars — constaté sur toutes les marques vérifiées : pm 3040, 3080, 4900). Or
l'EAN-lock du parser (`inoshop-search-parse.ts`) est une **égalité stricte** avec
le `data-ean` portail (13 chars) → un feed généré depuis la DB sans reconstruction
**perd le verrou EAN** (tout retombe en REF_BRAND / REVIEW). Reconstruction
(validée **0 mismatch sur 2 982 réfs** MECAFILTER DB↔xlsx, 2026-06-10) :

```sql
-- d13 = (10 − Σ(d_i × poids alterné 1/3) mod 10) mod 10
SELECT pre_code_ean || (((10 - (
  SELECT sum(substr(pre_code_ean,i,1)::int * CASE WHEN i % 2 = 1 THEN 1 ELSE 3 END)
  FROM generate_series(1,12) i) % 10) % 10))::text AS ean13
WHERE pre_code_ean ~ '^[0-9]{12}$';
```

Règles feed CSV (le parser du worker est un `split(',')` naïf) :

- EAN absent → champ **VIDE non-quoté** (psql : laisser NULL — **jamais** `''`,
  que `\copy` sort en `""` quoted, lu comme un EAN littéral de 2 chars).
- `ORDER BY ref` (checkpoint resume stable). Gencode xlsx **prioritaire** quand un
  fichier fournisseur existe ; EAN DB reconstruit en complément des manquants.
- Deux sources de feed : **xlsx fournisseur** (actives = `c_arret_gamme='N'` +
  `px_base>0`, clé `c_art_fourn`, `gencode`=EAN-13) ou **catalogue DB** (pas de
  fichier : `piece_ref` + EAN reconstruit, périmètre `piece_pm_id`).

## 2 — Vérif live portail (lecture seule, owner-gated)
Deux outils complémentaires, **génériques** (tout `SUPPLIER_SPL` + `BRAND_TOKENS`),
read-only, ne touchent **jamais** `pieces_price` :

- **`supplier-availability-classify.ts`** *(recommandé pour le 1er load d'une marque)* —
  classifie **tout** le feed via la route **bulk `POST /search`** (~0,2 s/réf, vs
  ~17 s/réf en rendu page) : EAN-lock + marque-lock par réf → buckets d'activation
  `CONFIRMED_AG` (ag/vert → futur `pri_dispo='1'`), `CONFIRMED_GRP` (grp/vert+ → `'2'`),
  `BLOCK_NONE` (rupture → `'0'`), `REVIEW_*` (humain). Cache HTML gz + checkpoint JSONL
  **reprenable** ; un batch en échec n'est jamais checkpointé (pas de faux NOT_FOUND).
  Invariant **no false in-stock** : CONFIRMED seulement si dispo-type **ET** icône verte
  concordent. `SUPPLIER_SPL=71 BRAND_TOKENS=NK,SBS FEED_PATH=… OUT_DIR=… npx tsx …`
  **Convergence `[CRITICAL]` (owner 2026-06-11)** : un portail lent peut 504 en boucle
  sur certaines réfs (numériques courtes = recherche lourde). Le worker délègue la
  résilience à un **module pur testé** (`portal-classify-resilience.ts`) qui applique le
  pattern canonique : **bisection** d'un batch en échec (isole le ref fautif en ~log₂(n)
  appels au lieu de n), **budget de tentatives par-ref** persistant (`attempts.json`,
  cumulé inter-resume) → au-delà de `MAX_REF_ATTEMPTS` (déf. 3) le ref est **dead-letté**
  bucket terminal **`REVIEW_PORTAL_TIMEOUT`** (le run **CONVERGE** au lieu de boucler), et
  un **circuit-breaker** à fenêtre glissante (`BREAKER_WINDOW`, déf. 8) qui **OPEN** sur
  échec soutenu → STOP **resumable, zéro faux terminal** (un retry d'un ref déjà
  connu-mauvais n'alimente PAS le breaker, sinon la queue de réfs fautives ouvrirait
  faussement le circuit). Réduire `BATCH` (ex. `BATCH=10`) allège les plages lourdes.
  Re-checker les `REVIEW_PORTAL_TIMEOUT` = retirer leurs réfs du checkpoint + `attempts.json` et relancer.
- **`supplier-price-verify.ts`** *(spot-check prix rapide)* — compare `achat fichier`
  vs `achat portail` sur un **échantillon** risque-pondéré (gros montants). Verdict
  **CONFIRMED / FIX_FEED / REVIEW / BLOCK**. ⚠️ recherche réf **floue** → re-vérifier
  les écarts par **EAN exact** avant de conclure (sur NK, les « erreurs ×4 » étaient
  des faux positifs ; l'EAN a confirmé le fichier).

## 3 — Dry-run gouverné (ZÉRO write)
`POST /api/admin/pricing/import/dry-run` `{ supplierId, brandPmId, fileRows, operator }`
→ `DryRunReport` : INSERT / UPDATE / reject (`PROTECTED_STATE`), invariants L2
(`VENTE_BELOW_ACHAT`, marge cap, `DELTA_EXCEEDS_MAX` 30 %, TVA whitelist),
`willActivate`. **Match scopé marque** (`piece_pm_id`), réf NON-unique cross-marque.

## 4 — Revue + correction
0 `VENTE_BELOW_ACHAT`, examiner les `DELTA` outliers et rejets. FIX_FEED **confirmés
par EAN** → corriger le fichier (ou exclure du 1er commit, repris en contrôle 30 j).

## 5 — Import gouverné (owner GO) — coût d'abord, activation ensuite
`POST /api/admin/pricing/import/commit` `{ batchId, ...ImportRequest }` (le corps
reprend les mêmes `fileRows`) → chunks atomiques 5000, écrit `pieces_price_history`,
batch `COMMITTED`. **Met le coût en base, en PENDING par défaut** (`activate:false`
→ `pri_dispo='0'`, non vendable ; **`pri_ref` persisté** depuis #913 — c'est la clé
de l'activation). L'activation **vendable** (`'1'` en stock, `'2'` stock faible,
`'3'` sur commande) ne porte que sur les réfs **CONFIRMED** (étape 2), via
`activate/{dry-run,commit}` (rows `{ref,dispo}`, `confirm:true`, brand-lock
`supplierId=pm_id`). **Rollback** : `POST .../rollback` `{ batchId, supplierId }`
(LIFO `pricing_rollback_batch`, restaure prix + dispo).

## 6 — Post-commit (étalé 30 j la 1ère fois)
Dispo tenue à jour par la sentinelle (capée `SUPPLIER_SYNC_MAX_REFS_PER_RUN`,
incrémentale). Re-contrôle remise / achat / quantité par sous-famille.

## 7 — Mises à jour suivantes
**INCRÉMENTAL — nouvelles réfs only**, même profil, jamais tout le fichier.

## 8 — Deltas catalogue (new refs / pièce disparue) — CONSIGNÉ, à part, gated `[CRITICAL]`

> **Phrase canon** : *Une mise à jour fournisseur ne supprime pas le catalogue ;
> elle propose des **activations**, des **désactivations commerciales** et des
> **quarantaines** owner-gated.*

Le **dry-run** d'une MAJ classe chaque ligne en **groupes** (consignés, traités à
part du commit bulk, owner-gated). **Activation = jamais auto** : seules les réfs
**CONFIRMED** au portail passent vendables.

| Groupe (sortie dry-run) | Action |
|---|---|
| New réf **dispo confirmée** | importer + activer `pri_dispo='1'` (`'2'` si stock faible) |
| New réf **sur commande confirmée** | importer + activer `pri_dispo='3'` (PREORDER) |
| Réf **rupture confirmée** | importer/garder le **coût**, **non vendable** (`'0'`) |
| Réf **disparue du fichier** | **quarantaine, PAS suppression** (voir B) |
| **Doute** | `pending` / `review` — non vendable tant que non tranché |

(Le commit gouverné force `pri_dispo='1'` → d'où le besoin du mode « import pending »
+ activation séparée par groupe, cf. §Garde-fou storefront.)

**A. New réf → déblocage véhicule/gamme.** Une new réf peut pointer une pièce
rattachée à un **véhicule** (`type_display`) ou une **gamme** (`pg_display`) non
affiché. « Débloquer » = activer ce flag — **décision SEO/catalogue** (R8 fiche
véhicule, R1 routage gamme) :
- **Consigner** ces new refs dans une **liste de deltas** (à part du feed prix).
  **Jamais d'activation auto.**
- Respecter le pipeline d'entrée existant (`integrations/parts-feed.md` : IDs internes
  `*_i`, remap 60000-83456 noindex+301, `type_display` ≠ `type_relfollow`).

**B. Réf disparue du fichier ≠ pièce morte → quarantaine, JAMAIS suppression.**
Une absence peut signifier : **rupture fournisseur temporaire, réf changée, fichier
incomplet, erreur fournisseur, équivalence remplacée**. Plan existant
`audit/unavailable-quarantine-plan.md` (owner, vérifié code) :
- **Par défaut** : `pricing_state='FROZEN'` (verrou **import-safe** — sinon ré-activé
  au prochain commit qui force `pri_dispo='1'`) + note `pricing_state_reason`.
- `pieces.piece_display=false` (retrait du grid) **uniquement si confirmé**
  (`pri_dispo='0'` **ne retire pas**, badge/tri seulement).
- véhicule/gamme à **0 pièce vendable** → page `NoProductsAlternatives` (existant).
- **La suppression d'un véhicule/gamme ne fait PAS partie de la MAJ fournisseur** —
  décision SEO **séparée, manuelle, owner-gated, dernier recours** (valeur SEO,
  retour possible, alternative compatible) — [[feedback_no_auto_page_suppression_ever]],
  [[feedback_vehicle_page_notfound_is_404_not_503]].

**Composition avec le gate storefront (#850)** : une pièce `pri_dispo='0'` ou sans
prix vendable reste sur le grid mais à prix 0 → le gate `can_sell` l'affiche
**« Indisponible »** (non-achetable). Le retrait total = `piece_display=false`.

## Outillage ops
- **Classif dispo (full feed)** : `supplier-availability-classify.ts` (read-only, bulk
  `/search`, cache+checkpoint, brand-générique via `BRAND_TOKENS`). ✅
- **Spot-check prix** : `supplier-price-verify.ts` (existant, read-only, N-échantillon). ✅
- **Import bulk** : un adaptateur CLI **Nest standalone-context** appelant
  `PriceImportService` (mêmes garde-fous : `--brand-pm-id`/`--feed-path`/
  `--source-tag` requis, `--dry-run` par défaut, `--commit` explicite,
  `--refuse-overwrite`, résumé skip/inserted/blocked/loss/existing, rollback
  imprimé ; **pas de scheduler/cron/worker autonome**). **À livrer en PR ops
  séparée** (pas dans le skill PR).

## Variantes
| Cas | Adaptation |
|-----|------------|
| Fournisseur **sans portail** | pas d'étape 2 live, fichier seul |
| Plateforme connecteur (CAL ≠ DCA) | `platform` du registry |
| Dérivation prix | profil `DIRECT_NET` / `REMISE_ON_BRUT` / … |
| `brand pm_id` cible | scope du profil + du match |

## Séquence figée (routine standard — prouvée de bout en bout VENEPORTE 2026-06-10)

| # | Étape | Endpoint / commande | Gate | Vérif après |
|---|---|---|---|---|
| 1 | Feed (§1/§1bis) | psql `\copy` → `data/tecdoc/<fourn>-<marque>-<AAAAMM>-feed.csv` | — | longueurs EAN ∈ {13, 0}, zéro `"` |
| 2 | Pilote classify | worker §2, `LIMIT=30` | **GO owner** (login portail) | 0 FALSE_MATCH, CONFIRMED EAN-locked |
| 3 | Full classify | worker sans LIMIT (background, resumable) | couvert par le GO pilote | `MECE sum_check`, buckets, 0 batch failed |
| 4 | Dry-run import | `POST import/dry-run` (fileRows = `confirmed.csv` : `ref,ean,achat_ht=portalPrix`) | **GO owner** | 0 rejet / 0 outlier ; unmatched = hors-catalogue connu |
| 5 | Commit PENDING | `POST import/commit` `{batchId,…}` | **GO owner** | SQL : n lignes, 100 % `pri_dispo='0'`, `pri_ref` non-vide, 0 vente<achat |
| 6 | Activation | `POST activate/{dry-run,commit}` rows AG→`'1'` / GRP→`'2'`, `confirm:true` | **GO owner** | SQL : répartition `pri_dispo` 1/2, 0 resté à `'0'` |
| 7 | Display **show** | `POST display/{dry-run,commit}` `{supplierId=pm_id, confirm:true}` | **GO owner** | décomposition **MECE** : flippées + déjà-affichées + retenues gate gamme |
| 8 | Display **hide** (R2-bruit) | `POST display/quarantine/{dry-run,commit}` `{supplierId=pm_id, confirm:true}` | **GO owner** | `quarantine/dry-run` retombe à `{eligible:0}` (plus de visible non-vendable) |

À l'étape 7, **toujours décomposer** `eligible` vs vendables. Les retenues par le
gate gamme (`pg_display≠'1'`, #915) sont de deux natures distinctes :
**accessoires level-4/5** → NO-GO permanent (cachés par design) ; **hub de gamme
principale (level-1) caché** → **décision owner séparée**, jamais prise par la
routine (ex. VENEPORTE : pg 26 Silencieux + pg 17 Tube d'échappement restent
cachés — coût de transport trop cher, à revoir). Les review du classify
(`ARRIVAGE`/`NOT_FOUND`/`NO_EAN`/`PORTAL_TIMEOUT`) restent pending (re-vérification
ultérieure). MAJ tarifaire ultérieure = §7 INCRÉMENTAL.

**Étape 8 = règle R2-bruit `[CRITICAL]` (owner 2026-06-11).** Le miroir de
l'activation : une réf **affichée mais non-vendable** (pas de `pieces_price` avec
`pri_dispo IN ('1','2','3')` ET `pri_vente_ttc_n>0`) rend à 0 €/indisponible sur
R2 = **bruit** (page mince, dilue le crawl, dégrade l'UX). `display/quarantine`
flippe `piece_display` true→false pour ces réfs (brand-locké, **structurellement
disjoint** du domaine activate — ne touche jamais une réf vendable, réversible par
le même `catalog_display_rollback_batch`). C'est la **clôture standard** de chaque
load : après avoir montré les vendables (§7), on cache les non-vendables (§8).
Complément SEO = flag `R2 noindex si <1 vendable` (#916, **catalogue-wide, owner-gated
séparé** — pas par-marque). À ne pas confondre avec le gate `pg_display` (§7, niveau
gamme) ni le NO-GO accessoires.

## Worked example — VENEPORTE (2026-06-10) — 1er run 100 % gouverné de bout en bout
`VENEPORTE.xlsx` (9 640 lignes, pm 4900, DCA spl 71) → 7 338 actives → feed
`dca-veneporte-202606-feed.csv` (6 865 EAN-13 dont 8 complétés depuis la DB, 473
vides nets) → pilote 30 réfs (0 NOT_FOUND = preuve empirique que DCA porte la
marque) → full classify 47 min, 0 erreur : **1 449 CONFIRMED tous EAN-locked**
(791 AG + 658 GRP), 5 850 ruptures, 39 review → dry-run batch `85c26ac0`
(1 411 INSERT / 38 unmatched / 0 rejet) → commit PENDING 1 411 (`pri_ref` 100 %)
→ activation batch `f3f18443` (778×`'1'` + 633×`'2'`) → display batch `9969fcd9` :
**332 visibles** (Catalyseur 163, Joint d'échappement 105, FAP 57, SCR 7) ;
1 078 vendables retenues hubs pg 26/17 (owner : transport) + 1 accessoire level-4.

## Worked example — 1er run NK (2026-06-04) + remédiation
Marque **NK** (= `SBS.xlsx`, « SBS = NK »), fournisseur **DCA** (spl 71), feed
`nk-feed-prepared.csv`, cible **pm_id 3410**. 1er run = **30 621 prix via le worker
superseded** (`pri_dispo=null` → invisibles, 0 perte, marge moy 58 %).
**Remédiation** = import gouverné `DIRECT_NET` (price-neutral, invariants OK,
historise) **en pending** (coût en base, **non vendable**), PUIS vérif dispo ciblée
sur les ~1 922 pièces affichables → activation des **seules CONFIRMED** selon statut
(`'1'` en stock / `'2'` stock faible / `'3'` sur commande ; rupture → `'0'` ;
doute → pending) — **owner-gated**. Gate storefront `can_sell = price_exists &&
pri_dispo IN ('1','2','3')` traité par #850.
