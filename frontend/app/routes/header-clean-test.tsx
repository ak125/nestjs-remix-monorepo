/**
 * 🧪 TEST HEADER - Test du composant Header unifié
 * 
 * Test des 3 variantes :
 * ✅ default - Header complet avec top bar
 * ✅ simple - Header simplifié 
 * ✅ minimal - Header minimaliste
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Header } from '../components/layout/Header';

export const meta: MetaFunction = () => {
  return [
    { title: "Header Test - Composant unifié" },
    { name: "description", content: "Test du composant Header avec variantes" },
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
      
      <div className="space-y-8">
        
        {/* 🎯 Header Default (complet) */}
        <div>
          <div className="bg-blue-50 p-4 text-center">
            <h2 className="text-lg font-semibold">Header Default (complet)</h2>
            <p className="text-sm text-gray-600">Top bar + recherche + navigation complète</p>
          </div>
          <Header 
            context="public"
            variant="default"
            theme="default"
            staticData={headerData}
          />
        </div>

        {/* 🎯 Header Simple */}
        <div>
          <div className="bg-green-50 p-4 text-center">
            <h2 className="text-lg font-semibold">Header Simple</h2>
            <p className="text-sm text-gray-600">Pas de top bar, navigation réduite</p>
          </div>
          <Header 
            context="public"
            variant="simple"
            theme="default"
            staticData={headerData}
          />
        </div>

        {/* 🎯 Header Minimal */}
        <div>
          <div className="bg-yellow-50 p-4 text-center">
            <h2 className="text-lg font-semibold">Header Minimal</h2>
            <p className="text-sm text-gray-600">Juste logo + panier</p>
          </div>
          <Header 
            context="public"
            variant="minimal"
            theme="default"
            staticData={headerData}
          />
        </div>

      </div>

      {/* 📊 Zone d'informations */}
      <div className="container mx-auto px-4 py-12">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🧪 Header Component Test
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

        {/* Informations techniques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">🔌 Backend</h3>
            <div className="space-y-2 text-sm">
              <div>API: <span className={headerData ? 'text-green-600' : 'text-red-600'}>
                {headerData ? '✅ OK' : '❌ Erreur'}
              </span></div>
              <div>Utilisateurs: <span>{headerData?.userStats?.total?.toLocaleString() || 'N/A'}</span></div>
              <div>Navigation: <span>{headerData?.navigation?.length || 0} items</span></div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">🎨 Variantes</h3>
            <div className="space-y-2 text-sm">
              <div>✅ Default - Complet</div>
              <div>✅ Simple - Réduit</div>
              <div>✅ Minimal - Basique</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">🎨 Thèmes</h3>
            <div className="space-y-1">
              {themes.map((theme) => (
                <div key={theme} className="text-sm flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="capitalize">{theme}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cas d'usage */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">📋 Cas d'usage recommandés</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div>
              <h4 className="font-medium text-blue-600 mb-2">Header Default</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Site e-commerce principal</li>
                <li>• Pages publiques avec recherche</li>
                <li>• Navigation complète requise</li>
                <li>• Contact et social importants</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-green-600 mb-2">Header Simple</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Pages de contenu</li>
                <li>• Landing pages</li>
                <li>• Interfaces administratives</li>
                <li>• Applications internes</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-yellow-600 mb-2">Header Minimal</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Pages de checkout</li>
                <li>• Processus de commande</li>
                <li>• Pages de connexion</li>
                <li>• Interfaces mobiles simples</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
