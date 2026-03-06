import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronRight,
  FileText,
  Info,
  Settings,
  Shield,
} from "lucide-react";

interface BuyArgument {
  title?: string;
  content?: string;
  icon?: string;
}

interface GammeContentV9Props {
  gammeName: string;
  content?: string;
  microSeoBlock?: string;
  tips?: Array<{ type: "info" | "warning"; text: string }>;
  pgAlias?: string;
  arguments?: BuyArgument[] | null;
  familyKey?: string;
}

const HOW_TO_STEPS = [
  { title: "Identifiez votre véhicule", desc: "Marque, modèle et année" },
  {
    title: "Vérifiez la motorisation",
    desc: "Code moteur sur la carte grise",
  },
  {
    title: "Comparez les références",
    desc: "Seules les compatibles s'affichent",
  },
  { title: "Commandez", desc: "Livraison rapide, retour simple" },
];

const FAMILY_TIPS: Record<string, { type: "info" | "warning"; text: string }> =
  {
    freinage: {
      type: "info",
      text: `<b class="font-semibold">Conseil freinage :</b> Vérifiez le diamètre et le type (ventilé/plein) avant commande. Remplacez toujours par paire sur le même essieu.`,
    },
    moteur: {
      type: "info",
      text: `<b class="font-semibold">Astuce carte grise :</b> Case D.2 identifie votre motorisation exacte. En cas de doute, notre équipe vérifie avant expédition.`,
    },
    suspension: {
      type: "info",
      text: `<b class="font-semibold">Conseil suspension :</b> Vérifiez la version (sport ou confort) et les cotes d'origine avant commande.`,
    },
    transmission: {
      type: "info",
      text: `<b class="font-semibold">Conseil transmission :</b> Vérifiez le type de volant moteur (simple masse ou bi-masse) et si le kit est complet.`,
    },
    electrique: {
      type: "info",
      text: `<b class="font-semibold">Conseil électrique :</b> Vérifiez l'ampérage et la connectique sur votre pièce d'origine avant commande.`,
    },
    climatisation: {
      type: "info",
      text: `<b class="font-semibold">Conseil climatisation :</b> Vérifiez le type de réfrigérant (R134a ou R1234yf) selon votre véhicule.`,
    },
    generic: {
      type: "info",
      text: `<b class="font-semibold">Astuce :</b> Utilisez notre sélecteur véhicule pour filtrer uniquement les pièces 100% compatibles avec votre auto.`,
    },
  };

const ICON_MAP: Record<string, typeof CheckCircle> = {
  "check-circle": CheckCircle,
  "shield-check": Shield,
  "currency-euro": Settings,
  cube: FileText,
};

function getArgIcon(iconName?: string, index?: number): typeof CheckCircle {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  const fallbacks = [CheckCircle, Shield, Settings, FileText];
  return fallbacks[(index ?? 0) % fallbacks.length];
}

export default function GammeContentV9({
  gammeName,
  content,
  microSeoBlock,
  tips,
  pgAlias,
  arguments: buyArgs,
  familyKey,
}: GammeContentV9Props) {
  const displayContent =
    content ||
    microSeoBlock ||
    `Trouvez votre ${gammeName.toLowerCase()} compatible parmi nos références OEM et équipementiers de qualité.`;

  const defaultTips: Array<{ type: "info" | "warning"; text: string }> =
    tips || [FAMILY_TIPS[familyKey || "generic"] || FAMILY_TIPS.generic];

  const hasPipelineArgs = buyArgs && buyArgs.length > 0;
  const sidebarSteps = hasPipelineArgs ? buyArgs : null;

  const resourceCards = [
    {
      icon: BookOpen,
      title: "Guide d'achat",
      desc: "Critères, budget, marques",
      href: pgAlias
        ? `/blog-pieces-auto/guide-achat/${pgAlias}`
        : "/blog-pieces-auto",
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      icon: Settings,
      title: "Conseils entretien",
      desc: "Quand et comment entretenir",
      href: pgAlias
        ? `/blog-pieces-auto/conseils/${pgAlias}`
        : "/blog-pieces-auto",
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      icon: FileText,
      title: "Fiche technique",
      desc: "Normes OE, spécifications",
      href: "/reference-auto",
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
  ];

  return (
    <section className="py-7 lg:py-10 bg-white">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
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

          {/* Sidebar */}
          <div className="mt-6 lg:mt-0 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[15px] font-bold text-slate-900 font-v9-heading mb-4">
                {sidebarSteps
                  ? "Pourquoi nous choisir"
                  : "Choisir en 15 secondes"}
              </h3>
              {sidebarSteps
                ? sidebarSteps.map((arg, i) => {
                    const Icon = getArgIcon(arg.icon, i);
                    return (
                      <div
                        key={arg.title || i}
                        className="flex items-start gap-3 mb-3 last:mb-0"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <Icon size={13} className="text-white" />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-slate-800">
                            {arg.title}
                          </div>
                          {arg.content && (
                            <div className="text-[11px] text-slate-500 font-normal">
                              {arg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                : HOW_TO_STEPS.map((step, i) => (
                    <div
                      key={step.title}
                      className="flex items-start gap-3 mb-3 last:mb-0"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white">
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-800">
                          {step.title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {step.desc}
                        </div>
                      </div>
                    </div>
                  ))}
            </div>

            {resourceCards.map((c) => {
              const Icon = c.icon;
              const colorParts = c.color.split(" ");
              return (
                <Link
                  key={c.title}
                  to={c.href}
                  className={`flex items-center gap-3 p-4 bg-white border ${colorParts[2]} rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all group`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${colorParts[1]} flex items-center justify-center group-hover:scale-105 transition-transform`}
                  >
                    <Icon size={18} className={colorParts[0]} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-slate-800">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      {c.desc}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
