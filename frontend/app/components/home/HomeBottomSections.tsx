/**
 * 📧 SECTIONS FINALES HOMEPAGE
 *
 * Regroupe les sections Newsletter + Advantages + Contact CTA
 * Extrait de _index.tsx pour modularité
 *
 * Sections incluses :
 * - Advantages : Stats + Services + CTA (84 lignes)
 * - Newsletter : Formulaire avec RGPD (77 lignes)
 * - Contact CTA : Boutons d'action (25 lignes)
 */

import { Link } from "@remix-run/react";
import { CheckCircle2, ChevronRight, Phone, Shield } from "lucide-react";
import { Button } from "../ui/button";

interface HomeBottomSectionsProps {
  newsletter: {
    email: string;
    setEmail: (email: string) => void;
    isSubmitting: boolean;
    success: boolean;
    handleSubmit: (e: React.FormEvent) => void;
  };
}

export default function HomeBottomSections({
  newsletter,
}: HomeBottomSectionsProps) {
  return (
    <>
      {/* 🌟 NOS AVANTAGES - Section optimisée avec preuve sociale + stats + CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/40">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* En-tête premium */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Pourquoi{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                50 000 professionnels
              </span>{" "}
              nous font confiance
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Leader B2B des pièces automobiles avec garantie du meilleur
              service
            </p>
          </div>

          {/* Statistiques en temps réel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { stat: "98%", label: "Clients satisfaits", icon: "⭐" },
              { stat: "24h", label: "Délai moyen", icon: "⚡" },
              { stat: "120+", label: "Marques", icon: "🏭" },
              { stat: "50K+", label: "Références", icon: "📦" },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 text-center border border-blue-200/30 hover:shadow-lg transition-all"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-2xl font-bold text-gray-900">
                  {item.stat}
                </div>
                <div className="text-sm text-gray-600">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Deux colonnes : Services + CTA */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Colonne 1: 3 Services clés */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Nos promesses
              </h3>
              {[
                {
                  icon: "✅",
                  title: "100% Certifiées",
                  desc: "Pièces neuves ou origin garanties",
                },
                {
                  icon: "🚚",
                  title: "Express 24-48h",
                  desc: "Partout en France métrop",
                },
                {
                  icon: "🔒",
                  title: "Paiement Sûr",
                  desc: "Cryptage SSL certifié",
                },
              ].map((service, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl p-4 border border-gray-200/50 hover:shadow-md transition-all"
                >
                  <div className="text-2xl mb-2">{service.icon}</div>
                  <h4 className="font-bold text-gray-900">{service.title}</h4>
                  <p className="text-sm text-gray-600">{service.desc}</p>
                </div>
              ))}
            </div>

            {/* Colonne 2: CTA + Avantages */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-8 text-white flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-6">Prêt à commander ?</h3>
                <ul className="space-y-3 mb-8">
                  {[
                    "✨ Commande en 2 minutes",
                    "📊 Suivi en temps réel",
                    "💰 Prix garantis bas",
                    "🎁 Offre de bienvenue",
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm">
                      <span>{item.split(" ")[0]}</span>
                      <span>{item.substring(item.indexOf(" ") + 1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/#catalogue"
                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold py-3 rounded-xl transition-all text-center"
              >
                Explorer le catalogue →
              </Link>
            </div>
          </div>

          {/* Ligne bonus : Trust badges */}
          <div className="mt-12 pt-12 border-t border-gray-200 text-center">
            <p className="text-gray-600 mb-4 text-sm">
              Reconnu par les professionnels
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-gray-500 text-xs font-semibold">
              <span>✅ Certifié B2B</span>
              <span>🔒 Paiements Sécurisés</span>
              <span>📞 Support 24/7</span>
              <span>🚚 Livraison Garantie</span>
            </div>
          </div>
        </div>
      </section>

      {/* 📧 NEWSLETTER - Moderne et épuré avec RGPD */}
      <section className="py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Restez informé
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Recevez nos offres exclusives et nouveautés
            </p>

            <form onSubmit={newsletter.handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  value={newsletter.email}
                  onChange={(e) => newsletter.setEmail(e.target.value)}
                  placeholder="Votre adresse email"
                  className="flex-1 px-6 py-4 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg transition-all"
                  required
                  disabled={newsletter.isSubmitting}
                  aria-label="Adresse email pour la newsletter"
                  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg px-8 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={newsletter.isSubmitting}
                >
                  {newsletter.isSubmitting ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      Envoi...
                    </>
                  ) : (
                    "S'abonner"
                  )}
                </Button>
              </div>

              {/* Checkbox RGPD */}
              <label className="flex items-start gap-3 text-left text-sm text-blue-100 cursor-pointer hover:text-white transition-colors max-w-xl mx-auto">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 w-4 h-4 rounded border-2 border-white/30 bg-white/10 checked:bg-white checked:border-white focus:ring-2 focus:ring-white/50 cursor-pointer"
                  aria-label="Consentement RGPD"
                />
                <span>
                  J'accepte de recevoir les offres et actualités d'Automecanik
                  par email. Vous pouvez vous désinscrire à tout moment.
                  <Link
                    to="/politique-confidentialite"
                    className="underline hover:text-white font-medium ml-1"
                  >
                    Politique de confidentialité
                  </Link>
                </span>
              </label>
            </form>

            {newsletter.success && (
              <div className="mt-6 bg-green-500/20 border border-green-400/50 rounded-lg px-4 py-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                <span className="text-green-100 font-medium">
                  Merci ! Vous êtes inscrit à notre newsletter. Vérifiez votre
                  boîte de réception.
                </span>
              </div>
            )}

            <p className="text-sm text-blue-200 mt-6 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" aria-hidden="true" />
              Vos données sont protégées et ne seront jamais partagées
            </p>
          </div>
        </div>
      </section>

      {/* 📞 CTA CONTACT - Compact */}
      <section className="py-12 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">Une question ?</h3>
              <p className="text-gray-300">
                Nos experts sont là pour vous aider
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                asChild
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Link to="/contact">
                  <Phone className="mr-2 h-5 w-5" />
                  Nous contacter
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-gray-900"
              >
                <Link to="/#catalogue">
                  Voir le catalogue
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
