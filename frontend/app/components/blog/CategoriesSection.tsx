/**
 * CategoriesSection — 4 grandes cartes catégories (Montage, Constructeurs, Guide d'Achat, Glossaire)
 */
import { Link } from "@remix-run/react";
import {
  Wrench,
  Car,
  ShoppingCart,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Hash,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const CATEGORY_CARDS = [
  {
    title: "Montage et Entretien",
    description:
      "Guides détaillés pour installer et entretenir vos pièces auto",
    href: "/blog-pieces-auto/conseils",
    icon: Wrench,
    color: "orange",
    borderColor: "border-orange-200 hover:border-orange-400",
    bgGradient: "from-orange-50 to-white",
    iconGradient: "from-orange-500 to-red-600",
    badgeClass: "bg-orange-100 text-orange-800",
    badgeLabel: "150+ guides",
    bullets: ["Tutoriels pas à pas", "Conseils de pro", "Liste d'outils"],
  },
  {
    title: "Constructeurs Automobile",
    description: "Histoire, modèles et spécificités de chaque marque",
    href: "/blog-pieces-auto/auto",
    icon: Car,
    color: "blue",
    borderColor: "border-blue-200 hover:border-blue-400",
    bgGradient: "from-blue-50 to-white",
    iconGradient: "from-blue-500 to-indigo-600",
    badgeClass: "bg-info/20 text-info",
    badgeLabel: "35+ marques",
    bullets: [
      "Histoire des marques",
      "Modèles emblématiques",
      "Fiches techniques",
    ],
  },
  {
    title: "Guide d'Achat",
    description: "Conseils pour choisir les meilleures pièces au meilleur prix",
    href: "/blog-pieces-auto/guide-achat",
    icon: ShoppingCart,
    color: "green",
    borderColor: "border-green-200 hover:border-green-400",
    bgGradient: "from-green-50 to-white",
    iconGradient: "from-green-500 to-emerald-600",
    badgeClass: "bg-success/20 text-success",
    badgeLabel: "120+ guides",
    bullets: [
      "Comparatifs détaillés",
      "Rapport qualité/prix",
      "Marques recommandées",
    ],
  },
  {
    title: "Glossaire Auto",
    description: "Définitions techniques des pièces automobiles",
    href: "/reference-auto",
    icon: BookOpen,
    color: "indigo",
    borderColor: "border-indigo-200 hover:border-indigo-400",
    bgGradient: "from-indigo-50 to-white",
    iconGradient: "from-indigo-500 to-purple-600",
    badgeClass: "bg-indigo-100 text-indigo-800",
    badgeLabel: "138 définitions",
    bullets: [
      "Rôles mécaniques",
      "Compositions détaillées",
      "Confusions courantes",
    ],
  },
] as const;

const CHECK_COLORS: Record<string, string> = {
  orange: "text-orange-500",
  blue: "text-blue-500",
  green: "text-green-500",
  indigo: "text-indigo-500",
};

const ARROW_COLORS: Record<string, string> = {
  orange: "text-orange-600",
  blue: "text-blue-600",
  green: "text-green-600",
  indigo: "text-indigo-600",
};

const HOVER_COLORS: Record<string, string> = {
  orange: "group-hover:text-orange-600",
  blue: "group-hover:text-blue-600",
  green: "group-hover:text-green-600",
  indigo: "group-hover:text-indigo-600",
};

export function CategoriesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 text-lg">
            <Hash className="w-4 h-4 mr-2" />
            Nos Catégories
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Explorez nos contenus par thématique
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Guides complets, conseils d'experts et informations détaillées
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12 max-w-7xl mx-auto">
          {CATEGORY_CARDS.map((cat) => (
            <Link key={cat.href} to={cat.href} className="group">
              <Card
                className={`h-full border-2 ${cat.borderColor} hover:shadow-2xl transition-all duration-300 bg-gradient-to-br ${cat.bgGradient} overflow-hidden`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-muted rounded-bl-full opacity-50" />
                <CardHeader className="relative">
                  <div
                    className={`bg-gradient-to-br ${cat.iconGradient} text-white rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <cat.icon className="w-8 h-8" />
                  </div>
                  <CardTitle
                    className={`text-2xl font-bold text-gray-900 ${HOVER_COLORS[cat.color]} transition-colors`}
                  >
                    {cat.title}
                  </CardTitle>
                  <p className="text-gray-600 mt-2">{cat.description}</p>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={`${cat.badgeClass} text-sm`}>
                      {cat.badgeLabel}
                    </Badge>
                    <ArrowRight
                      className={`w-5 h-5 ${ARROW_COLORS[cat.color]} group-hover:translate-x-2 transition-transform`}
                    />
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {cat.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center">
                        <CheckCircle2
                          className={`w-4 h-4 mr-2 ${CHECK_COLORS[cat.color]}`}
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link to="/blog-pieces-auto/conseils">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold group shadow-lg hover:shadow-xl transition-all"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Tous les conseils par catégorie
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
