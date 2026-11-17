/**
 * Pieces Schema.org commerce constants — PR commerce-loop V1 step 5A.
 *
 * Centralised Schema.org sub-objects required by Google Merchant Listings 2024 :
 *  - OfferShippingDetails  → ship-to FR, rate from the shipping policy served by
 *                            the backend (mandat BJ), transit ETA from delivery-eta.ts
 *  - MerchantReturnPolicy  → return policy served by the backend (mandat BJ)
 *  - priceValidUntil       → 30 days rolling window (Google rejects far-future)
 *
 * Source canon : frontend/app/utils/delivery-eta.ts (standard = 3 business days
 * transit, low-stock = +1 day handling). Aligned with site.constants.ts SITE_ORIGIN.
 * Anti-bricolage : reuse the ETA module, don't invent transit values.
 */

import {
  type ReturnPolicyResult,
  type ShippingPolicyResult,
} from "../remix-application-port";

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
 * Livraison déclarée sur une offre (OfferShippingDetails), France métropolitaine.
 *
 * Le montant n'est pas tenu ici : il vient de la règle de port reçue du backend
 * (`ShippingPolicyResult`, source unique
 * `backend/src/modules/cart/config/shipping-policy.config.ts`, mandat BJ) —
 * forfait sous le seuil de gratuité, 0 à partir du seuil (borne incluse).
 *
 * `orderValueTTC` est le montant de la commande décrite : pour une offre, son
 * prix. Pour un agrégat, l'appelant passe le prix le plus bas : le port déclaré
 * est alors celui de l'offre la moins chère commandée seule, donc jamais une
 * gratuité que le panier n'accorderait pas.
 *
 * Destination : `addressCountry: "FR"`. Google ne prend pas en charge de région
 * ni de code postal pour la France, la Corse (grille au poids) ne peut donc pas
 * être exclue du balisage.
 *
 * Délais : transit 2 à 4 jours (standard de delivery-eta.ts), préparation 0 à
 * 1 jour (en stock et stock faible confondus).
 */
export function buildMetropolitanShippingDetails(
  policy: ShippingPolicyResult,
  orderValueTTC: number,
) {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value:
        orderValueTTC >= policy.freeShippingThresholdTTC
          ? 0
          : policy.flatFeeTTC,
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
}

/**
 * `MerchantReturnPolicy` d'une offre, traduite de la politique de retour servie
 * par le backend (mandat BJ). Seul ce que schema.org sait dire est déclaré :
 *  - délai (`merchantReturnDays`, compté par Google à partir de la livraison) ;
 *  - retour par envoi postal ;
 *  - frais de retour à la charge du client (`ReturnFeesCustomerResponsibility`) ;
 *  - retour gratuit d'une pièce défectueuse (`itemDefectReturnFees` : propriété
 *    schema.org, que Google ne lit qu'au niveau Organization).
 * Rien n'est déclaré pour l'erreur du vendeur ni pour le remboursement par le
 * moyen de paiement d'origine : schema.org n'a pas de propriété pour l'un ni
 * pour l'autre. `refundType` n'est pas déclaré (FullRefund dirait « montant
 * intégral », ce que la décision ne précise pas).
 */
export function buildMerchantReturnPolicy(policy: ReturnPolicyResult) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: policy.country,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: policy.returnWindowDays,
    returnMethod: RETURN_METHOD_SCHEMA[policy.returnMethod],
    returnFees: RETURN_FEES_SCHEMA[policy.returnFeesPaidBy],
    ...(policy.returnFeesWaivedFor.includes("item_defect") && {
      itemDefectReturnFees: "https://schema.org/FreeReturn",
    }),
  } as const;
}

const RETURN_METHOD_SCHEMA = {
  by_mail: "https://schema.org/ReturnByMail",
} as const satisfies Record<ReturnPolicyResult["returnMethod"], string>;

const RETURN_FEES_SCHEMA = {
  customer: "https://schema.org/ReturnFeesCustomerResponsibility",
} as const satisfies Record<ReturnPolicyResult["returnFeesPaidBy"], string>;

/**
 * Seller block used across AggregateOffer + per-piece Offer.
 * Lifted out of the inline schema for reuse.
 */
export const DEFAULT_SELLER = {
  "@type": "Organization",
  name: "Automecanik",
  url: SITE_URL,
} as const;
