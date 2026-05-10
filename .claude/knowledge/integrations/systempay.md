---
integration: SystemPay
mode: test
sources:
  - backend/src/modules/payments/services/systempay.service.ts
last_scan: 2026-04-24
---

# Intégration SystemPay (test)

## Mode actuel

**SystemPay utilisé en test uniquement**. Paybox est la passerelle production.

## Flow

```
Order → SystemPay form fields (vads_*) → user paie → SystemPay callback
     → /api/payments/systempay/callback → signature HMAC-SHA256 vérifiée
     → order.status = paid
```

## Config environnement

- `SYSTEMPAY_SITE_ID`
- `SYSTEMPAY_CERTIFICATE_TEST`
- `SYSTEMPAY_CERTIFICATE_PROD`

## Règles CRITIQUES

1. **`vads_*` params TRIÉS alphabétiquement** avant signature (règle SystemPay).
2. **HMAC-SHA256** (différent de Paybox qui est SHA512). Ne pas mélanger.
3. **`timingSafeEqual`** obligatoire (même règle que Paybox).
4. **Certificate key rotation** : doit être hot-swappable sans redeploy.

## Fichiers clés

- [systempay.service.ts](../../../backend/src/modules/payments/services/systempay.service.ts) — génération form + vérification

## Gotchas

- Ordre alphabétique des `vads_*` NON négociable — un bug connu si on tri sur un subset
- Certificate test vs prod : JAMAIS endpoint test sur certif prod
- Le callback URL doit matcher exactement celui déclaré côté SystemPay (sinon signature invalide)

## CI gate connu

`perf-gates SystemPay cert` — CI flake récurrent, fix dans PR monorepo #100 (voir MEMORY.md `ci-flakes-known-infra.md`).

## Règles associées

- `.claude/rules/payments.md`
- MEMORY.md : `ci-flakes-known-infra.md`
