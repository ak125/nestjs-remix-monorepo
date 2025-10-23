// PARTIE 3/3 - Composants finaux pour homepage.v3.tsx
import { Link } from "@remix-run/react";
import { 
  Shield, Trophy, Rocket, BookOpen, Star, ShoppingCart, ArrowRight,
  TrendingUp, Award, DollarSign, Facebook, Twitter, Linkedin, Youtube,
  MapPin, Mail, Phone, MessageCircle, Check, ChevronRight, Clock
} from 'lucide-react';
import { useState } from 'react';

// ================================
// PARTENAIRES & CERTIFICATIONS
// ================================
export function PartnersAndCertifications({ brands: _brands }: any) {
  const partners = [
    { name: 'BOSCH', logo: 'https://via.placeholder.com/150x80?text=BOSCH' },
    { name: 'VALEO', logo: 'https://via.placeholder.com/150x80?text=VALEO' },
    { name: 'MANN-FILTER', logo: 'https://via.placeholder.com/150x80?text=MANN' },
    { name: 'SKF', logo: 'https://via.placeholder.com/150x80?text=SKF' },
    { name: 'SACHS', logo: 'https://via.placeholder.com/150x80?text=SACHS' },
    { name: 'LUK', logo: 'https://via.placeholder.com/150x80?text=LUK' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Nos Partenaires & Certifications</h2>
          <p className="text-xl text-gray-600">Des marques de confiance pour votre tranquillité</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
          {partners.map((partner, idx) => (
            <div
              key={idx}
              className="group relative bg-gray-50 hover:bg-white rounded-xl p-6 transition-all hover:shadow-lg border border-gray-100"
            >
              <img
                src={partner.logo}
                alt={partner.name}
                className="w-full h-16 object-contain filter grayscale group-hover:grayscale-0 transition-all"
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Partenaire certifié {partner.name}
              </div>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="mt-16 flex flex-wrap justify-center gap-6">
          <CertificationBadge icon={<Shield />} text="Certifié ISO 9001" />
          <CertificationBadge icon={<Check />} text="Pièces d'origine" />
          <CertificationBadge icon={<Trophy />} text="Élu meilleur site 2025" />
        </div>
      </div>
    </section>
  );
}

function CertificationBadge({ icon, text }: any) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-full">
      <div className="text-green-600">{icon}</div>
      <span className="font-semibold text-green-800">{text}</span>
    </div>
  );
}

// ================================
// CTA PRINCIPAL
// ================================
export function MainCTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ne manquez pas la pièce qui complète votre véhicule
          </h2>
          <p className="text-xl mb-10 text-blue-100">
            Rejoignez plus de 25 000 clients satisfaits et profitez de nos prix imbattables
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/recherche"
              className="inline-flex items-center gap-2 px-10 py-5 bg-white text-blue-600 rounded-full font-bold text-lg shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all"
            >
              Je commence ma recherche
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-10 py-5 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all"
            >
              <Phone className="w-5 h-5" />
              Contactez-nous
            </Link>
          </div>

          {/* Offres groupées */}
          <div className="mt-12 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-lg font-semibold mb-4">🎁 Offres groupées disponibles</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BundleOffer title="Pack Entretien" discount="-15%" items={3} />
              <BundleOffer title="Pack Freinage" discount="-20%" items={4} />
              <BundleOffer title="Pack Complet" discount="-25%" items={6} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BundleOffer({ title, discount, items }: any) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all cursor-pointer">
      <div className="text-yellow-300 text-2xl font-bold mb-1">{discount}</div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-blue-100">{items} pièces incluses</div>
    </div>
  );
}

// ================================
// SECTION BLOG
// ================================
export function BlogSection({ posts: _posts }: any) {
  const blogArticles = [
    {
      title: "5 erreurs à éviter lors de l'achat de pièces auto",
      excerpt: "Découvrez les pièges courants et comment les éviter pour faire le bon choix...",
      image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600",
      date: "15 Oct 2025",
      category: "Conseils",
      readTime: "5 min"
    },
    {
      title: "Comment choisir son kit de distribution ?",
      excerpt: "Guide complet pour sélectionner le kit de distribution adapté à votre véhicule...",
      image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600",
      date: "12 Oct 2025",
      category: "Tutoriel",
      readTime: "8 min"
    },
    {
      title: "Entretien automobile : le calendrier annuel",
      excerpt: "Tous les points de contrôle à effectuer mois par mois pour votre voiture...",
      image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600",
      date: "10 Oct 2025",
      category: "Guide",
      readTime: "6 min"
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Blog & Conseils Auto</h2>
          <p className="text-xl text-gray-600">Nos experts partagent leurs connaissances</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {blogArticles.map((article, idx) => (
            <BlogCard key={idx} article={article} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white rounded-xl font-semibold text-lg shadow-lg transition-all"
          >
            Voir tous les articles
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function BlogCard({ article }: any) {
  return (
    <article className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all group border border-gray-100">
      <div className="relative overflow-hidden">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-4 left-4 px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-semibold">
          {article.category}
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          <span>{article.date}</span>
          <span>•</span>
          <span>{article.readTime} de lecture</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {article.title}
        </h3>
        <p className="text-gray-600 mb-4 line-clamp-2">{article.excerpt}</p>
        <Link to={`/blog/${article.title.toLowerCase().replace(/\s+/g, '-')}`} className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:gap-3 transition-all">
          Lire la suite
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Boutons de partage */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
          <ShareButton icon={<Facebook className="w-4 h-4" />} />
          <ShareButton icon={<Twitter className="w-4 h-4" />} />
          <ShareButton icon={<Linkedin className="w-4 h-4" />} />
        </div>
      </div>
    </article>
  );
}

function ShareButton({ icon }: any) {
  return (
    <button className="p-2 bg-gray-100 hover:bg-blue-100 rounded-lg text-gray-600 hover:text-blue-600 transition-all">
      {icon}
    </button>
  );
}

// ================================
// SECTION FAQ
// ================================
export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const faqs = [
    {
      question: "Comment puis-je trouver la référence de ma pièce ?",
      answer: "Vous pouvez trouver la référence sur la pièce d'origine, dans le manuel de votre véhicule, ou en utilisant notre outil de recherche par immatriculation."
    },
    {
      question: "Quelle est la garantie sur les pièces ?",
      answer: "Toutes nos pièces sont garanties 2 ans minimum. Les pièces d'origine bénéficient de la garantie constructeur."
    },
    {
      question: "Quel est le délai de livraison ?",
      answer: "Les pièces en stock sont expédiées sous 24h. La livraison standard prend 2-3 jours ouvrés. Livraison express en 24h disponible."
    },
    {
      question: "Puis-je retourner une pièce ?",
      answer: "Oui, vous disposez de 30 jours pour retourner une pièce non montée dans son emballage d'origine."
    },
    {
      question: "Proposez-vous l'installation des pièces ?",
      answer: "Nous avons un réseau de garages partenaires qui peuvent installer vos pièces. Contactez-nous pour plus d'informations."
    }
  ];

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Questions Fréquentes</h2>
            <p className="text-xl text-gray-600">Trouvez rapidement les réponses à vos questions</p>
          </div>

          {/* Barre de recherche FAQ */}
          <div className="mb-8">
            <input
              type="text"
              placeholder="Rechercher une question..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
            />
          </div>

          {/* Accordéon FAQ */}
          <div className="space-y-4">
            {filteredFaqs.map((faq, idx) => (
              <FAQItem
                key={idx}
                faq={faq}
                isOpen={openIndex === idx}
                onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
              />
            ))}
          </div>

          {filteredFaqs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Aucune question ne correspond à votre recherche
            </div>
          )}

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">Vous ne trouvez pas votre réponse ?</p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              Contactez notre support
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQItem({ faq, isOpen, onToggle }: any) {
  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-left text-gray-900">{faq.question}</span>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

// ================================
// SECTION NEWSLETTER
// ================================
export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logique d'inscription
    setIsSubscribed(true);
    setTimeout(() => {
      setIsSubscribed(false);
      setEmail('');
    }, 3000);
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-6">📧</div>
          <h2 className="text-4xl font-bold mb-4">
            Rejoignez notre communauté
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Bénéficiez de 10% de réduction sur votre prochaine commande en vous inscrivant à notre newsletter
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              className="flex-1 px-6 py-4 rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Je m'inscris
            </button>
          </form>

          {isSubscribed && (
            <div className="bg-success text-success-foreground px-6 py-3 rounded-full inline-block animate-bounce">
              ✓ Inscription réussie ! Vérifiez votre email
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400 mt-8">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Offres exclusives</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Conseils d'experts</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Nouveautés en avant-première</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            🔒 Vos données sont protégées. Désabonnement possible à tout moment.
          </p>
        </div>
      </div>
    </section>
  );
}

// À continuer avec TeamSection, ContactSection, Footer, LiveChatButton, SignupPopup...

export { 
  Shield, Trophy, Rocket, BookOpen, Star, ShoppingCart, ArrowRight,
  TrendingUp, Award, DollarSign, Facebook, Twitter, Linkedin, Youtube,
  MapPin, Mail, Phone, MessageCircle, Check, ChevronRight, Clock
};
