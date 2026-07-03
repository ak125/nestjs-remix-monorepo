/**
 * SEO HUB - CONTENT DIAGNOSTICS (R5) Layout
 *
 * Pure layout route — renders child routes via <Outlet />.
 * List/create/edit live in _index, new, $slug child routes.
 */

import { Outlet } from "react-router";

export default function SeoHubContentDiagnosticsLayout() {
  return <Outlet />;
}
