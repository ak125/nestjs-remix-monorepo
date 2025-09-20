/**
 * 🎯 PRODUCTS ADMIN - UNIFIED INTERFACE
 * 
 * Interface unifiée pour la gestion des produits
 * Remplace pro.products._index.tsx + commercial.products._index.tsx
 * 
 * Features:
 * - Role-based UI (Pro vs Commercial)
 * - Progressive Enhancement (?enhanced=true)
 * - Component library integration
 * - Centralized backend communication
 * 
 * Routes:
 * - /products/admin (base interface)
 * - /products/admin?enhanced=true (advanced interface)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { 
  Search, 
  Filter, 
  Star,
  ShoppingCart,
  Eye,
  Truck,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { ProductsQuickActions } from '../components/products/ProductsQuickActions';
import { ProductsStatsCard } from '../components/products/ProductsStatsCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

// Unified Product Interface
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  priceProf?: number;  // Pro-only field
  brand: string;
  category: string;
  image: string;
  stock: number;
  rating: number;
  reviews: number;
  isProExclusive?: boolean;  // Pro-only field
  deliveryTime: string;
  discount?: number;
  alias?: string;  // Commercial-specific field
  is_active?: boolean;  // Commercial-specific field
  is_top?: boolean;  // Commercial-specific field
}

interface ProductStats {
  totalProducts: number;
  categoriesCount?: number;
  brandsCount?: number;
  averageRating?: number;
  inStock?: number;
  exclusiveProducts?: number;  // Pro-only
  lowStockItems?: number;  // Commercial focus
  totalBrands?: number;  // Commercial naming
  totalCategories?: number;  // Commercial naming
}

interface ProductsData {
  user: {
    id: string;
    name: string;
    level: number;
    role: 'pro' | 'commercial';
  };
  stats: ProductStats;
  products: Product[];
  recentProducts?: Product[];  // Commercial style
  recentBrands?: Array<{
    marque_id: number;
    marque_name: string;
  }>;
  enhanced: boolean;
  error?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  
  // Determine user role and check access
  const userLevel = user.level || 0;
  const userName = user.name || 'Utilisateur';
  const userRole = userLevel >= 4 ? 'pro' : userLevel >= 3 ? 'commercial' : null;
  if (!userRole) {
    throw new Response('Accès refusé - Compte professionnel ou commercial requis', { status: 403 });
  }

  // Check for enhanced mode
  const url = new URL(request.url);
  const enhanced = url.searchParams.get('enhanced') === 'true';

  const baseUrl = process.env.API_URL || "http://localhost:3000";
  
  try {
    // Unified API calls with role-based data fetching
    const apiCalls = [
      fetch(`${baseUrl}/api/products/stats`, {
        headers: { 
          'internal-call': 'true',
          'user-role': userRole,
          'user-level': userLevel.toString()
        }
      })
    ];

    // Add role-specific calls
    if (userRole === 'commercial') {
      apiCalls.push(
        fetch(`${baseUrl}/api/products/gammes`, {
          headers: { 'internal-call': 'true' }
        }),
        fetch(`${baseUrl}/api/products/brands-test`, {
          headers: { 'internal-call': 'true' }
        })
      );
    } else if (userRole === 'pro') {
      apiCalls.push(
        fetch(`${baseUrl}/api/products/pro-exclusive`, {
          headers: { 'internal-call': 'true' }
        })
      );
    }

    const responses = await Promise.all(apiCalls);
    
    // Parse stats (common to both roles)
    let stats: ProductStats = {
      totalProducts: 0,
      brandsCount: 0,
      categoriesCount: 0
    };

    if (responses[0]?.ok) {
      const statsData = await responses[0].json();
      stats = {
        totalProducts: statsData.totalProducts || 0,
        brandsCount: statsData.totalBrands || statsData.brandsCount || 0,
        categoriesCount: statsData.totalCategories || statsData.categoriesCount || 0,
        ...(userRole === 'commercial' && {
          lowStockItems: statsData.lowStockItems || 0
        }),
        ...(userRole === 'pro' && {
          averageRating: statsData.averageRating || 0,
          inStock: statsData.inStock || 0,
          exclusiveProducts: statsData.exclusiveProducts || 0
        })
      };
    }

    // Mock products data (in production, fetch from unified API)
    const products: Product[] = userRole === 'pro' ? [
      {
        id: 'prod-001',
        name: 'Plaquettes de frein Brembo Sport',
        description: 'Plaquettes haute performance pour conduite sportive',
        price: 129.99,
        priceProf: 89.99,
        brand: 'Brembo',
        category: 'Freinage',
        image: '/images/brake-pads-brembo.jpg',
        stock: 25,
        rating: 4.8,
        reviews: 127,
        isProExclusive: true,
        deliveryTime: '24-48h',
        discount: 31
      },
      {
        id: 'prod-002',
        name: 'Huile moteur Castrol GTX 5W-30',
        description: 'Huile synthétique haute performance',
        price: 34.50,
        priceProf: 24.90,
        brand: 'Castrol',
        category: 'Lubrification',
        image: '/images/oil-castrol.jpg',
        stock: 150,
        rating: 4.6,
        reviews: 89,
        isProExclusive: false,
        deliveryTime: '24h',
        discount: 28
      }
    ] : [
      {
        id: 'comm-001',
        name: 'Kit d\'embrayage Sachs Performance',
        description: 'Kit complet pour véhicules commerciaux',
        price: 189.99,
        brand: 'Sachs',
        category: 'Transmission',
        image: '/images/clutch-sachs.jpg',
        stock: 45,
        rating: 4.5,
        reviews: 67,
        deliveryTime: '48h',
        is_active: true,
        is_top: false
      }
    ];

    return json<ProductsData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      stats,
      products,
      enhanced,
      ...(userRole === 'commercial' && responses.length > 1 && {
        recentProducts: responses[1]?.ok ? (await responses[1].json()).slice(0, 6) : [],
        recentBrands: responses[2]?.ok ? await responses[2].json() : []
      })
    });

  } catch (error) {
    console.error('Products data loading error:', error);
    return json<ProductsData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      stats: { totalProducts: 0, brandsCount: 0, categoriesCount: 0 },
      products: [],
      enhanced,
      error: 'Erreur lors du chargement des données produits'
    });
  }
}

export default function ProductsAdmin() {
  const data = useLoaderData<typeof loader>();
  const { user, stats, products, enhanced, error } = data;

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erreur de chargement</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion Produits {user.role === 'pro' ? 'Pro' : 'Commercial'}
          </h1>
          <p className="text-gray-600 mt-2">
            {user.role === 'pro' 
              ? 'Interface professionnelle avec accès exclusif et tarifs négociés'
              : 'Interface commerciale pour la gestion catalogue et stocks'
            }
          </p>
          {enhanced && (
            <Badge variant="secondary" className="mt-2">
              Mode Avancé Activé
            </Badge>
          )}
        </div>
        
        {!enhanced && (
          <Link to="/products/admin?enhanced=true">
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Mode Avancé
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <ProductsStatsCard
        totalProducts={stats.totalProducts}
        categoriesCount={stats.categoriesCount || stats.totalCategories}
        brandsCount={stats.brandsCount || stats.totalBrands}
        averageRating={stats.averageRating}
        inStock={stats.inStock}
        exclusiveProducts={stats.exclusiveProducts}
        lowStockItems={stats.lowStockItems}
        enhanced={enhanced}
        userRole={user.role}
      />

      {/* Quick Actions */}
      <ProductsQuickActions
        enhanced={enhanced}
        userRole={user.role}
        onRefresh={handleRefresh}
      />

      {/* Products Grid */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {user.role === 'pro' ? 'Produits Exclusifs' : 'Catalogue Produits'}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrer
            </Button>
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600">{product.brand}</p>
                  </div>
                  {product.isProExclusive && user.role === 'pro' && (
                    <Badge variant="secondary">Exclusif</Badge>
                  )}
                  {product.is_top && user.role === 'commercial' && (
                    <Badge variant="default">Top</Badge>
                  )}
                </div>

                <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex justify-between items-center mb-4">
                  <div>
                    {user.role === 'pro' && product.priceProf ? (
                      <div>
                        <span className="text-sm text-gray-500 line-through">
                          {product.price.toFixed(2)}€
                        </span>
                        <span className="text-lg font-bold text-green-600 ml-2">
                          {product.priceProf.toFixed(2)}€
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-gray-900">
                        {product.price.toFixed(2)}€
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-gray-600">
                      {product.rating} ({product.reviews})
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">
                      Stock: {product.stock}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {product.deliveryTime}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/products/${product.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Voir
                    </Link>
                  </Button>
                  {user.role === 'pro' && (
                    <Button variant="outline" size="sm">
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {enhanced && (
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4">Analytics Avancées</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Tendances</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Analyse des ventes et tendances marché
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Performance</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Métriques de performance produits
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">Alertes</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Stock faible et actions requises
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
