/**
 * BlogFAQ — 5 questions fréquentes statiques (SEO + UX)
 * Apparaît sur la page index blog pour donner du contenu utile sans cliquer
 */
import { Link } from "@remix-run/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
  link?: { label: string; href: string };
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Quels sont les symptômes d'un alternateur HS ?",
    answer:
      "Les signes principaux sont un voyant batterie allumé au tableau de bord, des phares qui faiblissent progressivement, des difficultés au démarrage et une batterie qui se décharge rapidement même après recharge. Un bruit de grincement ou de sifflement au niveau du moteur peut aussi indiquer un roulement d'alternateur usé. Si plusieurs de ces symptômes apparaissent en même temps, faites tester l'alternateur rapidement.",
    link: {
      label: "Lire le guide complet alternateur",
      href: "/blog-pieces-auto/conseils/alternateur",
    },
  },
  {
    question: "Comment choisir une pièce compatible avec mon véhicule ?",
    answer:
      "La méthode la plus fiable est de vérifier la référence OEM (constructeur) de la pièce d'origine, visible sur la pièce elle-même ou dans le carnet d'entretien. Vous pouvez aussi utiliser notre sélecteur de véhicule pour filtrer les pièces par marque, modèle et motorisation. Comparez ensuite les caractéristiques techniques (dimensions, puissance, connectique) avec la fiche produit.",
    link: { label: "Utiliser le sélecteur de véhicule", href: "/pieces" },
  },
  {
    question: "Quelle différence entre pièce OEM et adaptable ?",
    answer:
      "Une pièce OEM (Original Equipment Manufacturer) est fabriquée par ou pour le constructeur automobile — c'est la pièce identique à celle montée en usine. Une pièce adaptable (aftermarket) est fabriquée par un équipementier indépendant selon les mêmes spécifications. Les deux sont compatibles avec votre véhicule. Les pièces OEM offrent la garantie constructeur, tandis que les pièces adaptables de qualité équivalente coûtent souvent 20 à 40% moins cher.",
    link: { label: "Voir le glossaire auto", href: "/reference-auto" },
  },
  {
    question: "Quand faut-il remplacer ses plaquettes de frein ?",
    answer:
      "En moyenne tous les 30 000 à 50 000 km selon votre style de conduite, le type de plaquettes et l'environnement (ville ou route). Les signaux d'alerte à surveiller : un bruit de frottement métallique au freinage, une pédale de frein molle ou spongieuse, un voyant frein allumé, ou des distances de freinage qui s'allongent. Certaines plaquettes disposent d'un témoin d'usure électronique qui déclenche un voyant automatiquement.",
    link: {
      label: "Guide plaquettes de frein",
      href: "/blog-pieces-auto/conseils/plaquette-de-frein",
    },
  },
  {
    question: "Peut-on rouler avec un embrayage qui patine ?",
    answer:
      "Non, il est fortement déconseillé de continuer à rouler. Un embrayage qui patine s'use de manière accélérée et risque d'endommager le volant moteur — une réparation bien plus coûteuse. Les symptômes typiques : le régime moteur monte sans que la voiture accélère, une odeur de brûlé, ou un point de patinage qui remonte progressivement. Faites remplacer le kit embrayage complet dès les premiers symptômes.",
    link: {
      label: "Guide embrayage complet",
      href: "/blog-pieces-auto/conseils/kit-embrayage",
    },
  },
];

export function BlogFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Questions fréquentes
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Les réponses aux questions les plus posées par nos utilisateurs
          </p>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {openIndex === index && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-600 leading-relaxed mb-3">
                      {item.answer}
                    </p>
                    {item.link && (
                      <Link
                        to={item.link.href}
                        prefetch="intent"
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm inline-flex items-center"
                      >
                        {item.link.label} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * JSON-LD FAQPage schema pour injection dans le head
 */
export function buildFAQJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
