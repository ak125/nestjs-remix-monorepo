/**
 * 📋 SECTION FAQ HOMEPAGE
 *
 * Composant FAQ optimisé pour la page d'accueil avec :
 * ✅ Schema.org FAQPage pour SEO
 * ✅ Accordion Shadcn UI avec animations
 * ✅ 4 questions principales
 * ✅ Design moderne avec icônes et couleurs
 *
 * Extrait de _index.tsx (lignes 687-987) pour modularité
 */

import {
  Award,
  CheckCircle2,
  Clock,
  Package,
  Search,
  Shield,
  Star,
  Truck,
  Users,
  Zap,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

export default function HomeFAQSection() {
  return (
    <div
      className="max-w-4xl mx-auto mt-12 pt-8 border-t border-gray-200"
      role="region"
      aria-labelledby="faq-title"
    >
      {/* Schema.org FAQPage structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Comment trouver les pièces compatibles avec mon véhicule ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Utilisez notre sélecteur de véhicule en renseignant votre immatriculation, marque et modèle, ou recherchez par numéro VIN. Notre système affiche automatiquement uniquement les pièces 100% compatibles avec votre véhicule.",
                },
              },
              {
                "@type": "Question",
                name: "Quelle est la différence entre une pièce d'origine et une pièce équivalente ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Les pièces d'origine sont fabriquées par le constructeur automobile avec garantie constructeur officielle, qualité OEM certifiée et compatibilité parfaite. Les pièces équivalentes premium offrent une qualité équivalente certifiée, respectent les normes constructeurs, sont proposées à des prix plus avantageux (-30% en moyenne) et incluent une garantie fabricant.",
                },
              },
              {
                "@type": "Question",
                name: "Quels sont vos délais de livraison ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Expédition sous 24h ouvrées pour les pièces en stock. Livraison express 24-48h disponible en France métropolitaine. Suivi en temps réel de votre colis avec numéro de tracking. Livraison gratuite pour toute commande supérieure à 150€ HT avec emballage sécurisé et assurance incluse.",
                },
              },
              {
                "@type": "Question",
                name: "Couvrez-vous toutes les marques automobiles ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Nous proposons plus de 50 marques et 50 000 références de pièces dans notre catalogue, incluant les marques françaises (Renault, Peugeot, Citroën, DS, Dacia, Alpine), allemandes (VW, BMW, Mercedes, Audi, Opel, Porsche, Smart), asiatiques (Toyota, Honda, Nissan, Mazda, Hyundai, Kia, Suzuki) et bien d'autres. Notre catalogue couvre les marques premium, généralistes, utilitaires et véhicules électriques.",
                },
              },
            ],
          }),
        }}
      />

      <div className="mb-6">
        <h2
          id="faq-title"
          className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
        >
          Questions fréquentes
        </h2>
        <p className="text-sm text-gray-600">
          Tout ce que vous devez savoir sur nos pièces et services
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-4">
        {/* Question 1 - Recherche pièces avec icône 🔍 */}
        <AccordionItem
          value="q1"
          className="group bg-gradient-to-br from-white to-blue-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-blue-400 hover:shadow-lg transition-all duration-300"
        >
          <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
            <span className="flex items-center gap-4">
              <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </span>
              <span className="flex-1">
                Comment trouver les pièces compatibles avec mon véhicule ?
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
            <p className="mb-4 text-gray-800">
              <strong className="text-blue-600">
                3 méthodes simples et rapides
              </strong>{" "}
              pour garantir la compatibilité :
            </p>
            <div className="space-y-3">
              <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                  1
                </span>
                <div>
                  <strong className="text-gray-900 block mb-1.5">
                    🎯 Par logo de marque
                  </strong>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Cliquez sur le logo → Sélectionnez modèle, année et
                    motorisation. Simple et intuitif pour tous types de
                    véhicules.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-gray-200 hover:border-green-300 transition-colors">
                <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold">
                  2
                </span>
                <div>
                  <strong className="text-gray-900 block mb-1.5">
                    ✅ Par numéro VIN (recommandé)
                  </strong>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Saisissez votre numéro de châssis pour une{" "}
                    <strong className="text-green-600">
                      compatibilité garantie à 100%
                    </strong>
                    . La méthode la plus fiable.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold">
                  3
                </span>
                <div>
                  <strong className="text-gray-900 block mb-1.5">
                    🔍 Par référence OEM
                  </strong>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Entrez la référence constructeur de votre pièce actuelle.
                    Idéal pour remplacer une pièce existante.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
              <p className="text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                <span className="text-xl flex-shrink-0">💡</span>
                <span>
                  <strong>Besoin d'aide ?</strong> Notre équipe d'experts vous
                  accompagne dans votre recherche pour vous garantir la pièce
                  parfaitement adaptée.
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Question 2 - Qualité pièces avec icône 🛡️ */}
        <AccordionItem
          value="q2"
          className="group bg-gradient-to-br from-white to-green-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-green-400 hover:shadow-lg transition-all duration-300"
        >
          <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-green-600 py-4">
            <span className="flex items-center gap-4">
              <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </span>
              <span className="flex-1">
                Quelle est la qualité des pièces proposées ?
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
            <p className="mb-4 text-gray-800">
              Nous proposons{" "}
              <strong className="text-green-600">
                2 gammes de qualité premium
              </strong>{" "}
              selon vos besoins et budget :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <strong className="text-gray-900 text-base">
                    Pièces d'origine
                  </strong>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Garantie constructeur officielle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Qualité OEM certifiée à 100%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Compatibilité parfaite garantie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Traçabilité complète des pièces</span>
                  </li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-5 rounded-xl border-2 border-green-200 hover:border-green-400 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <strong className="text-gray-900 text-base">
                    Équivalents premium
                  </strong>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Qualité équivalente certifiée</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Respect normes constructeurs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Prix plus avantageux (-30% moy.)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Garantie fabricant incluse</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <p className="text-xs text-gray-800 font-medium flex items-start gap-2 leading-relaxed">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Notre engagement qualité :</strong> Toutes nos pièces
                  sont rigoureusement sélectionnées et testées pour garantir
                  <strong className="text-blue-600">
                    {" "}
                    fiabilité, sécurité et conformité aux standards européens
                  </strong>
                  .
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Question 3 - Délais livraison avec icône ⏱️ */}
        <AccordionItem
          value="q3"
          className="group bg-gradient-to-br from-white to-orange-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-orange-400 hover:shadow-lg transition-all duration-300"
        >
          <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-orange-600 py-4">
            <span className="flex items-center gap-4">
              <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </span>
              <span className="flex-1">
                Quels sont vos délais de livraison ?
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
            <p className="mb-4 text-gray-800">
              <strong className="text-orange-600">
                Livraison rapide partout en France
              </strong>{" "}
              pour minimiser vos temps d'immobilisation :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white p-5 rounded-xl border-2 border-green-200 hover:border-green-400 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <strong className="text-gray-900 text-base">
                    Livraison Standard
                  </strong>
                </div>
                <p className="text-gray-700 mb-2">
                  <strong className="text-green-600 text-lg">24-48h</strong>{" "}
                  pour les pièces en stock
                </p>
                <p className="text-xs text-gray-600">
                  Idéal pour les commandes non urgentes. Suivi colis inclus.
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-xl border-2 border-orange-300 hover:border-orange-500 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <strong className="text-gray-900 text-base">
                    Livraison Express
                  </strong>
                </div>
                <p className="text-gray-700 mb-2">
                  <strong className="text-orange-600 text-lg">
                    Livraison J+1
                  </strong>{" "}
                  avant 12h
                </p>
                <p className="text-xs text-gray-600">
                  Pour les urgences. Commande avant 15h = livraison le
                  lendemain.
                </p>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-700 leading-relaxed">
                  <p className="font-semibold text-gray-900 mb-1">
                    📍 Livraison gratuite
                  </p>
                  <p>
                    Pour toute commande supérieure à{" "}
                    <strong className="text-blue-600">150€ HT</strong>.
                    Emballage sécurisé et assurance incluse.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Question 4 - Couverture marques avec icône 👥 */}
        <AccordionItem
          value="q4"
          className="group bg-gradient-to-br from-white to-purple-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-purple-400 hover:shadow-lg transition-all duration-300"
        >
          <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-purple-600 py-4">
            <span className="flex items-center gap-4">
              <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </span>
              <span className="flex-1">
                Couvrez-vous toutes les marques automobiles ?
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
            <p className="mb-4 text-gray-800">
              <strong className="text-purple-600">Plus de 50 marques</strong> et{" "}
              <strong className="text-purple-600">50 000 références</strong> de
              pièces disponibles dans notre catalogue :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <div className="text-center mb-3">
                  <div className="inline-flex w-12 h-12 bg-blue-100 rounded-xl items-center justify-center text-2xl mb-2">
                    🇫🇷
                  </div>
                  <strong className="text-gray-900 block text-sm">
                    Marques françaises
                  </strong>
                </div>
                <p className="text-xs text-gray-600 text-center leading-relaxed">
                  Renault • Peugeot • Citroën • DS Automobiles • Dacia • Alpine
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border-2 border-red-200 hover:border-red-400 transition-colors">
                <div className="text-center mb-3">
                  <div className="inline-flex w-12 h-12 bg-red-100 rounded-xl items-center justify-center text-2xl mb-2">
                    🇩🇪
                  </div>
                  <strong className="text-gray-900 block text-sm">
                    Marques allemandes
                  </strong>
                </div>
                <p className="text-xs text-gray-600 text-center leading-relaxed">
                  VW • BMW • Mercedes • Audi • Opel • Porsche • Smart
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border-2 border-green-200 hover:border-green-400 transition-colors">
                <div className="text-center mb-3">
                  <div className="inline-flex w-12 h-12 bg-green-100 rounded-xl items-center justify-center text-2xl mb-2">
                    🌏
                  </div>
                  <strong className="text-gray-900 block text-sm">
                    Marques asiatiques
                  </strong>
                </div>
                <p className="text-xs text-gray-600 text-center leading-relaxed">
                  Toyota • Honda • Nissan • Mazda • Hyundai • Kia • Suzuki
                </p>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
              <p className="text-xs text-purple-900 flex items-start gap-2 leading-relaxed font-medium">
                <span className="text-xl flex-shrink-0">🔧</span>
                <span>
                  <strong>Catalogue exhaustif :</strong> Marques premium,
                  généralistes, utilitaires et véhicules électriques. Du City
                  car au SUV, toutes motorisations confondues.
                </span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
