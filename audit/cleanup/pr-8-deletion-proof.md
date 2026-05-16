# PR-8 Controlled Cleanup — Deletion Proof

> **Source of truth**: `audit/cleanup/pr-8-controlled-cleanup-candidates.json` (this file is a human-readable projection).
> **Generator**: `scripts/audit/build-cleanup-candidates.ts` (deterministic, snapshot-only).
> **Re-generate**: `npm run audit:cleanup-candidates` — **DO NOT EDIT BY HAND.**

- Inventory format: `pr-8-cleanup-inventory`
- Schema version: `1.0.0`
- Cleanup policy version: `pr8-v1`
- Validation mode: `snapshot-only` (active runtime check deferred to PR-8b)
- Generated at: `2026-05-16T15:01:10.814Z`
- Toolchain: `v20.19.6` on `linux/x64`

## Input Fingerprint (sha256)

- `deadCodeCandidates`: `4affeffd871689a59f56e862328c297e63f9b34b84b87501ff69f74ad20dcfd7`
- `canonical`: `cad0d0e9044f6ccfdb852c4970d073cb7959296b8852b9f3a8a035dc083b77c9`
- `ownershipYaml`: `3c4c212a4e85baf28d04298b9ad5bfb38956e0c4134c566ecf454d2c390fd12f`
- `contractHealth`: `fcf7442c340fb1335545095a349246c12d5bacbf76223d8ece882cfd972be557`
- `validateScript`: `0f5224c9823ce6de8d3bf9686c9eb445b0adc343296c68cf5b0e91f4aaac7f21`
- `unreachableModules`: `75f4f5946d480ab8244e853aa25ffedb5d198bb4e7aee837cdb80e04e9e75e94`

## Counts

- Total: **333**
- By confidence: high=22 · medium=217 · low=94
- By decision: candidate=238 · blocked=95 · excluded=0

## candidate (238)

### candidate · high (22)

| Path | Domain | Kind | Confidence | Status | importedBy | Rationale |
|---|---|---|---|---|---:|---|
| `backend/src/database/services/invoices.service.ts` | database | service | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/database/services/payment.service.ts` | database | service | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/database/types/database.types.ts` | database | type | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/database/utils/supabase-type-helpers.ts` | database | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/events/keyword-plan.events.ts` | admin | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/catalog/interfaces/catalog-gamme.interface.ts` | catalog | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/config/interfaces/config.interfaces.ts` | config | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/invoices.module.ts` | invoices | module | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/products/types/product.types.ts` | products | type | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/shipping/shipping-new.module.ts` | shipping | module | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/notifications/notifications-center.controller.ts` | backend-core | controller | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/notifications/notifications-center.module.ts` | backend-core | module | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/search/global-search.controller.ts` | backend-core | controller | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/search/global-search.module.ts` | backend-core | module | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/types/order.types.ts` | backend-core | type | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/lib/auth.ts` | frontend-shared | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/ai.api.ts` | frontend-shared | frontend-service | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/api-url.server.ts` | frontend-shared | frontend-service | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/format-catalog-count.ts` | frontend-shared | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/seo/meta-generators.ts` | frontend-shared | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/storage.ts` | frontend-shared | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/supabase-storage.ts` | frontend-shared | other | high | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |

### candidate · medium (216)

| Path | Domain | Kind | Confidence | Status | importedBy | Rationale |
|---|---|---|---|---|---:|---|
| `backend/src/app.service.ts` | backend-core | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/auth/cart-merge.middleware.ts` | auth | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/auth/dto/index.ts` | auth | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/auth/exception.filter.ts` | auth | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/common/index.ts` | common | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/common/interceptors/method-not-allowed.interceptor.ts` | common | interceptor | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/common/interceptors/rate-limit-headers.interceptor.ts` | common | interceptor | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/config/execution-plan-resolver.service.ts` | config | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/config/index.ts` | config | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/config/page-contract-r5.schema.ts` | config | schema | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/config/page-contract-r7.schema.ts` | config | schema | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/config/r2-keyword-plan.constants.ts` | config | config | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/config/swagger.config.ts` | config | config | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/database/services/index.ts` | database | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/controllers/admin-buying-guide-preview.controller.ts` | admin | controller | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/decorators/admin-roles.decorator.ts` | admin | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/dto/admin-products.dto.ts` | admin | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/schemas/admin.schemas.ts` | admin | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/schemas/suppliers.schemas.ts` | admin | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/services/brief-template.service.ts` | admin | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/admin/services/section-compiler.service.ts` | admin | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/auth/dto/auth.dto.ts` | auth | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/config/validators/config.validator.ts` | config | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/config/validators/environment.validator.ts` | config | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/customers/dto/customer.dto.ts` | customers | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/diagnostic-engine/validate-phase0.ts` | diagnostic-engine | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/gamme-rest/services/purchase-guide-data.service.ts` | gamme-rest | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/knowledge-graph/index.ts` | knowledge-graph | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/layout/services/index.ts` | layout | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/marketing/templates/brand-rules-seed.ts` | marketing | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/mcp-validation/index.ts` | mcp-validation | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/messages/dto/index.ts` | messages | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/messages/index.ts` | messages | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/orders/dto/automotive-orders.dto.ts` | orders | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/orders/dto/index.ts` | orders | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/orders/dto/orders-enhanced.dto.ts` | orders | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/orders/dto/ticket.dto.ts` | orders | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/orders/schemas/orders.schemas.ts` | orders | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/payments/dto/payment-callback.dto.ts` | payments | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/payments/dto/payment-filters.dto.ts` | payments | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/payments/dto/payment-request.dto.ts` | payments | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/payments/dto/refund-payment.dto.ts` | payments | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/payments/index.ts` | payments | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/rag-proxy/index.ts` | rag-proxy | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/rag-proxy/types/rag-exploitation.types.ts` | rag-proxy | type | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo-logs/services/crawl-budget-experiment.service.ts` | seo-logs | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo-logs/services/url-audit.service.ts` | seo-logs | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo/config/sitemap.config.ts` | seo | config | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo/controllers/r2-page.controller.ts` | seo | controller | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo/index.ts` | seo | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo/interceptors/crawl-logger.interceptor.ts` | seo | interceptor | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo/services/seo-v4-switch-engine.service.ts` | seo | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/seo/validation/index.ts` | seo | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/support/index.ts` | support | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/system/simple.service.ts` | system | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/system/system.controller.ts` | system | controller | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/users/dto/index.ts` | users | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/users/dto/passwords.dto.ts` | users | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/users/dto/user-complete.dto.ts` | users | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/vehicles/decorators/performance-monitoring.decorator.ts` | vehicles | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/vehicles/dto/vehicles-simple-zod.dto.ts` | vehicles | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/vehicles/dto/vehicles-zod.dto.ts` | vehicles | dto | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/modules/vehicles/pipes/vehicle-validation.pipe.ts` | vehicles | pipe | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/security/rpc-gate/index.ts` | backend-core | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/shared/crypto/index.ts` | shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `backend/src/utils/fetch-with-retry.ts` | backend-core | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/account/UserShipmentTracking.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/AdminActionsDropdown.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/gamme-seo/EnrichedVehicleItem.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/OrdersManagement.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/OrdersOverview.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/patterns/contracts.ts` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/QuickNoteDialog.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/RecentActivity.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/seo/PreviewPanel.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/admin/UserList.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/blog/CategoryFilters.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/BrandImage.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/cart/AddToCartForm.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/cart/CartItem.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/catalog/FilterAccordion.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/catalog/PiecesCatalogGrid.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/catalog/ProductCatalog.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/catalog/PurchaseGuide.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/constructeurs/BrandHero.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/constructeurs/BrandPartsSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/constructeurs/BrandVehiclesSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/constructeurs/VehicleCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/AdvancedFilters.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/ConversionButton.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/MobileOptimizedCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/ProductCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/QuickCartDrawer.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/TechnicalReference.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/TrustPage.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ecommerce/VehicleCompatibilityBanner.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/expert/index.ts` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/faq/FAQAccordion.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/filters/FilterPresets.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/forms.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/forms/DatePickerPopover.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/forms/FormField.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/forms/FormInput.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/forms/FormProvider.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/CartButton.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/GlobalSearch.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/NotificationCenter.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/QuickSearchTrigger.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/ContentBlock.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/CTASimple.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/FeaturesGrid.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/Gallery.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/HeroExtended.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/HeroMinimal.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/templates/Testimonials.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/layout/UserMenu.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/manufacturers/ManufacturerCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/manufacturers/TypeGrid.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/navigation/DynamicMenu.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/orders/OrderActions.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/ActiveFiltersChips.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/CompatibilityConfirmationBlock.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/ContentGuidePills.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/DecisionGridSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/DesktopStickyCTA.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/GuideLinkCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/index.ts` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/MobileStickyBar.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/PiecesOemRefsDisplay.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/ProductCardSkeleton.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/PurchaseNarrativeSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/QuickGuideSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/R1CompatErrors.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/R1KpiCoverage.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/R1QuickNav.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/R1ReusableContent.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/R1TrustStrip.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/R2TransactionGuide.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/ReferenceEncartSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/SafeCompatTable.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/pieces/TableOfContents.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/products/ProductHoverCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/products/ProductQuickViewPopover.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/products/ProductTabs.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/profile/ActivityTimeline.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/profile/UserStats.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/rag/index.ts` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/search/ProductSearch.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/search/SearchBarEnhancedHomepage.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/search/SearchFilters.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/search/SearchResultsEnhanced.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/seo/HowToChooseSection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/seo/LazySection.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/seo/SmartLink.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/seo/UXMessageBox.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/shipping/UserShipments.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/trust/PricingDisplay.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/trust/TrustBadge.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ui/carousel.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ui/command.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ui/index.ts` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/ui/navigation-menu.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/users/UserActionsPopover.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/users/UserHoverCard.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicle/CategoryGrid.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicle/index.ts` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicle/VehicleCombobox.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicle/VehicleDetailSkeleton.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicle/VehicleFilterBadge.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicles/TypeSelectorSimple.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/components/vehicles/YearSelectorSimple.tsx` | frontend-shared | component | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/use-orders-filters.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useAdvancedAnalytics.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useApi.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useCommandPalette.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useConfig.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useContentLinkTracking.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useConversionTracking.tsx` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useHomeData.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useIsomorphicEffect.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useMobileNavigation.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useNewsletterState.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useProductCompatibility.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useRemixForm.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useScrollAnimation.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useSearchState.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/hooks/useUser.ts` | frontend-shared | hook | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/lib/schemas/validation.ts` | frontend-shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/admin-api.server.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/admin-orders.server.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/admin.server.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/catalog-families.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/claim.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/config.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/constructeur.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/enhanced-product.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/faq.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/glossary.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/legal.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/quote.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/seo-switches.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/v5-ultimate.api.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/api/vehicle-api-unified.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/orders/orders.service.ts` | frontend-shared | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/permissions.server.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/services/seo/seo-variations.service.ts` | frontend-shared | service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/api.ts` | frontend-shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/blog-metadata.tsx` | frontend-shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/fetch-with-retry.ts` | frontend-shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/filter-presets.demo.ts` | frontend-shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/gamme-contract-qa.utils.ts` | frontend-shared | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/safe-loader.server.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `frontend/app/utils/seo/blog-sitemap.server.ts` | frontend-shared | frontend-service | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `packages/design-tokens/src/generated.ts` | pkg-design-tokens | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |
| `packages/design-tokens/src/types.ts` | pkg-design-tokens | other | medium | UNKNOWN | 0 | Snapshot evidence: c0-c3 OK + importedBy=0 + deletePolicy!=LOCKED + not protected + no retain verdict. Active runtime check deferred to PR-8b. |

### candidate · low (0)

_(empty)_

## blocked (95)

### blocked · high (0)

_(empty)_

### blocked · medium (1)

| Path | Domain | Kind | Confidence | Status | importedBy | Rationale |
|---|---|---|---|---|---:|---|
| `backend/src/modules/upload/dto/index.ts` | upload | other | medium | n/a | n/a | missing from canonical.json (registry doesn't know this file — cannot prove dead) |

### blocked · low (94)

| Path | Domain | Kind | Confidence | Status | importedBy | Rationale |
|---|---|---|---|---|---:|---|
| `backend/src/auth/dto/logout-response.dto.ts` | auth | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/common/decorators/index.ts` | common | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/common/decorators/roles.decorator.ts` | common | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/common/pipes/index.ts` | common | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/config/r2-content-contract.defaults.ts` | config | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/config/r2-content-contract.schema.ts` | config | schema | low | UNKNOWN | 6 | snapshot c1 failed (static import); canonical.importedBy=6 |
| `backend/src/config/r2-fingerprint.utils.ts` | config | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/config/r2-heading-policy.utils.ts` | config | other | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/config/r2-meta-builder.utils.ts` | config | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/config/r2-scoring.utils.ts` | config | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/config/seo-switch-aliases.config.ts` | config | config | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/agentic-engine/agentic-engine.controller.ts` | agentic-engine | controller | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/agentic-engine/services/arbiter.service.ts` | agentic-engine | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/agentic-engine/services/planner.service.ts` | agentic-engine | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/agentic-engine/services/solver.service.ts` | agentic-engine | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/agentic-engine/services/verifier.service.ts` | agentic-engine | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/blog-metadata/blog-metadata.controller.ts` | blog-metadata | controller | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/blog-metadata/blog-metadata.service.ts` | blog-metadata | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/knowledge-graph/kg-data.service.ts` | knowledge-graph | service | low | UNKNOWN | 4 | snapshot c1 failed (static import); canonical.importedBy=4 |
| `backend/src/modules/knowledge-graph/kg.controller.ts` | knowledge-graph | controller | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/knowledge-graph/kg.service.ts` | knowledge-graph | service | low | UNKNOWN | 3 | snapshot c1 failed (static import); canonical.importedBy=3 |
| `backend/src/modules/knowledge-graph/kg.types.ts` | knowledge-graph | type | low | UNKNOWN | 4 | snapshot c1 failed (static import); canonical.importedBy=4 |
| `backend/src/modules/mcp-validation/config/mcp-route-map.config.ts` | mcp-validation | config | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/mcp-validation/decorators/mcp-verify.decorator.ts` | mcp-validation | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/mcp-validation/interceptors/mcp-shadow.interceptor.ts` | mcp-validation | interceptor | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/mcp-validation/interceptors/mcp-verify.interceptor.ts` | mcp-validation | interceptor | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/mcp-validation/mcp-validation.service.ts` | mcp-validation | service | low | UNKNOWN | 4 | snapshot c1 failed (static import); canonical.importedBy=4 |
| `backend/src/modules/mcp-validation/mcp-validation.types.ts` | mcp-validation | type | low | UNKNOWN | 6 | snapshot c1 failed (static import); canonical.importedBy=6 |
| `backend/src/modules/mcp-validation/services/chrome-devtools-client.service.ts` | mcp-validation | service | low | UNKNOWN | 4 | snapshot c1 failed (static import); canonical.importedBy=4 |
| `backend/src/modules/mcp-validation/services/external-compatibility-cache.service.ts` | mcp-validation | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/mcp-validation/services/external-compatibility-consensus.service.ts` | mcp-validation | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/mcp-validation/services/external-compatibility-partslink24.service.ts` | mcp-validation | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/mcp-validation/services/external-compatibility-scraping.service.ts` | mcp-validation | service | low | UNKNOWN | 3 | snapshot c1 failed (static import); canonical.importedBy=3 |
| `backend/src/modules/mcp-validation/services/external-compatibility.service.ts` | mcp-validation | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/mcp-validation/services/external-compatibility.types.ts` | mcp-validation | type | low | UNKNOWN | 6 | snapshot c1 failed (static import); canonical.importedBy=6 |
| `backend/src/modules/mcp-validation/services/mcp-alerting.service.ts` | mcp-validation | service | low | UNKNOWN | 3 | snapshot c1 failed (static import); canonical.importedBy=3 |
| `backend/src/modules/mcp-validation/services/mcp-query.service.ts` | mcp-validation | service | low | UNKNOWN | 3 | snapshot c1 failed (static import); canonical.importedBy=3 |
| `backend/src/modules/mcp-validation/types/mcp-verify.types.ts` | mcp-validation | type | low | UNKNOWN | 5 | snapshot c1 failed (static import); canonical.importedBy=5 |
| `backend/src/modules/messages/dto/message.schemas.ts` | messages | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/payments/dto/payment-response.dto.ts` | payments | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/seo/dto/r2-page-response.dto.ts` | seo | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/seo/services/r2-page-plan.service.ts` | seo | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/seo/validation/r2-validator.service.ts` | seo | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/substitution/controllers/substitution.controller.ts` | substitution | controller | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/substitution/services/intent-extractor.service.ts` | substitution | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/substitution/services/substitution-logger.service.ts` | substitution | service | low | UNKNOWN | 3 | snapshot c1 failed (static import); canonical.importedBy=3 |
| `backend/src/modules/substitution/services/substitution.service.ts` | substitution | service | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `backend/src/modules/substitution/types/substitution.types.ts` | substitution | type | low | UNKNOWN | 4 | snapshot c1 failed (static import); canonical.importedBy=4 |
| `backend/src/modules/support/types/index.ts` | support | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/system/services/health-check.service.ts` | system | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/upload/services/file-validation.service.ts` | upload | service | low | n/a | n/a | snapshot c1 failed (static import); missing from canonical.json (registry doesn't know this file — cannot prove dead) |
| `backend/src/modules/upload/services/image-processing.service.ts` | upload | service | low | n/a | n/a | snapshot c1 failed (static import); missing from canonical.json (registry doesn't know this file — cannot prove dead) |
| `backend/src/modules/upload/services/upload-analytics.service.ts` | upload | service | low | n/a | n/a | snapshot c1 failed (static import); missing from canonical.json (registry doesn't know this file — cannot prove dead) |
| `backend/src/modules/upload/services/upload-optimization.service.ts` | upload | service | low | n/a | n/a | snapshot c1 failed (static import); missing from canonical.json (registry doesn't know this file — cannot prove dead) |
| `backend/src/modules/upload/services/upload.service.ts` | upload | service | low | n/a | n/a | snapshot c1 failed (static import); missing from canonical.json (registry doesn't know this file — cannot prove dead) |
| `backend/src/modules/upload/upload.controller.ts` | upload | controller | low | n/a | n/a | snapshot c1 failed (static import); missing from canonical.json (registry doesn't know this file — cannot prove dead) |
| `backend/src/modules/users/dto/create-user.dto.ts` | users | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/users/dto/login.dto.ts` | users | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/users/dto/user-address.dto.ts` | users | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/users/dto/user-profile.dto.ts` | users | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/users/dto/user-sessions.dto.ts` | users | dto | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `backend/src/modules/vehicles/services/vehicles-performance.service.ts` | vehicles | service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/cart/AddToCartButton.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/cart/CartIcon.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/expert/CompatibilityBadgeV2.tsx` | frontend-shared | component | low | UNKNOWN | 2 | snapshot c1 failed (static import); canonical.importedBy=2 |
| `frontend/app/components/expert/CompatibilityResolverModal.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/expert/CompatibilitySheetV2.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/expert/design-system.ts` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/expert/ProductStickyCTAV2.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/expert/TrustRowV2.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/ai-predictions/AIPredictionsPanel.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/ConseilsSection.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/ErrorState.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/FadeIn.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/GuideSection.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/InformationsSection.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/LoadingState.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/PerformanceIndicator.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/PiecesGrid.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/types.ts` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/pieces/VehicleHeader.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/DynamicMenu.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/ErrorBoundary.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/MultiCarousel.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/OptimizedSearchBar.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/pagination.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/PerformanceMetrics.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/components/ui/popover.tsx` | frontend-shared | component | low | UNKNOWN | 4 | snapshot c1 failed (static import); canonical.importedBy=4 |
| `frontend/app/components/ui/SEOHelmet.tsx` | frontend-shared | component | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/hooks/useProductSearch.ts` | frontend-shared | hook | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/services/common/errors.ts` | frontend-shared | frontend-service | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/types/layout.ts` | frontend-shared | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/types/navigation.ts` | frontend-shared | other | low | UNKNOWN | 1 | snapshot c1 failed (static import); canonical.importedBy=1 |
| `frontend/app/utils/performance.utils.ts` | frontend-shared | other | low | UNKNOWN | 3 | snapshot c1 failed (static import); canonical.importedBy=3 |

## excluded (0)

### excluded · high (0)

_(empty)_

### excluded · medium (0)

_(empty)_

### excluded · low (0)

_(empty)_
