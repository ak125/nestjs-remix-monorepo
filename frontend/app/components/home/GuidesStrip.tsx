import { Link } from "@remix-run/react";
import {
  BookMarked,
  Layers,
  ScanLine,
  Play,
  ArrowRight,
  Wrench,
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
    description: "Comparatifs, critères de choix et aide à la sélection",
    href: "/blog-pieces-auto/guide-achat",
    icon: BookMarked,
    iconWrapperClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
  },
  {
    title: "Réf. techniques",
    description: "Équivalences par numéro OE ou constructeur",
    href: "/reference-auto",
    icon: Layers,
    iconWrapperClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
  },
  {
    title: "Diagnostic assisté",
    description: "Décrivez vos symptômes, trouvez les pièces à vérifier",
    href: "/diagnostic-auto",
    icon: ScanLine,
    iconWrapperClassName:
      "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
  },
  {
    title: "Conseils d'entretien",
    description: "Comprendre quand contrôler ou remplacer une pièce",
    href: "/blog-pieces-auto/conseils",
    icon: Wrench,
    iconWrapperClassName: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
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
        "group relative flex rounded-[20px] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)]",
        "active:scale-[0.99]",
        "flex-row items-center gap-4 p-4 lg:min-w-[232px] lg:snap-start lg:flex-col lg:items-stretch lg:gap-0",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl lg:mb-4",
          iconWrapperClassName,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] lg:text-[20px] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-950">
          {title}
        </h3>
        <p className="line-clamp-1 lg:line-clamp-2 text-[13px] lg:text-[15px] leading-5 lg:leading-6 text-slate-600 mt-0.5 lg:mt-2">
          {description}
        </p>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 lg:mt-5 lg:text-blue-600" />
    </Link>
  );
}

export default function HomeResourcesAndVideoSection() {
  return (
    <section
      className="bg-white px-5 py-7 lg:py-10"
      aria-labelledby="resources-video-title"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5">
          <div className="space-y-1">
            <h2
              id="resources-video-title"
              className="text-lg sm:text-xl lg:text-[32px] font-black leading-none tracking-[-0.03em] text-slate-950"
            >
              Besoin d'aide pour choisir ou vérifier ?
            </h2>
          </div>
        </div>

        {/* Resource cards — stacked mobile, horizontal desktop */}
        <div className="flex flex-col gap-3 mb-8 lg:-mx-4 lg:flex-row lg:overflow-x-auto lg:px-4 lg:pb-2 lg:snap-x lg:snap-mandatory">
          {resources.map((item) => (
            <ResourceCardItem key={item.title} {...item} />
          ))}
        </div>

        {/* Premium video card */}
        <div className="overflow-hidden rounded-[28px] border border-slate-800/20 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_35%),linear-gradient(135deg,#11284e_0%,#0d1f3a_55%,#0a1730_100%)] shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex h-20 w-20 shrink-0 items-center justify-center rounded-full",
                    "bg-white/10 ring-1 ring-white/10 backdrop-blur-md",
                  )}
                >
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/8">
                    <Play className="ml-1 h-7 w-7 fill-white text-white" />
                  </span>
                </div>

                <div className="max-w-[520px]">
                  <p className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Présentation
                  </p>

                  <h3 className="text-xl sm:text-2xl lg:text-[30px] font-black leading-[1.02] tracking-[-0.03em] text-white">
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
