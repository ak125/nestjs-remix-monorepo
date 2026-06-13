---
name: supplier-price-load
description: Use when loading a supplier/brand tariff into pieces_price — drives the GOVERNED Pricing Control Plane import (feed + EAN-13 → portal classify → supplier profile → dry-run → commit PENDING → activation → display → rollback), never a standalone INSERT. Triggers — "charger les tarifs de <marque>", "importer le tarif <fournisseur>", "mettre à jour les prix d'achat de <marque>", or any prepared supplier feed destined for pieces_price.
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-06-10'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — Supabase + PostgreSQL + Playwright supplier connectors + the governed PricingModule (Pricing Control Plane V1). Touches pieces_price (live client cost) via the governed import API only. Privileged — drives prod price writes + does real supplier-portal logins.
tags: [pricing, supplier, pieces_price, tariff, import, pricing-control-plane, dca, governance]
metadata:
  version: "2.1"
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

> **Invariant dispo `[CRITICAL]`** : le commit gouverné écrit en **PENDING par
> défaut** (`ImportRequest.activate:false` → `pri_dispo='0'` +
> `pending_stock_check`, non vendable ; **`pri_ref` persisté** #913 = clé de
> l'activation). Tous les chemins de lecture filtrent `pri_dispo IN ('1','2','3')`
> → un prix pending/null est **INVISIBLE partout** (0,00 €). Rendre vendable =
> étape séparée `activate/{dry-run,commit}` sur les seules réfs
> **portal-CONFIRMED** (AG→`'1'`, GRP→`'2'`), puis visible = `display/commit`
> (gate gamme `pg_display` #915). Chaque étape = **GO owner** + rollback batch.

## Quand proposer ce skill

| Contexte détecté | Proposition |
|------------------|-------------|
| User : « charger / importer le tarif de <marque/fournisseur> » | `/supplier-price-load [marque] [fournisseur]` |
| Feed/fichier fournisseur destiné à `pieces_price` | `/supplier-price-load` |
| MAJ prix d'achat d'une marque | `/supplier-price-load [marque]` |

---

## Workflow (OBLIGATOIRE — chaque étape gated)

### 1. Localiser / générer le feed
Feed préparé sous `/opt/automecanik/data/tecdoc/`, nommage générique
`<fournisseur>-<marque>-<AAAAMM>-feed.csv`. ⚠️ **Valider l'unité `px_base`**
(pack vs pièce) — risque d'erreur ×N. ⚠️ **EAN depuis la DB = reconstruire le
check digit** (`pieces_ref_ean` stocke 12 chars ; EAN-lock parser = égalité
stricte EAN-13) ; EAN absent = champ vide **non-quoté** (jamais `""`) — SQL +
règles dans le runbook §1bis.

### 2. Vérif live portail (login RÉEL, lecture seule — GO owner)
Deux outils **génériques** (tout `SUPPLIER_SPL` + `BRAND_TOKENS`), read-only, ne
touchent jamais `pieces_price`. C'est la **seule** brique hors-module (le
`PricingModule` n'a pas de vérif portail).

**Full-feed (recommandé au 1er load d'une marque)** — classifie TOUT le feed via la
route bulk `POST /search` (~0,2 s/réf), buckets `CONFIRMED_AG`/`CONFIRMED_GRP`/
`BLOCK_NONE`/`REVIEW_*`, cache + checkpoint reprenable, invariant *no false in-stock* :
```bash
SUPPLIER_SPL=<spl_id> BRAND_TOKENS=<MARQUE,ALIAS> FEED_PATH=<feed.csv> \
  OUT_DIR=/opt/automecanik/data/tecdoc/<fournisseur>-<marque> [LIMIT=30] \
  npx tsx -r dotenv/config backend/src/workers/supplier-availability-classify.ts dotenv_config_path=backend/.env
```
`OUT_DIR` **obligatoire et durable** (#908 — jamais un tmp OS : il porte le
checkpoint resumable). Routine : **pilote `LIMIT=30` d'abord** (vérifie login,
brand tokens, EAN-lock), puis full run en background (resumable). Portail lent →
baisser `BATCH` (`BATCH=10`). **Convergence** : un ref qui 504 **seul** (portail
sain) finit en bucket terminal `REVIEW_PORTAL_TIMEOUT` (le run converge au lieu de
boucler) ; une passe d'isolation 0-succès = panne → STOP resumable sans faux terminal.

**Spot-check prix (échantillon)** — compare achat fichier vs achat portail sur N réfs
risque-pondérées :
```bash
SUPPLIER_SPL=<spl_id> FEED_PATH=<feed.csv> VERIFY_N=200 \
  node -r dotenv/config dist/workers/supplier-price-verify.js dotenv_config_path=.env
```
- Verdict **CONFIRMED / FIX_FEED / REVIEW / BLOCK(indispo)**.
- ⚠️ recherche réf **floue** → re-vérifier les FIX_FEED avec `BY_EAN=true` (exact)
  AVANT de conclure. *Fournisseur sans portail → fichier seul.*

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

### 6. Commit gouverné PENDING (GO owner explicite — écrit `pieces_price`)
`POST /api/admin/pricing/import/commit` `{ batchId, ...ImportRequest }` → chunks
atomiques 5000, **`pri_dispo='0'` PENDING** (défaut `activate:false`), `pri_ref`
persisté, écrit `pieces_price_history`, batch `COMMITTED`. **Vérif SQL** : n lignes,
100 % `'0'`, `pri_ref` non-vide, 0 vente<achat.

### 7. Activation dispo (GO owner — rend les prix lisibles)
`POST /api/admin/pricing/activate/dry-run` puis `commit` `{ supplierId: <pm_id>,
rows: [{ref, dispo}], confirm: true }` — rows depuis `confirmed.csv` du classify :
AG→`'1'`, GRP→`'2'`. Missing attendu = hors-catalogue du dry-run import.
**Vérif SQL** : répartition `pri_dispo`, 0 resté à `'0'`.

### 8. Display (GO owner — rend les pièces visibles/achetables)
`POST /api/admin/pricing/display/dry-run` puis `commit` `{ supplierId: <pm_id>,
confirm: true }` — flip `piece_display` des vendables cachées, **gate gamme
`pg_display='1'` (#915)**. **Décomposer TOUJOURS** eligible vs vendables : retenues
= accessoires level-4/5 (NO-GO design) OU hub gamme level-1 caché (**décision owner
séparée** — ex. transport trop cher, cf. runbook §Séquence figée).

### 9. Quarantine R2-bruit (GO owner — cache les non-vendables) `[CRITICAL]`
**Clôture standard du load** (miroir de l'activation, owner 2026-06-11). Une réf
**affichée mais non-vendable** rend à 0 €/indisponible sur R2 = bruit (page mince,
SEO/UX). `POST /api/admin/pricing/display/quarantine/dry-run` puis `commit`
`{ supplierId: <pm_id>, confirm: true }` → flip `piece_display` true→false pour ces
réfs (brand-locké, **disjoint du domaine activate**, réversible). Vérif : le
`quarantine/dry-run` retombe à `{eligible:0}`. Complément SEO = flag #916 (`R2
noindex si <1 vendable`, **catalogue-wide owner-gated séparé**).

### 10. Rollback gouverné (si besoin, par étape)
`POST /api/admin/pricing/{import,activate,display,display/quarantine}/rollback`
`{ batchId, supplierId }` → LIFO restore (dispo / prix / `piece_display`).

### 11. MAJ suivantes : **INCRÉMENTAL — nouvelles réfs only**, même profil.

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
