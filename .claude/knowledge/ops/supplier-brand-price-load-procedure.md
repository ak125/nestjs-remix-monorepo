---
scope: Ops / Pricing — supplier tariff load into pieces_price
audience: human + Claude
sources:
  - backend/src/modules/pricing/services/pricing-formula.service.ts
  - backend/src/modules/supplier-truth/connectors/supplier-registry.ts
  - backend/src/workers/feed-commit-nk.ts
  - /opt/automecanik/data/tecdoc/
last_scan: 2026-06-04
---

# Supplier Brand Price-Load Procedure

> **Procédure réutilisable pour charger les tarifs d'une marque/fournisseur dans
> `pieces_price`.** Validée le 2026-06-04 sur le 1er run réel (marque **NK** via
> fournisseur **DCA/DistriCash**, 30 621 prix). Réutilisable pour chaque
> marque/fournisseur, **à quelques variantes près**.
>
> **Règle cardinale** : le prix et la **dispo** se gèrent SÉPARÉMENT. On commit
> les prix (vérifiés) ; la dispo est gérée en runtime par la sentinelle
> (`supplier-truth`, #831-837), JAMAIS pré-scrapée en masse (portail lent, pas
> d'API). On ne committe jamais un `pri_dispo='en stock'` d'office.

## 0 — Prérequis (par fournisseur)

- Fournisseur **avec portail** connectable → entrée dans
  [`supplier-registry.ts`](../../../backend/src/modules/supplier-truth/connectors/supplier-registry.ts)
  (`spl_id`, `platform`, `baseUrl`, env creds). *Variante : plateforme —
  inoshop (DCA), ASP.NET WebForms (CAL), …*
- Fournisseur fournit un **fichier tarif** (export, ex. `SBS.xlsx` = `px_base`
  par réf). Emplacement durable : `/opt/automecanik/data/tecdoc/` (PAS
  `.archive/docs`, nettoyé).

## 1 — Préparer le feed

```
achat_ht  = px_base × (1 − remise)
vente_ht  = round(achat_ht × (1 + marge_grille), 2)
vente_ttc = round((vente_ht + frais_port + frais_supp) × (1 + tva), 2)
```

- **Remise** = par (marque × sous-famille) — jamais un taux global.
- **Grille marge** = `MARGE_NEW_2021.xls` (SoT) ; formule = `pricing-formula.service.ts`.
- ⚠️ Valider l'**unité de `px_base`** (pack vs pièce) AVANT — un px_base "pack de 4"
  traité en "pièce" donne un achat ×4 faux.
- Sortie : `feed.csv` (ref, ean, gros_ht, achat_ht, marge, vente_ht, vente_ttc, …).

## 2 — Dry-run feed (lecture seule, zéro write)

- **Cohérence interne** : 0 vente à perte (`vente_ht ≥ achat_ht`), achat/vente > 0,
  remise cohérente, marge ≥ seuil min.
- **Match catalogue SCOPÉ MARQUE** : `pieces.piece_pm_id = <brand_id>` AND
  `piece_ref = feed.ref`. **PAS par réf seule** — une même réf existe pour
  plusieurs marques (cross-références). `pieces_price` est keyé
  `(pri_piece_id, pri_type)`, `pri_type='0'`.
- **« Déjà tarifées »** (pri_pm_id=brand) = 0 → **pur INSERT** (1ère charge) ;
  sinon UPDATE + historisation.

## 3 — Vérif live portail (login RÉEL, lecture seule, owner-gated)

- Vérifier les **cas douteux** (plus gros écarts vs ancien prix / plus gros
  montants) : `achat fichier` vs `achat portail réel`.
- ⚠️ La recherche portail par **réf est FLOUE** (autocomplete) → peut renvoyer
  une autre pièce. **Re-vérifier les écarts par EAN (exact)** pour trancher
  vraie erreur vs faux positif. *(Sur NK : les "erreurs ×4" étaient TOUTES des
  faux positifs ; l'EAN exact a confirmé le fichier.)*
- Verdict par réf : **CONFIRMED / FIX_FEED / REVIEW / BLOCK (indispo)**.
- **Dispo** : pas d'API fournisseur → portail lent (~17 s/réf → 36 k = 7 jours).
  On ne scrape JAMAIS tout le fichier. La dispo est gérée **runtime par la
  sentinelle** (`supplier_offer_snapshot`), pas pré-scrapée.

## 4 — Corriger le feed

- FIX_FEED **confirmés par EAN** → corriger la valeur, OU **exclure** du 1er commit
  (à reprendre dans le contrôle 30 j).

## 5 — Commit (avec rollback)

- Script : [`feed-commit-nk.ts`](../../../backend/src/workers/feed-commit-nk.ts)
  (supabase-js, batché 500, **safe-by-default : dry-run sauf `COMMIT_CONFIRM=true`**).
- **INSERT** `pieces_price` : `pri_pm_id=<brand>`, `pri_type='0'`,
  achat/vente/ttc/marge/gros en numérique `_n` **+ mirror texte**, `pri_ean`,
  `pri_ref`, `pricing_state='ACTIVE'`, **`pricing_updated_source=<tag>`**.
- `pri_dispo` **conservateur** (jamais `'en stock'` d'office → `null` ou code
  "sur commande").
- **DRY-RUN (compte exact + échantillon + rollback) → puis `COMMIT_CONFIRM=true`.**
- **Rollback** (réversible à 100 %) :
  ```sql
  DELETE FROM pieces_price WHERE pri_pm_id='<brand>' AND pricing_updated_source='<tag>';
  ```

## 6 — Post-commit (étalé 30 j, la 1ère fois)

- **Dispo** : sentinelle (live, capée — `SUPPLIER_SYNC_MAX_REFS_PER_RUN`,
  incrémentale). ⚠️ Follow-up : la projection sentinelle doit alimenter
  l'affichage dispo (sinon `pri_dispo=null` reste à câbler).
- **Re-contrôle remise / achat / quantité** par sous-famille (certaines
  sous-familles ont une remise portail ≠ du taux supposé).

## 7 — Mises à jour suivantes

- **INCRÉMENTAL — uniquement les NOUVELLES réfs**, jamais tout le fichier.
  Le même script ressert (filtrer les réfs déjà tarifées pour la marque).

## Variantes par cas

| Cas | Adaptation |
|-----|------------|
| Fournisseur **sans portail** (marque/équipementier pur) | pas d'étape 3 live, fichier seul |
| Plateforme connecteur (CAL ≠ DCA) | `platform` du registry |
| Remise propre | par (marque × sous-famille) |
| `brand pm_id` cible différent | scope du match + de l'INSERT |

## Worked example — 1er run (2026-06-04)

Marque **NK** (= fichier `SBS.xlsx`, owner : « SBS = NK »), fournisseur **DCA**
(spl 71). Feed `nk-feed-prepared.csv` (36 072 réfs). Cible **NK = pm_id 3410**
(37 432 pièces catalogue, 0 tarifées avant). **30 621 prix insérés** (84,9 %
match), 0 vente à perte, 0 écrasement, marge moy 58 %, `pri_dispo=null`.

```sql
-- rollback de ce run :
DELETE FROM pieces_price WHERE pri_pm_id='3410' AND pricing_updated_source='NK_FEED_2026-06';
```
