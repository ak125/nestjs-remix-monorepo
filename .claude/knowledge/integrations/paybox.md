---
integration: Paybox
mode: production
sources:
  - backend/src/modules/payments/services/paybox.service.ts
  - backend/src/modules/payments/services/paybox-callback-gate.service.ts
  - backend/src/modules/payments/controllers/paybox-callback.controller.ts
last_scan: 2026-04-24
---

# Intégration Paybox (production)

## Mode actuel

**Paybox RSA STRICT mode actif en production** (voir MEMORY.md `paybox-rsa.md`).
La vérification RSA remplace progressivement HMAC pour les nouveaux paiements.

## Flow

```
Order → redirect Paybox → user paie → Paybox POST callback
     → /api/payments/paybox/callback → PayboxCallbackGateService.verify()
     → signature RSA/HMAC vérifiée (timingSafeEqual obligatoire)
     → error code check → order.status = paid
     → redirect user success
```

## Config environnement

- `PAYBOX_SITE`
- `PAYBOX_RANG`
- `PAYBOX_IDENTIFIANT`
- `PAYBOX_HMAC_KEY` (legacy, strict mode = RSA)
- `PAYBOX_RSA_PUBKEY` (strict mode)

## Règles CRITIQUES (bloquantes)

1. **`timingSafeEqual` obligatoire** — JAMAIS `===` (timing attack). Enforcé par ast-grep rule `payments-no-raw-equality`.
2. **`normalizeOrderId()`** obligatoire avant DB lookup (référence clé).
3. **Vérifier error code AVANT** de confirmer `paid`.
4. **Jamais de HMAC keys hardcodées** dans le code.
5. **Jamais de test endpoints en prod**.

## Fichiers clés

- [paybox-callback-gate.service.ts](../../../backend/src/modules/payments/services/paybox-callback-gate.service.ts) — vérif signature
- [paybox.service.ts](../../../backend/src/modules/payments/services/paybox.service.ts) — génération payload
- [paybox-callback.controller.ts](../../../backend/src/modules/payments/controllers/paybox-callback.controller.ts) — endpoint HTTP
- [paybox-redirect.controller.ts](../../../backend/src/modules/payments/controllers/paybox-redirect.controller.ts) — retour user
- [paybox-monitoring.controller.ts](../../../backend/src/modules/payments/controllers/paybox-monitoring.controller.ts) — health probes

## Gotchas vécus

- Callback peut arriver en GET OU POST selon config Paybox → gérer les 2 côtés controller
- `vads_*` est SystemPay, pas Paybox — ne pas mélanger
- En mode RSA strict, HMAC est ignoré ; prévoir fallback si Paybox downgrade signature

## Règles associées

- `.claude/rules/payments.md` — règles sécurité (bloquantes)
- MEMORY.md : `paybox-rsa.md` — RSA strict mode 2026-04
- Incidents vault : `governance-vault/ledger/incidents/2026/paybox-*`
