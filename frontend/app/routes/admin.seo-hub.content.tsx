/**
 * SEO HUB - CONTENT Layout
 *
 * Pure layout route — renders child routes via <Outlet />.
 * Dashboard content lives in admin.seo-hub.content._index.tsx
 */

import { Outlet } from "react-router";

export default function SeoHubContentLayout() {
  return <Outlet />;
}
