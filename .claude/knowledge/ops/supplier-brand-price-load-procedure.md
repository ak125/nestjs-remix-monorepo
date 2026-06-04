---
scope: Ops / Pricing — supplier tariff load into pieces_price (via the governed PricingModule)
audience: human + Claude
sources:
  - backend/src/modules/pricing/                      # Pricing Control Plane V1 (SoT cost import)
  - backend/src/modules/pricing/controllers/pricing-import.controller.ts
  - backend/supabase/migrations/20260522_pricing_control_plane_v1_functions.sql
  - .claude/skills/supplier-price-load/SKILL.md        # canonical operator flow (PR #849)
  - backend/src/workers/supplier-price-verify.ts       # read-only portal verification
  - backend/src/modules/supplier-truth/connectors/supplier-registry.ts
  - /opt/automecanik/data/tecdoc/
last_scan: 2026-06-04
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
(`pri_dispo='1'`) — les **30 621 prix sont restés invisibles** (load inerte).
C'était un **système parallèle** (anti-pattern). **Superseded** par le flux
gouverné ci-dessous. Remédiation NK = ré-import via le module (active `dispo='1'`).

## Garde-fou storefront `[CRITICAL]`

Importer un tarif **active** la pièce : `pricing_commit_chunk` met
`pri_dispo='1'`. Tant que le storefront **n'enforce pas la dispo** au runtime
(`hasStockAvailable()` hardcodé `true`, filtre dispo désactivé « flux tendu »),
**activer un prix = l'activer commercialement** (vendable), même si ce n'est
« que le coût ». Donc :

> **Toute activation bulk d'une marque fournisseur DOIT être précédée d'une
> vérification de disponibilité ciblée sur les références affichables/vendables
> en storefront.** Pas besoin de couvrir 100 % du fichier — mais les réfs qui
> peuvent réellement être vues/achetées doivent être couvertes (BLOCK si indispo).

`pri_dispo` ne se laisse **jamais** à `null` pour un prix qu'on veut visible
(= prix muet partout). La rupture se demote **après**, réactivement, via le
toggle admin `working-stock` / la sentinelle.

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
Formule canon (module L1, en cents) : `achat = px_base×(1−remise)` ;
`vente_ht = round(achat×(1+marge))` ; remise par (marque×sous-famille) ;
grille = `MARGE_NEW_2021.xls`. ⚠️ **Valider l'unité `px_base`** (pack vs pièce).

## 2 — Vérif live portail (lecture seule, owner-gated)
`supplier-price-verify.ts` (read-only, ne touche jamais `pieces_price`) :
`achat fichier` vs `achat portail` + **dispo**. Verdict
**CONFIRMED / FIX_FEED / REVIEW / BLOCK(indispo)**. ⚠️ recherche réf **floue** →
re-vérifier les écarts par **EAN exact** avant de conclure (sur NK, les « erreurs
×4 » étaient des faux positifs ; l'EAN a confirmé le fichier). Pas d'API → portail
lent (~17 s/réf) → **vérif ciblée** (réfs affichables/vendables + plus gros
montants), jamais tout le fichier.

## 3 — Dry-run gouverné (ZÉRO write)
`POST /api/admin/pricing/import/dry-run` `{ supplierId, brandPmId, fileRows, operator }`
→ `DryRunReport` : INSERT / UPDATE / reject (`PROTECTED_STATE`), invariants L2
(`VENTE_BELOW_ACHAT`, marge cap, `DELTA_EXCEEDS_MAX` 30 %, TVA whitelist),
`willActivate`. **Match scopé marque** (`piece_pm_id`), réf NON-unique cross-marque.

## 4 — Revue + correction
0 `VENTE_BELOW_ACHAT`, examiner les `DELTA` outliers et rejets. FIX_FEED **confirmés
par EAN** → corriger le fichier (ou exclure du 1er commit, repris en contrôle 30 j).

## 5 — Commit gouverné (owner GO)
`POST /api/admin/pricing/import/commit` `{ batchId }` → chunks atomiques 5000,
**`pri_dispo='1'`** (activation), écrit `pieces_price_history`, batch `COMMITTED`.
**Rollback** gouverné : `POST /api/admin/pricing/import/rollback`
`{ batchId, supplierId }` (LIFO via `pricing_rollback_batch`, restaure prix + dispo).

## 6 — Post-commit (étalé 30 j la 1ère fois)
Dispo tenue à jour par la sentinelle (capée `SUPPLIER_SYNC_MAX_REFS_PER_RUN`,
incrémentale). Re-contrôle remise / achat / quantité par sous-famille.

## 7 — Mises à jour suivantes
**INCRÉMENTAL — nouvelles réfs only**, même profil, jamais tout le fichier.

## Outillage ops
- **Vérif** : `supplier-price-verify.ts` (existant, read-only). ✅
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

## Worked example — 1er run NK (2026-06-04) + remédiation
Marque **NK** (= `SBS.xlsx`, « SBS = NK »), fournisseur **DCA** (spl 71), feed
`nk-feed-prepared.csv`, cible **pm_id 3410**. 1er run = **30 621 prix via le worker
superseded** (`pri_dispo=null` → invisibles, 0 perte, marge moy 58 %).
**Remédiation** = ré-import gouverné `DIRECT_NET` (price-neutral, invariants OK,
active `dispo='1'`, historise), précédé de la vérif dispo ciblée sur les ~1 922
pièces affichables — **owner-gated**.
