/**
 * 📦 PRODUCTS DETAIL - UNIFIED INTERFACE
 * 
 * Page de détail unifié d'un produit
 * Remplace commercial.products.$id.tsx
 * 
 * Features:
 * - Role-based access (Commercial/Pro)
 * - Enhanced product information
 * - Progressive Enhancement ready
 * - Component library integration
 * 
 * Routes:
 * - /products/:id (base interface)
 * - /products/:id?enhanced=true (advanced interface)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { ArrowLeft, Package, Tag, Info, Star, TrendingUp, ShoppingCart } from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { ProductsQuickActions } from '../components/products/ProductsQuickActions';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PublicBreadcrumb } from '../components/ui/PublicBreadcrumb';

interface ProductDetail {
  piece_id: string;
  piece_name: string;
  piece_alias?: string;
  piece_sku: string;
  piece_image?: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description?: string;
  piece_stock?: number;
  // Enhanced fields
  compatibility?: string[];     // Enhanced data
  specifications?: any;         // Enhanced data
  related_products?: string[];  // Enhanced data
  // Pro-specific fields
  price_pro?: number;          // Pro exclusive
  margin?: number;             // Pro exclusive
  // Unified data structure
  pieces_gamme?: {
    gamme_id: string;
    gamme_name: string;
    gamme_description?: string;
    gamme_seo_title?: string;
    gamme_seo_description?: string;
  };
  pieces_marque?: {
    marque_id: string;
    marque_name: string;
    marque_logo?: string;
    marque_activ: boolean;
  };
  pieces_price?: {
    price_ht: number;
    price_ttc: number;
    price_vat: number;
    price_date?: string;
  };
}

interface ProductDetailData {
  user: {
    id: string;
    name: string;
    level: number;
    role: 'pro' | 'commercial';
  };
  product: ProductDetail | null;
  enhanced: boolean;
  error?: string;
}

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  
  // Determine user role and check access
  const userLevel = user.level || 0;
  const userName = user.name || 'Utilisateur';
  const userRole = userLevel >= 4 ? 'pro' : userLevel >= 3 ? 'commercial' : null;
  
  if (!userRole) {
    throw new Response('Accès refusé - Compte professionnel ou commercial requis', { status: 403 });
  }

  const productId = params.id;
  if (!productId) {
    throw new Response('ID produit manquant', { status: 400 });
  }

  const url = new URL(request.url);
  const enhanced = url.searchParams.get('enhanced') === 'true';
  
  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/products/${productId}`, {
      headers: { 
        'internal-call': 'true',
        'user-role': userRole,
        'user-level': userLevel.toString(),
        'enhanced-mode': enhanced.toString()
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Response('Produit non trouvé', { status: 404 });
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const productData = await response.json();
    
    // Map and enhance product data
    const product: ProductDetail | null = productData ? {
      piece_id: productData.piece_id || productData.id,
      piece_name: productData.piece_name || productData.name,
      piece_alias: productData.piece_alias || productData.alias,
      piece_sku: productData.piece_sku || productData.sku,
      piece_image: productData.piece_image || productData.image,
      piece_activ: productData.piece_activ ?? productData.is_active ?? true,
      piece_top: productData.piece_top ?? productData.is_top ?? false,
      piece_description: productData.piece_description || productData.description,
      piece_stock: productData.piece_stock || productData.stock,
      pieces_gamme: productData.pieces_gamme || productData.gamme,
      pieces_marque: productData.pieces_marque || productData.marque,
      pieces_price: productData.pieces_price || productData.price,
      ...(enhanced && {
        compatibility: productData.compatibility,
        specifications: productData.specifications,
        related_products: productData.related_products
      }),
      ...(userRole === 'pro' && {
        price_pro: productData.price_pro,
        margin: productData.margin
      })
    } : null;

    return json<ProductDetailData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      product,
      enhanced
    });

  } catch (error) {
    console.error('Product detail loading error:', error);
    
    if (error instanceof Response) {
      throw error;
    }
    
    return json<ProductDetailData>({
      user: {
        id: user.id,
        name: userName,
        level: userLevel,
        role: userRole
      },
      product: null,
      enhanced,
      error: 'Erreur lors du chargement du produit'
    });
  }
}

export default function ProductDetail() {
  const data = useLoaderData<typeof loader>();
  const { user, product, enhanced, error } = data;

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/catalog">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au catalogue
            </Link>
          </Button>
        </div>
        
        <div className="text-center">
          <Package className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error || 'Produit non trouvé'}
          </h1>
          <p className="text-gray-600">
            Ce produit n'est pas disponible ou n'existe pas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <PublicBreadcrumb items={[
        { label: "Produits", href: "/products" },
        { label: "Catalogue", href: "/products/catalog" },
        { label: product.piece_name }
      ]} />
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/products/catalog">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au catalogue
            </Link>
          </Button>
        </div>

        {!enhanced && (
          <Link to={`/products/${product.piece_id}?enhanced=true`}>
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Mode Avancé
            </Button>
          </Link>
        )}
      </div>

      {/* Product Header */}
      <div className="bg-white p-6 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-6">
          {product.piece_image ? (
            <img
              src={product.piece_image}
              alt={product.piece_name}
              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {product.piece_name}
                </h1>
                {product.piece_alias && (
                  <p className="text-lg text-gray-600 mt-1">
                    {product.piece_alias}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="outline">
                    SKU: {product.piece_sku}
                  </Badge>
                  {product.piece_top && (
                    <Badge variant="secondary">
                      <Star className="h-3 w-3 mr-1" />
                      Top Produit
                    </Badge>
                  )}
                  {!product.piece_activ && (
                    <Badge variant="destructive">
                      Inactif
                    </Badge>
                  )}
                  {enhanced && (
                    <Badge variant="secondary">
                      Mode Avancé
                    </Badge>
                  )}
                </div>
              </div>

              {user.role === 'pro' && (
                <div className="text-right">
                  <Button className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Ajouter au panier
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Information */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {product.piece_description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {product.piece_description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Information */}
          {enhanced && (
            <>
              {/* Specifications */}
              {product.specifications && (
                <Card>
                  <CardHeader>
                    <CardTitle>Spécifications Techniques</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2">
                      {Object.entries(product.specifications).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-gray-100">
                          <span className="font-medium text-gray-600">{key}:</span>
                          <span className="text-gray-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Compatibility */}
              {product.compatibility && product.compatibility.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Compatibilité</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {product.compatibility.map((vehicle, index) => (
                        <Badge key={index} variant="outline">
                          {vehicle}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock Information */}
          {product.piece_stock !== undefined && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {product.piece_stock}
                  </div>
                  <div className="text-sm text-gray-600">
                    Unités en stock
                  </div>
                  {product.piece_stock > 0 ? (
                    <Badge variant="secondary" className="mt-2">
                      Disponible
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="mt-2">
                      Rupture de stock
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price Information */}
          {product.pieces_price && (
            <Card>
              <CardHeader>
                <CardTitle>Prix</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Prix HT:</span>
                  <span className="font-semibold">
                    {product.pieces_price.price_ht.toFixed(2)}€
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>TVA ({(product.pieces_price.price_vat * 100).toFixed(1)}%):</span>
                  <span>
                    {(product.pieces_price.price_ttc - product.pieces_price.price_ht).toFixed(2)}€
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Prix TTC:</span>
                  <span>{product.pieces_price.price_ttc.toFixed(2)}€</span>
                </div>
                {user.role === 'pro' && product.price_pro && (
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>Prix Pro:</span>
                    <span>{product.price_pro.toFixed(2)}€</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Brand Information */}
          {product.pieces_marque && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Marque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  {product.pieces_marque.marque_logo ? (
                    <img
                      src={product.pieces_marque.marque_logo}
                      alt={product.pieces_marque.marque_name}
                      className="h-12 mx-auto mb-2"
                    />
                  ) : (
                    <Tag className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  )}
                  <div className="font-semibold text-gray-900">
                    {product.pieces_marque.marque_name}
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to={`/products/catalog?brand=${product.pieces_marque.marque_id}`}>
                      Voir tous les produits
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Range Information */}
          {product.pieces_gamme && (
            <Card>
              <CardHeader>
                <CardTitle>Gamme</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-semibold text-gray-900">
                    {product.pieces_gamme.gamme_name}
                  </div>
                  {product.pieces_gamme.gamme_description && (
                    <p className="text-sm text-gray-600">
                      {product.pieces_gamme.gamme_description}
                    </p>
                  )}
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={`/products/catalog?range=${product.pieces_gamme.gamme_id}`}>
                      Voir la gamme
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Related Products */}
      {enhanced && product.related_products && product.related_products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produits Associés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {product.related_products.slice(0, 4).map((relatedId, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="text-center">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to={`/products/${relatedId}`}>
                        Voir produit
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <ProductsQuickActions
        enhanced={enhanced}
        userRole={user.role}
      />
    </div>
  );
}
