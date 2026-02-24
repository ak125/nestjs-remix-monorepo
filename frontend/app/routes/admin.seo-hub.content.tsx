/**
 * SEO HUB - CONTENT Layout
 *
 * Pure layout route — renders child routes via <Outlet />.
 * Dashboard content lives in admin.seo-hub.content._index.tsx
 */

import { Outlet } from "@remix-run/react";

export default function SeoHubContentLayout() {
  return <Outlet />;
}
