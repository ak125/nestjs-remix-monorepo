/**
 * 🔄 ROUTE DE MIGRATION AUTOMATIQUE - ANCIENNES URLs PIÈCES
 * 
 * Route catch-all pour intercepter les anciennes URLs de pièces
 * et effectuer des redirections 301 automatiques vers la nouvelle structure
 * 
 * Pattern capturé: /pieces/{category-name-id}/{brand-brandId}/{model-modelId}/{type-typeId}.html
 * 
 * @version 1.0.0
 * @since 2025-09-14
 * @author SEO Migration Team
 */

import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { AlertTriangle, ArrowRight, Clock, ExternalLink, Package, Star, ShoppingCart, ArrowLeft } from "lucide-react";
import { AddToCartModern } from "../components/cart/AddToCartModern";

// ====================================
// 🎯 INTERFACES & TYPES
// ====================================

interface MigrationResult {
  success: boolean;
  legacy_url: string;
  new_url?: string;
  metadata?: {
    migration_type: string;
    legacy_category: string;
    modern_category: string;
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_type: string;
    seo_keywords: string[];
  };
  error?: string;
}

interface MigrationPageData {
  migration: MigrationResult;
  redirect_in_seconds: number;
  show_manual_redirect: boolean;
}

// ====================================
// 🔧 UTILITAIRES DE MIGRATION
// ====================================

/**
 * Appelle l'API de migration backend pour tester une URL
 */
async function testUrlMigration(legacyUrl: string): Promise<MigrationResult> {
  try {
    const encodedUrl = encodeURIComponent(legacyUrl);
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/vehicles/migration/test/${encodedUrl}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      success: data.success,
      legacy_url: legacyUrl,
      new_url: data.migration?.new_url,
      metadata: data.migration?.metadata
    };
  } catch (error) {
    console.error('Erreur test migration:', error);
    return {
      success: false,
      legacy_url: legacyUrl,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

// ====================================
// � ACTION FUNCTION - Ajout au panier
// ====================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  if (intent === "add") {
    const productId = formData.get("product_id");
    const quantity = formData.get("quantity");
    
    try {
      // Appel à l'API backend
      const response = await fetch(`http://localhost:3000/api/cart/test-add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: quantity,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        return json({ success: true, message: "Produit ajouté au panier", data: result });
      } else {
        return json({ success: false, message: "Erreur lors de l'ajout", error: result }, { status: response.status });
      }
    } catch (error) {
      console.error("Erreur ajout panier:", error);
      return json({ success: false, message: "Erreur de connexion" }, { status: 500 });
    }
  }
  
  return json({ success: false, message: "Action non reconnue" }, { status: 400 });
};

// ====================================
// �📡 LOADER FUNCTION
// ====================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const legacyUrl = url.pathname;
  
  console.log(`🔄 Interception URL legacy: ${legacyUrl}`);
  
  // 🎯 Gérer les URLs de gammes au format /pieces/{slug-id}.html
  const gammeUrlPattern = /^\/pieces\/(.+)-(\d+)\.html$/;
  const gammeMatch = legacyUrl.match(gammeUrlPattern);
  
  if (gammeMatch) {
    const [, slugPart, gammeId] = gammeMatch;
    console.log(`🎯 URL de gamme détectée: ${legacyUrl} (ID: ${gammeId})`);
    
    try {
      // 🎯 Utiliser le nouvel endpoint pour récupérer une gamme spécifique
      const response = await fetch(`http://localhost:3000/api/products/gammes/${gammeId}`);
      
      if (response.ok) {
        const result = await response.json();
        const gamme = result.data;
        
        // Gamme trouvée, servir la page de gamme
        console.log(`✅ Gamme ${gammeId} trouvée: ${gamme.name}`);
        
        // Générer des produits mockés pour cette gamme
        const mockProducts = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          name: `${gamme.name} ${String.fromCharCode(65 + (i % 6))}${Math.floor(i / 6) + 1}`,
          description: `Pièce ${gamme.name.toLowerCase()} haute qualité avec garantie constructeur`,
          price: Math.floor(Math.random() * 150) + 25,
          currency: 'EUR',
          imageUrl: `/images/parts/${slugPart}.jpg`,
          availability: ['in-stock', 'low-stock', 'out-of-stock'][Math.floor(Math.random() * 3)],
          brand: ['BOSCH', 'MANN', 'VALEO', 'FEBI', 'LEMFÖRDER', 'SKF'][Math.floor(Math.random() * 6)],
          partNumber: `${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          gamme: gamme.name,
          compatibility: ['Universel', 'Essence', 'Diesel'][Math.floor(Math.random() * 3)]
        }));

        return json({
          type: 'gamme',
          gamme,
          products: mockProducts,
          slug: slugPart,
          totalProducts: mockProducts.length
        });
      } else {
        // Gamme non trouvée - 404
        console.log(`❌ Gamme ${gammeId} non trouvée`);
        throw new Response(`Gamme ${gammeId} non trouvée`, { status: 404 });
      }
    } catch (error) {
      console.error('Erreur récupération gamme:', error);
      if (error instanceof Response) {
        throw error; // Re-throw Response errors (404, etc.)
      }
      // Pour les autres erreurs, essayer la migration classique
      console.log('Tentative de migration classique...');
    }
  }
  
  // 🚀 Détecter les URLs de véhicules mal routées (format: /pieces/brand-id/model-id/type-name-id)
  const vehicleUrlPattern = /^\/pieces\/([^/]+)-(\d+)\/([^/]+)-(\d+)\/([^/]+)-(\d+)$/;
  const vehicleMatch = legacyUrl.match(vehicleUrlPattern);
  
  if (vehicleMatch) {
    const [, brandName, brandId, modelName, modelId, typeName, typeId] = vehicleMatch;
    const correctUrl = `/constructeurs/${brandName}-${brandId}/${modelName}-${modelId}/${typeName}-${typeId}.html`;
    console.log(`🔀 Redirection URL véhicule mal routée: ${legacyUrl} → ${correctUrl}`);
    return redirect(correctUrl, { status: 301 });
  }
  
  // Vérifier si c'est bien une URL de pièce ancienne
  if (!legacyUrl.includes('/pieces/') || !legacyUrl.endsWith('.html')) {
    throw new Response("URL non reconnue comme ancienne URL de pièce", { status: 404 });
  }
  
  // Tenter la migration
  const migration = await testUrlMigration(legacyUrl);
  
  // Si migration réussie, redirection 301 immédiate
  if (migration.success && migration.new_url) {
    // En production, effectuer la redirection directement
    if (process.env.NODE_ENV === 'production') {
      return redirect(migration.new_url, { status: 301 });
    }
    
    // En développement, afficher la page de migration pour debug
    return json<MigrationPageData>({
      migration,
      redirect_in_seconds: 5,
      show_manual_redirect: true
    });
  }
  
  // Si migration échouée, afficher page d'erreur avec diagnostic
  return json<MigrationPageData>({
    migration,
    redirect_in_seconds: 0,
    show_manual_redirect: false
  }, { status: 404 });
};

// ====================================
// 🎯 META FUNCTION
// ====================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Page déplacée - Redirection en cours" },
      { name: "description", content: "Cette page a été déplacée vers notre nouvelle structure." },
      { name: "robots", content: "noindex, nofollow" }
    ];
  }

  // Cas des gammes
  if (data.type === 'gamme') {
    const { gamme, totalProducts } = data;
    const title = `${gamme.name} | ${totalProducts} Pièces Auto`;
    const description = `Découvrez notre gamme ${gamme.name} avec ${totalProducts} pièces automobiles de qualité. Livraison rapide et garantie constructeur.`;

    return [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" }
    ];
  }

  // Cas des migrations
  if (!data.migration.success) {
    return [
      { title: "Page déplacée - Redirection en cours" },
      { name: "description", content: "Cette page a été déplacée vers notre nouvelle structure." },
      { name: "robots", content: "noindex, nofollow" }
    ];
  }

  const { metadata } = data.migration;
  const title = `${metadata?.vehicle_brand} ${metadata?.vehicle_model} - ${metadata?.modern_category} - Redirection`;
  const description = `Page déplacée: ${metadata?.legacy_category} pour ${metadata?.vehicle_brand} ${metadata?.vehicle_model} ${metadata?.vehicle_type}`;

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "noindex, follow" },
    { "http-equiv": "refresh", content: `${data.redirect_in_seconds};url=${data.migration.new_url}` }
  ];
};

// ====================================
// 🎨 COMPOSANT PRINCIPAL
// ====================================

export default function LegacyPartUrlMigrationPage() {
  const data = useLoaderData<typeof loader>();

  // 🎯 Page de gamme
  if ('type' in data && data.type === 'gamme') {
    const { gamme, products, totalProducts } = data;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* 🍞 Fil d'Ariane */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="flex items-center space-x-2 text-sm" aria-label="Fil d'Ariane">
              <Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors duration-200">
                🏠 Accueil
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded">
                {gamme.name}
              </span>
            </nav>
          </div>
        </div>

        {/* 🎯 En-tête gamme */}
        <div className="bg-white shadow-lg border-b-2 border-blue-100">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl">📦</div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                      {gamme.name}
                    </h1>
                    <p className="text-lg text-gray-600 mt-1">
                      Gamme professionnelle ID #{gamme.id}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                    {totalProducts} pièces disponibles
                  </span>
                  {gamme.is_top && (
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                      ⭐ Gamme populaire
                    </span>
                  )}
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                    Livraison 24h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 📦 Grille des produits */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 group">
                {/* Image produit */}
                <div className="aspect-square bg-gray-100 rounded-xl mb-4 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.src = '/images/parts/default.svg';
                    }}
                  />
                </div>

                {/* Infos produit */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">{product.brand}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">{product.partNumber}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-blue-600">
                      {product.price.toFixed(2)} {product.currency}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.availability === 'in-stock' ? 'bg-green-100 text-green-800' :
                      product.availability === 'low-stock' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {product.availability === 'in-stock' ? 'En stock' :
                       product.availability === 'low-stock' ? 'Stock limité' : 'Rupture'}
                    </div>
                  </div>

                  {/* 🛒 Bouton Ajouter au panier moderne */}
                  <AddToCartModern 
                    productId={product.id} 
                    quantity={1}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Message si aucun produit */}
          {products.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun produit disponible</h3>
              <p className="text-gray-600">Cette gamme sera bientôt approvisionnée.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 🔄 Page de migration (données héritées)
  const { migration, redirect_in_seconds, show_manual_redirect } = data as any;

  // Page de succès avec redirection automatique
  if (migration.success && migration.new_url) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto p-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            {/* Icône et titre */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <ArrowRight className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Page Déplacée
            </h1>
            
            <p className="text-gray-600 mb-6">
              Cette page a été déplacée vers notre nouvelle structure pour une meilleure expérience.
            </p>

            {/* Informations de migration */}
            {migration.metadata && (
              <div className="bg-blue-50 rounded-xl p-6 mb-6 text-left">
                <h3 className="font-semibold text-blue-900 mb-3">Informations de redirection</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-blue-800">Véhicule:</span>{' '}
                    <span className="text-blue-700">
                      {migration.metadata.vehicle_brand} {migration.metadata.vehicle_model} {migration.metadata.vehicle_type}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Catégorie:</span>{' '}
                    <span className="text-blue-700">
                      {migration.metadata.legacy_category} → {migration.metadata.modern_category}
                    </span>
                  </div>
                  {migration.metadata.seo_keywords.length > 0 && (
                    <div>
                      <span className="font-medium text-blue-800">Mots-clés:</span>{' '}
                      <span className="text-blue-700">
                        {migration.metadata.seo_keywords.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Redirection automatique */}
            {redirect_in_seconds > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center text-yellow-800">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="font-medium">
                    Redirection automatique dans {redirect_in_seconds} secondes...
                  </span>
                </div>
              </div>
            )}

            {/* Redirection manuelle */}
            {show_manual_redirect && (
              <div className="space-y-4">
                <Link
                  to={migration.new_url}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Accéder à la nouvelle page
                </Link>
                
                <div className="text-sm text-gray-500">
                  <ExternalLink className="w-4 h-4 inline mr-1" />
                  {migration.new_url}
                </div>
              </div>
            )}

            {/* Debug info en développement */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Informations de débogage
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {JSON.stringify(migration, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Page d'erreur si migration impossible
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icône d'erreur */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Page non trouvée
          </h1>
          
          <p className="text-gray-600 mb-6">
            Nous n'avons pas pu trouver cette page ou la rediriger automatiquement.
          </p>

          {/* Informations d'erreur */}
          <div className="bg-red-50 rounded-xl p-6 mb-6 text-left">
            <h3 className="font-semibold text-red-900 mb-3">Détails de l'erreur</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-red-800">URL demandée:</span>{' '}
                <span className="text-red-700 break-all">{migration.legacy_url}</span>
              </div>
              {migration.error && (
                <div>
                  <span className="font-medium text-red-800">Erreur:</span>{' '}
                  <span className="text-red-700">{migration.error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions alternatives */}
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            >
              Retour à l'accueil
            </Link>
            
            <div className="text-sm text-gray-500">
              Ou utilisez notre sélecteur de véhicule pour trouver les pièces que vous cherchez
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================
// 🔧 SCRIPT REDIRECTION CÔTÉ CLIENT
// ====================================

// Script injecté pour redirection automatique en JavaScript (fallback)
export function redirectScript(newUrl: string, seconds: number) {
  return `
    <script>
      (function() {
        let countdown = ${seconds};
        const updateCountdown = () => {
          const element = document.querySelector('[data-countdown]');
          if (element) {
            element.textContent = countdown;
          }
          countdown--;
          if (countdown < 0) {
            window.location.href = '${newUrl}';
          }
        };
        
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        
        // Nettoyage
        setTimeout(() => {
          clearInterval(interval);
        }, ${seconds * 1000 + 100});
      })();
    </script>
  `;
}