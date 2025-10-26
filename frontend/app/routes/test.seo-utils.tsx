import { useState } from "react";
import {
  buildCanonicalUrl,
  isIndexableFacet,
  generatePaginationTags,
  cleanUrl,
  normalizeUrl,
} from "../utils/seo/canonical";
import {
  generateGammeMeta,
  generatePieceMeta,
  generateMarqueMeta,
} from "../utils/seo/meta-generators";

/**
 * 🧪 Page de test SEO Utils
 * 
 * Teste les utilitaires canonical et meta generators
 */

export default function TestSEOUtilsPage() {
  const [customUrl, setCustomUrl] = useState('/pieces/plaquette-de-frein-402');
  const [customParams, setCustomParams] = useState('{"marque":"renault","utm_source":"google"}');

  // Générer URL canonique custom
  let canonicalResult = '';
  let canonicalError = '';
  try {
    const params = JSON.parse(customParams);
    canonicalResult = buildCanonicalUrl({
      baseUrl: customUrl,
      params,
      includeHost: true,
    });
  } catch (e: any) {
    canonicalError = e.message;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔗 Test SEO Utils - Canonical & Meta Generators
          </h1>
          <p className="text-lg text-gray-600">
            Utilitaires pour générer des URLs canoniques et des meta tags optimisés.
          </p>
        </div>

        {/* Section 1 - Canonical URLs */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">🔗 Canonical URL Builder</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-bold mb-3">Exemple 1: URL propre</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600 mb-2">Input:</p>
                <code className="text-xs bg-gray-800 text-green-400 px-2 py-1 rounded block mb-3">
                  baseUrl: '/pieces/plaquette-de-frein-402'<br/>
                  params: &#123; marque: 'renault', utm_source: 'google' &#125;
                </code>
                <p className="text-sm text-gray-600 mb-2">Output:</p>
                <code className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded block break-all">
                  {buildCanonicalUrl({
                    baseUrl: '/pieces/plaquette-de-frein-402',
                    params: { marque: 'renault', utm_source: 'google' },
                    includeHost: true,
                  })}
                </code>
                <p className="text-xs text-green-600 mt-2">✓ utm_source supprimé automatiquement</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-3">Exemple 2: Limitation facettes</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600 mb-2">Input:</p>
                <code className="text-xs bg-gray-800 text-green-400 px-2 py-1 rounded block mb-3">
                  params: &#123; marque: 'r', modele: 'c',<br/>
                  motorisation: 'm', annee: '2020' &#125;
                </code>
                <p className="text-sm text-gray-600 mb-2">Output:</p>
                <code className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded block break-all">
                  {buildCanonicalUrl({
                    baseUrl: '/pieces/plaquette-de-frein-402',
                    params: { marque: 'renault', modele: 'clio', motorisation: '1.5dci', annee: 2020 },
                  })}
                </code>
                <p className="text-xs text-green-600 mt-2">✓ Max 3 facettes indexables conservées</p>
              </div>
            </div>
          </div>

          {/* Interactive tester */}
          <div className="border-t pt-6">
            <h3 className="font-bold mb-3">🧪 Testez vos URLs</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL de base</label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="/pieces/plaquette-de-frein-402"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paramètres (JSON)</label>
                <input
                  type="text"
                  value={customParams}
                  onChange={(e) => setCustomParams(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder='{"marque":"renault"}'
                />
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-700 mb-2">Résultat:</p>
              {canonicalError ? (
                <p className="text-red-600 text-sm">{canonicalError}</p>
              ) : (
                <code className="text-sm bg-blue-900 text-blue-200 px-3 py-2 rounded block break-all">
                  {canonicalResult}
                </code>
              )}
            </div>
          </div>
        </div>

        {/* Section 2 - Pagination Tags */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">🔢 Pagination Tags Generator</h2>
          
          <div className="bg-gray-50 p-4 rounded mb-4">
            <code className="text-sm bg-gray-800 text-green-400 px-2 py-1 rounded block mb-3">
              generatePaginationTags(&#123;<br/>
              &nbsp;&nbsp;baseUrl: '/pieces/plaquette-de-frein-402',<br/>
              &nbsp;&nbsp;currentPage: 2,<br/>
              &nbsp;&nbsp;totalPages: 5,<br/>
              &nbsp;&nbsp;params: &#123; marque: 'renault' &#125;<br/>
              &#125;)
            </code>
          </div>

          {(() => {
            const tags = generatePaginationTags({
              baseUrl: '/pieces/plaquette-de-frein-402',
              currentPage: 2,
              totalPages: 5,
              params: { marque: 'renault' },
              includeHost: true,
            });

            return (
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(tags).map(([key, value]) => (
                  <div key={key} className="p-3 bg-blue-50 rounded">
                    <p className="text-sm font-bold text-gray-700 mb-1">rel="{key}"</p>
                    <code className="text-xs text-blue-800 break-all">{value}</code>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Section 3 - Facet Validation */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">✅ Facet Indexability Checker</h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { params: { marque: 'renault', modele: 'clio' }, expected: true },
              { params: { prix_min: 10, prix_max: 100 }, expected: false },
              { params: { marque: 'r', modele: 'c', motorisation: 'm', annee: 2020 }, expected: false },
            ].map((test, i) => {
              const isIndexable = isIndexableFacet(test.params);
              const matches = isIndexable === test.expected;

              return (
                <div key={i} className={`p-4 rounded border-2 ${matches ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                  <p className="font-bold text-sm mb-2">Test {i + 1}</p>
                  <code className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded block mb-2">
                    {JSON.stringify(test.params)}
                  </code>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={isIndexable ? 'text-green-600' : 'text-red-600'}>
                      {isIndexable ? '✓ Indexable' : '✗ Non-indexable'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {matches ? '✓ Correct' : '✗ Erreur'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 4 - Meta Generators */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">🏷️ Meta Tags Generators</h2>
          
          <div className="space-y-6">
            {/* Gamme Meta */}
            <div>
              <h3 className="font-bold text-lg mb-3 text-blue-600">📦 generateGammeMeta()</h3>
              {(() => {
                const meta = generateGammeMeta({
                  name: 'Plaquettes de frein',
                  count: 3542,
                  minPrice: 12.90,
                  maxPrice: 89.90,
                  vehicleBrand: 'Renault',
                  vehicleModel: 'Clio III',
                  onSale: true,
                });

                return (
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="mb-3">
                      <span className="text-xs text-gray-600">Title ({meta.title.length} chars):</span>
                      <p className="text-sm font-bold text-gray-900">{meta.title}</p>
                    </div>
                    <div className="mb-3">
                      <span className="text-xs text-gray-600">Description ({meta.description.length} chars):</span>
                      <p className="text-sm text-gray-700">{meta.description}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {meta.keywords?.map((kw, i) => (
                          <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Piece Meta */}
            <div>
              <h3 className="font-bold text-lg mb-3 text-green-600">🔧 generatePieceMeta()</h3>
              {(() => {
                const meta = generatePieceMeta({
                  name: 'Plaquettes de frein avant',
                  reference: 'PLQ-FR-402-AV',
                  price: 42.90,
                  originalPrice: 54.90,
                  brand: 'Bosch',
                  vehicleBrand: 'Renault',
                  vehicleModel: 'Clio III',
                  vehicleMotor: '1.5 dCi',
                });

                return (
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="mb-3">
                      <span className="text-xs text-gray-600">Title ({meta.title.length} chars):</span>
                      <p className="text-sm font-bold text-gray-900">{meta.title}</p>
                    </div>
                    <div className="mb-3">
                      <span className="text-xs text-gray-600">Description ({meta.description.length} chars):</span>
                      <p className="text-sm text-gray-700">{meta.description}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {meta.keywords?.map((kw, i) => (
                          <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Marque Meta */}
            <div>
              <h3 className="font-bold text-lg mb-3 text-purple-600">🚗 generateMarqueMeta()</h3>
              {(() => {
                const meta = generateMarqueMeta({
                  brand: 'Renault',
                  model: 'Clio III',
                  motor: '1.5 dCi',
                  gamme: 'Plaquettes de frein',
                  productsCount: 127,
                  minPrice: 12.90,
                  period: '2005-2012',
                });

                return (
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="mb-3">
                      <span className="text-xs text-gray-600">Title ({meta.title.length} chars):</span>
                      <p className="text-sm font-bold text-gray-900">{meta.title}</p>
                    </div>
                    <div className="mb-3">
                      <span className="text-xs text-gray-600">Description ({meta.description.length} chars):</span>
                      <p className="text-sm text-gray-700">{meta.description}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {meta.keywords?.map((kw, i) => (
                          <span key={i} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Section 5 - URL Utilities */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">🧹 URL Utilities</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-3">cleanUrl()</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-xs text-gray-600 mb-2">Avant:</p>
                <code className="text-xs bg-gray-800 text-red-400 px-2 py-1 rounded block mb-3 break-all">
                  /pieces/plaquette?marque=r&utm_source=google&fbclid=123
                </code>
                <p className="text-xs text-gray-600 mb-2">Après:</p>
                <code className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded block break-all">
                  {cleanUrl('/pieces/plaquette?marque=r&utm_source=google&fbclid=123')}
                </code>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-3">normalizeUrl()</h3>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-xs text-gray-600 mb-2">Avant:</p>
                <code className="text-xs bg-gray-800 text-red-400 px-2 py-1 rounded block mb-3 break-all">
                  /Pieces/Plaquette/?modele=clio&marque=renault/
                </code>
                <p className="text-xs text-gray-600 mb-2">Après:</p>
                <code className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded block break-all">
                  {normalizeUrl('/Pieces/Plaquette/?modele=clio&marque=renault/')}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg shadow-lg text-white">
          <h2 className="text-2xl font-bold mb-4">💡 Best Practices SEO</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-3">URLs Canoniques</h3>
              <ul className="space-y-2 text-sm">
                <li>✓ Supprimer les paramètres de tracking (UTM, fbclid, etc.)</li>
                <li>✓ Limiter à 2-3 facettes indexables maximum</li>
                <li>✓ Trier les paramètres alphabétiquement</li>
                <li>✓ Utiliser rel="prev/next" pour la pagination</li>
                <li>✓ Inclure le domaine complet dans les schemas</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-3">Meta Tags</h3>
              <ul className="space-y-2 text-sm">
                <li>✓ Titre: max 60 caractères (optimal: 50-60)</li>
                <li>✓ Description: max 155 caractères (optimal: 145-155)</li>
                <li>✓ Inclure le prix dans le titre si possible</li>
                <li>✓ Utiliser des power words: "Pas cher", "Rapide", "Garanti"</li>
                <li>✓ Mentionner les bénéfices: stock, livraison, garantie</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
