import { Link } from "@remix-run/react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Card } from "~/components/ui/card";

const GUIDES = [
  {
    ico: BookOpen,
    t: "Guides d'achat",
    s: "12 guides",
    desc: "Critères de choix, comparatifs et erreurs à éviter",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    link: "/blog-pieces-auto/guide-achat",
  },
  {
    ico: FileText,
    t: "Réf. techniques",
    s: "OEM & aftermarket",
    desc: "Correspondances constructeur et équivalences",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-100",
    link: "/reference-auto",
  },
  {
    ico: Calendar,
    t: "Entretien",
    s: "Par kilométrage",
    desc: "Intervalles de remplacement par motorisation",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    link: "/blog-pieces-auto/conseils",
  },
];

export default function GuidesStripV9() {
  return (
    <section className="px-5 py-7 bg-white lg:py-10">
      <div className="max-w-[1280px] mx-auto lg:px-8">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Ressources
          </h2>
          <Link
            to="/blog-pieces-auto"
            className="no-style no-visited text-[12px] font-semibold text-blue-600 flex items-center gap-1 hover:gap-2 transition-all"
          >
            Tout voir <ArrowRight size={12} />
          </Link>
        </div>

        {/* Cards grid */}
        <div className="flex gap-2.5 overflow-x-auto hide-scroll lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible">
          {GUIDES.map((c) => {
            const Icon = c.ico;
            return (
              <Link key={c.t} to={c.link} className="no-style no-visited">
                <Card
                  className={`flex-shrink-0 flex flex-col gap-3 px-4 py-4 lg:px-5 lg:py-5 border ${c.border} rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all group lg:w-auto`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${c.bg} flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0`}
                    >
                      <Icon
                        className={`${c.color} w-[18px] h-[18px] lg:w-5 lg:h-5`}
                      />
                    </div>
                    <div>
                      <div className="text-[13px] lg:text-[15px] font-semibold text-slate-800 font-v9-heading">
                        {c.t}
                      </div>
                      <div className="text-[10px] lg:text-[12px] text-slate-400">
                        {c.s}
                      </div>
                    </div>
                  </div>
                  <p className="text-[12px] lg:text-[13px] text-slate-500 leading-relaxed font-v9-body">
                    {c.desc}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] lg:text-[12px] font-semibold text-blue-600 group-hover:gap-2 transition-all">
                    Consulter <ChevronRight size={13} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
