/**
 * 🧪 FOOTER TEST - Démonstration des variantes Footer
 * 
 * Test des 3 variantes FooterEnhanced :
 * ✅ complete - Footer complet avec newsletter et social
 * ✅ simple - Footer simplifié
 * ✅ minimal - Footer basique
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { FooterEnhanced } from '../components/layout/FooterEnhanced';

export const meta: MetaFunction = () => {
  return [
    { title: "Footer Test - Variantes Enhanced" },
    { name: "description", content: "Test du FooterEnhanced avec toutes les variantes" },
  ];
};

interface FooterTestData {
  footerData?: any;
  status: string;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  try {
    const baseUrl = 'http://localhost:3000';
    
    const footerRes = await fetch(`${baseUrl}/api/layout/footer?context=public`);
    const footerData = await footerRes.json();

    return json<FooterTestData>({
      footerData,
      status: 'success',
    });

  } catch (error) {
    console.error('Footer test error:', error);
    
    return json<FooterTestData>({
      status: 'error',
      error: 'Impossible de charger les données backend',
    });
  }
}

export default function FooterTest() {
  const { footerData, status, error } = useLoaderData<FooterTestData>();

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* 📊 Header d'information */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Footer Enhanced Test
          </h1>
          <p className="text-gray-600 mb-4">
            Démonstration des 3 variantes FooterEnhanced avec backend integration
          </p>
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
            status === 'success' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            Backend Status: {status}
            {error && ` - ${error}`}
          </div>
        </div>
      </div>

      {/* Contenu principal simulé */}
      <div className="container mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contenu de la page</h2>
          <p className="text-gray-600 mb-4">
            Cette section simule le contenu principal d'une page. 
            Les footers sont affichés ci-dessous pour démonstration.
          </p>
          
          {/* Informations backend */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📊 Données Backend Footer</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Entreprise:</span>
                <br />
                {footerData?.company?.name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Sections liens:</span>
                <br />
                {footerData?.links?.length || 0} sections
              </div>
              <div>
                <span className="font-medium">Réseaux sociaux:</span>
                <br />
                {footerData?.social?.length || 0} plateformes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 Tests des variantes Footer */}
      <div className="space-y-12">
        
        {/* Footer Complete */}
        <section>
          <div className="bg-indigo-50 py-6">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-2xl font-bold text-indigo-900 mb-2">Footer Complete</h2>
              <p className="text-indigo-700 mb-2">Footer complet avec toutes les fonctionnalités</p>
              <code className="text-sm bg-indigo-100 px-3 py-1 rounded">
                {'<FooterEnhanced variant="complete" showNewsletter={true} showSocial={true} />'}
              </code>
            </div>
          </div>
          <FooterEnhanced 
            variant="complete"
            context="public"
            staticData={footerData}
            showNewsletter={true}
            showSocial={true}
          />
        </section>

        {/* Spacer */}
        <div className="h-16 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-500 text-sm">--- Changement de variante ---</span>
        </div>

        {/* Footer Simple */}
        <section>
          <div className="bg-green-50 py-6">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-2xl font-bold text-green-900 mb-2">Footer Simple</h2>
              <p className="text-green-700 mb-2">Footer simplifié sans newsletter</p>
              <code className="text-sm bg-green-100 px-3 py-1 rounded">
                {'<FooterEnhanced variant="simple" showSocial={true} />'}
              </code>
            </div>
          </div>
          <FooterEnhanced 
            variant="simple"
            context="public"
            staticData={footerData}
            showNewsletter={false}
            showSocial={true}
          />
        </section>

        {/* Spacer */}
        <div className="h-16 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-500 text-sm">--- Changement de variante ---</span>
        </div>

        {/* Footer Minimal */}
        <section>
          <div className="bg-yellow-50 py-6">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-2xl font-bold text-yellow-900 mb-2">Footer Minimal</h2>
              <p className="text-yellow-700 mb-2">Footer basique pour pages de checkout</p>
              <code className="text-sm bg-yellow-100 px-3 py-1 rounded">
                {'<FooterEnhanced variant="minimal" />'}
              </code>
            </div>
          </div>
          <FooterEnhanced 
            variant="minimal"
            context="public"
            staticData={footerData}
            showNewsletter={false}
            showSocial={false}
          />
        </section>

      </div>

      {/* 📊 Guide d'utilisation */}
      <div className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              📖 Guide d'utilisation FooterEnhanced
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              <div className="bg-indigo-50 p-6 rounded-lg">
                <h3 className="font-bold text-indigo-900 mb-4">Complete</h3>
                <div className="space-y-2 text-sm">
                  <div>✅ Informations entreprise complètes</div>
                  <div>✅ Newsletter avec formulaire</div>
                  <div>✅ Réseaux sociaux</div>
                  <div>✅ Liens organisés par sections</div>
                  <div>✅ Mentions légales</div>
                </div>
                <div className="mt-4 text-xs text-indigo-700 bg-indigo-100 p-2 rounded">
                  <strong>Usage:</strong> Page d'accueil, pages principales
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="font-bold text-green-900 mb-4">Simple</h3>
                <div className="space-y-2 text-sm">
                  <div>✅ Informations entreprise</div>
                  <div>✅ Navigation essentielle</div>
                  <div>✅ Réseaux sociaux</div>
                  <div>❌ Newsletter</div>
                  <div>✅ Copyright</div>
                </div>
                <div className="mt-4 text-xs text-green-700 bg-green-100 p-2 rounded">
                  <strong>Usage:</strong> Pages de contenu, interfaces admin
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <h3 className="font-bold text-yellow-900 mb-4">Minimal</h3>
                <div className="space-y-2 text-sm">
                  <div>✅ Nom entreprise</div>
                  <div>✅ Liens légaux essentiels</div>
                  <div>✅ Copyright</div>
                  <div>❌ Newsletter</div>
                  <div>❌ Réseaux sociaux</div>
                </div>
                <div className="mt-4 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                  <strong>Usage:</strong> Checkout, connexion, processus critiques
                </div>
              </div>
            </div>

            {/* Exemples de code */}
            <div className="mt-8 bg-gray-100 p-6 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-4">💻 Exemples de code</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                
                <div>
                  <h4 className="font-medium mb-2">Import</h4>
                  <code className="block bg-white p-3 rounded">
                    {`import { FooterEnhanced } from '~/components/layout';`}
                  </code>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Usage avec backend</h4>
                  <code className="block bg-white p-3 rounded">
                    {`<FooterEnhanced 
  variant="complete"
  context="public"
  showNewsletter={true}
/>`}
                  </code>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Avec données statiques</h4>
                  <code className="block bg-white p-3 rounded">
                    {`<FooterEnhanced 
  variant="simple"
  staticData={customData}
  showSocial={false}
/>`}
                  </code>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Thème sombre</h4>
                  <code className="block bg-white p-3 rounded">
                    {`<FooterEnhanced 
  variant="complete"
  theme="dark"
  className="custom-footer"
/>`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
