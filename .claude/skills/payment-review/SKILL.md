# Payment Review Skill

Validates payment flow security: HMAC signatures, callback handling, order normalization, and gateway configuration for Paybox + SystemPay.

## When to Activate
- Invoke with `/payment-review`
- When reviewing any file in `backend/src/modules/payments/`
- When auditing payment security

## Checklist (MANDATORY before approving payment changes)

1. **HMAC signature verification preserved** — never removed or weakened
2. **timingSafeEqual used** (not `===` for signature comparison) — prevents timing attacks
3. **normalizeOrderId() called** before DB lookup — ensures consistent order matching
4. **Error code validation** — `Erreur:00000` = success for Paybox, check before marking paid
5. **Idempotency check** — replay callbacks must return OK without double-processing
6. **PBX_SITE/RANG/IDENTIFIANT match** production config — no test values in prod
7. **No test endpoints exposed** — callback-test endpoints removed from production
8. **CSP allows payment gateway domains** only — no wildcard origins

## Key Files

- `backend/src/modules/payments/services/paybox-callback-gate.service.ts` — Callback validation gate
- `backend/src/modules/payments/services/cyberplus.service.ts` — SystemPay integration
- `backend/src/modules/payments/services/paybox.service.ts` — Paybox integration
- `backend/src/modules/payments/controllers/paybox-callback.controller.ts` — Callback endpoint
- `backend/src/modules/payments/utils/normalize-order-id.ts` — Order ID normalization

## Signature Verification Patterns

**Paybox (HMAC-SHA512):**
- Response: `Mt:10050;Ref:ORD123;Auto:XXXXX;Erreur:00000;Signature:...`
- Verify: HMAC-SHA512 of response body (without Signature param) using PAYBOX_HMAC_KEY
- Compare with `crypto.timingSafeEqual()`

**SystemPay (HMAC-SHA256):**
- Vads_* parameters sorted alphabetically
- Concatenated with `+` separator + certificate
- SHA256 hash comparison

## Anti-Patterns (BLOCK these changes)

- Using `===` for signature comparison (timing attack vulnerability)
- Skipping or commenting out signature verification
- Hardcoded HMAC keys in source code
- Test callback endpoints accessible in production
- Missing error code validation before marking order as paid
- Removing normalizeOrderId() call
