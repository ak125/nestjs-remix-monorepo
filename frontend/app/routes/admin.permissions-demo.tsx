// app/routes/admin.permissions-demo.tsx
// Exemple d'utilisation du système de permissions optimisé
// Démontre l'approche "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Shield, CheckCircle, XCircle, Users, Settings } from 'lucide-react';
import { 
  checkModuleAccess, 
  checkMultipleModuleAccess,
  requireModuleAccess,
  getUserModulePermissions 
} from '../services/permissions.server';

// Interface pour les données du loader
interface LoaderData {
  userPermissions: Record<string, { read: boolean; write: boolean }>;
  bulkCheck: Record<string, boolean>;
  hasAdminAccess: boolean;
  currentUserId: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Vérification automatique de l'accès requis
  await requireModuleAccess(request, 'admin', 'read');
  
  // Simuler un ID utilisateur (en production, extraire de la session)
  const currentUserId = '123'; // await getUserIdFromRequest(request)

  try {
    // 1. Vérification simple d'un module
    const hasAdminAccess = await checkModuleAccess(currentUserId, 'admin', 'write');

    // 2. Vérification en lot (optimisé - une seule requête API)
    const bulkCheck = await checkMultipleModuleAccess(currentUserId, [
      { module: 'commercial', action: 'read' },
      { module: 'seo', action: 'write' },
      { module: 'expedition', action: 'read' },
      { module: 'finance', action: 'read' },
    ]);

    // 3. Récupération complète des permissions (avec cache)
    const userPermissions = await getUserModulePermissions(currentUserId);

    return json<LoaderData>({
      userPermissions,
      bulkCheck,
      hasAdminAccess,
      currentUserId,
    });

  } catch (error) {
    console.error('Error in permissions demo loader:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
}

export default function PermissionsDemo() {
  const { userPermissions, bulkCheck, hasAdminAccess, currentUserId } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Démo - Système de Permissions Optimisé
              </h1>
              <p className="text-gray-600 mt-1">
                Utilisation du backend NestJS existant (approche "vérifier existant et utiliser le meilleur")
              </p>
            </div>
          </div>
          
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Utilisateur: {currentUserId}</div>
            <div className="text-xs text-blue-500">
              Admin: {hasAdminAccess ? 'Oui' : 'Non'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Permissions complètes par module */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Permissions par Module
            </h2>
            
            <div className="space-y-3">
              {Object.entries(userPermissions).map(([module, permissions]) => (
                <div key={module} className="bg-white p-4 rounded border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 capitalize">{module}</h3>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      {permissions.read ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm text-gray-600">Lecture</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {permissions.write ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm text-gray-600">Écriture</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vérifications en lot */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Vérifications Optimisées (Bulk Check)
            </h2>
            
            <div className="space-y-3">
              {Object.entries(bulkCheck).map(([key, hasAccess]) => {
                const [module, action] = key.split(':');
                return (
                  <div key={key} className="bg-white p-4 rounded border flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900 capitalize">{module}</span>
                      <span className="text-sm text-gray-500 ml-2">({action})</span>
                    </div>
                    
                    {hasAccess ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Autorisé</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Refusé</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Avantages de cette approche */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            ✅ Avantages de cette approche optimisée
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-gray-800">Performance</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Utilise Redis pour cache haute performance</li>
                <li>• Requêtes groupées avec Promise.all</li>
                <li>• API backend NestJS optimisée</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-gray-800">Architecture</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Réutilise le système auth existant</li>
                <li>• Centralisé dans le backend NestJS</li>
                <li>• Meilleur que Supabase direct</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Code exemple */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            💡 Utilisation dans vos routes
          </h2>
          
          <pre className="text-sm text-gray-300 overflow-x-auto">
{`// Dans votre loader Remix
export async function loader({ request }: LoaderFunctionArgs) {
  // Vérification automatique + logging
  await requireModuleAccess(request, 'admin', 'read');
  
  // Vérification simple
  const canEdit = await checkModuleAccess(userId, 'admin', 'write');
  
  // Vérifications multiples optimisées
  const permissions = await checkMultipleModuleAccess(userId, [
    { module: 'commercial', action: 'read' },
    { module: 'admin', action: 'write' }
  ]);
  
  return json({ canEdit, permissions });
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
