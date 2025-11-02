import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import { SocialProof } from "../components/trust/SocialProof";
import { TrustBadge } from "../components/trust/TrustBadge";
import { SEOHelmet, type BreadcrumbItem, type ReviewData, type OrganizationData } from "../components/ui/SEOHelmet";

export default function TestSEOPage() {
  // Breadcrumbs pour la démonstration
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Accueil", href: "/" },
    { label: "Pièces Auto", href: "/pieces" },
    { label: "Plaquettes de frein", href: "/pieces/plaquette-de-frein-402.html" },
    { label: "Alfa Romeo", href: "/pieces/plaquette-de-frein-402/alfa-romeo-13" },
    { label: "Giulietta II", href: "/pieces/plaquette-de-frein-402/alfa-romeo-13/giulietta-ii-13044" },
    { label: "1.8 TBI", href: "/pieces/plaquette-de-frein-402/alfa-romeo-13/giulietta-ii-13044/1-8-tbi-33300.html" }
  ];

  // Données d'organisation
  const organization: OrganizationData = {
    name: "Automecanik",
    logo: "https://automecanik.com/logo.png",
    url: "https://automecanik.com",
    contactPoint: {
      telephone: "+33-1-23-45-67-89",
      contactType: "Service Client",
      email: "contact@automecanik.com"
    },
    sameAs: [
      "https://www.facebook.com/automecanik",
      "https://twitter.com/automecanik",
      "https://www.linkedin.com/company/automecanik"
    ]
  };

  // Avis clients fictifs
  const reviews: ReviewData[] = [
    {
      author: "Jean Dupont",
      rating: 5,
      date: "2024-10-15",
      comment: "Excellentes plaquettes de frein, installation facile et prix imbattable !"
    },
    {
      author: "Marie Martin",
      rating: 4,
      date: "2024-10-10",
      comment: "Très bon rapport qualité-prix. Freinage efficace après rodage."
    },
    {
      author: "Pierre Bernard",
      rating: 5,
      date: "2024-10-05",
      comment: "Conforme aux attentes, livraison rapide. Je recommande."
    },
    {
      author: "Sophie Lefebvre",
      rating: 4,
      date: "2024-09-28",
      comment: "Plaquettes de bonne qualité, compatibles avec ma Giulietta."
    },
    {
      author: "Luc Moreau",
      rating: 5,
      date: "2024-09-20",
      comment: "Parfait ! Freinage silencieux et progressif. Excellent achat."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      
      {/* SEO avec tous les schemas JSON-LD */}
      <SEOHelmet
        seo={{
          title: "Plaquettes de frein ALFA ROMEO GIULIETTA II 1.8 TBI - Test SEO Schemas",
          description: "Plaquettes de frein de qualité pour ALFA ROMEO GIULIETTA II 1.8 TBI. Livraison rapide, garantie 2 ans. Note 4.6/5 basée sur 127 avis clients.",
          canonicalUrl: "pieces/plaquette-de-frein-402/alfa-romeo-13/giulietta-ii-13044/1-8-tbi-33300.html",
          keywords: ["plaquettes de frein", "alfa romeo", "giulietta", "freinage"],
          breadcrumbs,
          reviews,
          organization,
          ogImage: "https://automecanik.com/upload/articles/gammes-produits/catalogue/plaquette-de-frein.webp",
          twitterCard: "summary_large_image"
        }}
      />

      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🧪 Test SEO - Schemas JSON-LD Enrichis
          </h1>
          <p className="text-lg text-gray-600">
            Cette page démontre l'intégration complète des schemas JSON-LD pour le SEO.
          </p>
        </div>

        {/* Breadcrumbs visuels */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">🍞 Breadcrumbs</h2>
          <Breadcrumbs items={breadcrumbs} enableSchema={false} />
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              ℹ️ Le schema BreadcrumbList JSON-LD est généré par SEOHelmet (pas en double)
            </p>
          </div>
        </div>

        {/* Grille 2 colonnes */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* Organisation Schema */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">🏢 Organization Schema</h2>
            <div className="space-y-3">
              <div>
                <strong className="text-gray-700">Nom:</strong>
                <p className="text-gray-600">{organization.name}</p>
              </div>
              <div>
                <strong className="text-gray-700">URL:</strong>
                <p className="text-gray-600 break-all">{organization.url}</p>
              </div>
              <div>
                <strong className="text-gray-700">Contact:</strong>
                <p className="text-gray-600">{organization.contactPoint?.email}</p>
                <p className="text-gray-600">{organization.contactPoint?.telephone}</p>
              </div>
              <div>
                <strong className="text-gray-700">Réseaux sociaux:</strong>
                <ul className="list-disc list-inside text-gray-600 text-sm">
                  {organization.sameAs?.map((url, i) => (
                    <li key={i}>{url}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-700">
                ✅ Eligible au Knowledge Graph Google
              </p>
            </div>
          </div>

          {/* Reviews Schema */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">⭐ Reviews + AggregateRating</h2>
            
            {/* Social Proof component */}
            <SocialProof
              rating={4.6}
              reviewCount={127}
              soldCount={3542}
              variant="full"
            />

            <div className="mt-6 space-y-3">
              <strong className="text-gray-700">Derniers avis ({reviews.length}):</strong>
              {reviews.map((review, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-gray-900">{review.author}</span>
                    <span className="text-yellow-500 font-bold">{"★".repeat(review.rating)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{review.comment}</p>
                  <p className="text-xs text-gray-400 mt-1">{review.date}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-700">
                ⭐ Rich snippets avec étoiles dans Google
              </p>
            </div>
          </div>
        </div>

        {/* Product Example */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">📦 Exemple Produit Complet</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Image produit */}
            <div className="md:col-span-1">
              <img 
                src="/upload/articles/gammes-produits/catalogue/plaquette-de-frein.webp"
                alt="Plaquettes de frein"
                className="w-full rounded-lg shadow-md"
                loading="lazy"
              />
            </div>

            {/* Infos produit */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">
                Plaquettes de frein ALFA ROMEO GIULIETTA II 1.8 TBI
              </h3>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-2">
                <TrustBadge type="oem" variant="compact" />
                <TrustBadge type="warranty" variant="compact" />
                <TrustBadge type="stock" variant="compact" />
              </div>

              {/* Social proof */}
              <SocialProof
                rating={4.6}
                reviewCount={127}
                soldCount={3542}
                variant="compact"
              />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-gray-700">Marque:</strong>
                  <p className="text-gray-600">FEBI, ATE, BORG & BECK</p>
                </div>
                <div>
                  <strong className="text-gray-700">Référence:</strong>
                  <p className="text-gray-600">PLQ-AR-GIULIETTA-18TBI</p>
                </div>
                <div>
                  <strong className="text-gray-700">Disponibilité:</strong>
                  <p className="text-green-600 font-medium">✅ En stock</p>
                </div>
                <div>
                  <strong className="text-gray-700">Livraison:</strong>
                  <p className="text-gray-600">24-48h</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-3xl font-bold text-gray-900">42,90 €</span>
                  <span className="text-lg text-gray-500 line-through">54,90 €</span>
                  <span className="px-2 py-1 bg-red-500 text-white text-sm font-bold rounded">-22%</span>
                </div>
                <p className="text-xs text-gray-500">TTC - Livraison gratuite dès 50€</p>
              </div>

              <button className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>

        {/* Rich Results Info */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg shadow-lg text-white">
          <h2 className="text-2xl font-bold mb-4">🚀 Impact SEO Estimé</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <div className="text-3xl font-bold mb-1">+15-30%</div>
              <div className="text-white/90">CTR dans Google</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <div className="text-3xl font-bold mb-1">+20%</div>
              <div className="text-white/90">Trust utilisateur</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <div className="text-3xl font-bold mb-1">+8-12%</div>
              <div className="text-white/90">Taux de conversion</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-lg">✅ Schemas implémentés:</h3>
            <ul className="grid md:grid-cols-2 gap-2 text-sm">
              <li>✓ Product (avec prix, disponibilité, marque)</li>
              <li>✓ BreadcrumbList (fil d'Ariane)</li>
              <li>✓ AggregateRating (note moyenne)</li>
              <li>✓ Review (jusqu'à 5 avis)</li>
              <li>✓ Organization (Knowledge Graph)</li>
              <li>✓ Offer (prix, devise, disponibilité)</li>
            </ul>
          </div>

          <div className="mt-6 p-4 bg-white/20 rounded-lg">
            <p className="text-sm">
              💡 <strong>Conseil:</strong> Testez vos schemas avec{" "}
              <a 
                href="https://search.google.com/test/rich-results" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-yellow-300"
              >
                Google Rich Results Test
              </a>
            </p>
          </div>
        </div>

        {/* View Source */}
        <div className="mt-8 bg-gray-900 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-white">👨‍💻 Voir les schemas JSON-LD</h2>
          <p className="text-gray-300 mb-4">
            Ouvrez la console développeur (F12) et inspectez les balises <code className="bg-gray-800 px-2 py-1 rounded">&lt;script type="application/ld+json"&gt;</code> dans le <code className="bg-gray-800 px-2 py-1 rounded">&lt;head&gt;</code>
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                console.log(`📊 ${scripts.length} schemas JSON-LD trouvés:`);
                scripts.forEach((script, i) => {
                  console.log(`\n${i + 1}. Schema:`, JSON.parse(script.textContent || '{}'));
                });
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              📊 Afficher dans la console
            </button>
            <button 
              onClick={() => window.open('view-source:' + window.location.href)}
              className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            >
              📄 Voir le code source
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
