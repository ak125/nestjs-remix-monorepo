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
