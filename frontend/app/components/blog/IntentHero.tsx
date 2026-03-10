/**
 * IntentHero — Hero avec 4 lanes intentionnelles
 * Remplace CompactBlogHeader sur la page index blog
 * Parcours : Diagnostiquer → Réparer → Choisir → Comprendre
 */
import { Link } from "@remix-run/react";
import {
  Stethoscope,
  Wrench,
  ShoppingCart,
  BookOpen,
  ArrowRight,
  BookMarked,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";

interface IntentHeroProps {
  stats?: {
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
  };
}

const INTENT_LANES = [
  {
    key: "diagnostic",
    title: "Diagnostiquer un symptôme",
    cta: "Diagnostiquer",
    icon: Stethoscope,
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-200 hover:border-orange-400",
    bgColor: "from-orange-50 to-white",
    textColor: "text-orange-600",
    subtitle: "Bruit, vibration, voyant… identifiez la cause",
    bullets: [
      "Identifier un bruit anormal",
      "Comprendre un voyant",
      "Tester un composant",
    ],
    href: "/blog-pieces-auto/conseils",
  },
  {
    key: "howto",
    title: "Réparer / Monter",
    subtitle: "Pas à pas illustré, outils, temps estimé",
    cta: "Voir les tutos",
    icon: Wrench,
    color: "from-blue-500 to-indigo-500",
    borderColor: "border-blue-200 hover:border-blue-400",
    bgColor: "from-blue-50 to-white",
    textColor: "text-blue-600",
    bullets: [
      "Tutoriels pas à pas",
      "Liste d'outils nécessaires",
      "Temps et difficulté",
    ],
    href: "/blog-pieces-auto/conseils",
  },
  {
    key: "buying",
    title: "Choisir la bonne pièce",
    subtitle: "Comparatifs OEM/adaptable, rapport qualité/prix",
    cta: "Comparer les pièces",
    icon: ShoppingCart,
    color: "from-green-500 to-emerald-500",
    borderColor: "border-green-200 hover:border-green-400",
    bgColor: "from-green-50 to-white",
    textColor: "text-green-600",
    bullets: [
      "Comparatifs détaillés",
      "Rapport qualité/prix",
      "Marques recommandées",
    ],
    href: "/blog-pieces-auto/guide-achat",
  },
  {
    key: "reference",
    title: "Comprendre un terme",
    subtitle: "Rôles, compositions, confusions courantes",
    cta: "Consulter le glossaire",
    icon: BookOpen,
    color: "from-indigo-500 to-purple-500",
    borderColor: "border-indigo-200 hover:border-indigo-400",
    bgColor: "from-indigo-50 to-white",
    textColor: "text-indigo-600",
    bullets: [
      "Rôles mécaniques",
      "Compositions détaillées",
      "Confusions courantes",
    ],
    href: "/reference-auto",
  },
] as const;

function formatViewsCompact(views: number): string {
  if (views > 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views > 1000) return `${(views / 1000).toFixed(0)}k`;
  return String(views);
}

export function IntentHero({ stats }: IntentHeroProps) {
  return (
    <section className="py-10 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      <div className="container mx-auto px-4">
        {/* Titre + sous-texte */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Blog pièces auto
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto leading-relaxed">
            Diagnostiquer une panne, comprendre une pièce, réussir un montage,
            choisir la bonne référence
          </p>

          {/* Stats pills */}
          {stats && stats.totalArticles > 0 && (
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                <BookMarked className="w-3.5 h-3.5" />
                <span>{stats.totalArticles}+ articles</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{formatViewsCompact(stats.totalViews)} vues</span>
              </div>
            </div>
          )}
        </div>

        {/* H2 descriptif */}
        <h2 className="text-center text-xl font-semibold text-blue-100 mb-6">
          Que cherchez-vous à faire ?
        </h2>

        {/* 4 Intent Lanes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {INTENT_LANES.map((lane) => (
            <Link
              key={lane.key}
              to={lane.href}
              prefetch="intent"
              className="group"
            >
              <Card
                className={`h-full border-2 ${lane.borderColor} hover:shadow-xl transition-all duration-300 bg-gradient-to-br ${lane.bgColor} overflow-hidden`}
              >
                <CardContent className="p-5">
                  <div
                    className={`bg-gradient-to-br ${lane.color} text-white rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                  >
                    <lane.icon className="w-6 h-6" />
                  </div>

                  <h3
                    className={`text-lg font-bold text-gray-900 mb-1 group-hover:${lane.textColor} transition-colors`}
                  >
                    {lane.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">{lane.subtitle}</p>

                  <ul className="space-y-1.5 text-sm text-gray-600 mb-3">
                    {lane.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-1.5">
                        <span
                          className={`mt-1 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${lane.color} flex-shrink-0`}
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`inline-flex items-center text-sm font-medium ${lane.textColor} group-hover:underline`}
                  >
                    {lane.cta}
                    <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
