import { ArrowRight, CheckCircle } from "lucide-react";
import { Reveal, Section, SectionHeader } from "~/components/layout";
import { Badge } from "~/components/ui/badge";

interface EquipementierItem {
  name: string;
  description?: string;
  logo?: string;
}

interface GammeEquipementiersProps {
  items: EquipementierItem[];
  intro?: string;
  h2Override?: string | null;
}

export default function GammeEquipementiers({
  items,
  intro,
  h2Override,
}: GammeEquipementiersProps) {
  if (items.length === 0) return null;

  return (
    <Section variant="navy-gradient" id="equip" className="scroll-mt-16" glow>
      <SectionHeader
        title={h2Override || "Équipementiers OE"}
        sub={intro}
        dark
        trailing={
          <Badge
            variant="outline"
            className="text-[11px] font-bold text-white/50 bg-white/[0.08] border-white/10"
          >
            {items.length} marques
          </Badge>
        }
      />

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
        {items.map((e, i) => (
          <Reveal key={e.name} delay={i * 60}>
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-[22px] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-white/[0.08] flex items-center justify-center flex-shrink-0 group-hover:text-white group-hover:bg-white/[0.12] transition-all overflow-hidden">
                  {e.logo ? (
                    <img
                      src={e.logo}
                      alt={e.name}
                      className="w-8 h-8 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[14px] font-extrabold text-white/60 font-heading">
                      {e.name.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-white">
                    {e.name}
                  </div>
                  <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-400/20 flex items-center gap-0.5 w-fit">
                    <CheckCircle size={7} /> Confiance
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-blue-300 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Voir <ArrowRight size={10} />
                </span>
              </div>
              {e.description && (
                <p className="text-[11px] text-blue-200/40 font-normal leading-relaxed">
                  {e.description}
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
