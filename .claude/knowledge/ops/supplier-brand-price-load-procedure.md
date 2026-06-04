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
(`='1'` côté search/products, `IN ('1','2','3')` côté RPC R2) — les **30 621 prix
sont restés invisibles** (load inerte).
C'était un **système parallèle** (anti-pattern). **Superseded** par le flux
gouverné ci-dessous. Remédiation NK = import gouverné **sans activation**, puis
activation des seules réfs à dispo **confirmée** (voir §Garde-fou storefront).

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

> ⚠️ **Le module gouverné active `pri_dispo='1'` au commit** (`pricing_commit_chunk`).
> Pour respecter « import ≠ vendable », l'import doit pouvoir écrire en **pending**
> (option d'activation paramétrable, défaut **non-activant**) — **changement
> gouverné à livrer** (sinon : import puis demote immédiat des non-confirmées).

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

## 5 — Import gouverné (owner GO) — coût d'abord, activation ensuite
`POST /api/admin/pricing/import/commit` `{ batchId }` → chunks atomiques 5000,
écrit `pieces_price_history`, batch `COMMITTED`. **Met le coût en base.**
⚠️ Le module met `pri_dispo='1'` au commit ; pour respecter « import ≠ vendable »
(§Garde-fou storefront), soit l'import écrit en **pending** (option non-activante,
**à livrer**), soit on **demote** immédiatement les non-confirmées (→ pending /
`'0'` + `pricing_state_reason`) — l'activation **vendable** (`'1'` en stock, `'2'`
stock faible, `'3'` sur commande) ne reste que sur les réfs **CONFIRMED** (étape 2),
selon leur statut réel. **Rollback** : `POST .../rollback`
`{ batchId, supplierId }` (LIFO `pricing_rollback_batch`, restaure prix + dispo).

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
**Remédiation** = import gouverné `DIRECT_NET` (price-neutral, invariants OK,
historise) **en pending** (coût en base, **non vendable**), PUIS vérif dispo ciblée
sur les ~1 922 pièces affichables → activation des **seules CONFIRMED** selon statut
(`'1'` en stock / `'2'` stock faible / `'3'` sur commande ; rupture → `'0'` ;
doute → pending) — **owner-gated**. Gate storefront `can_sell = price_exists &&
pri_dispo IN ('1','2','3')` traité par #850.
