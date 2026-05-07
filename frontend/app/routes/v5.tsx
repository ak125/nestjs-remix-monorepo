/**
 * V5 layout — namespace mobile parcours (/v5/*).
 *
 * - Charge `app/styles/v5.css` via `links()` (scope local, pas globalement
 *   dans root.tsx → pas de pollution CSS sur les routes V4).
 * - Wrapper `mx-auto max-w-md min-h-screen` : centré ≤ 480px, app mobile.
 * - BottomBar persistante sur tous les écrans V5.
 *
 * Mobile collision gate : sticky-cta + bottombar + safe-area gérés
 * par les routes filles. Voir styles/v5.css en tête de fichier.
 */

import { type LinksFunction, type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { V5BottomBar } from "~/components/v5/BottomBar";
import v5StylesheetUrl from "~/styles/v5.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: v5StylesheetUrl },
];

export const meta: MetaFunction = () => [
  { title: "AutoMecanik · V5 mobile" },
  {
    name: "viewport",
    content:
      "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
  },
];

export default function V5Layout() {
  return (
    <div className="v5 v5-page mx-auto flex min-h-screen max-w-md flex-col">
      <Outlet />
      <V5BottomBar />
    </div>
  );
}
