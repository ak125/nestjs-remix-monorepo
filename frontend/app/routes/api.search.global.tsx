/**
 * 🔍 API GLOBAL SEARCH - Endpoint pour la recherche globale
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category: 'products' | 'users' | 'orders' | 'pages' | 'settings';
  url: string;
  metadata?: {
    badge?: string;
    price?: string;
    status?: string;
  };
}

// Mock data pour les tests
const MOCK_RESULTS: SearchResult[] = [
  {
    id: "prod-1",
    title: "Amortisseur avant Renault Clio",
    description: "Amortisseur hydraulique pour Renault Clio III",
    category: "products",
    url: "/admin/products/prod-1",
    metadata: {
      price: "89,99€",
      badge: "En stock"
    }
  },
  {
    id: "user-1",
    title: "Jean Dupont",
    description: "Client professionnel - 25 commandes",
    category: "users",
    url: "/admin/users/user-1",
    metadata: {
      status: "Actif",
      badge: "Pro"
    }
  },
  {
    id: "order-1",
    title: "Commande #12345",
    description: "Commande de Jean Dupont - 3 articles",
    category: "orders",
    url: "/admin/orders/order-1",
    metadata: {
      status: "En traitement",
      price: "125,99€"
    }
  },
  {
    id: "page-1",
    title: "Gestion des stocks",
    description: "Page d'administration des stocks",
    category: "pages",
    url: "/admin/stock",
  },
  {
    id: "settings-1",
    title: "Paramètres de notifications",
    description: "Configuration des notifications système",
    category: "settings",
    url: "/admin/settings/notifications",
  },
  {
    id: "prod-2",
    title: "Plaquettes de frein Peugeot 307",
    description: "Jeu de plaquettes avant et arrière",
    category: "products",
    url: "/admin/products/prod-2",
    metadata: {
      price: "45,50€",
      badge: "Stock faible"
    }
  },
  {
    id: "user-2",
    title: "Marie Martin",
    description: "Nouveau client particulier",
    category: "users",
    url: "/admin/users/user-2",
    metadata: {
      status: "Nouveau"
    }
  }
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const limit = parseInt(url.searchParams.get("limit") || "20");

  if (!query.trim()) {
    return json({ results: [] });
  }

  // Filtrer par recherche textuelle
  let filteredResults = MOCK_RESULTS.filter(result => 
    result.title.toLowerCase().includes(query.toLowerCase()) ||
    result.description?.toLowerCase().includes(query.toLowerCase())
  );

  // Filtrer par catégorie
  if (category && category !== "all") {
    filteredResults = filteredResults.filter(result => result.category === category);
  }

  // Limiter les résultats
  const results = filteredResults.slice(0, limit);

  // Simuler un délai de recherche
  await new Promise(resolve => setTimeout(resolve, 200));

  return json({ results });
}
