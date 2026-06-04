---
name: supplier-price-load
description: Use when loading a supplier/brand tariff into pieces_price — drives the GOVERNED Pricing Control Plane import (portal verification → supplier profile → dry-run → commit → rollback), never a standalone INSERT. Triggers — "charger les tarifs de <marque>", "importer le tarif <fournisseur>", "mettre à jour les prix d'achat de <marque>", or any prepared supplier feed destined for pieces_price.
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-06-04'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — Supabase + PostgreSQL + Playwright supplier connectors + the governed PricingModule (Pricing Control Plane V1). Touches pieces_price (live client cost) via the governed import API only. Privileged — drives prod price writes + does real supplier-portal logins.
tags: [pricing, supplier, pieces_price, tariff, import, pricing-control-plane, dca, governance]
metadata:
  version: "2.0"
  argument-hint: "[brand] [supplier]"
  disable-model-invocation: true
  spec: agentskills.io/specification v1
---

# Supplier Price-Load Skill

Charge les tarifs d'une marque/fournisseur dans `pieces_price` **via le module
gouverné** `PricingModule` (Pricing Control Plane V1, `backend/src/modules/pricing/`,
PR #707/#709), de façon vérifiée et réversible. Doctrine = runbook
[`.claude/knowledge/ops/supplier-brand-price-load-procedure.md`](../../knowledge/ops/supplier-brand-price-load-procedure.md).

> **Règle cardinale `[CRITICAL]`** : **JAMAIS d'INSERT/UPDATE direct dans
> `pieces_price`.** Le SoT du coût est le `PricingModule` — formule en cents,
> invariants L2 (`VENTE_BELOW_ACHAT`, marge cap, **DELTA outlier 30 %**, TVA
> whitelist), historique `pieces_price_history`, batch-audit, commit atomique +
> rollback **gouvernés** (PG functions). Un loader standalone est un **système
> parallèle interdit** (anti-bricolage). Le run réel exige un **GO owner par
> étape**.

> **Invariant dispo `[CRITICAL]`** : importer un tarif **active** la pièce —
> `pricing_commit_chunk` met `pri_dispo='1'` (= vendable). Tous les chemins de
> lecture de prix filtrent `pri_dispo='1'` (R2 RPC, search, products). Donc
> **`pri_dispo=null` rend le prix INVISIBLE partout** — ne jamais charger un prix
> qu'on veut voir avec `dispo` null. La nuance « rupture » se gère **après** via
> le toggle admin `working-stock` / la sentinelle, pas en laissant le prix muet.

## Quand proposer ce skill

| Contexte détecté | Proposition |
|------------------|-------------|
| User : « charger / importer le tarif de <marque/fournisseur> » | `/supplier-price-load [marque] [fournisseur]` |
| Feed/fichier fournisseur destiné à `pieces_price` | `/supplier-price-load` |
| MAJ prix d'achat d'une marque | `/supplier-price-load [marque]` |

---

## Workflow (OBLIGATOIRE — chaque étape gated)

### 1. Localiser le fichier fournisseur
Fichier brut ou feed préparé sous `/opt/automecanik/data/tecdoc/`. ⚠️ **Valider
l'unité `px_base`** (pack vs pièce) — risque d'erreur ×N.

### 2. Vérif live portail (login RÉEL, lecture seule — GO owner)
```bash
SUPPLIER_SPL=<spl_id> FEED_PATH=<feed.csv> VERIFY_N=200 \
  node -r dotenv/config dist/workers/supplier-price-verify.js dotenv_config_path=.env
```
- Compare achat fichier vs achat **portail** + **dispo**. Verdict
  **CONFIRMED / FIX_FEED / REVIEW / BLOCK(indispo)**.
- ⚠️ recherche réf **floue** → re-vérifier les FIX_FEED avec `BY_EAN=true` (exact)
  AVANT de conclure. *Fournisseur sans portail → fichier seul.*
- C'est la **seule** brique hors-module : le `PricingModule` n'a pas de vérif
  portail. Read-only, ne touche jamais `pieces_price`.

### 3. Profil fournisseur gouverné (`supplier_price_profiles`)
Le module **exige** un profil actif pour le `supplierId` (sinon
`BadRequestException`). Le profil mappe les colonnes → champs canoniques
(`ref/ean/grosHt/remise/achatHt/marge/publicHt`) + une `derivation` gouvernée :
- `DIRECT_NET` — le fichier porte déjà `achat_ht` (feed pré-calculé).
- `REMISE_ON_BRUT` — `px_base` brut + remise par (marque×sous-famille) → scope `SUBFAMILY`.
- `REMISE_ON_PUBLIC` / `MARGE_ON_NET` selon le fournisseur.

Transforms whitelistées uniquement (`none/trim/decimalComma/percent`) — **pas de
DSL caché**. Profil = donnée gouvernée, à confirmer avec l'owner.

### 4. Dry-run gouverné (ZÉRO write)
`POST /api/admin/pricing/import/dry-run` `{ supplierId, brandPmId, fileRows, operator }`
→ `DryRunReport` : INSERT / UPDATE / reject (`PROTECTED_STATE`), invariants L2,
`willActivate`. Aucune écriture.

### 5. Revue du rapport
0 `VENTE_BELOW_ACHAT`, examiner `DELTA_EXCEEDS_MAX` (outliers), rejets, comptes
INSERT vs UPDATE. **Présenter à l'owner.**

### 6. Commit gouverné (GO owner explicite — écrit `pieces_price`)
`POST /api/admin/pricing/import/commit` `{ batchId }` → chunks atomiques 5000,
`pri_dispo='1'`, écrit `pieces_price_history`, batch `COMMITTED`.

### 7. Rollback gouverné (si besoin)
`POST /api/admin/pricing/import/rollback` `{ batchId, supplierId }` → LIFO restore
via `pricing_rollback_batch` (restaure dispo + prix antérieurs depuis l'historique).

### 8. MAJ suivantes : **INCRÉMENTAL — nouvelles réfs only**, même profil.

---

## Interdits (BLOCK)
- ❌ INSERT/UPDATE direct dans `pieces_price` (worker/script standalone) — **utiliser le module**.
- ❌ `pri_dispo=null` sur un prix qu'on veut visible (= prix muet partout).
- ❌ commit sans dry-run revu + GO owner.
- ❌ profil avec transform non-whitelistée (DSL caché).
- ❌ committer un FIX_FEED non re-vérifié par EAN.

## Worked example
NK (pm_id 3410) via DCA (spl 71). Profil `DIRECT_NET` (feed `nk-feed-prepared.csv`
porte `achat_ht`+`marge`) → dry-run → commit gouverné (active `pri_dispo='1'`,
historise). Le 1er run (2026-06-04) avait été fait par un **loader standalone**
(`pri_dispo=null` → 30 621 prix invisibles) : remédié en re-passant par le module.
Voir le runbook.
