import { Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { getFamilyTheme } from "~/utils/family-theme";

interface FamilleItem {
  name: string;
  link: string;
  img?: string;
  icon?: string;
}

interface GammeFamilleGridV9Props {
  familleName: string;
  items: FamilleItem[];
}

export default function GammeFamilleGridV9({
  familleName,
  items,
}: GammeFamilleGridV9Props) {
  if (items.length === 0) return null;

  return (
    <section id="family" className="py-7 lg:py-10 bg-white scroll-mt-16">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Famille {familleName}
          </h2>
          <Badge
            variant="outline"
            className="text-[12px] text-blue-600 bg-blue-50 border-blue-100 font-semibold"
          >
            {items.length} pièces
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {items.map((c) => {
            const theme = getFamilyTheme(c.name);
            return (
              <Link
                key={c.name}
                to={c.link}
                className="bg-slate-50 rounded-xl border border-slate-100 p-4 lg:p-5 cursor-pointer hover:bg-white hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-200 group relative block"
              >
                <div
                  className={`w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all overflow-hidden`}
                >
                  {c.img ? (
                    <img
                      src={c.img}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-lg text-white">{c.icon || "📦"}</span>
                  )}
                </div>
                <div className="text-[13px] font-semibold text-slate-800 leading-tight font-v9-heading group-hover:text-blue-700 transition-colors">
                  {c.name}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400 font-normal">
                    Entretien
                  </span>
                  <ArrowRight
                    size={12}
                    className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
