/**
 * Pieces Schema.org commerce constants — PR commerce-loop V1 step 5A.
 *
 * Centralised Schema.org sub-objects required by Google Merchant Listings 2024 :
 *  - OfferShippingDetails  → ship-to FR, transit ETA from delivery-eta.ts
 *  - MerchantReturnPolicy  → 14-day Code de la consommation FR minimum
 *  - priceValidUntil       → 30 days rolling window (Google rejects far-future)
 *
 * Source canon : frontend/app/utils/delivery-eta.ts (standard = 3 business days
 * transit, low-stock = +1 day handling). Aligned with site.constants.ts SITE_ORIGIN.
 * Anti-bricolage : reuse the ETA module, don't invent transit values.
 */

const SITE_URL = "https://www.automecanik.com";

/**
 * Default rolling price validity window (days).
 * Google Search rejects priceValidUntil more than 1 year in the future and shows
 * warnings beyond ~3 months. 30 days = safe revalidation cadence aligned with
 * monthly catalogue sync.
 */
export const DEFAULT_PRICE_VALID_UNTIL_DAYS = 30;

/**
 * Compute priceValidUntil ISO date (YYYY-MM-DD) — deterministic per-day, not
 * per-request, so SSR snapshots cache cleanly (cache key includes the date).
 */
export function computePriceValidUntil(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + DEFAULT_PRICE_VALID_UNTIL_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Default ship-to-FR shipping details.
 * Transit time = 3 business days (standard, matches delivery-eta.ts:43).
 * Handling time = 0-1 day (matches in-stock + low-stock combined range).
 * Shipping rate = 0 (free shipping is the canonical FR commerce expectation ;
 * specific paid options live in checkout, not in catalog Schema).
 */
export const DEFAULT_SHIPPING_DETAILS_FR = {
  "@type": "OfferShippingDetails",
  shippingRate: {
    "@type": "MonetaryAmount",
    value: 0,
    currency: "EUR",
  },
  shippingDestination: {
    "@type": "DefinedRegion",
    addressCountry: "FR",
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 1,
      unitCode: "DAY",
    },
    transitTime: {
      "@type": "QuantitativeValue",
      minValue: 2,
      maxValue: 4,
      unitCode: "DAY",
    },
  },
} as const;

/**
 * Default 14-day MerchantReturnPolicy (FR Code de la consommation L221-18 minimum).
 * No restocking fee, return shipping by buyer (canonical sparepart commerce).
 */
export const DEFAULT_RETURN_POLICY_FR = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "FR",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnShippingFees",
  refundType: "https://schema.org/FullRefund",
} as const;

/**
 * Seller block used across AggregateOffer + per-piece Offer.
 * Lifted out of the inline schema for reuse.
 */
export const DEFAULT_SELLER = {
  "@type": "Organization",
  name: "Automecanik",
  url: SITE_URL,
} as const;
