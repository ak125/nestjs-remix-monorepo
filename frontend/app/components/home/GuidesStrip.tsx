import { Link } from "@remix-run/react";
import {
  BookOpen,
  FileText,
  Stethoscope,
  Play,
  ArrowRight,
} from "lucide-react";
import { cn } from "~/lib/utils";

type ResourceCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrapperClassName: string;
};

const resources: ResourceCard[] = [
  {
    title: "Guides d'achat",
    description: "Choisir la bonne pièce sans erreur",
    href: "/blog-pieces-auto/guide-achat",
    icon: BookOpen,
    iconWrapperClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
  },
  {
    title: "Réf. techniques",
    description: "Équivalences OEM et aftermarket",
    href: "/reference-auto",
    icon: FileText,
    iconWrapperClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
  },
  {
    title: "Diagnostic assisté",
    description: "Identifier rapidement les causes probables",
    href: "/diagnostic-auto",
    icon: Stethoscope,
    iconWrapperClassName:
      "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
  },
];

function ResourceCardItem({
  title,
  description,
  href,
  icon: Icon,
  iconWrapperClassName,
}: ResourceCard) {
  return (
    <Link
      to={href}
      className={cn(
        "group relative flex min-w-[232px] snap-start flex-col rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)]",
        "active:scale-[0.99]",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            iconWrapperClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <ArrowRight className="mt-1 h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>

      <div className="space-y-2">
        <h3 className="text-[20px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-950">
          {title}
        </h3>

        <p className="line-clamp-2 text-[15px] leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-2 text-[15px] font-semibold text-[#2563eb]">
        <span>Consulter</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function HomeResourcesAndVideoSection() {
  return (
    <section
      className="bg-white px-4 py-8 sm:px-5"
      aria-labelledby="resources-video-title"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5">
          <div className="space-y-1">
            <h2
              id="resources-video-title"
              className="text-[32px] font-black leading-none tracking-[-0.03em] text-slate-950"
            >
              Ressources
            </h2>
            <p className="text-[15px] leading-6 text-slate-500">
              Aides utiles pour choisir, vérifier et comprendre
            </p>
          </div>
        </div>

        {/* Mobile-first horizontal cards */}
        <div className="-mx-4 mb-8 overflow-x-auto px-4 pb-2">
          <div className="flex snap-x snap-mandatory gap-3">
            {resources.map((item) => (
              <ResourceCardItem key={item.title} {...item} />
            ))}
          </div>
        </div>

        {/* Premium video card */}
        <div className="overflow-hidden rounded-[28px] border border-slate-800/20 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_35%),linear-gradient(135deg,#11284e_0%,#0d1f3a_55%,#0a1730_100%)] shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  aria-label="Lire la présentation AutoMecanik"
                  className={cn(
                    "group flex h-20 w-20 shrink-0 items-center justify-center rounded-full",
                    "bg-white/10 ring-1 ring-white/10 backdrop-blur-md transition-all duration-200",
                    "hover:bg-white/14 hover:ring-white/20 active:scale-[0.98]",
                  )}
                >
                  <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/8">
                    <Play className="ml-1 h-7 w-7 fill-white text-white" />
                  </span>
                </button>

                <div className="max-w-[520px]">
                  <p className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Présentation
                  </p>

                  <h3 className="text-[30px] font-black leading-[1.02] tracking-[-0.03em] text-white">
                    Pourquoi choisir
                    <br />
                    AutoMecanik&nbsp;?
                  </h3>

                  <p className="mt-3 max-w-[36ch] text-[16px] leading-7 text-white/74">
                    Compatibilité vérifiée, pièces neuves, navigation claire et
                    livraison rapide.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
