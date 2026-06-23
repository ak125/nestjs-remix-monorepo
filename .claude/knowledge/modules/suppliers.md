---
module: suppliers
sources:
- backend/src/modules/suppliers
last_scan: '2026-06-23'
primary_files:
- backend/src/modules/suppliers/dto/index.ts
- backend/src/modules/suppliers/dto/supplier.dto.ts
- backend/src/modules/suppliers/dto/supplier.schemas.ts
- backend/src/modules/suppliers/suppliers-modern.controller.ts
- backend/src/modules/suppliers/suppliers.controller.ts
- backend/src/modules/suppliers/suppliers.module.ts
- backend/src/modules/suppliers/suppliers.service.ts
depends_on:
- DatabaseModule
---

# Module Suppliers

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
`backend/src/modules/suppliers/` = **données maîtres fournisseur** (roster
`___xtr_supplier`, liens marque `___xtr_supplier_link_pm`, stats) via `SuppliersService` —
référentiel pur, **n'écrit aucune dispo/prix**. Le **domaine fournisseur** complet est plus
large que ce module : voir la carte des 3 surfaces ci-dessous (§Pourquoi) — chacune a un
métier distinct et partage les mêmes couches, **ne jamais en réinventer une**.

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SuppliersService`

### Providers (top 15)
- `SuppliersService`

### Fichiers primaires
- [backend/src/modules/suppliers/dto/index.ts](../../../backend/src/modules/suppliers/dto/index.ts)
- [backend/src/modules/suppliers/dto/supplier.dto.ts](../../../backend/src/modules/suppliers/dto/supplier.dto.ts)
- [backend/src/modules/suppliers/dto/supplier.schemas.ts](../../../backend/src/modules/suppliers/dto/supplier.schemas.ts)
- [backend/src/modules/suppliers/suppliers-modern.controller.ts](../../../backend/src/modules/suppliers/suppliers-modern.controller.ts)
- [backend/src/modules/suppliers/suppliers.controller.ts](../../../backend/src/modules/suppliers/suppliers.controller.ts)
- [backend/src/modules/suppliers/suppliers.module.ts](../../../backend/src/modules/suppliers/suppliers.module.ts)
- [backend/src/modules/suppliers/suppliers.service.ts](../../../backend/src/modules/suppliers/suppliers.service.ts)

<!-- END AUTO-GENERATED -->

## Pourquoi
<!-- À compléter à la main : contraintes architecturales, décisions historiques, trade-offs. -->

### Carte du domaine fournisseur — 3 surfaces distinctes, couches partagées `[anti-redondance]`

Vérifié à fond 2026-06-13 (audit read-only). **Trois** surfaces fournisseur coexistent,
**métiers orthogonaux** — ce ne sont **pas** des doublons, et chaque session doit étendre
celle qui correspond, **jamais en créer une parallèle** :

| Surface | Fichier | Métier | Sortie | Cadence | Plateformes |
|---|---|---|---|---|---|
| **classify** | `backend/src/workers/supplier-availability-classify.ts` | full-feed pré-activation : quels refs peuvent devenir vendables | JSONL/CSV + **buckets d'activation** (CONFIRMED/BLOCK/REVIEW), read-only | on-demand (ops CLI) | **inoshop only** (route bulk `POST /search`) |
| **supplier-sync** | `backend/src/modules/supplier-truth/supplier-sync.runner.ts` (+ scheduler/processor, `worker.module.ts`) | **observatoire** continu prix+dispo | écrit `supplier_offer_snapshot` (observations brutes + `parse_confidence`) | cron 4h, **DORMANT par défaut** (flag `SUPPLIER_TRUTH_SYNC_ENABLED`) | **DCA + CAL** (générique registry) |
| **supplier-price-verify** | `backend/src/workers/supplier-price-verify.ts` | spot-check prix N-échantillon risque-pondéré avant import | verdict CONFIRMED/FIX_FEED/REVIEW/BLOCK | on-demand (ops CLI) | **inoshop + CAL** |

**Couches PARTAGÉES (réutilisées par les 3, jamais dupliquées)** :
- **Connecteurs** = couche portail unique : `connectors/supplier-registry.ts`
  (générique par `spl_id`/platform/creds) + `inoshop.connector.ts` + `cal.connector.ts`
  (login, token, jitter anti-ban, `fetchSearchRaw` bulk / `fetchAvailability` per-ref, close).
- **Classification** : `connectors/inoshop-search-parse.ts` (`verdictForRef`/`ActivationBucket`) — pure, unique.
- **Résilience** : `connectors/portal-classify-resilience.ts` (#960) — module **pur testé**
  (bisection + budget par-ref + circuit-breaker + dead-letter `REVIEW_PORTAL_TIMEOUT`).
  Réutilisable par classify **et** un futur supplier-sync.

### Pourquoi classify ≠ DCA-only
Générique via `SUPPLIER_SPL`+`BRAND_TOKENS`+registry. La limite `cfg.platform === 'inoshop'`
est une **contrainte portail** (seul inoshop expose le bulk `/search`), **pas un hardcode** ;
la dispo CAL passe par supplier-sync (per-ref) / supplier-price-verify.

## Gotchas
<!-- À compléter à la main : pièges connus, bugs célèbres, invariants non évidents. -->
- **Ne pas confondre / dupliquer les 3 surfaces** (§Pourquoi). Avant d'ajouter une logique
  dispo/prix/résilience fournisseur : étendre la surface + la couche partagée existante.
- **`supplier_offer_snapshot` ≠ buckets d'activation.** L'observatoire stocke des
  observations brutes (`parse_confidence` HIGH/AMBIGUOUS/…), **pas** CONFIRMED/BLOCK/REVIEW.
  Le mapping refs→`pri_dispo` est le métier de classify, pas de supplier-sync.
- **supplier-sync est DORMANT** (flag off, one-shot owner-gated `SUPPLIER_SYNC_ONESHOT_CONFIRM`).
  Ne pas l'activer ni y câbler la résilience sans GO owner — c'est du code inactif.
- **Pipeline supplier-sync WRITE câblé dans `worker.module.ts`** (Bull `forRoot`), jamais
  re-provider ailleurs (sinon 2ᵉ `@Processor('supplier-sync')` = double-conso).
- **Résilience = 1 seul module** (`portal-classify-resilience.ts`). Ne pas recréer un breaker
  parallèle ; les breakers `CircuitBreakerService` (ai-content) / `RagCircuitBreakerService`
  sont des **gates par-provider** d'un autre domaine — forme différente, ne pas coupler.

## Références
<!-- À compléter à la main : liens vers `.claude/rules/`, vault ADRs, MEMORY.md entries. -->
- Runbook ops : [`.claude/knowledge/ops/supplier-brand-price-load-procedure.md`](../ops/supplier-brand-price-load-procedure.md) (séquence figée 8 gates).
- Skill : [`supplier-price-load`](../../skills/supplier-price-load/SKILL.md).
- PRs : #908 (consolidation classify) · #926 (méthode figée) · #960 (résilience module).
- MEMORY : `project_supplier_verify_consolidation_20260608`,
  `reference_supplier_pricing_via_governed_module`, `feedback_one_frozen_method_no_improvised_variants`.
