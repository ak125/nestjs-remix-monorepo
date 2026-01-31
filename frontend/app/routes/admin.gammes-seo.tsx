/**
 * 🎯 ADMIN GAMMES SEO - LAYOUT
 *
 * Layout parent pour les routes gammes-seo:
 * - /admin/gammes-seo (index) → admin.gammes-seo._index.tsx
 * - /admin/gammes-seo/:pgId (detail) → admin.gammes-seo.$pgId.tsx
 */

import { Outlet } from "@remix-run/react";

export default function AdminGammesSeoLayout() {
  return <Outlet />;
}
