/**
 * Layout des routes /preview-mobile/* — preview visuelle mobile-V5.
 *
 * Cette route est temporaire : elle permet à Fafa de valider visuellement
 * les composants mobile-V5 (Plaque, FitmentBand, StickyCTA, BottomBar,
 * MobileProductCard) avant qu'ils soient intégrés in-place dans les routes
 * V4 réelles (`/`, `/pieces/*`, `/cart`).
 *
 * Une fois validé : tout le namespace `/preview-mobile/*` est supprimé,
 * les composants migrent vers `components/home/`, `components/ecommerce/`,
 * `components/cart/`, `components/layout/` et sont consommés par les routes V4.
 */

import { type LinksFunction, type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { MV5BottomBar } from "~/components/mobile-v5/BottomBar";
import mobileSignaturesUrl from "~/styles/mobile-signatures.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: mobileSignaturesUrl },
];

export const meta: MetaFunction = () => [
  { title: "AutoMecanik · Preview mobile" },
  {
    name: "viewport",
    content:
      "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
  },
  // Preview-only : noindex pour ne pas polluer le SEO V4
  { name: "robots", content: "noindex,nofollow" },
];

export default function PreviewMobileLayout() {
  return (
    <div className="mobile-v5 mx-auto flex min-h-screen max-w-md flex-col">
      <Outlet />
      <MV5BottomBar />
    </div>
  );
}
