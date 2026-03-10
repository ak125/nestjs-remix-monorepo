import { useSearchParams } from "@remix-run/react";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { ErrorGeneric } from "../components/errors/ErrorGeneric";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    canonicalEntity: "410-gone",
  }),
};

export default function GonePage() {
  const [searchParams] = useSearchParams();

  const _url = searchParams.get("url") || undefined;
  const _isOldLink = searchParams.get("isOldLink") === "true";
  const _redirectTo = searchParams.get("redirectTo") || undefined;
  const _userAgent = searchParams.get("userAgent") || undefined;
  const _referrer = searchParams.get("referrer") || undefined;
  const _method = searchParams.get("method") || undefined;

  return (
    <ErrorGeneric
      status={410}
      message="Cette ressource a été définitivement supprimée"
    />
  );
}

export function meta() {
  return [
    { title: "410 - Contenu supprimé | NestJS Remix Monorepo" },
    {
      name: "description",
      content:
        "Cette ressource a été définitivement supprimée ou utilise un format d'URL obsolète.",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
