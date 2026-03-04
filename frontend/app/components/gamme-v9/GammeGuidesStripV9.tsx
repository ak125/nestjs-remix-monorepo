import { Link } from "@remix-run/react";
import { ArrowRight, BookOpen, FileText, Settings } from "lucide-react";

interface GuideItem {
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  gradient: string;
  tag: string;
  link: string;
}

interface GammeGuidesStripV9Props {
  gammeName: string;
  pgAlias?: string;
}

export default function GammeGuidesStripV9({
  gammeName,
  pgAlias,
}: GammeGuidesStripV9Props) {
  const guides: GuideItem[] = [
    {
      icon: BookOpen,
      title: "Guide d'achat",
      subtitle: "Critères & budget",
      gradient: "from-blue-500 to-blue-400",
      tag: "Guide",
      link: pgAlias
        ? `/blog-pieces-auto/guide-achat/${pgAlias}`
        : "/blog-pieces-auto/guide-achat",
    },
    {
      icon: Settings,
      title: `Entretien ${gammeName.toLowerCase().slice(0, 20)}`,
      subtitle: "Par kilométrage",
      gradient: "from-emerald-500 to-emerald-400",
      tag: "Conseil",
      link: pgAlias
        ? `/blog-pieces-auto/conseils/${pgAlias}`
        : "/blog-pieces-auto/conseils",
    },
    {
      icon: FileText,
      title: "Réf. techniques",
      subtitle: "OEM & aftermarket",
      gradient: "from-purple-500 to-purple-400",
      tag: "Fiche",
      link: "/reference-auto",
    },
  ];

  return (
    <section className="px-5 pb-7 lg:py-8 bg-slate-50">
      <div className="max-w-[1280px] mx-auto lg:px-8">
        <div className="flex gap-2.5 overflow-x-auto hide-scroll lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible">
          {guides.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.title} to={c.link}>
                <div className="flex-shrink-0 w-[200px] lg:w-auto bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group">
                  <div
                    className={`h-20 bg-gradient-to-br ${c.gradient} flex items-center justify-center relative`}
                  >
                    <Icon
                      size={28}
                      className="text-white/30 group-hover:text-white/50 group-hover:scale-110 transition-all"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur rounded-lg text-[9px] font-bold text-slate-700 shadow-sm">
                      {c.tag}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <div className="text-[12px] lg:text-[13px] font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors font-v9-heading">
                      {c.title}
                    </div>
                    <div className="text-[10px] lg:text-[11px] text-slate-400 font-normal mt-0.5">
                      {c.subtitle}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-semibold text-blue-600 group-hover:gap-1.5 transition-all">
                      Lire <ArrowRight size={10} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
