/**
 * DiagnosticSection — "Diagnostiquer par symptôme"
 * Affiche les articles diagnostic les plus populaires avec des chips symptômes
 */
import { Link } from "@remix-run/react";
import { Stethoscope, ArrowRight, Eye } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  type BlogArticle,
  getArticleUrl,
  formatReadingTime,
  formatViews,
} from "./blog-helpers";

const SYMPTOM_CHIPS = [
  "Bruit anormal",
  "Voyant allumé",
  "Vibration",
  "Fumée",
  "Démarrage difficile",
  "Surchauffe",
] as const;

interface DiagnosticSectionProps {
  articles: BlogArticle[];
}

export function DiagnosticSection({ articles }: DiagnosticSectionProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="py-12 bg-gradient-to-br from-orange-50 to-red-50">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Diagnostiquer par symptôme
            </h2>
          </div>
          <p className="text-gray-600 mb-6 ml-13">
            Identifiez la pièce en cause à partir de ce que vous observez
          </p>

          {/* Symptom chips */}
          <div className="flex flex-wrap gap-2 mb-8">
            {SYMPTOM_CHIPS.map((symptom) => (
              <Badge
                key={symptom}
                variant="outline"
                className="px-3 py-1.5 text-sm border-orange-300 text-orange-700 bg-white hover:bg-orange-100 cursor-default"
              >
                {symptom}
              </Badge>
            ))}
          </div>

          {/* Article cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.slice(0, 6).map((article) => (
              <Link
                key={article.id}
                to={getArticleUrl(article)}
                prefetch="intent"
                className="group"
              >
                <Card className="h-full border border-orange-200 hover:border-orange-400 hover:shadow-lg transition-all bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className="bg-orange-100 text-orange-700 text-xs flex-shrink-0">
                        Diagnostic
                      </Badge>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatViews(article.viewsCount)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2 mb-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatReadingTime(article.readingTime)}</span>
                      <span className="text-orange-600 font-medium group-hover:underline inline-flex items-center gap-1">
                        Lire
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <Link to="/blog-pieces-auto/conseils">
              <Button
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100 group"
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Ouvrir le diagnostic complet
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
