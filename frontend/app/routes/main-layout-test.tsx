/**
 * 🧪 MAIN LAYOUT TEST - Test du composant MainLayout
 * 
 * Route de test pour valider le composant MainLayout avec :
 * ✅ Integration backend API
 * ✅ Multi-versions support
 * ✅ Responsive design
 * ✅ Widgets dynamiques
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { MainLayout, type LayoutData } from '../components/layout/MainLayout';

export const meta: MetaFunction = () => {
  return [
    { title: "MainLayout Test - Composant unifié" },
    { name: "description", content: "Test du composant MainLayout avec backend integration" },
  ];
};

interface MainLayoutTestData {
  layoutData: LayoutData;
  status: 'success' | 'error';
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const context = url.searchParams.get('context') as 'admin' | 'commercial' | 'public' || 'public';
    const version = url.searchParams.get('version') || 'v8';

    // Récupération des données layout depuis l'API backend
    const baseUrl = 'http://localhost:3000';
    const layoutRes = await fetch(`${baseUrl}/api/layout?context=${context}`);
    
    if (!layoutRes.ok) {
      throw new Error('Erreur API Layout');
    }

    const layoutApiData = await layoutRes.json();

    // Construction des données layout compatibles avec MainLayout
    const layoutData: LayoutData = {
      type: context,
      version,
      theme: 'default',
      header: {
        title: layoutApiData.header?.title || 'MainLayout Test',
        logo: {
          url: '/logo.svg',
          alt: 'Logo',
          link: '/',
        },
        navigation: layoutApiData.navigation || [
          { label: 'Accueil', href: '/' },
          { label: 'Produits', href: '/products' },
          { label: 'Contact', href: '/contact' },
        ],
        userStats: layoutApiData.header?.userStats,
        quickSearch: {
          enabled: true,
          config: {
            enabled: true,
            placeholder: 'Rechercher...',
            modules: ['products', 'orders'],
          },
        },
      },
      footer: {
        company: {
          name: 'Mon Entreprise',
          address: '123 Rue Example, 75001 Paris',
          phone: '+33 1 23 45 67 89',
          email: 'contact@example.com',
        },
        links: [
          {
            title: 'Produits',
            items: [
              { label: 'Catalogue', url: '/products' },
              { label: 'Nouveautés', url: '/products?new=true' },
            ],
          },
          {
            title: 'Support',
            items: [
              { label: 'Contact', url: '/contact' },
              { label: 'FAQ', url: '/faq' },
            ],
          },
        ],
        copyright: `© ${new Date().getFullYear()} - MainLayout Test`,
        showNewsletter: true,
      },
      navigation: layoutApiData.navigation || [],
      widgets: [
        {
          widget_key: 'top-banner',
          widget_type: 'banner',
          title: 'Widget Banner',
          content: {
            html: '<div class="bg-blue-100 p-4 text-center">Widget de test en haut de page</div>',
          },
          position: 'top',
        },
        {
          widget_key: 'bottom-info',
          widget_type: 'info',
          title: 'Information',
          content: {
            html: '<div class="bg-gray-100 p-4 text-center">Widget de test en bas de page</div>',
          },
          position: 'bottom',
        },
      ],
      scripts: [
        {
          src: '/js/layout-analytics.js',
          async: true,
        },
      ],
      styles: [
        {
          href: '/css/layout-theme.css',
          media: 'all',
        },
      ],
      config: {
        showHeader: true,
        showFooter: true,
        showSidebar: context !== 'public',
        showQuickSearch: true,
        enableNotifications: true,
        enableThemeSwitcher: false,
      },
    };

    return json<MainLayoutTestData>({
      layoutData,
      status: 'success',
    });

  } catch (error) {
    console.error('Erreur MainLayout test:', error);
    
    // Données de fallback
    const fallbackLayoutData: LayoutData = {
      type: 'public',
      version: 'v8',
      theme: 'default',
      header: {
        title: 'MainLayout Test (Fallback)',
        logo: {
          url: '/logo.svg',
          alt: 'Logo',
        },
        navigation: [
          { label: 'Accueil', href: '/' },
        ],
      },
      footer: {
        company: {
          name: 'Fallback Mode',
        },
        links: [],
        copyright: '© 2025 - Fallback',
      },
      navigation: [],
      config: {
        showHeader: true,
        showFooter: true,
        showSidebar: false,
        showQuickSearch: false,
        enableNotifications: false,
        enableThemeSwitcher: false,
      },
    };

    return json<MainLayoutTestData>({
      layoutData: fallbackLayoutData,
      status: 'error',
    });
  }
}

export default function MainLayoutTest() {
  const { layoutData, status } = useLoaderData<MainLayoutTestData>();

  return (
    <MainLayout layoutData={layoutData} version={layoutData.version}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              🏗️ MainLayout Component Test
            </h1>
            
            <div className={`p-4 rounded-lg mb-6 ${
              status === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`font-medium ${
                status === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                Status: {status === 'success' ? '✅ Succès' : '❌ Erreur (mode fallback)'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-blue-900 mb-4">
                  📊 Configuration Layout
                </h2>
                <ul className="space-y-2 text-blue-800">
                  <li><strong>Type:</strong> {layoutData.type}</li>
                  <li><strong>Version:</strong> {layoutData.version}</li>
                  <li><strong>Thème:</strong> {layoutData.theme}</li>
                  <li><strong>Header:</strong> {layoutData.config?.showHeader ? '✅' : '❌'}</li>
                  <li><strong>Footer:</strong> {layoutData.config?.showFooter ? '✅' : '❌'}</li>
                  <li><strong>Sidebar:</strong> {layoutData.config?.showSidebar ? '✅' : '❌'}</li>
                </ul>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-green-900 mb-4">
                  🧩 Composants Actifs
                </h2>
                <ul className="space-y-2 text-green-800">
                  <li><strong>Recherche:</strong> {layoutData.config?.showQuickSearch ? '✅' : '❌'}</li>
                  <li><strong>Notifications:</strong> {layoutData.config?.enableNotifications ? '✅' : '❌'}</li>
                  <li><strong>Widgets:</strong> {layoutData.widgets?.length || 0}</li>
                  <li><strong>Scripts:</strong> {layoutData.scripts?.length || 0}</li>
                  <li><strong>Styles:</strong> {layoutData.styles?.length || 0}</li>
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                🎯 Fonctionnalités Testées
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-medium text-gray-900 mb-2">Backend Integration</h3>
                  <p className="text-sm text-gray-600">Connexion API Layout</p>
                </div>
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-medium text-gray-900 mb-2">Responsive Design</h3>
                  <p className="text-sm text-gray-600">Mobile + Desktop</p>
                </div>
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-medium text-gray-900 mb-2">Widget System</h3>
                  <p className="text-sm text-gray-600">Dynamique et flexible</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="flex flex-wrap justify-center gap-4">
                <a 
                  href="/main-layout-test?context=admin&version=v8" 
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Test Admin
                </a>
                <a 
                  href="/main-layout-test?context=commercial&version=v8" 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Test Commercial
                </a>
                <a 
                  href="/main-layout-test?context=public&version=v8" 
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Test Public
                </a>
                <a 
                  href="/main-layout-test?context=public&version=v7" 
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Test V7
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
