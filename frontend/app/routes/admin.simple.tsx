import { type LoaderFunction, type ActionFunction, type MetaFunction , json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/server/auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Admin Simple - AutoParts" },
    { name: "description", content: "Page admin simple pour tests" },
  ];
};

// Action Context7 - Gestion résiliente des requêtes POST
export const action: ActionFunction = async ({ request, context }) => {
  console.log('🎯 Action admin.simple - POST request received');
  
  try {
    // Vérifier l'authentification utilisateur avec Context7 patterns
    const user = await requireUser({ context }).catch((error) => {
      console.error('❌ Erreur authentification dans action:', error);
      return null;
    });

    if (!user) {
      console.log('🔒 Utilisateur non authentifié - redirection vers login');
      return redirect('/auth/login');
    }

    // Vérifier les permissions admin (niveau >= 7)
    const userLevel = parseInt(user.level) || 0;
    if (userLevel < 7) {
      console.log(`🚫 Permissions insuffisantes - niveau ${userLevel} < 7`);
      throw new Response("Accès non autorisé - permissions administrateur requises", { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Récupérer les données du formulaire
    const formData = await request.formData();
    const action = formData.get('_action');

    console.log(`📋 Action reçue: ${action}`);

    // Gestion des différentes actions possibles
    switch (action) {
      case 'logout':
        console.log('👋 Action logout - redirection vers /auth/logout');
        return redirect('/auth/logout');
        
      case 'refresh':
        console.log('🔄 Action refresh - rechargement de la page');
        return redirect('/admin/simple');
        
      case 'navigate':
        const destination = formData.get('destination');
        console.log(`🧭 Navigation vers: ${destination}`);
        if (destination && typeof destination === 'string') {
          return redirect(destination);
        }
        return redirect('/admin/simple');
        
      default:
        console.log(`⚠️ Action inconnue: ${action} - redirection par défaut`);
        return redirect('/admin/simple');
    }

  } catch (error) {
    console.error('💥 Erreur dans action admin.simple:', error);
    
    // Context7 resilience - retourner une réponse d'erreur gracieuse
    if (error instanceof Response) {
      return error;
    }
    
    return json(
      { 
        error: 'Erreur serveur lors du traitement de la requête',
        timestamp: new Date().toISOString(),
        code: 'ACTION_ERROR'
      }, 
      { status: 500 }
    );
  }
};

// Loader Context7 - Chargement résilient des données
export const loader: LoaderFunction = async ({ request, context }) => {
  console.log('📖 Loader admin.simple - GET request received');
  
  try {
    // Authentification avec gestion d'erreur Context7
    const user = await requireUser({ context }).catch((error) => {
      console.error('❌ Erreur authentification dans loader:', error);
      throw new Response("Session expirée - reconnexion requise", { 
        status: 401,
        headers: { 'Content-Type': 'text/plain' }
      });
    });
    
    // Vérifier les permissions admin (niveau >= 7)
    const userLevel = parseInt(user.level) || 0;
    if (userLevel < 7) {
      console.log(`🚫 Permissions insuffisantes - niveau ${userLevel} < 7`);
      throw new Response("Accès non autorisé - permissions administrateur requises", { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    console.log(`✅ Utilisateur admin authentifié: ${user.email} (niveau ${userLevel})`);

    // Retourner les données avec informations Context7
    return json({
      user,
      timestamp: new Date().toISOString(),
      message: "Dashboard admin simple - services complexes désactivés temporairement",
      context7: {
        serviceStatus: "resilient_mode",
        fallbacksActive: true,
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 Erreur dans loader admin.simple:', error);
    
    // Si c'est déjà une Response (erreur HTTP), la retourner
    if (error instanceof Response) {
      throw error;
    }
    
    // Sinon, créer une réponse d'erreur générique
    throw new Response("Erreur serveur lors du chargement de la page admin", { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

export default function AdminSimple() {
  const { user, timestamp, message, context7 } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Dashboard Admin - Test
                </h1>
                {context7?.serviceStatus === 'resilient_mode' && (
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Mode Résilient Context7
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  Connecté en tant que: {user.firstName} {user.lastName}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Niveau {user.level}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Informations de session
              </h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ID Utilisateur</dt>
                    <dd className="text-sm text-gray-900">{user.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="text-sm text-gray-900">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nom complet</dt>
                    <dd className="text-sm text-gray-900">{user.firstName} {user.lastName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Niveau d'administration</dt>
                    <dd className="text-sm text-gray-900">{user.level}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Admin</dt>
                    <dd className="text-sm text-gray-900">{user.isAdmin ? 'Oui' : 'Non'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Timestamp</dt>
                    <dd className="text-sm text-gray-900">{timestamp}</dd>
                  </div>
                  {context7 && (
                    <>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status Context7</dt>
                        <dd className="text-sm text-gray-900">{context7.serviceStatus}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Fallbacks Actifs</dt>
                        <dd className="text-sm text-gray-900">{context7.fallbacksActive ? 'Oui' : 'Non'}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Message de statut
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">{message}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Actions rapides
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <a 
                  href="/admin/users" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Gérer les utilisateurs
                </a>
                <a 
                  href="/admin/orders" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Voir les commandes
                </a>
                <a 
                  href="/auth/logout" 
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Se déconnecter
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Navigation admin
              </h3>
              <nav className="space-y-2">
                <a href="/admin" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                  Dashboard principal
                </a>
                <a href="/admin/users" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                  Gestion des utilisateurs
                </a>
                <a href="/admin/orders" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                  Gestion des commandes
                </a>
                <a href="/admin/payments" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                  Gestion des paiements
                </a>
                <a href="/admin/reports" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                  Rapports
                </a>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
