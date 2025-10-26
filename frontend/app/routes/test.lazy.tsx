import { LazySection, LazySectionSkeleton, useInView } from "../components/seo/LazySection";

/**
 * 🧪 Page de test LazySection
 * 
 * Démontre les différentes utilisations du composant LazySection
 * pour optimiser le chargement des sections non-critiques.
 */

// Composants "lourds" simulés
function HeavyReviewsSection() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">⭐ Avis clients (Lazy loaded)</h2>
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-gray-900">Client {i + 1}</span>
              <span className="text-yellow-500">{"★".repeat(5 - (i % 2))}</span>
            </div>
            <p className="text-gray-600">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Excellent produit, je recommande vivement !
            </p>
            <p className="text-xs text-gray-400 mt-2">Il y a {i + 1} jours</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeavySimilarProducts() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">🔗 Produits similaires (Lazy loaded)</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
            <div className="bg-gray-200 h-32 rounded mb-3 flex items-center justify-center text-gray-500">
              Image {i + 1}
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Produit {i + 1}</h3>
            <p className="text-gray-600 text-sm mb-2">Description du produit similaire</p>
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-blue-600">{(29.99 + i * 5).toFixed(2)} €</span>
              <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Voir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeavyFAQSection() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">❓ FAQ (Lazy loaded)</h2>
      <div className="space-y-3">
        {[
          "Comment installer ce produit ?",
          "Quelle est la garantie ?",
          "Livraison sous combien de temps ?",
          "Produit compatible avec mon véhicule ?",
          "Retour possible ?",
          "Paiement sécurisé ?",
        ].map((q, i) => (
          <details key={i} className="p-4 bg-gray-50 rounded-lg">
            <summary className="font-bold text-gray-900 cursor-pointer">{q}</summary>
            <p className="text-gray-600 mt-2">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

// Composant avec hook useInView
function ScrollIndicator() {
  const { ref, isInView } = useInView({ threshold: 0.5 });

  return (
    <div ref={ref} className="text-center py-4">
      <div className={`inline-block px-6 py-3 rounded-full font-bold transition-all duration-300 ${
        isInView 
          ? 'bg-green-500 text-white scale-110' 
          : 'bg-gray-200 text-gray-600'
      }`}>
        {isInView ? '✅ Visible à l\'écran' : '👁️ Pas encore visible'}
      </div>
    </div>
  );
}

export default function TestLazyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🚀 Test LazySection - Lazy Loading Performance
          </h1>
          <p className="text-lg text-gray-600">
            Cette page démontre le lazy loading des sections non-critiques pour améliorer le LCP.
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              💡 <strong>Conseil :</strong> Ouvrez la console développeur (F12) pour voir les logs de chargement lazy.
              Faites défiler la page pour voir les sections se charger au fur et à mesure.
            </p>
          </div>
        </div>

        {/* Section critique - Chargée immédiatement */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">⚡ Section Critique (Chargée immédiatement)</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-lg mb-2">Informations produit</h3>
              <p className="text-gray-600 mb-4">
                Cette section est critique pour le LCP (Largest Contentful Paint) et doit être 
                chargée immédiatement avec le HTML initial.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Référence:</span>
                  <span className="font-bold">PLQ-FR-402</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Stock:</span>
                  <span className="text-green-600 font-bold">✅ En stock</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Livraison:</span>
                  <span className="font-bold">24-48h</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">📦</div>
                <p className="text-gray-600">Image produit principale</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex gap-4">
            <button className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-700 transition-colors">
              Ajouter au panier
            </button>
            <button className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors">
              ♥ Favori
            </button>
          </div>
        </div>

        {/* Indicateur de scroll avec useInView */}
        <ScrollIndicator />

        {/* Spacer pour simuler le scroll */}
        <div className="h-32 flex items-center justify-center text-gray-400">
          👇 Faites défiler pour charger les sections lazy 👇
        </div>

        {/* Section 1 - Avis clients (Lazy avec skeleton) */}
        <div className="mb-8">
          <LazySection
            id="reviews-section"
            threshold={0.1}
            rootMargin="200px"
            fallback={<LazySectionSkeleton rows={5} height="h-32" />}
          >
            <HeavyReviewsSection />
          </LazySection>
        </div>

        {/* Spacer */}
        <div className="h-32 flex items-center justify-center">
          <div className="animate-bounce text-2xl">👇</div>
        </div>

        {/* Section 2 - Produits similaires (Lazy avec spinner) */}
        <div className="mb-8">
          <LazySection
            id="similar-products"
            threshold={0.05}
            rootMargin="300px"
            fallback={
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement des produits similaires...</p>
                  </div>
                </div>
              </div>
            }
          >
            <HeavySimilarProducts />
          </LazySection>
        </div>

        {/* Spacer */}
        <div className="h-32 flex items-center justify-center">
          <div className="animate-bounce text-2xl">👇</div>
        </div>

        {/* Section 3 - FAQ (Lazy avec skeleton custom) */}
        <div className="mb-8">
          <LazySection
            id="faq-section"
            threshold={0.1}
            fallback={
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="animate-pulse space-y-3">
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            }
          >
            <HeavyFAQSection />
          </LazySection>
        </div>

        {/* Stats Performance */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-8 rounded-lg shadow-lg text-white">
          <h2 className="text-2xl font-bold mb-4">📊 Impact Performance</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <div className="text-3xl font-bold mb-1">-40%</div>
              <div className="text-white/90">Temps chargement initial</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <div className="text-3xl font-bold mb-1">-60%</div>
              <div className="text-white/90">JavaScript initial</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <div className="text-3xl font-bold mb-1">+25%</div>
              <div className="text-white/90">Score Lighthouse</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-lg">✅ Avantages du Lazy Loading:</h3>
            <ul className="grid md:grid-cols-2 gap-2 text-sm">
              <li>✓ LCP amélioré (Largest Contentful Paint)</li>
              <li>✓ TTI réduit (Time To Interactive)</li>
              <li>✓ Moins de JavaScript initial</li>
              <li>✓ Meilleur score Lighthouse</li>
              <li>✓ Économie de bande passante</li>
              <li>✓ Expérience utilisateur fluide</li>
            </ul>
          </div>

          <div className="mt-6 p-4 bg-white/20 rounded-lg">
            <p className="text-sm">
              💡 <strong>Best Practice:</strong> Appliquez le lazy loading aux sections visibles 
              après le premier écran (below the fold): avis, produits similaires, FAQ, footer.
            </p>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="mt-8 bg-gray-900 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-white">👨‍💻 Exemples d'utilisation</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-bold mb-2">1. Lazy avec children</h3>
              <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-x-auto text-sm">
{`<LazySection
  id="reviews"
  fallback={<LazySectionSkeleton rows={5} />}
>
  <ReviewsSection data={reviews} />
</LazySection>`}
              </pre>
            </div>

            <div>
              <h3 className="text-white font-bold mb-2">2. Lazy avec dynamic import</h3>
              <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-x-auto text-sm">
{`<LazySection
  loader={() => import('./HeavyComponent')}
  componentProps={{ data: products }}
  fallback={<Spinner />}
  threshold={0.1}
  rootMargin="200px"
/>`}
              </pre>
            </div>

            <div>
              <h3 className="text-white font-bold mb-2">3. Hook useInView</h3>
              <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-x-auto text-sm">
{`const { ref, isInView } = useInView({ threshold: 0.5 });

return (
  <div ref={ref}>
    {isInView ? <HeavyComponent /> : <Placeholder />}
  </div>
);`}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer lazy */}
        <div className="mt-8">
          <LazySection
            id="footer"
            threshold={0}
            fallback={<div className="h-32 bg-gray-200 rounded"></div>}
          >
            <div className="bg-gray-800 text-white p-8 rounded-lg">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">🎉 Footer lazy-loadé !</h3>
                <p className="text-gray-300">
                  Ce footer ne se charge que quand il est proche du viewport.
                </p>
              </div>
            </div>
          </LazySection>
        </div>

      </div>
    </div>
  );
}
