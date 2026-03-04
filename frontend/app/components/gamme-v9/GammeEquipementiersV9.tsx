import { ArrowRight, CheckCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface EquipementierItem {
  name: string;
  description?: string;
  logo?: string;
}

interface GammeEquipementiersV9Props {
  items: EquipementierItem[];
}

export default function GammeEquipementiersV9({
  items,
}: GammeEquipementiersV9Props) {
  if (items.length === 0) return null;

  return (
    <section id="equip" className="py-7 lg:py-10 bg-[#0d1b2a] scroll-mt-16">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-white tracking-tight font-v9-heading">
            Équipementiers OE
          </h2>
          <Badge
            variant="outline"
            className="text-[11px] font-bold text-white/50 bg-white/[0.08] border-white/10"
          >
            {items.length} marques
          </Badge>
        </div>

        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
          {items.map((e) => (
            <div
              key={e.name}
              className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group"
            >
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
                    <span className="text-[14px] font-extrabold text-white/60 font-v9-heading">
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
          ))}
        </div>
      </div>
    </section>
  );
}
