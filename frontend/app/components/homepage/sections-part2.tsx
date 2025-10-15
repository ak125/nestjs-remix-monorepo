// PARTIE 2/3 - Composants restants pour homepage.v3.tsx
import { useState } from 'react';
import { Link } from '@remix-run/react';
import { Trophy, Rocket, BookOpen, Facebook, Twitter, Linkedin, ArrowRight, Star, ShoppingCart, TrendingUp, Award, DollarSign, Youtube } from 'lucide-react';

// ================================
// WHY CHOOSE US - Avantages
// ================================
function WhyChooseUs({ stats: _stats }: any) {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Pourquoi AutoMecanik est votre choix numéro un
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Nous combinons qualité, rapidité et expertise pour vous offrir une expérience d'achat inégalée
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <FeatureCard
            icon={<Trophy className="w-12 h-12" />}
            title="Qualité"
            description="Pièces certifiées d'origine avec garantie constructeur incluse"
            color="yellow"
          />
          <FeatureCard
            icon={<Rocket className="w-12 h-12" />}
            title="Rapidité"
            description="Expédition sous 24h et livraison express partout en France"
            color="blue"
          />
          <FeatureCard
            icon={<BookOpen className="w-12 h-12" />}
            title="Expertise"
            description="Conseils de mécaniciens professionnels à votre service"
            color="purple"
          />
        </div>

        {/* Boutons de partage social */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">Partagez avec vos amis :</p>
          <div className="flex justify-center gap-3">
            <SocialShareButton icon={<Facebook className="w-5 h-5" />} label="Facebook" />
            <SocialShareButton icon={<Twitter className="w-5 h-5" />} label="Twitter" />
            <SocialShareButton icon={<Linkedin className="w-5 h-5" />} label="LinkedIn" />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, description, color }: any) {
  const colorClasses: Record<string, string> = {
    yellow: 'from-yellow-400 to-orange-400',
    blue: 'from-blue-400 to-cyan-400',
    purple: 'from-purple-400 to-pink-400',
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 border border-gray-100">
      <div className={`w-16 h-16 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function SocialShareButton({ icon, label }: any) {
  return (
    <button className="px-4 py-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg flex items-center gap-2 transition-all">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// ================================
// PRODUITS VEDETTES (Carrousel)
// ================================
function FeaturedProducts({ products: _products }: any) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Nouveautés & Produits Vedettes</h2>
          <p className="text-xl text-gray-600">Découvrez notre sélection exclusive</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((idx) => (
            <ProductCard
              key={idx}
              name={`Kit de distribution ${idx === 1 ? 'Premium' : idx === 2 ? 'Sport' : 'Classic'}`}
              price={149.99 + (idx * 50)}
              oldPrice={199.99 + (idx * 50)}
              rating={4.8}
              reviews={245}
              image={`https://via.placeholder.com/400x300?text=Produit+${idx}`}
              badge={idx === 1 ? 'NOUVEAU' : idx === 2 ? 'PROMO -30%' : 'STOCK LIMITÉ'}
              badgeColor={idx === 1 ? 'green' : idx === 2 ? 'red' : 'orange'}
            />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/nouveautes" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
            Voir toutes les nouveautés
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProductCard({ name, price, oldPrice, rating, reviews, image, badge, badgeColor }: any) {
  const badgeColors: Record<string, string> = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all group border border-gray-100">
      <div className="relative overflow-hidden">
        <img src={image} alt={name} className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className={`absolute top-4 right-4 ${badgeColors[badgeColor]} text-white px-3 py-1 rounded-full text-xs font-bold`}>
          {badge}
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{name}</h3>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? 'fill-current' : ''}`} />
            ))}
          </div>
          <span className="text-sm text-gray-600">({reviews} avis)</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl font-bold text-blue-600">{price}€</span>
          <span className="text-lg text-gray-400 line-through">{oldPrice}€</span>
        </div>
        <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg flex items-center justify-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Ajouter au panier
        </button>
        <button className="w-full mt-2 py-3 border-2 border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 rounded-xl font-semibold transition-all">
          En savoir plus
        </button>
      </div>
    </div>
  );
}

// ================================
// COMMERCE ÉLECTRONIQUE FUTUR
// ================================
function EcommerceFuture() {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Naviguez dans le futur de l'automobile avec nous
          </h2>
          <p className="text-xl text-gray-600">L'évolution du commerce électronique dans l'automobile</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <InfoCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Commerce électronique : La nouvelle norme"
            description="Le marché des pièces auto en ligne connaît une croissance exponentielle de 35% par an"
          />
          <InfoCard
            icon={<Award className="w-8 h-8" />}
            title="Acteurs clés : Pourquoi nous sommes différents"
            description="Qualité certifiée, service premium et expertise reconnue depuis 10 ans"
          />
          <InfoCard
            icon={<DollarSign className="w-8 h-8" />}
            title="Monétisation : Votre gain, notre mission"
            description="Jusqu'à 40% d'économies par rapport aux concessions traditionnelles"
          />
        </div>

        {/* Quiz interactif */}
        <div className="mt-16 max-w-2xl mx-auto bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            🎯 Trouvez la pièce parfaite pour votre véhicule
          </h3>
          <p className="text-gray-600 mb-6 text-center">Répondez à quelques questions pour une recommandation personnalisée</p>
          <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold text-lg transition-all hover:shadow-lg">
            Démarrer le quiz interactif
          </button>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon, title, description }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all border border-gray-100">
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

// ================================
// COMPARAISON DE PRODUITS
// ================================
function ProductComparison() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Comparaison de Produits</h2>
          <p className="text-xl text-gray-600">Comparez facilement nos produits pour faire le meilleur choix</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-4 font-bold text-gray-900">Critère</th>
                <th className="text-center py-4 px-4 font-bold text-gray-900">Produit A</th>
                <th className="text-center py-4 px-4 font-bold text-gray-900">Produit B</th>
                <th className="text-center py-4 px-4 font-bold text-gray-900">Produit C</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow label="Prix" values={['149€', '199€', '99€']} />
              <ComparisonRow label="Garantie" values={['2 ans', '3 ans', '1 an']} />
              <ComparisonRow label="Note client" values={['4.8/5', '4.5/5', '4.2/5']} />
              <ComparisonRow label="Livraison" values={['24h', '48h', '72h']} />
              <ComparisonRow label="Stock" values={['✓ Disponible', '✓ Disponible', '⚠️ Limité']} />
            </tbody>
          </table>

          {/* Filtres avancés */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Filtrer par marque
            </button>
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
              Filtrer par prix
            </button>
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
              Filtrer par note
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
      <td className="py-4 px-4 font-medium text-gray-700">{label}</td>
      {values.map((value, idx) => (
        <td key={idx} className="py-4 px-4 text-center text-gray-900">{value}</td>
      ))}
    </tr>
  );
}

// ================================
// TÉMOIGNAGES (Diaporama)
// ================================
function TestimonialsSection({ testimonials: _testimonials }: any) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const testimonialsList = [
    {
      name: "Jean Dupont",
      role: "Particulier",
      location: "Paris",
      rating: 5,
      comment: "Excellent service ! J'ai trouvé mes pièces rapidement et la livraison était ultra rapide. Le service client est très professionnel.",
      videoUrl: "https://example.com/video1",
      avatar: "https://via.placeholder.com/100"
    },
    {
      name: "Marie Martin",
      role: "Garagiste professionnelle",
      location: "Lyon",
      rating: 5,
      comment: "En tant que professionnelle, je commande régulièrement chez AutoMecanik. La qualité est toujours au rendez-vous et les prix sont imbattables.",
      videoUrl: "https://example.com/video2",
      avatar: "https://via.placeholder.com/100"
    },
    {
      name: "Pierre Dubois",
      role: "Passionné automobile",
      location: "Marseille",
      rating: 4,
      comment: "Super expérience d'achat. Le site est facile à utiliser et j'ai trouvé exactement ce que je cherchais. Petit délai de livraison mais produit conforme.",
      videoUrl: "https://example.com/video3",
      avatar: "https://via.placeholder.com/100"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ce que disent nos clients</h2>
          <p className="text-xl text-blue-100">Plus de 25 000 clients satisfaits nous font confiance</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <TestimonialSlide testimonial={testimonialsList[currentSlide]} />

            {/* Navigation */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonialsList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentSlide ? 'bg-white w-8' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Avis et évaluations intégrés */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <RatingCard label="Qualité des produits" rating={4.9} />
            <RatingCard label="Service client" rating={4.8} />
            <RatingCard label="Livraison" rating={4.7} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialSlide({ testimonial }: any) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <img src={testimonial.avatar} alt={testimonial.name} className="w-24 h-24 rounded-full border-4 border-white/30" />
      </div>

      <div className="flex justify-center mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`w-6 h-6 ${i < testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
        ))}
      </div>

      <p className="text-xl italic mb-6 leading-relaxed">"{testimonial.comment}"</p>

      <div className="font-bold text-lg">{testimonial.name}</div>
      <div className="text-blue-200">{testimonial.role} • {testimonial.location}</div>

      {/* Vidéo témoignage placeholder */}
      <div className="mt-6 bg-black/30 rounded-xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-black/40 transition-colors">
        <Youtube className="w-5 h-5" />
        <span className="text-sm">Voir le témoignage vidéo</span>
      </div>
    </div>
  );
}

function RatingCard({ label, rating }: any) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
      <div className="text-3xl font-bold mb-1">{rating}/5</div>
      <div className="text-sm text-blue-100">{label}</div>
    </div>
  );
}

// À suivre dans la partie 3...

export { WhyChooseUs, FeaturedProducts, EcommerceFuture, ProductComparison, TestimonialsSection };
