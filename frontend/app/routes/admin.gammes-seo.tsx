/**
 * 🎯 ADMIN GAMMES SEO - LAYOUT
 *
 * Layout parent pour les routes gammes-seo:
 * - /admin/gammes-seo (index) → admin.gammes-seo._index.tsx
 * - /admin/gammes-seo/:pgId (detail) → admin.gammes-seo.$pgId.tsx
 */

import { type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Gammes SEO - Admin");

export default function AdminGammesSeoLayout() {
  return <Outlet />;
}
