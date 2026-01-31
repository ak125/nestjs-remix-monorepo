// Route: /politique-cookies -> Cookies
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    canonicalEntity: "politique-cookies",
  }),
};

const API_URL = getInternalApiUrl("");

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Politique de cookies - Automecanik" }];
  }
  return [
    { title: `${data.page.title} - Automecanik` },
    {
      name: "description",
      content: data.page.description || "Politique de cookies Automecanik",
    },
    { name: "robots", content: "noindex, follow" },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/politique-cookies",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(
      `${API_URL}/api/support/legal/ariane/cookies`,
      {
        headers: { Accept: "application/json" },
      },
    );

    if (response.ok) {
      const dbPage = await response.json();
      return json({
        page: {
          key: "cookies",
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
    console.warn("Failed to fetch cookies:", error);
  }

  return json({
    page: {
      key: "cookies",
      title: "Politique de cookies",
      content: "<p>Contenu non disponible</p>",
      description: "",
      keywords: "",
      breadcrumb: "Cookies",
      indexable: false,
    },
    fromDB: false,
  });
}

export { default } from "./legal.$pageKey";
