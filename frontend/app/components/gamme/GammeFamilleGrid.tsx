import { Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { Reveal, Section, SectionHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";
import { getFamilyTheme } from "~/utils/family-theme";

interface FamilleItem {
  name: string;
  link: string;
  img?: string;
  icon?: string;
}

interface GammeFamilleGridProps {
  familleName: string;
  items: FamilleItem[];
  intro?: string;
  h2Override?: string | null;
}

export default function GammeFamilleGrid({
  familleName,
  items,
  intro,
  h2Override,
}: GammeFamilleGridProps) {
  if (items.length === 0) return null;

  return (
    <Section variant="white" id="family" className="scroll-mt-16">
      <SectionHeader
        title={h2Override || `Famille ${familleName}`}
        sub={intro}
        trailing={
          <Badge
            variant="outline"
            className="text-[12px] text-blue-600 bg-blue-50 border-blue-100 font-semibold"
          >
            {items.length} pièces
          </Badge>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {items.map((c, i) => {
          const theme = getFamilyTheme(c.name);
          return (
            <Reveal key={c.name} delay={i * 60}>
              <Link
                to={c.link}
                className="bg-slate-50 rounded-[22px] border border-slate-100 p-4 lg:p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] cursor-pointer hover:bg-white hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-200 group relative block"
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
                <div className="text-[13px] font-semibold text-slate-800 leading-tight font-heading group-hover:text-blue-700 transition-colors">
                  {c.name}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400 font-normal">
                    {familleName}
                  </span>
                  <ArrowRight
                    size={12}
                    className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
