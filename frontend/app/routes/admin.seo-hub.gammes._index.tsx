/**
 * 🎯 ADMIN SEO HUB - GAMMES SEO INDEX
 *
 * Route proxy vers admin.gammes-seo._index.tsx
 * Charge le contenu original tout en maintenant le layout du hub
 *
 * Note: Cette route re-exporte les fonctionnalités existantes
 * pour maintenir la compatibilité pendant la transition
 */

// Re-export everything from the original gammes-seo route
export { loader, action, default } from "./admin.gammes-seo._index";
