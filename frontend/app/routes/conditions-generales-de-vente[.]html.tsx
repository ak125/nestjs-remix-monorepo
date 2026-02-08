// Route: /conditions-generales-de-vente.html -> CGV
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import _LegalPageComponent from "./legal.$pageKey";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    canonicalEntity: "cgv",
  }),
};

const API_URL = getInternalApiUrl("");

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "CGV - Automecanik" }];
  }
  return [
    { title: `${data.page.title} - Automecanik` },
    {
      name: "description",
      content:
        data.page.description || "Conditions Générales de Vente Automecanik",
    },
    { name: "robots", content: "noindex, follow" },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/legal/cgv",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(`${API_URL}/api/support/legal/ariane/cgv`, {
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const dbPage = await response.json();
      return json({
        page: {
          key: "cgv",
          title: dbPage.h1 || dbPage.title,
          content: dbPage.content,
          description: dbPage.description,
          keywords: dbPage.keywords,
          breadcrumb: dbPage.breadcrumb,
          indexable: false,
        },
        fromDB: true,
      });
    }
  } catch (error) {
    logger.warn("Failed to fetch CGV:", error);
  }

  return json({
    page: {
      key: "cgv",
      title: "Conditions Générales de Vente",
      content: "<p>Contenu non disponible</p>",
      description: "",
      keywords: "",
      breadcrumb: "CGV",
      indexable: false,
    },
    fromDB: false,
  });
}

export { default } from "./legal.$pageKey";
