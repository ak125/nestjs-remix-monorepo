import { Link } from "@remix-run/react";
import {
  ArrowRight,
  BookOpen,
  Clock,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { type BlogArticle } from "~/components/home/constants";
import { Card, CardContent } from "~/components/ui/card";

// Gradient by tag
function getTagStyle(tag: string) {
  if (tag.toLowerCase().includes("achat"))
    return { gradient: "from-blue-500 to-blue-400", Icon: ShoppingCart };
  if (tag.toLowerCase().includes("entretien"))
    return { gradient: "from-emerald-500 to-emerald-400", Icon: Wrench };
  return { gradient: "from-purple-500 to-purple-400", Icon: BookOpen };
}

export default function BlogCarouselV9({
  articles,
}: {
  articles: BlogArticle[];
}) {
  return (
    <section className="py-7 lg:py-10 bg-white">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between px-5 lg:px-8 mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Blog & Guides
          </h2>
          <Link
            to="/blog-pieces-auto"
            className="text-[12px] font-semibold text-blue-600 flex items-center gap-1 hover:gap-2 transition-all"
          >
            Voir tous <ArrowRight size={12} />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto px-5 pb-2 hide-scroll lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-8">
          {articles.slice(0, 3).map((b) => {
            const { gradient, Icon } = getTagStyle(b.tag);
            return (
              <Link
                key={b.t}
                to={b.link || "#"}
                className="flex-shrink-0 w-[250px] lg:w-auto"
              >
                <Card className="rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group h-full">
                  {/* Gradient header */}
                  <div
                    className={`h-24 lg:h-36 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
                  >
                    <Icon
                      size={36}
                      className="text-white/30 group-hover:text-white/50 group-hover:scale-110 transition-all lg:!w-12 lg:!h-12"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
                      {b.tag}
                    </span>
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-black/20 backdrop-blur rounded text-[9px] font-semibold text-white flex items-center gap-1">
                      <Clock size={8} /> 5 min
                    </span>
                  </div>
                  <CardContent className="p-4 lg:p-5">
                    <div className="text-[14px] font-semibold text-slate-800 leading-snug mb-1.5 line-clamp-2 group-hover:text-blue-700 transition-colors font-v9-heading">
                      {b.t}
                    </div>
                    <div className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                      {b.d}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-blue-600 group-hover:gap-2 transition-all">
                      Lire l&apos;article <ArrowRight size={11} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
