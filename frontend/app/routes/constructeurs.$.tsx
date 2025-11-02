// 🔄 Route catch-all pour gérer les anciennes URLs avec IDs

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const catchAll = params["*"];
  
  console.log('[LegacyCatchAll] URL:', request.url, 'CatchAll:', catchAll);
  
  if (!catchAll) {
    throw new Response("Not Found", { status: 404 });
  }

  // Pattern legacy : brand-ID/model-ID.html
  // Exemple: audi-22/80-break-22016.html
  const legacyMatch = catchAll.match(/^([a-z0-9-]+)-(\d+)\/([a-z0-9-]+)-(\d+)\.html$/i);
  
  if (legacyMatch) {
    const [, brandSlug, brandId, modelSlug, typeId] = legacyMatch;
    
    console.log('[LegacyCatchAll] Legacy URL detected:', {
      brandSlug,
      brandId,
      modelSlug,
      typeId,
    });
    
    // Appeler l'API backend pour résoudre les alias
    try {
      const apiUrl = new URL(request.url);
      const baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
      
      const response = await fetch(
        `${baseUrl}/api/vehicles/${typeId}`,
        { 
          headers: { 
            'User-Agent': 'RemixSSR',
            'Accept': 'application/json',
          } 
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('[LegacyCatchAll] Vehicle found:', data);
        
        // Construire la nouvelle URL avec les alias
        const newUrl = `/constructeurs/${data.marque_alias}/${data.modele_alias}/${data.type_alias}`;
        
        console.log('[LegacyCatchAll] Redirecting to:', newUrl);
        
        // Redirection 301 permanente
        return redirect(newUrl, { status: 301 });
      }
      
      // Véhicule supprimé/introuvable → 410 Gone
      if (response.status === 404 || response.status === 410) {
        console.log('[LegacyCatchAll] Vehicle gone, type_id:', typeId);
        
        throw new Response(
          JSON.stringify({
            error: 'Vehicle No Longer Available',
            message: 'Ce véhicule n\'est plus disponible dans notre catalogue',
            type_id: typeId,
            code: 'VEHICLE_GONE'
          }),
          {
            status: 410,
            statusText: "Gone",
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      console.error('[LegacyCatchAll] Unexpected API response:', response.status);
    } catch (error) {
      console.error('[LegacyCatchAll] Error:', error);
      
      // En cas d'erreur, retourner 404 plutôt que crash
      throw new Response("Vehicle data unavailable", { status: 404 });
    }
  }

  // Autres patterns legacy possibles
  // Pattern : brand-ID.html (page marque)
  const brandLegacyMatch = catchAll.match(/^([a-z0-9-]+)-(\d+)\.html$/i);
  if (brandLegacyMatch) {
    const [, brandSlug, brandId] = brandLegacyMatch;
    console.log('[LegacyCatchAll] Legacy brand URL:', brandSlug, brandId);
    
    // Rediriger vers la page marque sans ID
    return redirect(`/constructeurs/${brandSlug}`, { status: 301 });
  }

  // URLs inconnues → 404
  console.log('[LegacyCatchAll] Unknown pattern, returning 404');
  throw new Response("Not Found", { status: 404 });
}

// Ce component ne sera jamais rendu (redirection ou erreur)
export default function LegacyCatchAll() {
  return null;
}

// Gestion des erreurs
export function ErrorBoundary() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center p-6">
        <div className="text-6xl mb-4">🚗</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Véhicule introuvable
        </h1>
        <p className="text-gray-600 mb-6">
          Ce véhicule n'est plus disponible dans notre catalogue.
        </p>
        <a
          href="/constructeurs"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Voir tous les constructeurs
        </a>
      </div>
    </div>
  );
}
