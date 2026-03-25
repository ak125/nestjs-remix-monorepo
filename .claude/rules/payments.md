# Payment Integration (Critical)

## Gateways

- **Paybox** (prod) : HMAC-SHA512. Config : `PAYBOX_SITE/RANG/IDENTIFIANT/HMAC_KEY`
- **SystemPay** (test) : HMAC-SHA256. Config : `SYSTEMPAY_SITE_ID/CERTIFICATE_*`. Vads_* params tries alphabetiquement.

## Flow

Order → redirect gateway → callback `/api/payments/paybox/callback` → signature verifiee → order updated → redirect user

## Security (BLOCK si viole)

- `timingSafeEqual` obligatoire (JAMAIS `===` — timing attack)
- `normalizeOrderId()` avant DB lookup
- Verifier error code avant confirmation paid
- Jamais de HMAC keys hardcodees, jamais de test endpoints en prod

## Key Files

`payments/services/paybox-callback-gate.service.ts`, `cyberplus.service.ts`, `paybox.service.ts`, `controllers/paybox-callback.controller.ts`
