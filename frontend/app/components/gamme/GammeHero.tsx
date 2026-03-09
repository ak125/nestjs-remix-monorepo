import { Link } from "@remix-run/react";
import {
  Award,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Filter,
  Gauge,
  Phone,
  Search,
  Shield,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import VehicleSelector from "~/components/vehicle/VehicleSelector";
import { ImageOptimizer } from "~/utils/image-optimizer";

interface GammeHeroProps {
  gammeName: string;
  familleTag?: string;
  subtitle?: string;
  pgPic?: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  kpis: { motorisationsCount: number; modelsCount: number; equipCount: number };
  onVehicleSelect?: (vehicle: any) => void;
  selectedVehicle?: any;
}

const TABS = [
  { label: "Par véhicule", icon: Gauge },
  { label: "Type Mine", icon: BookOpen },
];

export default function GammeHero({
  gammeName,
  familleTag,
  subtitle,
  pgPic,
  breadcrumbs,
  kpis,
  onVehicleSelect,
  selectedVehicle: _selectedVehicle,
}: GammeHeroProps) {
  const [tab, setTab] = useState(0);

  return (
    <section className="bg-gradient-to-b from-[var(--v9-navy)] to-[var(--v9-navy-light)]">
      <div className="px-5 pt-5 pb-2 lg:pt-8 lg:pb-4 max-w-[1280px] mx-auto lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-[10px] lg:text-[11px] text-white/25 mb-4">
          {breadcrumbs.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={8} />}
              {b.href ? (
                <Link
                  to={b.href}
                  className="hover:text-white/50 transition-colors"
                >
                  {b.label}
                </Link>
              ) : (
                <span className="text-white/60 font-medium">{b.label}</span>
              )}
            </span>
          ))}
        </nav>

        {familleTag && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.08] rounded-full border border-white/15 text-[11px] font-semibold text-white/80 mb-4 shadow-lg shadow-black/10">
            <Filter size={11} className="text-blue-300" /> {familleTag}
          </span>
        )}

        <h1 className="text-[28px] lg:text-[42px] font-extrabold leading-[1.1] tracking-tight font-v9-heading text-white mb-2 lg:mb-3">
          {gammeName}
        </h1>
        <p className="text-[13px] lg:text-[15px] text-white/40 font-normal leading-relaxed mb-5">
          {subtitle ||
            "Trouvez la pièce compatible avec votre véhicule en quelques secondes"}
        </p>
      </div>

      {/* Desktop: 2 columns (image + selector), Mobile: stacked */}
      <div className="max-w-[1280px] mx-auto px-5 lg:px-8 pb-5 lg:pb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
          {/* Product image */}
          <div className="lg:w-[360px] lg:flex-shrink-0">
            <div className="mx-0 mb-4 lg:mb-0 bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/[0.12] rounded-2xl p-8 flex justify-center relative backdrop-blur-sm">
              {pgPic ? (
                (() => {
                  const imgPath = pgPic.replace(/^\/img\//, "");
                  const pictureSet = ImageOptimizer.getPictureImageSet(
                    imgPath,
                    {
                      widths: [200, 400],
                      quality: 85,
                      sizes: "(max-width: 1024px) 200px, 300px",
                      width: 300,
                      height: 300,
                    },
                  );
                  return (
                    <picture>
                      <source
                        srcSet={pictureSet.avifSrcSet}
                        type="image/avif"
                        sizes={pictureSet.sizes}
                      />
                      <source
                        srcSet={pictureSet.webpSrcSet}
                        type="image/webp"
                        sizes={pictureSet.sizes}
                      />
                      <img
                        src={pictureSet.fallbackSrc}
                        alt={gammeName}
                        width={300}
                        height={300}
                        className="w-full h-full object-contain max-h-[200px]"
                        loading="eager"
                        fetchPriority="high"
                        onError={(e) => {
                          e.currentTarget.src =
                            "/images/categories/default.svg";
                          e.currentTarget.onerror = null;
                        }}
                      />
                    </picture>
                  );
                })()
              ) : (
                <Filter size={56} className="text-white/15" />
              )}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg border border-white/15 text-[9px] font-bold text-white/60">
                <CheckCircle size={9} className="text-emerald-400" />{" "}
                Compatibilité vérifiée
              </div>
            </div>

            {/* KPIs — under image on desktop */}
            <div className="grid grid-cols-3 gap-2 mb-5 lg:mb-0 lg:mt-4">
              {[
                {
                  n: `${kpis.motorisationsCount}+`,
                  l: "motorisations",
                },
                { n: `${kpis.modelsCount}+`, l: "modèles" },
                { n: `${kpis.equipCount}`, l: "équipementiers" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="bg-white/[0.05] border border-white/[0.08] rounded-xl py-2.5 text-center hover:bg-white/[0.08] transition-all"
                >
                  <div className="text-[14px] font-extrabold text-white font-v9-heading">
                    {s.n}
                  </div>
                  <div className="text-[9px] text-blue-200/40 font-normal">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle selector */}
          <div className="flex-1">
            <div className="rounded-2xl border border-white/[0.1] overflow-hidden bg-white/[0.05] backdrop-blur-sm">
              {/* Tabs */}
              <div className="flex">
                {TABS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setTab(i)}
                      className={`flex-1 py-3.5 text-center text-[11.5px] font-semibold flex items-center justify-center gap-1.5 relative transition-all ${
                        tab === i
                          ? "text-white bg-white/[0.06]"
                          : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      <Icon size={12} />
                      {t.label}
                      {tab === i && (
                        <span className="absolute bottom-0 left-[15%] w-[70%] h-[2.5px] bg-blue-400 rounded" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-4 pt-3.5">
                {tab === 0 && (
                  <VehicleSelector
                    mode="compact"
                    className="flex-wrap gap-2"
                    context="pieces"
                    redirectOnSelect={false}
                    onVehicleSelect={onVehicleSelect}
                  />
                )}
                {tab === 1 && (
                  <div>
                    <p className="text-[11px] text-white/30 font-normal mb-2">
                      Carte grise ?{" "}
                      <Link
                        to="/search/mine"
                        className="text-blue-300 underline underline-offset-2"
                      >
                        Identifier par CNIT / Type Mine
                      </Link>
                    </p>
                  </div>
                )}

                <Button className="w-full mt-3.5 py-3.5 h-auto bg-blue-500 rounded-xl text-white text-[14px] font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-400 hover:-translate-y-0.5 active:translate-y-0 transition-all">
                  <Search size={15} className="mr-2" /> Trouver mes pièces
                  compatibles
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="max-w-[1280px] mx-auto px-5 lg:px-8 pb-5 lg:pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              icon: Truck,
              title: "Livraison 24-48h",
              desc: "Expédition le jour même avant 15h",
              color: "text-emerald-300",
            },
            {
              icon: Shield,
              title: "Retours 30 jours",
              desc: "Satisfait ou remboursé",
              color: "text-amber-300",
            },
            {
              icon: Award,
              title: "Garantie constructeur",
              desc: "Pièces certifiées OE",
              color: "text-purple-300",
            },
            {
              icon: Phone,
              title: "Assistance technique",
              desc: "Un expert vous aide",
              color: "text-blue-300",
            },
          ].map((t) => (
            <div
              key={t.title}
              className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-3"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <t.icon size={16} className={t.color} />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-white/80">
                  {t.title}
                </div>
                <div className="text-[10px] text-white/35 font-normal">
                  {t.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
