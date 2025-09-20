/**
 * 📦 DÉTAIL PRODUIT COMMERCIAL
 * 
 * Page de détail d'un produit pour l'équipe commerciale
 * Route: /commercial/products/:id
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft, Package, Tag, Info, ExternalLink, Star } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { AddToCartForm } from "../components/cart/AddToCartForm";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

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

interface LoaderData {
  product: ProductDetail | null;
  error?: string;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const productId = params.id;
  
  if (!productId) {
    throw new Response("ID produit manquant", { status: 400 });
  }

  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/products/${productId}`, {
      headers: { 'internal-call': 'true' }
    });
    
    if (response.status === 404) {
      throw new Response("Produit non trouvé", { status: 404 });
    }
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const product: ProductDetail = await response.json();

    return json({
      product,
    } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement détail produit:", error);
    
    if (error instanceof Response) {
      throw error;
    }
    
    return json({
      product: null,
      error: "Impossible de charger le détail du produit"
    } as LoaderData);
  }
}

export default function CommercialProductDetail() {
  const { product, error } = useLoaderData<typeof loader>();

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Produit introuvable
            </h1>
            <p className="text-gray-600 mb-6">
              {error || "Ce produit n'existe pas ou n'est plus disponible."}
            </p>
            <Button asChild>
              <Link to="/commercial/products">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au catalogue
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <Link to="/commercial" className="hover:text-gray-900">Commercial</Link>
                <span>/</span>
                <Link to="/commercial/products" className="hover:text-gray-900">Produits</Link>
                <span>/</span>
                <Link to="/commercial/products/catalog" className="hover:text-gray-900">Catalogue</Link>
                <span>/</span>
                <span className="text-gray-900">Détail</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {product.piece_name}
              </h1>
              <p className="text-gray-600 mt-1">
                REF: {product.piece_sku} • ID: {product.piece_id}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button asChild variant="outline">
                <Link to="/commercial/products/catalog">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne gauche - Image et informations principales */}
          <div className="space-y-6">
            {/* Image du produit */}
            <Card>
              <CardContent className="p-6">
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  {product.piece_image ? (
                    <img
                      src={product.piece_image}
                      alt={product.piece_name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Package className="h-20 w-20 text-gray-300" />
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant={product.piece_activ ? "default" : "destructive"}>
                      {product.piece_activ ? 'Actif' : 'Inactif'}
                    </Badge>
                    {product.piece_top && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Star className="h-3 w-3 mr-1" />
                        TOP
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informations techniques */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Informations techniques
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">ID:</span>
                    <span className="ml-2">{product.piece_id}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">SKU:</span>
                    <span className="ml-2">{product.piece_sku}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Stock:</span>
                    <span className="ml-2">
                      {product.piece_stock ? `${product.piece_stock} unités` : 'Non défini'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Statut:</span>
                    <span className="ml-2">
                      {product.piece_activ ? 'Disponible' : 'Indisponible'}
                    </span>
                  </div>
                </div>
                
                {product.piece_alias && (
                  <div className="pt-2 border-t">
                    <span className="font-medium text-gray-600">Alias:</span>
                    <span className="ml-2 text-sm">{product.piece_alias}</span>
                  </div>
                )}
                
                {product.piece_description && (
                  <div className="pt-2 border-t">
                    <span className="font-medium text-gray-600">Description:</span>
                    <p className="mt-1 text-sm text-gray-700">
                      {product.piece_description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite - Gamme, marque, prix et actions */}
          <div className="space-y-6">
            {/* Gamme */}
            {product.pieces_gamme && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    Gamme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h3 className="font-medium">{product.pieces_gamme.gamme_name}</h3>
                    {product.pieces_gamme.gamme_description && (
                      <p className="text-sm text-gray-600">
                        {product.pieces_gamme.gamme_description}
                      </p>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/commercial/products/gammes?id=${product.pieces_gamme.gamme_id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Voir la gamme
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Marque */}
            {product.pieces_marque && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Tag className="h-5 w-5 mr-2" />
                    Marque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      {product.pieces_marque.marque_logo ? (
                        <img
                          src={product.pieces_marque.marque_logo}
                          alt={product.pieces_marque.marque_name}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                          <Tag className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <span className="font-medium">{product.pieces_marque.marque_name}</span>
                      <Badge variant={product.pieces_marque.marque_activ ? "default" : "secondary"}>
                        {product.pieces_marque.marque_activ ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/commercial/products/brands?id=${product.pieces_marque.marque_id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Voir la marque
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prix */}
            {product.pieces_price && (
              <Card>
                <CardHeader>
                  <CardTitle>Prix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-3xl font-bold text-green-600">
                      {product.pieces_price.price_ttc.toFixed(2)} €
                      <span className="text-sm font-normal text-gray-500 ml-2">TTC</span>
                    </div>
                    <div className="text-lg text-gray-700">
                      {product.pieces_price.price_ht.toFixed(2)} € HT
                    </div>
                    <div className="text-sm text-gray-500">
                      TVA: {product.pieces_price.price_vat.toFixed(2)}%
                    </div>
                    {product.pieces_price.price_date && (
                      <div className="text-xs text-gray-400">
                        Mis à jour le {new Date(product.pieces_price.price_date).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions commerciales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.piece_activ && product.pieces_price && (
                  <AddToCartForm
                    productId={parseInt(product.piece_id)}
                    maxQuantity={product.piece_stock || 99}
                    className="w-full"
                  />
                )}
                
                <div className="flex space-x-2">
                  <Button variant="outline" className="flex-1">
                    Créer devis
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Contacter client
                  </Button>
                </div>
                
                {!product.piece_activ && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      Ce produit est actuellement indisponible.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
