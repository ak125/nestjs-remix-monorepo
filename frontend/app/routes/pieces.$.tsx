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

import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { AlertTriangle, ArrowRight, Clock, ExternalLink } from "lucide-react";

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

/**
 * Effectue une redirection 301 si la migration est possible
 */
async function performRedirection(legacyUrl: string): Promise<Response | null> {
  const migration = await testUrlMigration(legacyUrl);
  
  if (migration.success && migration.new_url) {
    // Redirection 301 permanente pour le SEO
    return redirect(migration.new_url, { status: 301 });
  }
  
  return null;
}

// ====================================
// 📡 LOADER FUNCTION
// ====================================

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const legacyUrl = url.pathname;
  
  console.log(`🔄 Interception URL legacy: ${legacyUrl}`);
  
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
  if (!data || !data.migration.success) {
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
  const { migration, redirect_in_seconds, show_manual_redirect } = useLoaderData<typeof loader>();

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