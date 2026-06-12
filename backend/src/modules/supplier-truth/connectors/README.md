# Supplier connectors

Layer 1 I/O adapters. One per **platform** (inoshop covers DistriCash + any other
inoshop distributor), not per supplier. Implements the **`SupplierConnector`**
contract (`supplier-connector.interface.ts`). Connectors only authenticate,
fetch, and parse — **zero business logic**.

## Implemented

| Platform | Reference impl | Supplier id (`___xtr_supplier.spl_id`) |
|---|---|---|
| `inoshop` | `inoshop.connector.ts` | **71** (DistriCash / "DCA" — operational; 26 is a phantom row, 0 brand-links / 0 orders) |

*(CAL connector — platform `cal`, spl_id 19 — arrives in PR1b, separate.)*

## Credentials — never in chat, never in repo

Credentials live in **env vars**, loaded from `backend/.env.local`
(gitignored) on dev, and from the deploy secret manager on PROD. Placeholders
are in `backend/.env.example`. The connector accepts a `SupplierCredentials`
object passed by the caller — never reads `process.env` itself (so it stays
testable and the caller controls the surface).

Pattern per supplier:

```env
# backend/.env.local (gitignored) — placeholders live in backend/.env.example
SUPPLIER_INOSHOP_DISTRICASH_USER=<your login — never commit, never paste in chat>
SUPPLIER_INOSHOP_DISTRICASH_PASSWORD=<your password — never commit, never paste in chat>
```

The caller resolves these vars and instantiates the connector:

```ts
const dca = new InoshopConnector({ supplierId: '71', baseUrl: 'https://districashv2.inoshop.net' });
await dca.login({
  user: process.env.SUPPLIER_INOSHOP_DISTRICASH_USER!,
  password: process.env.SUPPLIER_INOSHOP_DISTRICASH_PASSWORD!,
});
const observations = await dca.fetchAvailability(['715899', '479075']);
await dca.close();
```

## Adding a new supplier connector (template)

1. **Inspect the portal manually** with browser devtools (login flow, search,
   product page). Note: form field selectors, post-login URL, dispo/price labels.
2. **Add env-var placeholders** to `backend/.env.example` (USER/PASSWORD/BASE_URL).
3. **Pure parser** (`<supplier>-parse.ts`): price/dispo/delay parsing as pure
   functions, fully unit-testable, returning `SupplierObservation`.
4. **Connector class** (`<supplier>.connector.ts`): Playwright-based for any
   stateful/JS portal; raw `undici` only for trivial JSON APIs.
5. **Tests** (`<supplier>.connector.test.ts`): pure parser cases + constructor
   guards + `fetchAvailability before login throws`. No live I/O in unit tests.
6. **`LIVE_VERIFY` markers** for every selector that wasn't captured against a
   live session. First real run confirms; until then `parseError: true` on miss
   (never a false in-stock).
7. Rate-limit + jitter per `minRequestIntervalMs`, anti-ban; only request
   working-set refs, never a full-catalog crawl.

## Anti-bricolage rules

- No business decisions in connectors (no margin math, no policy). That's L2+.
- One `Browser` per connector instance, one warm `BrowserContext`; close on
  shutdown via `close()`.
- Safe degradation: any extraction failure → `parseError: true` observation,
  never a synthetic in-stock or zero-price.
- ToS: automated access is for the customer's own account; pause if the portal
  introduces CAPTCHA/2FA and switch to manual file fallback (the L0.5 import
  profile path in the pricing module).
