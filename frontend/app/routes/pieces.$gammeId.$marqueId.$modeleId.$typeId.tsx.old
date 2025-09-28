import { redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';

// ========================================
// 🔄 ROUTE DE REDIRECTION TEMPORAIRE
// Cette route redirige le format IDs vers le format HTML SEO-friendly
// ========================================

export async function loader({ params }: LoaderFunctionArgs) {
  const { gammeId, marqueId, modeleId, typeId } = params;
  
  console.log('🔄 Redirection de format IDs vers format HTML:', {
    gammeId, marqueId, modeleId, typeId
  });
  
  // TODO: Implémenter la récupération des alias depuis la DB
  // Pour construire l'URL SEO-friendly finale
  
  // En attendant, redirection vers l'accueil avec message
  const redirectUrl = `/?message=route-migration&ids=${gammeId}-${marqueId}-${modeleId}-${typeId}`;
  
  throw redirect(redirectUrl, { status: 302 });
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Redirection en cours...' },
    { name: 'robots', content: 'noindex' }
  ];
};

export default function RedirectRoute() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirection en cours...</p>
      </div>
    </div>
  );
}