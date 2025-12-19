// Route: /politique-confidentialite.html -> Confidentialité
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";

const API_URL = process.env.API_URL || "http://localhost:3000";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Politique de confidentialité - Automecanik" }];
  }
  return [
    { title: `${data.page.title} - Automecanik` },
    { name: "description", content: data.page.description || "Politique de confidentialité Automecanik" },
    { name: "robots", content: "noindex, follow" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(`${API_URL}/api/support/legal/ariane/cpuc`, {
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const dbPage = await response.json();
      return json({
        page: {
          key: "privacy",
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
    console.warn("Failed to fetch confidentialité:", error);
  }

  return json({
    page: {
      key: "privacy",
      title: "Politique de confidentialité",
      content: "<p>Contenu non disponible</p>",
      description: "",
      keywords: "",
      breadcrumb: "Confidentialité",
      indexable: false,
    },
    fromDB: false,
  });
}

export { default } from "./legal.$pageKey";
