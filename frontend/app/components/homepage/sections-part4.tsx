// PARTIE 4/4 - Composants finaux : Team, Contact, Footer, LiveChat, Popup
import { Link } from "@remix-run/react";
import { MapPin, Mail, Phone, MessageCircle, Clock, Facebook, Twitter, Linkedin, Instagram, Youtube, X } from 'lucide-react';
import { useState, useEffect } from 'react';

// ================================
// ÉQUIPE & CULTURE D'ENTREPRISE
// ================================
export function TeamSection() {
  const teamMembers = [
    {
      name: "Jean Dupuis",
      role: "Fondateur & CEO",
      photo: "https://via.placeholder.com/200",
      quote: "Passionné d'automobile depuis 25 ans"
    },
    {
      name: "Marie Laurent",
      role: "Directrice Technique",
      photo: "https://via.placeholder.com/200",
      quote: "L'expertise au service de la qualité"
    },
    {
      name: "Pierre Martin",
      role: "Responsable Service Client",
      photo: "https://via.placeholder.com/200",
      quote: "Votre satisfaction, notre priorité"
    },
    {
      name: "Sophie Dubois",
      role: "Chef de projet E-commerce",
      photo: "https://via.placeholder.com/200",
      quote: "Innovation et expérience utilisateur"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Notre Équipe Passionnée
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Des experts automobiles dédiés à votre satisfaction depuis plus de 10 ans
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamMembers.map((member, idx) => (
            <TeamMemberCard key={idx} member={member} />
          ))}
        </div>

        {/* Culture d'entreprise */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Nos Valeurs</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ValueCard emoji="🎯" title="Excellence" description="Qualité irréprochable dans chaque produit" />
              <ValueCard emoji="🤝" title="Confiance" description="Relations transparentes avec nos clients" />
              <ValueCard emoji="💡" title="Innovation" description="Technologies de pointe pour vous servir" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamMemberCard({ member }: any) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all group">
      <div className="relative overflow-hidden">
        <img
          src={member.photo}
          alt={member.name}
          className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
      <div className="p-6 text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
        <p className="text-blue-600 font-medium mb-3">{member.role}</p>
        <p className="text-gray-600 italic text-sm">"{member.quote}"</p>
      </div>
    </div>
  );
}

function ValueCard({ emoji, title, description }: any) {
  return (
    <div className="text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <h4 className="font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

// ================================
// CONTACT & LOCALISATION
// ================================
export function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [_isChatOpen, setIsChatOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logique d'envoi du formulaire
    alert('Message envoyé !');
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Contactez-Nous
          </h2>
          <p className="text-xl text-gray-600">
            Notre équipe est à votre écoute pour répondre à toutes vos questions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Formulaire de contact */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sujet
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Sélectionnez un sujet</option>
                  <option value="commande">Question sur une commande</option>
                  <option value="produit">Information produit</option>
                  <option value="sav">Service après-vente</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  rows={5}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Envoyer le message
              </button>
            </form>

            {/* Option chat en direct */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                  <div>
                    <div className="font-semibold text-gray-900">Chat en direct disponible</div>
                    <div className="text-sm text-gray-600">Réponse immédiate de notre équipe</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Démarrer
                </button>
              </div>
            </div>
          </div>

          {/* Informations de contact & Carte */}
          <div className="space-y-6">
            <ContactInfoCard
              icon={<Phone />}
              title="Téléphone"
              content="01 48 49 78 69"
              subtitle="Lun-Ven : 9h-18h, Sam : 9h-12h"
            />
            <ContactInfoCard
              icon={<Mail />}
              title="Email"
              content="contact@automecanik.com"
              subtitle="Réponse sous 24h"
            />
            <ContactInfoCard
              icon={<MapPin />}
              title="Adresse"
              content="123 Avenue des Champs-Élysées"
              subtitle="75008 Paris, France"
            />

            {/* Carte interactive */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 h-64">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2624.9916256937604!2d2.2922926156747707!3d48.858370279287454!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e66e2964e34e2d%3A0x8ddca9ee380ef7e0!2sEiffel%20Tower!5e0!3m2!1sen!2sfr!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Notre localisation"
              ></iframe>
            </div>

            {/* Horaires d'ouverture */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">Horaires d'ouverture</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Lundi - Vendredi</span>
                  <span className="font-semibold">9h - 18h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Samedi</span>
                  <span className="font-semibold">9h - 12h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dimanche</span>
                  <span className="font-semibold text-red-600">Fermé</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactInfoCard({ icon, title, content, subtitle }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-lg text-blue-600 font-semibold mb-1">{content}</p>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ================================
// FOOTER COMPLET
// ================================
export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* À propos */}
          <div>
            <h4 className="text-xl font-bold mb-4 text-blue-400">À propos d'AutoMecanik</h4>
            <p className="text-gray-400 mb-4 leading-relaxed">
              Spécialiste de la vente de pièces détachées automobiles neuves et d'origine depuis plus de 10 ans.
              Qualité, rapidité et expertise à votre service.
            </p>
            <div className="flex gap-3">
              <SocialIcon icon={<Facebook />} href="https://facebook.com/automecanik" />
              <SocialIcon icon={<Twitter />} href="https://twitter.com/automecanik" />
              <SocialIcon icon={<Instagram />} href="https://instagram.com/automecanik" />
              <SocialIcon icon={<Youtube />} href="https://youtube.com/automecanik" />
              <SocialIcon icon={<Linkedin />} href="https://linkedin.com/company/automecanik" />
            </div>
          </div>

          {/* Liens utiles */}
          <div>
            <h4 className="text-xl font-bold mb-4 text-blue-400">Liens Utiles</h4>
            <ul className="space-y-2">
              <FooterLink to="/qui-sommes-nous" text="Qui sommes-nous ?" />
              <FooterLink to="/mentions-legales" text="Mentions légales" />
              <FooterLink to="/cgv" text="Conditions générales de vente" />
              <FooterLink to="/politique-confidentialite" text="Politique de confidentialité" />
              <FooterLink to="/cookies" text="Gestion des cookies" />
              <FooterLink to="/plan-du-site" text="Plan du site" />
            </ul>
          </div>

          {/* Service client */}
          <div>
            <h4 className="text-xl font-bold mb-4 text-blue-400">Service Client</h4>
            <ul className="space-y-2">
              <FooterLink to="/faq" text="FAQ" />
              <FooterLink to="/livraison" text="Livraison & Retours" />
              <FooterLink to="/garanties" text="Garanties" />
              <FooterLink to="/guide-achat" text="Guide d'achat" />
              <FooterLink to="/tutoriels" text="Tutoriels vidéo" />
              <FooterLink to="/mon-compte" text="Mon compte" />
            </ul>
          </div>

          {/* Newsletter rapide */}
          <div>
            <h4 className="text-xl font-bold mb-4 text-blue-400">Restez informé</h4>
            <p className="text-gray-400 mb-4">Recevez nos offres exclusives</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Votre email"
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
                OK
              </button>
            </div>

            {/* Moyens de paiement */}
            <div className="mt-6">
              <h5 className="text-sm font-semibold mb-3 text-gray-400">Paiement sécurisé</h5>
              <div className="flex flex-wrap gap-2">
                <PaymentBadge text="VISA" />
                <PaymentBadge text="MC" />
                <PaymentBadge text="PayPal" />
                <PaymentBadge text="CB" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm text-center md:text-left">
              &copy; 2025 AutoMecanik. Tous droits réservés. | Conçu avec ❤️ en France
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500">
              <span>🔒 Paiement sécurisé</span>
              <span>🚚 Livraison rapide</span>
              <span>✓ Garantie constructeur</span>
              <span>📞 Support 24/7</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, text }: { to: string; text: string }) {
  return (
    <li>
      <Link to={to} className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
        {text}
      </Link>
    </li>
  );
}

function SocialIcon({ icon, href }: { icon: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-10 h-10 bg-gray-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors"
    >
      {icon}
    </a>
  );
}

function PaymentBadge({ text }: { text: string }) {
  return (
    <span className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-semibold">
      {text}
    </span>
  );
}

// ================================
// BOUTON CHAT EN DIRECT
// ================================
export function LiveChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-110 z-50 flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 animate-slide-up">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-2xl">
            <h3 className="font-bold text-lg">Chat en direct</h3>
            <p className="text-sm text-blue-100">Nous sommes là pour vous aider !</p>
          </div>
          <div className="p-4 h-96 overflow-y-auto">
            <div className="space-y-4">
              <ChatMessage
                isBot
                message="Bonjour ! Comment puis-je vous aider aujourd'hui ?"
                time="Maintenant"
              />
            </div>
          </div>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Votre message..."
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChatMessage({ isBot, message, time }: any) {
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] ${isBot ? 'bg-gray-100' : 'bg-blue-600 text-white'} rounded-xl p-3`}>
        <p className="text-sm">{message}</p>
        <p className={`text-xs mt-1 ${isBot ? 'text-gray-500' : 'text-blue-100'}`}>{time}</p>
      </div>
    </div>
  );
}

// ================================
// POP-UP D'INSCRIPTION
// ================================
export function SignupPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000); // Apparaît après 5 secondes

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-slide-up">
        <div className="relative">
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-3xl font-bold text-gray-900 mb-2">
              Offre exclusive !
            </h3>
            <p className="text-xl text-gray-600 mb-6">
              <span className="text-blue-600 font-bold">-10%</span> sur votre première commande
            </p>
            <p className="text-gray-600 mb-6">
              Inscrivez-vous à notre newsletter et recevez immédiatement votre code promo
            </p>

            <form className="space-y-4">
              <input
                type="email"
                placeholder="Votre adresse email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                required
              />
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
              >
                J'en profite maintenant
              </button>
            </form>

            <p className="text-xs text-gray-500 mt-4">
              En vous inscrivant, vous acceptez de recevoir nos offres par email
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
