/**
 * 🎯 ADMIN SEO HUB - GAMMES SEO INDEX
 *
 * Route proxy vers admin.gammes-seo._index.tsx
 * Charge le contenu original tout en maintenant le layout du hub
 *
 * Note: Cette route re-exporte les fonctionnalités existantes
 * pour maintenir la compatibilité pendant la transition
 */

import { type MetaFunction } from "@remix-run/node";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Gammes SEO Hub - Admin");

// Re-export everything from the original gammes-seo route
export { loader, action, default } from "./admin.gammes-seo._index";
