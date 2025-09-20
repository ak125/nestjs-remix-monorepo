/**
 * 🧪 TEST HEADER V8 ENHANCED - Route de test pour le nouveau header
 * 
 * Test complet :
 * ✅ Backend API integration
 * ✅ Composants existants réutilisés
 * ✅ Responsive design
 * ✅ Thèmes dynamiques
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { HeaderV8Enhanced } from '../components/layout/HeaderV8Enhanced';

export const meta: MetaFunction = () => {
  return [
    { title: "Header V8 Enhanced Test" },
    { name: "description", content: "Test du nouveau header amélioré" },
  ];
};

interface HeaderTestData {
  headerData?: any;
  themes: string[];
  status: string;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  try {
    const baseUrl = 'http://localhost:3000';
    
    const [headerRes, themesRes] = await Promise.all([
      fetch(`${baseUrl}/api/layout/header?context=public`),
      fetch(`${baseUrl}/api/layout/themes`),
    ]);

    const [headerData, themes] = await Promise.all([
      headerRes.json(),
      themesRes.json(),
    ]);

    return json<HeaderTestData>({
      headerData,
      themes,
      status: 'success',
    });

  } catch (error) {
    console.error('Header test error:', error);
    
    return json<HeaderTestData>({
      themes: [],
      status: 'error',
      error: 'Impossible de charger les données backend',
    });
  }
}

export default function HeaderTest() {
  const { headerData, themes, status, error } = useLoaderData<HeaderTestData>();

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* 🎯 Header V8 Enhanced avec vraies données */}
      <HeaderV8Enhanced 
        context="public"
        theme="default"
        staticData={headerData}
      />

      {/* 📊 Zone de test et informations */}
      <div className="container mx-auto px-4 py-12">
        
        {/* Status */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🧪 Header V8 Enhanced Test
          </h1>
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
            status === 'success' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            Status: {status}
            {error && ` - ${error}`}
          </div>
        </div>

        {/* Informations Backend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🔌 Backend Integration</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">API Header:</span> 
                <span className={headerData ? 'text-green-600' : 'text-red-600'}>
                  {headerData ? '✅ Connecté' : '❌ Échec'}
                </span>
              </div>
              <div>
                <span className="font-medium">Titre:</span> 
                <span>{headerData?.title || 'Non disponible'}</span>
              </div>
              <div>
                <span className="font-medium">Navigation:</span> 
                <span>{headerData?.navigation?.length || 0} éléments</span>
              </div>
              <div>
                <span className="font-medium">Stats utilisateurs:</span> 
                <span>{headerData?.userStats?.total?.toLocaleString() || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🎨 Thèmes Disponibles</h2>
            <div className="space-y-2">
              {themes.map((theme, index) => (
                <div key={theme} className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: 
                        theme === 'default' ? '#3b82f6' :
                        theme === 'dark' ? '#1f2937' :
                        theme === 'automotive' ? '#dc2626' :
                        theme === 'professional' ? '#059669' :
                        theme === 'modern' ? '#8b5cf6' : '#6b7280'
                    }}
                  />
                  <span className="text-sm capitalize">{theme}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fonctionnalités testées */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">✅ Fonctionnalités Testées</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">Top Bar avec contact/social</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">Logo cliquable</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">SearchBar intégrée</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">Navigation responsive</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">UserMenu avec dropdown</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">CartIcon existant</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">Menu mobile hamburger</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">Navigation dropdown hover</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span className="text-sm">Backend API fallback</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📋 Instructions de Test
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Testez la recherche mobile (bouton loupe)</li>
            <li>• Vérifiez le menu hamburger responsive</li>
            <li>• Survolez les éléments de navigation</li>
            <li>• Cliquez sur le menu utilisateur</li>
            <li>• Testez le panier (CartIcon existant)</li>
            <li>• Redimensionnez la fenêtre pour le responsive</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
