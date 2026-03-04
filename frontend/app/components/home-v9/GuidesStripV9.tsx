import { Link } from "@remix-run/react";
import { BookOpen, Calendar, ChevronRight, FileText } from "lucide-react";
import { Card } from "~/components/ui/card";

const GUIDES = [
  {
    ico: BookOpen,
    t: "Guides d'achat",
    s: "12 guides",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    link: "/blog-pieces-auto/guide-achat",
  },
  {
    ico: FileText,
    t: "Réf. techniques",
    s: "OEM & aftermarket",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-100",
    link: "/reference-auto",
  },
  {
    ico: Calendar,
    t: "Entretien",
    s: "Par kilométrage",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    link: "/blog-pieces-auto/conseils",
  },
];

export default function GuidesStripV9() {
  return (
    <section className="px-5 pb-6 bg-slate-50 lg:py-8">
      <div className="max-w-[1280px] mx-auto lg:px-8">
        <div className="flex gap-2.5 overflow-x-auto hide-scroll lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible">
          {GUIDES.map((c) => {
            const Icon = c.ico;
            return (
              <Link key={c.t} to={c.link}>
                <Card
                  className={`flex-shrink-0 flex items-center gap-3 px-4 py-3.5 lg:px-5 lg:py-4 border ${c.border} rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all group lg:w-auto`}
                >
                  <div
                    className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${c.bg} flex items-center justify-center group-hover:scale-105 transition-transform`}
                  >
                    <Icon size={18} className={`${c.color} lg:!w-5 lg:!h-5`} />
                  </div>
                  <div>
                    <div className="text-[12px] lg:text-[14px] font-semibold text-slate-800 font-v9-heading">
                      {c.t}
                    </div>
                    <div className="text-[10px] lg:text-[12px] text-slate-400">
                      {c.s}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 ml-1" />
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
