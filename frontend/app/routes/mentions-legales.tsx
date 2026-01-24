// Route: /mentions-legales -> Mentions légales
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    canonicalEntity: "mentions-legales",
  }),
};

const API_URL = process.env.API_URL || "http://localhost:3000";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Mentions légales - Automecanik" }];
  }
  return [
    { title: `${data.page.title} - Automecanik` },
    {
      name: "description",
      content: data.page.description || "Mentions légales Automecanik",
    },
    { name: "robots", content: "noindex, follow" },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/mentions-legales",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(`${API_URL}/api/support/legal/ariane/ml`, {
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const dbPage = await response.json();
      return json({
        page: {
          key: "legal-notice",
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
    console.warn("Failed to fetch mentions légales:", error);
  }

  return json({
    page: {
      key: "legal-notice",
      title: "Mentions légales",
      content: "<p>Contenu non disponible</p>",
      description: "",
      keywords: "",
      breadcrumb: "Mentions légales",
      indexable: false,
    },
    fromDB: false,
  });
}

export { default } from "./legal.$pageKey";
