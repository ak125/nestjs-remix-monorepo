/**
 * 🎯 ADMIN SEO HUB - GAMME SEO DETAIL
 *
 * Route proxy vers admin.gammes-seo.$pgId.tsx
 * Charge le contenu original tout en maintenant le layout du hub
 *
 * Note: Cette route re-exporte les fonctionnalités existantes
 * pour maintenir la compatibilité pendant la transition
 */

import { type MetaFunction } from "@remix-run/node";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Gamme SEO Hub - Admin");

// Re-export everything from the original gammes-seo detail route
export { loader, action, default } from "./admin.gammes-seo.$pgId";
