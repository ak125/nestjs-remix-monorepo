import { AlertTriangle, Info } from "lucide-react";

interface GammeContentV9Props {
  gammeName: string;
  content?: string;
  microSeoBlock?: string;
  tips?: Array<{ type: "info" | "warning"; text: string }>;
}

export default function GammeContentV9({
  gammeName,
  content,
  microSeoBlock,
  tips,
}: GammeContentV9Props) {
  const displayContent =
    content ||
    microSeoBlock ||
    `Trouvez votre ${gammeName.toLowerCase()} compatible parmi nos références OEM et équipementiers de qualité.`;

  const defaultTips: Array<{ type: "info" | "warning"; text: string }> =
    tips || [
      {
        type: "info",
        text: `<b class="font-semibold">Astuce carte grise :</b> Case D.2 identifie votre motorisation exacte. En cas de doute, notre équipe vérifie avant expédition.`,
      },
    ];

  return (
    <section className="py-7 lg:py-10 bg-white">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading mb-3">
          Bien choisir votre {gammeName.toLowerCase()}
        </h2>

        <div className="text-[13px] lg:text-[14px] text-slate-600 leading-relaxed font-normal font-v9-body space-y-2.5 mb-4">
          <div dangerouslySetInnerHTML={{ __html: displayContent }} />
        </div>

        <div className="space-y-2.5">
          {defaultTips.map((tip, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 p-3.5 rounded-xl ${
                tip.type === "info"
                  ? "bg-blue-50 border border-blue-100"
                  : "bg-amber-50 border border-amber-100"
              }`}
            >
              {tip.type === "info" ? (
                <Info
                  size={15}
                  className="text-blue-500 mt-0.5 flex-shrink-0"
                />
              ) : (
                <AlertTriangle
                  size={15}
                  className="text-amber-500 mt-0.5 flex-shrink-0"
                />
              )}
              <p
                className={`text-[12px] lg:text-[13px] leading-relaxed ${
                  tip.type === "info" ? "text-blue-800" : "text-amber-800"
                }`}
                dangerouslySetInnerHTML={{ __html: tip.text }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
