import { Section } from "~/components/layout";
import { type EquipItem } from "./constants";

export default function EquipementiersMarquee({
  equipementiers,
}: {
  equipementiers: EquipItem[];
}) {
  return (
    <Section variant="white" spacing="sm">
      <div className="text-center mb-5 sm:mb-6">
        <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 text-balance">
          Nos &eacute;quipementiers partenaires
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Les plus grandes marques de pi&egrave;ces auto
        </p>
      </div>
      <div
        className="w-full overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
        }}
      >
        <div className="marquee-anim animate-marquee flex items-center gap-6 sm:gap-10 w-max">
          {[...equipementiers, ...equipementiers].map((e, i) => (
            <div
              key={`${e.name}-${i}`}
              className="flex-shrink-0 h-8 sm:h-10 w-auto"
            >
              <img
                src={e.logoUrl}
                alt={e.name}
                title={e.name}
                className="h-full w-auto object-contain"
                loading="lazy"
                width={120}
                height={40}
                onError={(ev) => {
                  ev.currentTarget.style.display = "none";
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
