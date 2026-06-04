---
name: supplier-price-load
description: Use when loading a supplier/brand tariff into pieces_price — guides the verified, reversible procedure (prepare feed → read-only dry-run → live portal verification → commit tagged + rollback → 30-day control → incremental updates). Triggers — "charger les tarifs de <marque>", "importer le tarif <fournisseur>", "mettre à jour les prix d'achat de <marque>", or any prepared supplier feed CSV destined for pieces_price.
type: discipline
status: stable
owners: ['@ak125']
domain: D15
runtime_class: privileged
llm_safe: false
last_verified: '2026-06-04'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — Supabase + PostgreSQL + Playwright supplier connectors. Touches pieces_price (live client cost), supplier portals (real login). Privileged — writes prod prices + does real supplier-portal logins.
tags: [pricing, supplier, pieces_price, tariff, import, dca, governance]
metadata:
  version: "1.0"
  argument-hint: "[brand] [supplier]"
  disable-model-invocation: true
  spec: agentskills.io/specification v1
---

# Supplier Price-Load Skill

Charge les tarifs d'une marque/fournisseur dans `pieces_price`, de façon
**vérifiée et réversible**. Encode les garde-fous du runbook
[`.claude/knowledge/ops/supplier-brand-price-load-procedure.md`](../../knowledge/ops/supplier-brand-price-load-procedure.md)
(= la doc canon ; ce skill = l'exécution).

> **Règle cardinale** : prix et **dispo** séparés. On committe les prix vérifiés ;
> la **dispo** est gérée en runtime par la sentinelle (`supplier-truth`), JAMAIS
> pré-scrapée en masse (portail lent, pas d'API). `pri_dispo` jamais `'en stock'`
> d'office. Le run réel (login portail + write `pieces_price`) exige un **GO owner
> explicite** par étape.

## Quand proposer ce skill

| Contexte détecté | Proposition |
|------------------|-------------|
| User : « charger / importer le tarif de <marque/fournisseur> » | `/supplier-price-load [marque] [fournisseur]` |
| Feed fournisseur préparé (CSV achat/vente) destiné à `pieces_price` | `/supplier-price-load` |
| MAJ prix d'achat d'une marque | `/supplier-price-load [marque]` |

---

## Workflow (OBLIGATOIRE — chaque étape gated)

### 1. Préparer / localiser le feed
- Feed = CSV `ref, ean, gros_ht, achat_ht, marge_finale_pct, vente_ht, vente_ttc`
  (achat = `px_base × (1−remise)`, vente = `achat × (1+marge)`). Source durable :
  `/opt/automecanik/data/tecdoc/`.
- ⚠️ **Valider l'unité `px_base`** (pack vs pièce) — risque d'erreur ×N.

### 2. Dry-run feed (lecture seule, ZÉRO write)
```bash
BRAND_PM_ID=<brand> FEED_PATH=<feed.csv> SOURCE_TAG=<TAG> \
  node -r dotenv/config dist/workers/supplier-price-commit.js dotenv_config_path=.env
```
- Vérifie : 0 vente à perte (`vente≥achat`, filtré), match **scopé marque**
  (`pieces.piece_pm_id`), « déjà tarifées » = 0 (sinon STOP — ce loader est
  INSERT-only). Sort le **compte exact + un échantillon + le rollback SQL**.

### 3. Vérif live portail (login RÉEL, lecture seule — GO owner)
```bash
SUPPLIER_SPL=<spl_id> FEED_PATH=<feed.csv> VERIFY_N=200 \
  node -r dotenv/config dist/workers/supplier-price-verify.js dotenv_config_path=.env
```
- Compare achat fichier vs achat portail + dispo. Verdict
  **CONFIRMED / FIX_FEED / REVIEW / BLOCK(indispo)**.
- ⚠️ recherche réf **floue** → re-vérifier les FIX_FEED avec `BY_EAN=true` (exact)
  AVANT de conclure (faux positifs fréquents).
- *Fournisseur sans portail → sauter cette étape (fichier seul).*

### 4. Corriger le feed
- FIX_FEED **confirmés par EAN** → corriger, ou `EXCLUDE_REFS=<csv>` du 1er commit.

### 5. Commit (GO owner explicite — écrit `pieces_price`)
```bash
BRAND_PM_ID=<brand> FEED_PATH=<feed.csv> SOURCE_TAG=<TAG> EXCLUDE_REFS=<csv> \
  COMMIT_CONFIRM=true \
  node -r dotenv/config dist/workers/supplier-price-commit.js dotenv_config_path=.env
```
- INSERT scopé marque, `pri_dispo` conservateur (null par défaut). **Refuse si
  déjà tarifé** (garde overwrite).
- **Rollback** (toujours montrer avant le GO) :
  `DELETE FROM pieces_price WHERE pri_pm_id='<brand>' AND pricing_updated_source='<TAG>';`
- Vérifier après : count = attendu, 0 vente à perte, 0 écrasement.

### 6. Post-commit (étalé 30j) : dispo via sentinelle · re-contrôle remise/achat/**quantité** par sous-famille.

### 7. MAJ suivantes : **INCRÉMENTAL — uniquement les nouvelles réfs** (même script, filtrer les déjà-tarifées).

---

## Interdits (BLOCK)
- ❌ `COMMIT_CONFIRM=true` sans GO owner explicite + rollback montré.
- ❌ `pri_dispo='en stock'` d'office (sur-promesse).
- ❌ overwrite d'une marque déjà tarifée par ce loader (INSERT-only).
- ❌ scraper tout le fichier en live (portail lent, pas d'API) — dispo = sentinelle.
- ❌ committer un FIX_FEED non re-vérifié par EAN.

## Worked example
NK (pm_id 3410) via DCA (spl 71), 2026-06-04 : 30 621 prix, 0 perte, 0 écrasement,
`SOURCE_TAG=NK_FEED_2026-06`. Voir le runbook pour le détail.
