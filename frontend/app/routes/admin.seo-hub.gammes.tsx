/**
 * 🎯 ADMIN SEO HUB - GAMMES LAYOUT
 *
 * Layout parent pour les routes gammes du SEO Hub:
 * - /admin/seo-hub/gammes (index) → admin.seo-hub.gammes._index.tsx
 * - /admin/seo-hub/gammes/:pgId (detail) → admin.seo-hub.gammes.$pgId.tsx
 */

import { Outlet } from "@remix-run/react";

export default function AdminSeoHubGammesLayout() {
  return <Outlet />;
}
