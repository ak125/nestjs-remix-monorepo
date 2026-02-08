/**
 * 🎯 ADMIN SEO HUB - GAMMES LAYOUT
 *
 * Layout parent pour les routes gammes du SEO Hub:
 * - /admin/seo-hub/gammes (index) → admin.seo-hub.gammes._index.tsx
 * - /admin/seo-hub/gammes/:pgId (detail) → admin.seo-hub.gammes.$pgId.tsx
 */

import { type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Gammes SEO - Admin");

export default function AdminSeoHubGammesLayout() {
  return <Outlet />;
}
