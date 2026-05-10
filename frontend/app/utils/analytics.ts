/**
 * 📊 Analytics - Utilitaires pour le tracking des événements
 * Compatible Google Analytics (gtag.js) et console logs en dev
 *
 * Tous les nouveaux events passent par `safeGtag()` qui applique
 * `sanitizeParams` (S10 RGPD : immat FR, emails, tels) avant gtag.
 * Cf. `analytics-sanitize.ts` + plan SEO 2026 §S10.
 */

import { logger } from "~/utils/logger";
import { sanitizeParams } from "~/utils/analytics-sanitize";

// GA4 Window augmentation: see frontend/env.d.ts (single source of truth)

/**
 * Wrapper interne : sanitize PII puis appelle `window.gtag('event', …)`.
 * Tous les nouveaux trackers de ce fichier doivent passer par cette fonction.
 *
 * No-op silencieux si `window.gtag` indisponible (SSR, bot detection,
 * consent denied — gestion côté `root.tsx`).
 */
function safeGtag(eventName: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, sanitizeParams(params));
}

/**
 * 👀 Tracker la vue d'un article
 */
export function trackArticleView(articleId: string, title: string) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "article_view", {
      article_id: articleId,
      article_title: title,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
  logger.log("📊 Analytics: Article view", { articleId, title });
}

/**
 * 🔗 Tracker un clic sur CTA
 */
export function trackCTAClick(
  ctaLink: string,
  ctaAnchor: string,
  articleId?: string,
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "cta_click", {
      link_url: ctaLink,
      link_text: ctaAnchor,
      article_id: articleId,
      page_location: window.location.href,
    });
  }
  logger.log("📊 Analytics: CTA click", { ctaLink, ctaAnchor, articleId });
}

/**
 * 📤 Tracker un partage d'article
 */
export function trackShareArticle(
  method: "native" | "copy" | "twitter" | "facebook" | "linkedin",
  articleId: string,
  articleTitle?: string,
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "share", {
      method,
      content_type: "article",
      item_id: articleId,
      item_title: articleTitle,
    });
  }
  logger.log("📊 Analytics: Article shared", {
    method,
    articleId,
    articleTitle,
  });
}

/**
 * ⏱️ Tracker le temps de lecture
 */
export function trackReadingTime(
  articleId: string,
  durationSeconds: number,
  articleTitle?: string,
) {
  if (typeof window !== "undefined" && window.gtag) {
    const engagementLevel =
      durationSeconds > 120 ? "high" : durationSeconds > 60 ? "medium" : "low";

    window.gtag("event", "reading_time", {
      article_id: articleId,
      article_title: articleTitle,
      duration: durationSeconds,
      engagement_level: engagementLevel,
    });
  }
  logger.log("📊 Analytics: Reading time", {
    articleId,
    durationSeconds,
    articleTitle,
  });
}

/**
 * 🔖 Tracker l'ajout aux favoris
 */
export function trackBookmark(
  articleId: string,
  action: "add" | "remove",
  articleTitle?: string,
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(
      "event",
      action === "add" ? "add_to_wishlist" : "remove_from_wishlist",
      {
        item_id: articleId,
        item_name: articleTitle,
        item_category: "blog_article",
      },
    );
  }
  logger.log("📊 Analytics: Bookmark", { action, articleId, articleTitle });
}

/**
 * 🔍 Tracker une recherche
 *
 * Note RGPD : `query` est user-input → passe par `safeGtag` (sanitize
 * immat FR, emails, tels) avant envoi à GA4.
 */
export function trackSearch(query: string, resultsCount: number) {
  safeGtag("search", {
    search_term: query,
    results_count: resultsCount,
  });
  logger.log("📊 Analytics: Search", { query, resultsCount });
}

/**
 * 📥 Tracker le scroll depth (profondeur de lecture)
 */
export function trackScrollDepth(articleId: string, percentage: number) {
  if (typeof window !== "undefined" && window.gtag) {
    // Track milestones: 25%, 50%, 75%, 100%
    const milestone = Math.floor(percentage / 25) * 25;

    window.gtag("event", "scroll_depth", {
      article_id: articleId,
      scroll_percentage: milestone,
      page_location: window.location.href,
    });
  }
  logger.log("📊 Analytics: Scroll depth", { articleId, percentage });
}

// ============================================================================
// FUNNEL SÉLECTEUR VÉHICULE R1
// ============================================================================

/**
 * 🚗 Sélecteur véhicule : sélection complète (marque→modèle→type terminé)
 */
export function trackSelectorComplete(gamme: string, vehicle: string) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "selector_complete", {
      gamme,
      vehicle,
      page_location: window.location.href,
    });
  }
  logger.log("📊 Analytics: selector_complete", { gamme, vehicle });
}

/**
 * 🎯 Sélecteur véhicule : clic CTA "Voir mes pièces compatibles"
 */
export function trackSelectorCTA(gamme: string, vehicle: string) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "selector_cta_click", {
      gamme,
      vehicle,
      page_location: window.location.href,
    });
  }
  logger.log("📊 Analytics: selector_cta_click", { gamme, vehicle });
}

/**
 * 🔄 Sélecteur véhicule : reprise via cookie (véhicule déjà enregistré)
 */
export function trackSelectorResume(gamme: string, vehicle: string) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "selector_resume", {
      gamme,
      vehicle,
      page_location: window.location.href,
    });
  }
  logger.log("📊 Analytics: selector_resume", { gamme, vehicle });
}

// ============================================================================
// E-COMMERCE GA4 - Tracking Produits
// ============================================================================

interface ProductItem {
  id?: string;
  productId?: string;
  name?: string;
  title?: string;
  price?: number;
  category?: string;
  brand?: string;
}

/**
 * Helper pour formater un produit au format GA4
 */
function formatGA4Product(item: ProductItem, index: number = 0) {
  return {
    item_id: item.id || item.productId || `item_${index}`,
    item_name: item.name || item.title || "Produit",
    price: item.price || 0,
    item_category: item.category || "Pièces Auto",
    item_brand: item.brand || "AutoMecanik",
    index,
  };
}

/**
 * 📋 E-commerce: Vue d'une liste de produits (gamme/catégorie)
 */
export function trackViewItemList(
  listId: string,
  listName: string,
  items: ProductItem[],
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "view_item_list", {
      item_list_id: listId,
      item_list_name: listName,
      items: items.slice(0, 10).map((item, index) => ({
        ...formatGA4Product(item),
        index,
      })),
    });
  }
  logger.log("📊 Analytics: view_item_list", { listId, count: items.length });
}

/**
 * 👁️ E-commerce: Vue d'un produit
 */
export function trackViewItem(product: ProductItem) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "view_item", {
      currency: "EUR",
      value: product.price || 0,
      items: [formatGA4Product(product)],
    });
  }
  logger.log("📊 Analytics: view_item", {
    productId: product.id || product.productId,
    name: product.name || product.title,
  });
}

/**
 * 🛒 E-commerce: Ajout au panier
 */
export function trackAddToCart(product: ProductItem, quantity: number = 1) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "add_to_cart", {
      currency: "EUR",
      value: (product.price || 0) * quantity,
      items: [
        {
          ...formatGA4Product(product),
          quantity,
        },
      ],
    });
  }
  logger.log("📊 Analytics: add_to_cart", {
    productId: product.id || product.productId,
    quantity,
  });
}

/**
 * 🗑️ E-commerce: Retrait du panier
 */
export function trackRemoveFromCart(
  product: ProductItem,
  quantity: number = 1,
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "remove_from_cart", {
      currency: "EUR",
      value: (product.price || 0) * quantity,
      items: [
        {
          ...formatGA4Product(product),
          quantity,
        },
      ],
    });
  }
  logger.log("📊 Analytics: remove_from_cart", {
    productId: product.id || product.productId,
    quantity,
  });
}

// ============================================================================
// E-COMMERCE GA4 - Tracking Funnel Paiement
// ============================================================================

interface CartItem {
  id?: string;
  productId?: string;
  name?: string;
  title?: string;
  price?: number;
  quantity?: number;
}

/**
 * Helper pour formater les items au format GA4
 */
function formatGA4Item(item: CartItem, index: number) {
  return {
    item_id: item.id || item.productId || `item_${index}`,
    item_name: item.name || item.title || "Produit",
    price: item.price || 0,
    quantity: item.quantity || 1,
  };
}

/**
 * 🛒 E-commerce: Vue du panier
 */
export function trackViewCart(items: CartItem[], value: number) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "view_cart", {
      currency: "EUR",
      value,
      items: items.map(formatGA4Item),
    });
  }
  logger.log("📊 Analytics: view_cart", { itemCount: items.length, value });
}

/**
 * 📋 E-commerce: Debut checkout
 */
export function trackBeginCheckout(items: CartItem[], value: number) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "begin_checkout", {
      currency: "EUR",
      value,
      items: items.map(formatGA4Item),
    });
  }
  logger.log("📊 Analytics: begin_checkout", {
    itemCount: items.length,
    value,
  });
}

/**
 * 💳 E-commerce: Info paiement ajoutee
 */
export function trackAddPaymentInfo(
  value: number,
  paymentType: string = "card",
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "add_payment_info", {
      currency: "EUR",
      value,
      payment_type: paymentType,
    });
  }
  logger.log("📊 Analytics: add_payment_info", { value, paymentType });
}

/**
 * ✅ E-commerce: Achat finalise
 */
export function trackPurchase(
  transactionId: string,
  value: number,
  items: CartItem[] = [],
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: transactionId,
      currency: "EUR",
      value,
      items: items.map(formatGA4Item),
    });
  }
  logger.log("📊 Analytics: purchase", { transactionId, value });
}

// ============================================================================
// V0.B — Diagnostic, lead generation, local intent (plan SEO 2026 § V0)
// ============================================================================

/**
 * 🩺 Diagnostic : recherche d'un symptôme dans /diagnostic-auto
 *
 * Note RGPD : `query` est user-input (texte libre) → sanitize PII via `safeGtag`.
 */
export function trackSymptomSearch(
  query: string,
  intent?: "noise" | "warning_light" | "smell" | "vibration" | "leak" | "other",
  resultsCount?: number,
) {
  safeGtag("symptom_search", {
    search_term: query,
    intent,
    results_count: resultsCount,
  });
  logger.log("📊 Analytics: symptom_search", { query, intent, resultsCount });
}

/**
 * 🎯 Diagnostic : parcours `/diagnostic-auto` complété (système identifié)
 */
export function trackDiagnosticCompleted(params: {
  systemId: string;
  symptomId?: string;
  durationSeconds?: number;
  resultsCount?: number;
  ctaTaken?: "view_pieces" | "call" | "quote" | "exit";
}) {
  safeGtag("diagnostic_completed", {
    system_id: params.systemId,
    symptom_id: params.symptomId,
    duration_seconds: params.durationSeconds,
    results_count: params.resultsCount,
    cta_taken: params.ctaTaken,
  });
  logger.log("📊 Analytics: diagnostic_completed", params);
}

/**
 * 📞 CTA téléphone (clic sur lien `tel:`)
 *
 * Le numéro de téléphone du commerce (CTA) n'est pas user-input mais reste
 * sanitize-safe par défense. La page d'origine, elle, peut contenir une URL
 * avec query-string user-input → sanitize.
 */
export function trackCallClick(params: {
  phone: string;
  source: "header" | "footer" | "diagnostic" | "product" | "guide";
  pageContext?: string;
}) {
  safeGtag("call_click", {
    phone: params.phone,
    source: params.source,
    page_context: params.pageContext,
  });
  logger.log("📊 Analytics: call_click", params);
}

/**
 * 📍 Intent local (clic GBP / direction / store locator)
 *
 * Cible Phase 1-2 ADR-036 (`local-business-agent` — zone 93).
 */
export function trackLocalStoreIntent(params: {
  storeId: string;
  action: "directions" | "call" | "view_hours" | "gbp_link";
  source: "header" | "footer" | "local_landing" | "gbp";
}) {
  safeGtag("local_store_intent", {
    store_id: params.storeId,
    action: params.action,
    source: params.source,
  });
  logger.log("📊 Analytics: local_store_intent", params);
}

/**
 * 📝 Demande de devis / lead form submit
 *
 * Note RGPD : ne JAMAIS passer name/email/phone — passer un `formId` opaque
 * + métadonnées non-PII. Le helper `safeGtag` sanitize en defense-in-depth
 * si un champ leak.
 */
export function trackQuoteRequest(params: {
  formId: string;
  productCategory?: string;
  vehicleId?: string;
  estimatedValue?: number;
}) {
  safeGtag("quote_request", {
    form_id: params.formId,
    product_category: params.productCategory,
    vehicle_id: params.vehicleId,
    currency: "EUR",
    value: params.estimatedValue,
  });
  logger.log("📊 Analytics: quote_request", params);
}
