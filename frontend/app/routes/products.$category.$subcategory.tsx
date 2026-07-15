// app/routes/products.$category.$subcategory.tsx - Exemple d'usage optimisé
import { type LoaderFunctionArgs, type MetaFunction } from "react-router";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { buildCacheHeaders } from "~/utils/cache-control";
import { getSeoMetadata, createSeoMeta } from "../utils/seo.server";

// PR B review — /products/* = espace pro non-public : la plupart lisent
// requireUser, sont noindex et renvoient un payload personnalisé (identité
// user, price_pro/margin, données démo). Namespace entier retiré du cache
// partagé (décision owner). Jamais public/s-maxage. L'arbitre entry.server
// force aussi private/no-store sur toute requête sessionnée.
export const headers = buildCacheHeaders(
  "private, no-cache, no-store, must-revalidate",
);

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const { category, subcategory } = params;

  // ✅ Récupérer métadonnées depuis l'API backend existante (714K+ entrées)
  const seoData = await getSeoMetadata(url.pathname, {
    title: `${subcategory?.replace("-", " ")} ${category} - Pièces Auto`,
    description: `Découvrez notre sélection ${subcategory} pour ${category}. Qualité garantie, livraison rapide et prix compétitifs.`,
    keywords: `${category}, ${subcategory}, pièces auto, automobile`,
  });

  // ✅ Créer les métadonnées côté serveur
  const metaTags = createSeoMeta(seoData);

  // Simuler récupération produits depuis API
  const products = [
    {
      id: "1",
      name: `Produit ${subcategory} premium`,
      brand: "Bosch",
      price: 89.99,
      category: category,
      description: `Pièce ${subcategory} de haute qualité`,
    },
  ];

  return {
    seoData,
    metaTags, // ✅ Passer les métadonnées créées côté serveur
    products,
    category: category,
    subcategory: subcategory,
  };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData: data }) => {
  if (!data?.metaTags) {
    return [{ title: "Erreur | Automecanik" }];
  }

  // ✅ Utiliser les métadonnées pré-calculées côté serveur
  return data.metaTags;
};

export default function ProductsSubcategory() {
  const { products, category, subcategory, seoData } =
    useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <nav className="text-sm text-muted-foreground mb-4">
          <span>Accueil</span> → <span>{category}</span> →{" "}
          <span className="font-medium">{subcategory}</span>
        </nav>

        <h1 className="text-3xl font-bold mb-2">
          {seoData.title?.split("|")[0]?.trim() || `${subcategory} ${category}`}
        </h1>

        <p className="text-lg text-muted-foreground">{seoData.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
            <p className="text-muted-foreground mb-4">{product.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-primary">
                {product.price}€
              </span>
              <button className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90">
                Ajouter au panier
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Zone de contenu SEO supplémentaire */}
      <div className="mt-12 bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-semibold mb-4">
          Pourquoi choisir nos {subcategory} pour {category} ?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-medium mb-2">✅ Qualité garantie</h3>
            <p>
              Pièces d'origine ou équivalentes, certifiées conformes aux normes
              constructeur.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">🚚 Livraison rapide</h3>
            <p>
              Expédition sous 24h, livraison France métropolitaine en 2-3 jours
              ouvrés.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">💰 Prix compétitifs</h3>
            <p>
              Meilleurs prix du marché grâce à nos partenariats directs avec les
              fabricants.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">🔧 Support technique</h3>
            <p>
              Équipe d'experts disponible pour vous conseiller dans vos choix.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
