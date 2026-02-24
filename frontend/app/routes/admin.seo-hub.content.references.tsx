/**
 * SEO HUB - CONTENT REFERENCES (R4) Layout
 *
 * Pure layout route — renders child routes via <Outlet />.
 * List/create/edit live in _index, new, $slug child routes.
 */

import { Outlet } from "@remix-run/react";

export default function SeoHubContentReferencesLayout() {
  return <Outlet />;
}
