/**
 * 🎪 HEADER SHOWCASE - Démonstration complète de tous les headers
 * 
 * Présente tous les variants et composants spécialisés
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { 
  Header, 
  AdminHeader, 
  EcommerceHeader, 
  CheckoutHeader 
} from '../components/layout';

export const meta: MetaFunction = () => {
  return [
    { title: "Header Showcase - Tous les variants" },
    { name: "description", content: "Démonstration complète du système Header" },
  ];
};

interface ShowcaseData {
  headerData?: any;
  themes: string[];
  status: string;
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

    return json<ShowcaseData>({
      headerData,
      themes,
      status: 'success',
    });

  } catch (error) {
    return json<ShowcaseData>({
      themes: [],
      status: 'error',
    });
  }
}

export default function HeaderShowcase() {
  const { headerData, themes, status } = useLoaderData<ShowcaseData>();

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* 🎯 Navigation entre les exemples */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">🎪 Header Showcase</h1>
            <div className="flex items-center space-x-4 text-sm">
              <a href="#default" className="text-blue-600 hover:underline">Default</a>
              <a href="#simple" className="text-blue-600 hover:underline">Simple</a>
              <a href="#minimal" className="text-blue-600 hover:underline">Minimal</a>
              <a href="#admin" className="text-blue-600 hover:underline">Admin</a>
              <a href="#ecommerce" className="text-blue-600 hover:underline">E-commerce</a>
              <a href="#checkout" className="text-blue-600 hover:underline">Checkout</a>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-12 py-8">
        
        {/* 🎯 Header Default */}
        <section id="default">
          <div className="container mx-auto px-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-2">Header Default</h2>
              <p className="text-blue-700 mb-4">Header complet avec top bar, recherche et navigation complète</p>
              <div className="text-sm text-blue-600">
                <code>{'<Header variant="default" context="public" />'}</code>
              </div>
            </div>
          </div>
          <Header 
            context="public"
            variant="default"
            staticData={headerData}
          />
        </section>

        {/* 🎯 Header Simple */}
        <section id="simple">
          <div className="container mx-auto px-4 mb-4">
            <div className="bg-green-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-green-900 mb-2">Header Simple</h2>
              <p className="text-green-700 mb-4">Header sans top bar, navigation réduite</p>
              <div className="text-sm text-green-600">
                <code>{'<Header variant="simple" context="public" />'}</code>
              </div>
            </div>
          </div>
          <Header 
            context="public"
            variant="simple"
            staticData={headerData}
          />
        </section>

        {/* 🎯 Header Minimal */}
        <section id="minimal">
          <div className="container mx-auto px-4 mb-4">
            <div className="bg-yellow-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-yellow-900 mb-2">Header Minimal</h2>
              <p className="text-yellow-700 mb-4">Juste logo et panier, parfait pour checkout</p>
              <div className="text-sm text-yellow-600">
                <code>{'<Header variant="minimal" context="public" />'}</code>
              </div>
            </div>
          </div>
          <Header 
            context="public"
            variant="minimal"
            staticData={headerData}
          />
        </section>

        {/* 🎯 Admin Header */}
        <section id="admin">
          <div className="container mx-auto px-4 mb-4">
            <div className="bg-purple-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-purple-900 mb-2">Admin Header</h2>
              <p className="text-purple-700 mb-4">Header spécialisé pour interface d'administration</p>
              <div className="text-sm text-purple-600">
                <code>{'<AdminHeader />'}</code>
              </div>
            </div>
          </div>
          <AdminHeader />
        </section>

        {/* 🎯 E-commerce Header */}
        <section id="ecommerce">
          <div className="container mx-auto px-4 mb-4">
            <div className="bg-red-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-red-900 mb-2">E-commerce Header</h2>
              <p className="text-red-700 mb-4">Header optimisé pour site e-commerce</p>
              <div className="text-sm text-red-600">
                <code>{'<EcommerceHeader showTopBar={true} />'}</code>
              </div>
            </div>
          </div>
          <EcommerceHeader showTopBar={true} />
        </section>

        {/* 🎯 Checkout Header */}
        <section id="checkout">
          <div className="container mx-auto px-4 mb-4">
            <div className="bg-indigo-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-indigo-900 mb-2">Checkout Header</h2>
              <p className="text-indigo-700 mb-4">Header minimal avec barre de progression</p>
              <div className="text-sm text-indigo-600">
                <code>{'<CheckoutHeader step="Panier" showProgress={true} />'}</code>
              </div>
            </div>
          </div>
          <CheckoutHeader step="Panier" showProgress={true} />
        </section>

      </div>

      {/* 📊 Informations techniques */}
      <div className="container mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Informations Techniques</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">🔌 Backend Integration</h3>
              <div className="space-y-2 text-sm">
                <div>Status: <span className={status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {status === 'success' ? '✅ OK' : '❌ Erreur'}
                </span></div>
                <div>API Header: <span>{headerData?.title || 'N/A'}</span></div>
                <div>Utilisateurs: <span>{headerData?.userStats?.total?.toLocaleString() || 'N/A'}</span></div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-3">🎨 Thèmes Disponibles</h3>
              <div className="space-y-1">
                {themes.map((theme) => (
                  <div key={theme} className="text-sm flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="capitalize">{theme}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-3">🧩 Composants</h3>
              <div className="text-sm space-y-1">
                <div>✅ Header (principal)</div>
                <div>✅ AdminHeader</div>
                <div>✅ EcommerceHeader</div>
                <div>✅ CheckoutHeader</div>
                <div>✅ SearchBar intégré</div>
                <div>✅ CartIcon existant</div>
                <div>✅ UserMenu dropdown</div>
              </div>
            </div>
          </div>

          {/* Guide d'utilisation */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">📖 Guide d'utilisation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              
              <div>
                <h4 className="font-medium text-blue-600 mb-2">Import</h4>
                <code className="block bg-white p-2 rounded text-xs">
                  {`import { Header, AdminHeader, EcommerceHeader } from '~/components/layout';`}
                </code>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-600 mb-2">Usage basique</h4>
                <code className="block bg-white p-2 rounded text-xs">
                  {`<Header variant="default" context="public" />`}
                </code>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-600 mb-2">Avec thème</h4>
                <code className="block bg-white p-2 rounded text-xs">
                  {`<Header variant="simple" theme="dark" />`}
                </code>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-600 mb-2">Header spécialisé</h4>
                <code className="block bg-white p-2 rounded text-xs">
                  {`<CheckoutHeader step="Livraison" />`}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
