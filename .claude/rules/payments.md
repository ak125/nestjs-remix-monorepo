# Payment Integration (Critical)

## Two Gateways

1. **Paybox (Production)** - Verifone
   - HMAC-SHA512 signature
   - Config: `PAYBOX_SITE`, `PAYBOX_RANG`, `PAYBOX_IDENTIFIANT`, `PAYBOX_HMAC_KEY`
   - Response format: `Mt:10050;Ref:ORD123;Auto:XXXXX;Erreur:00000;Signature:...`

2. **SystemPay (Test)** - BNP Paribas Cyberplus
   - HMAC-SHA256 or SHA1 signature
   - Config: `SYSTEMPAY_SITE_ID`, `SYSTEMPAY_CERTIFICATE_PROD/TEST`
   - Vads_* parameters (alphabetically sorted for signature)

## Payment Flow

1. Order created -> Payment initiated
2. User redirected to gateway
3. Gateway callback to `/api/payments/paybox/callback`
4. Signature verified -> Order status updated
5. User redirected to success/error page

## Security

- HMAC signature verification on all callbacks
- CSP headers allow payment domains
- Error code validation before confirmation
- Use `timingSafeEqual` for signature comparison (NOT `===`)
- Always call `normalizeOrderId()` before DB lookup

## Key Files

- `backend/src/modules/payments/services/paybox-callback-gate.service.ts`
- `backend/src/modules/payments/services/cyberplus.service.ts`
- `backend/src/modules/payments/services/paybox.service.ts`
- `backend/src/modules/payments/controllers/paybox-callback.controller.ts`

## Anti-Patterns (BLOCK)

- Using `===` for signature comparison (timing attack vulnerability)
- Skipping signature verification
- Hardcoded HMAC keys in source code
- Test callback endpoints in production
- Missing error code validation before marking order as paid
