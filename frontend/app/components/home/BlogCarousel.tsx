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

function getTagStyle(tag: string) {
  if (tag.toLowerCase().includes("achat"))
    return { gradient: "from-blue-500 to-blue-400", Icon: ShoppingCart };
  if (tag.toLowerCase().includes("entretien"))
    return { gradient: "from-emerald-500 to-emerald-400", Icon: Wrench };
  return { gradient: "from-purple-500 to-purple-400", Icon: BookOpen };
}

/* ── Mobile: Featured large card (1st article) ── */
function FeaturedCard({ b }: { b: BlogArticle }) {
  const { gradient, Icon } = getTagStyle(b.tag);
  return (
    <Link to={b.link || "#"} className="no-style no-visited lg:hidden group">
      <Card className="rounded-[28px] border overflow-hidden shadow-[0_14px_34px_rgba(15,23,42,0.08)] hover:shadow-xl transition-all duration-200">
        <div
          className={`relative aspect-[16/10] overflow-hidden ${b.img ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`}`}
        >
          {b.img ? (
            <img
              src={b.img}
              alt={b.t}
              width={600}
              height={375}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <Icon
              size={48}
              className="absolute inset-0 m-auto text-white/30 group-hover:text-white/50 transition-all"
            />
          )}
          <span className="absolute top-4 left-4 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            {b.tag}
          </span>
          <span className="absolute top-4 right-4 px-2.5 py-1 bg-black/20 backdrop-blur rounded-full text-[10px] font-semibold text-white flex items-center gap-1">
            <Clock size={9} /> 5 min
          </span>
        </div>
        <CardContent className="p-5">
          <h3 className="text-[1.5rem] font-extrabold text-slate-900 leading-[1.15] tracking-[-0.03em] mb-2 line-clamp-2 group-hover:text-blue-700 transition-colors font-v9-heading">
            {b.t}
          </h3>
          <p className="text-[14px] text-slate-500 line-clamp-2 leading-relaxed mb-4">
            {b.d}
          </p>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-5 py-3 text-white text-[14px] font-semibold group-hover:gap-3 transition-all">
            Lire l&apos;article <ArrowRight size={14} />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ── Mobile: Compact card (articles 2-3) ── */
function CompactCard({ b }: { b: BlogArticle }) {
  const { gradient, Icon } = getTagStyle(b.tag);
  return (
    <Link to={b.link || "#"} className="no-style no-visited lg:hidden group">
      <Card className="rounded-[20px] border overflow-hidden shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-lg transition-all duration-200 flex flex-row h-24">
        <div
          className={`w-24 h-full flex-shrink-0 overflow-hidden ${b.img ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`}`}
        >
          {b.img ? (
            <img
              src={b.img}
              alt={b.t}
              width={96}
              height={96}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon size={24} className="text-white/40" />
            </div>
          )}
        </div>
        <CardContent className="p-3 flex flex-col justify-center flex-1 min-w-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
            {b.tag}
          </span>
          <h3 className="text-[14px] font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors font-v9-heading">
            {b.t}
          </h3>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ── Desktop: Standard card (3-col grid) ── */
function DesktopCard({ b }: { b: BlogArticle }) {
  const { gradient, Icon } = getTagStyle(b.tag);
  return (
    <Link
      to={b.link || "#"}
      className="no-style no-visited hidden lg:block group"
    >
      <Card className="rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200 h-full">
        <div
          className={`h-36 relative overflow-hidden ${b.img ? "bg-slate-100" : `bg-gradient-to-br ${gradient}`}`}
        >
          {b.img ? (
            <img
              src={b.img}
              alt={b.t}
              width={400}
              height={192}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <Icon
              size={48}
              className="absolute inset-0 m-auto text-white/30 group-hover:text-white/50 group-hover:scale-110 transition-all"
            />
          )}
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
            {b.tag}
          </span>
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-black/20 backdrop-blur rounded text-[9px] font-semibold text-white flex items-center gap-1">
            <Clock size={8} /> 5 min
          </span>
        </div>
        <CardContent className="p-5">
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
}

export default function BlogCarousel({
  articles,
}: {
  articles: BlogArticle[];
}) {
  const items = articles.slice(0, 4);
  const [first, ...rest] = items;

  if (!first) return null;

  return (
    <section className="py-7 lg:py-10 bg-white">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between px-5 lg:px-8 mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Blog & Guides
          </h2>
          <Link
            to="/blog-pieces-auto"
            className="no-style no-visited text-base font-semibold text-blue-600 flex items-center gap-1 hover:gap-2 transition-all"
          >
            Voir tous <ArrowRight size={14} />
          </Link>
        </div>

        {/* Mobile: Featured + compact */}
        <div className="flex flex-col gap-3 px-5 lg:hidden">
          <FeaturedCard b={first} />
          {rest.map((b) => (
            <CompactCard key={b.t} b={b} />
          ))}
        </div>

        {/* Desktop: 4-col grid */}
        <div className="hidden lg:grid lg:grid-cols-4 lg:gap-5 lg:px-8">
          {items.map((b) => (
            <DesktopCard key={b.t} b={b} />
          ))}
        </div>
      </div>
    </section>
  );
}
