import { Link, useNavigate } from "@remix-run/react";
import {
  BookOpen,
  Car,
  ChevronRight,
  Filter,
  Gauge,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import VehicleSelector from "~/components/vehicle/VehicleSelector";
import { ImageOptimizer } from "~/utils/image-optimizer";

interface GammeHeroProps {
  gammeName: string;
  familleTag?: string;
  subtitle?: string;
  pgPic?: string;
  /** Image R1 HERO (prioritaire sur pgPic si présente) */
  r1HeroPath?: string;
  r1HeroAlt?: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  kpis: { motorisationsCount: number; modelsCount: number; equipCount: number };
  onVehicleSelect?: (vehicle: any) => void;
  selectedVehicle?: any;
}

const TAB_ITEMS = [
  { label: "Véhicule", labelDesktop: "Par véhicule", icon: Gauge },
  { label: "Type Mine", labelDesktop: "Type Mine", icon: BookOpen },
];

export default function GammeHero({
  gammeName,
  pgPic,
  r1HeroPath,
  r1HeroAlt,
  breadcrumbs,
  kpis: _kpis,
  onVehicleSelect,
}: GammeHeroProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [mineCode, setMineCode] = useState("");

  return (
    <section className="bg-gradient-to-b from-navy to-navy-light">
      <div className="px-5 pt-5 pb-2 lg:pt-8 lg:pb-4 max-w-7xl mx-auto lg:px-8">
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

        <h1 className="text-[28px] lg:text-[42px] font-extrabold leading-[1.1] tracking-tight font-heading text-white mb-5">
          {gammeName}
        </h1>
      </div>

      {/* Desktop: 2 columns (image + selector), Mobile: stacked */}
      <div className="max-w-7xl mx-auto px-page pb-5 lg:pb-8">
        <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-8">
          {/* Product image */}
          <div className="lg:w-[280px] lg:flex-shrink-0 flex">
            <div className="mx-0 mb-4 lg:mb-0 w-full max-h-[280px] bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/[0.12] rounded-2xl overflow-hidden flex items-center justify-center backdrop-blur-sm">
              {r1HeroPath || pgPic ? (
                (() => {
                  const imgPath = r1HeroPath
                    ? `uploads/${r1HeroPath}`
                    : pgPic!.replace(/^\/img\//, "");
                  const pictureSet = ImageOptimizer.getPictureImageSet(
                    imgPath,
                    {
                      widths: [360, 720],
                      quality: 90,
                      sizes: "(max-width: 1024px) 100vw, 360px",
                      width: 360,
                      height: 360,
                    },
                  );
                  return (
                    <picture className="block w-full h-full">
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
                        alt={r1HeroAlt || gammeName}
                        width={360}
                        height={360}
                        className="block w-full h-full object-cover"
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
            </div>
          </div>

          {/* Vehicle selector — same design as homepage */}
          <div className="flex-1 flex flex-col">
            {/* ── MOBILE SELECTOR ── */}
            <div className="relative lg:hidden">
              <div className="absolute inset-x-3 top-0 h-24 rounded-[28px] bg-white/8 blur-2xl" />
              <div className="relative rounded-[28px] border border-white/60 bg-white/95 p-2.5 shadow-[0_20px_60px_rgba(5,16,36,0.22)]">
                <div className="mb-2.5 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Sélectionnez votre véhicule
                  </span>
                </div>
                {/* Tabs dark pill */}
                <div
                  className="mb-3 grid grid-cols-2 gap-1.5 rounded-[20px] bg-slate-900 p-1.5 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  role="tablist"
                >
                  {TAB_ITEMS.map((t, i) => {
                    const isActive = activeTab === i;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(i)}
                        className={`min-h-[44px] rounded-2xl px-3 py-2.5 text-center transition-all ${
                          isActive
                            ? "bg-white text-slate-950 shadow-sm ring-1 ring-orange-500/30"
                            : "bg-transparent text-slate-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Inner card */}
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 pb-4 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  {activeTab === 0 && (
                    <VehicleSelector
                      mode="mobile-premium"
                      context="pieces"
                      redirectOnSelect={false}
                      onVehicleSelect={onVehicleSelect}
                    />
                  )}
                  {activeTab === 1 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (mineCode.length >= 5) {
                          navigate(
                            `/search/mine?code=${mineCode.toUpperCase()}`,
                          );
                        }
                      }}
                      className="space-y-2.5"
                    >
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Car size={12} /> Numéro de Type Mine ou CNIT
                      </label>
                      <Input
                        value={mineCode}
                        onChange={(e) =>
                          setMineCode(e.target.value.toUpperCase())
                        }
                        placeholder="Ex : M10RENVP0A5G35"
                        maxLength={20}
                        className="rounded-xl border-slate-200 bg-slate-50 font-mono text-[13px] font-bold uppercase tracking-[2px] text-slate-900 placeholder-slate-400 focus-visible:border-cta focus-visible:ring-cta/10"
                      />
                      <Button
                        type="submit"
                        disabled={mineCode.length < 5}
                        className="h-12 w-full rounded-2xl bg-cta text-[16px] font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.28)] hover:bg-cta-hover disabled:opacity-50"
                      >
                        <Search size={15} className="mr-2" /> Rechercher
                      </Button>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400">
                        Repère D.2.1 sur votre carte grise
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* ── DESKTOP SELECTOR ── */}
            <div className="relative hidden lg:flex lg:flex-col lg:flex-1">
              <div className="absolute inset-x-6 top-0 h-28 rounded-[28px] bg-white/[0.06] blur-2xl" />
              <div className="relative flex-1 flex flex-col rounded-[28px] border border-white/40 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
                {/* Desktop live pill */}
                <div className="flex justify-center pt-4 pb-1">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Sélectionnez votre véhicule
                  </span>
                </div>
                {/* Desktop tabs pill */}
                <div className="px-5 pt-2">
                  <div
                    className="grid grid-cols-2 rounded-[20px] bg-slate-100 p-1.5"
                    role="tablist"
                  >
                    {TAB_ITEMS.map((t, i) => {
                      const Icon = t.icon;
                      const isActive = activeTab === i;
                      return (
                        <button
                          key={t.label}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveTab(i)}
                          className={`flex h-12 items-center justify-center gap-2 rounded-[16px] text-[14px] font-semibold transition-all ${
                            isActive
                              ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Icon
                            size={14}
                            className={isActive ? "text-cta" : "text-slate-400"}
                          />
                          {t.labelDesktop}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop tab content */}
                <div className="p-5 pt-4">
                  {activeTab === 0 && (
                    <VehicleSelector
                      mode="compact"
                      context="pieces"
                      redirectOnSelect={false}
                      onVehicleSelect={onVehicleSelect}
                    />
                  )}
                  {activeTab === 1 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (mineCode.length >= 5) {
                          navigate(
                            `/search/mine?code=${mineCode.toUpperCase()}`,
                          );
                        }
                      }}
                      className="flex items-end gap-3"
                    >
                      <div className="flex-1">
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <Car size={12} /> Numéro de Type Mine ou CNIT
                        </label>
                        <Input
                          value={mineCode}
                          onChange={(e) =>
                            setMineCode(e.target.value.toUpperCase())
                          }
                          placeholder="Ex : M10RENVP0A5G35"
                          maxLength={20}
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 font-mono text-[14px] font-bold uppercase tracking-[2px] text-slate-900 placeholder-slate-400 focus-visible:border-cta focus-visible:ring-cta/10"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={mineCode.length < 5}
                        className="h-12 shrink-0 rounded-2xl bg-cta px-8 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.28)] hover:bg-cta-hover disabled:opacity-50"
                      >
                        <Search size={15} className="mr-2" /> Rechercher
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust strip supprimé — R1TrustStrip est affiché après le hero */}
    </section>
  );
}
