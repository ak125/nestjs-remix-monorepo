import { Link } from "@remix-run/react";
import { ArrowRight, BookOpen, ShoppingCart, Wrench } from "lucide-react";
import { Reveal, Section, SectionHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { type BlogArticle } from "./constants";

export default function BlogGuidesSection({
  articles,
}: {
  articles: BlogArticle[];
}) {
  return (
    <Section variant="slate" spacing="md">
      <SectionHeader
        title="Blog & Guides"
        sub="Conseils pratiques pour l'entretien de votre véhicule"
        linkText="Voir tous les guides"
        linkHref="/blog-pieces-auto"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {articles.slice(0, 3).map((article, i) => {
          const BlogIcon =
            article.tag === "Guide d'achat"
              ? ShoppingCart
              : article.tag === "Entretien"
                ? Wrench
                : BookOpen;
          return (
            <Reveal key={article.t} delay={i * 80}>
              <Link to={article.link || "#"}>
                <Card className="group h-full rounded-2xl border-[1.5px] overflow-hidden hover:border-cta/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  <CardContent className="p-5 sm:p-6 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge
                        variant="secondary"
                        className="px-2.5 py-0.5 text-[10px] font-semibold bg-orange-50 text-cta rounded-full border-0"
                      >
                        {article.tag}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center flex-shrink-0">
                        <BlogIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug mb-1.5 group-hover:text-cta transition-colors">
                          {article.t}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {article.d}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 text-xs font-semibold text-cta">
                      Lire l&apos;article{" "}
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
