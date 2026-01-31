// 📁 frontend/app/routes/pieces.catalogue.tsx
// 🛍️ Page catalogue de pièces automobiles moderne

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  default as ProductCatalog,
  type ProductCategory,
  type Product,
} from "../components/catalog/ProductCatalog";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { Error404 } from "~/components/errors/Error404";
import { getInternalApiUrl } from "~/utils/internal-api.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Catalogue Pièces Détachées - Automecanik" },
    {
      name: "description",
      content:
        "Découvrez notre catalogue complet de pièces automobiles. Plus de 50,000 pièces détachées de qualité pour tous véhicules.",
    },
    {
      name: "keywords",
      content:
        "pièces détachées, catalogue auto, pièces automobiles, freinage, moteur, suspension",
    },
  ];
};

interface LoaderData {
  categories: ProductCategory[];
  products: Product[];
  total: number;
  page: number;
  searchTerm: string;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const category = url.searchParams.get("category") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;

  const baseUrl = getInternalApiUrl("");

  try {
    // Charger les catégories et produits en parallèle
    await Promise.allSettled([
      fetch(`${baseUrl}/api/catalog/categories`, {
        headers: { "internal-call": "true" },
      }),
      fetch(
        `${baseUrl}/api/catalog/pieces?search=${encodeURIComponent(search)}&category=${category}&page=${page}&limit=${limit}`,
        {
          headers: { "internal-call": "true" },
        },
      ),
    ]);

    // Categories mockées pour le moment
    const mockCategories: ProductCategory[] = [
      {
        id: "moteur",
        name: "Moteur",
        slug: "moteur",
        description: "Pièces moteur, filtres, huiles, courroies...",
        products_count: 12456,
        featured: true,
        color: "#3B82F6",
      },
      {
        id: "freinage",
        name: "Freinage",
        slug: "freinage",
        description: "Plaquettes, disques, liquides de frein...",
        products_count: 8743,
        featured: true,
        color: "#DC2626",
      },
      {
        id: "suspension",
        name: "Suspension",
        slug: "suspension",
        description: "Amortisseurs, ressorts, silentblocs...",
        products_count: 6521,
        featured: true,
        color: "#059669",
      },
      {
        id: "electrique",
        name: "Électrique",
        slug: "electrique",
        description: "Batteries, alternateurs, démarreurs...",
        products_count: 4892,
        featured: true,
        color: "#7C3AED",
      },
      {
        id: "carrosserie",
        name: "Carrosserie",
        slug: "carrosserie",
        description: "Optiques, pare-chocs, rétroviseurs...",
        products_count: 9876,
        featured: true,
        color: "#EA580C",
      },
      {
        id: "accessoires",
        name: "Accessoires",
        slug: "accessoires",
        description: "Outils, produits d'entretien...",
        products_count: 3214,
        featured: false,
        color: "#6B7280",
      },
    ];

    // Products mockés pour la démonstration
    const mockProducts: Product[] = [
      {
        piece_id: "BRK001",
        piece_name: "Plaquettes de frein avant Bosch BP1234",
        piece_sku: "BRK001-BOSCH",
        piece_activ: true,
        piece_top: true,
        piece_description: "Plaquettes de frein haute performance",
        piece_price: 45.99,
        category: "freinage",
        brand: "Bosch",
        stock_status: "in_stock",
      },
      {
        piece_id: "ENG002",
        piece_name: "Filtre à huile Mann W712/93",
        piece_sku: "ENG002-MANN",
        piece_activ: true,
        piece_top: false,
        piece_description: "Filtre à huile haute qualité",
        piece_price: 12.5,
        category: "moteur",
        brand: "Mann",
        stock_status: "in_stock",
      },
      {
        piece_id: "SUS003",
        piece_name: "Amortisseur avant gauche Monroe G7890",
        piece_sku: "SUS003-MONROE",
        piece_activ: true,
        piece_top: true,
        piece_description: "Amortisseur hydraulique premium",
        piece_price: 89.99,
        category: "suspension",
        brand: "Monroe",
        stock_status: "low_stock",
      },
      {
        piece_id: "ELE004",
        piece_name: "Batterie Varta Blue Dynamic E11",
        piece_sku: "ELE004-VARTA",
        piece_activ: true,
        piece_top: false,
        piece_description: "Batterie 12V 74Ah 680A",
        piece_price: 125.0,
        category: "electrique",
        brand: "Varta",
        stock_status: "in_stock",
      },
      {
        piece_id: "CAR005",
        piece_name: "Phare avant droit H4 Valeo 043734",
        piece_sku: "CAR005-VALEO",
        piece_activ: true,
        piece_top: false,
        piece_description: "Optique avant adaptable",
        piece_price: 76.8,
        category: "carrosserie",
        brand: "Valeo",
        stock_status: "in_stock",
      },
      {
        piece_id: "ACC006",
        piece_name: "Huile moteur Castrol GTX 5W-30 5L",
        piece_sku: "ACC006-CASTROL",
        piece_activ: true,
        piece_top: true,
        piece_description: "Huile synthétique haute performance",
        piece_price: 34.99,
        category: "accessoires",
        brand: "Castrol",
        stock_status: "in_stock",
      },
    ];

    return json({
      categories: mockCategories,
      products: mockProducts,
      total: mockProducts.length,
      page,
      searchTerm: search,
    } as LoaderData);
  } catch (error) {
    console.error("Erreur chargement catalogue:", error);
    return json({
      categories: [],
      products: [],
      total: 0,
      page: 1,
      searchTerm: "",
      error: "Impossible de charger le catalogue",
    } as LoaderData);
  }
}

export default function PiecesCatalogue() {
  const { categories, products, searchTerm, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearch = (term: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (term) {
      newSearchParams.set("search", term);
    } else {
      newSearchParams.delete("search");
    }
    newSearchParams.delete("page"); // Reset page lors d'une nouvelle recherche
    setSearchParams(newSearchParams);
  };

  const handleCategorySelect = (categoryId: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (categoryId) {
      newSearchParams.set("category", categoryId);
    } else {
      newSearchParams.delete("category");
    }
    newSearchParams.delete("page"); // Reset page lors d'un nouveau filtre
    setSearchParams(newSearchParams);
  };

  const handleProductClick = (product: Product) => {
    // Naviger vers la page de détail du produit
    console.log("Product clicked:", product);
    // Pour l'instant, juste un log - à implémenter plus tard
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Erreur de chargement
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PublicBreadcrumb items={[{ label: "Catalogue Pièces" }]} />
      </div>

      <ProductCatalog
        categories={categories}
        products={products}
        searchTerm={searchTerm}
        onSearch={handleSearch}
        onCategorySelect={handleCategorySelect}
        onProductClick={handleProductClick}
        showCategories={true}
        showStats={true}
      />
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP avec composants
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
