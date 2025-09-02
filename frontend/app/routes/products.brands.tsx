/**
 * 🏷️ PRODUCTS BRANDS - UNIFIED MANAGEMENT
 * 
 * Gestion unifiée des marques de produits
 * Remplace commercial.products.brands.tsx
 * 
 * Features:
 * - Role-based access (Commercial/Pro)
 * - Progressive Enhancement ready
 * - Component library integration
 * - Unified API communication
 * 
 * Routes:
 * - /products/brands (base interface)
 * - /products/brands?enhanced=true (advanced interface)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { ArrowLeft, Tag, Car, TrendingUp, Search, Filter } from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { ProductsQuickActions } from '../components/products/ProductsQuickActions';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface Brand {
  marque_id: number;
  marque_name: string;
  products_count?: number;  // Enhanced data
  last_updated?: string;    // Enhanced data
  is_featured?: boolean;    // Pro feature
}

interface BrandsData {
  user: {
    id: string;
    name: string;
    level: number;
    role: 'pro' | 'commercial';
  };
  brands: Brand[];
  stats: {
    total: number;
    featured?: number;  // Pro feature
    active: number;
  };
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
    // Unified API call for brands
    const response = await fetch(`${baseUrl}/api/vehicles/brands`, {
      headers: { 
        'internal-call': 'true',
        'user-role': userRole,
        'enhanced-mode': enhanced.toString()
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const brandsData = await response.json();
    const brands: Brand[] = brandsData.data?.map((brand: any) => ({
      marque_id: brand.marque_id,
      marque_name: brand.marque_name,
      ...(enhanced && {
        products_count: brand.products_count || 0,
        last_updated: brand.last_updated,
        is_featured: brand.is_featured || false
      })
    })) || [];

    const stats = {
      total: brands.length,
      active: brands.filter(brand => brand.marque_name).length,
      ...(userRole === 'pro' && {
        featured: brands.filter(brand => brand.is_featured).length
      })
    };

    return json<BrandsData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      brands,
      stats,
      enhanced
    });

  } catch (error) {
    console.error('Brands loading error:', error);
    return json<BrandsData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      brands: [],
      stats: { total: 0, active: 0 },
      enhanced,
      error: 'Erreur lors du chargement des marques'
    });
  }
}

export default function ProductsBrands() {
  const data = useLoaderData<typeof loader>();
  const { user, brands, stats, enhanced, error } = data;

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        </div>
        
        <div className="text-center">
          <Tag className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Tag className="h-8 w-8 text-blue-600" />
              Marques Produits {user.role === 'pro' ? 'Pro' : 'Commercial'}
            </h1>
            <p className="text-gray-600 mt-2">
              Gestion des marques disponibles dans le catalogue
            </p>
            {enhanced && (
              <Badge variant="secondary" className="mt-2">
                Mode Avancé - Analytics Détaillées
              </Badge>
            )}
          </div>
        </div>

        {!enhanced && (
          <Link to="/products/brands?enhanced=true">
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Mode Avancé
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Marques</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Tag className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Marques Actives</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Car className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {user.role === 'pro' && stats.featured !== undefined && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Marques Vedettes</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.featured}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <ProductsQuickActions
        enhanced={enhanced}
        userRole={user.role}
        onRefresh={handleRefresh}
      />

      {/* Brands Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Liste des Marques</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrer
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brands.map((brand) => (
            <Card key={brand.marque_id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{brand.marque_name}</span>
                  {brand.is_featured && user.role === 'pro' && (
                    <Badge variant="secondary">Vedette</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                {enhanced && (
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    {brand.products_count && (
                      <div className="flex justify-between">
                        <span>Produits:</span>
                        <span className="font-medium">{brand.products_count}</span>
                      </div>
                    )}
                    {brand.last_updated && (
                      <div className="flex justify-between">
                        <span>Mis à jour:</span>
                        <span className="font-medium">
                          {new Date(brand.last_updated).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/products/catalog?brand=${brand.marque_id}`}>
                      Voir Produits
                    </Link>
                  </Button>
                  {user.role === 'pro' && (
                    <Button variant="outline" size="sm">
                      Éditer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {brands.length === 0 && (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune marque trouvée
            </h3>
            <p className="text-gray-600">
              Aucune marque n'est actuellement disponible dans le système.
            </p>
          </div>
        )}
      </div>

      {enhanced && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Analytics Marques</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Répartition par Activité</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Actives:</span>
                    <span>{Math.round((stats.active / stats.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(stats.active / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {user.role === 'pro' && stats.featured !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Marques Vedettes</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Vedettes:</span>
                      <span>{Math.round((stats.featured / stats.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${(stats.featured / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
