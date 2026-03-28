import { useNavigate } from "@remix-run/react";
import {
  Award,
  BookOpen,
  Car,
  CheckCircle,
  Gauge,
  Search,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import VehicleSelector from "~/components/vehicle/VehicleSelector";

const HERO_TRUST = [
  { icon: CheckCircle, label: "Compatibilité vérifiée" },
  { icon: Award, label: "Pièces neuves de grandes marques" },
  { icon: Truck, label: "Livraison 24\u201348h" },
];

const TAB_ITEMS = [
  { label: "Véhicule", labelDesktop: "Par véhicule", icon: Gauge },
  { label: "Type Mine", labelDesktop: "Type Mine", icon: BookOpen },
  { label: "Référence", labelDesktop: "Référence", icon: Search },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [mineCode, setMineCode] = useState("");
  const [refQuery, setRefQuery] = useState("");

  // Listen for tab-switch events from QuickAccessGrid
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (typeof tab === "number" && tab >= 0 && tab <= 2) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("hero-tab-switch", handler);
    return () => window.removeEventListener("hero-tab-switch", handler);
  }, []);

  return (
    <>
      <a
        href="#hero-v9"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-blue-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      <section
        id="hero-v9"
        className="bg-gradient-to-b from-navy to-navy-light"
      >
        <div className="mx-auto max-w-[1280px] px-5 pt-6 pb-8 lg:px-8 lg:pt-10 lg:pb-14">
          {/* TITRE */}
          <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-tight text-white font-heading lg:text-center lg:text-[42px]">
            Trouvez la pièce compatible{" "}
            <span className="text-cta-light">avec votre véhicule</span>
          </h1>
          <p className="text-[14px] lg:text-[16px] text-white/60 mt-2 lg:mt-3 lg:text-center font-body">
            Recherche par véhicule, référence OE, Type Mine ou immatriculation.
          </p>
          {/* ====== SELECTOR ====== */}
          <div className="mx-auto mt-5 max-w-[960px] lg:mt-8">
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
                    Recherche par véhicule, référence ou mine
                  </span>
                </div>
                {/* Tabs dark pill */}
                <div
                  className="mb-3 grid grid-cols-3 gap-1.5 rounded-[20px] bg-slate-900 p-1.5 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  role="tablist"
                  aria-label="Mode de recherche"
                >
                  {TAB_ITEMS.map((t, i) => {
                    const isActive = activeTab === i;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`tabpanel-${i}`}
                        id={`tab-${i}`}
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
                  {/* Tab content (mobile) */}
                  <div
                    role="tabpanel"
                    id={`tabpanel-mobile-${activeTab}`}
                    aria-labelledby={`tab-${activeTab}`}
                  >
                    {activeTab === 0 && (
                      <VehicleSelector
                        mode="mobile-premium"
                        context="homepage"
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

                    {activeTab === 2 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (refQuery.trim()) {
                            navigate(
                              `/recherche?q=${encodeURIComponent(refQuery.trim())}`,
                            );
                          }
                        }}
                        className="space-y-2.5"
                      >
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <Search size={12} /> Référence ou nom de pièce
                        </label>
                        <Input
                          value={refQuery}
                          onChange={(e) => setRefQuery(e.target.value)}
                          placeholder="Référence OE, marque ou pièce…"
                          className="rounded-xl border-slate-200 bg-slate-50 text-[13px] text-slate-900 placeholder-slate-400 focus-visible:border-cta focus-visible:ring-cta/10"
                        />
                        <Button
                          type="submit"
                          disabled={!refQuery.trim()}
                          className="h-12 w-full rounded-2xl bg-cta text-[16px] font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.28)] hover:bg-cta-hover disabled:opacity-50"
                        >
                          <Search size={15} className="mr-2" /> Rechercher
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── DESKTOP SELECTOR ── */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-x-6 top-0 h-28 rounded-[28px] bg-white/[0.06] blur-2xl" />
              <div className="relative rounded-[28px] border border-white/40 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
                {/* Desktop tabs pill */}
                <div className="flex justify-center pt-4 pb-1">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Recherche par véhicule, référence ou mine
                  </span>
                </div>
                <div className="px-5 pt-2">
                  <div
                    className="grid grid-cols-3 rounded-[20px] bg-slate-100 p-1.5"
                    role="tablist"
                    aria-label="Mode de recherche"
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
                          aria-controls={`tabpanel-desktop-${i}`}
                          id={`tab-desktop-${i}`}
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
                <div
                  className="p-5 pt-4"
                  role="tabpanel"
                  id={`tabpanel-desktop-${activeTab}`}
                  aria-labelledby={`tab-desktop-${activeTab}`}
                >
                  {activeTab === 0 && (
                    <VehicleSelector mode="compact" context="homepage" />
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

                  {activeTab === 2 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (refQuery.trim()) {
                          navigate(
                            `/recherche?q=${encodeURIComponent(refQuery.trim())}`,
                          );
                        }
                      }}
                      className="flex items-end gap-3"
                    >
                      <div className="flex-1">
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <Search size={12} /> Référence ou nom de pièce
                        </label>
                        <Input
                          value={refQuery}
                          onChange={(e) => setRefQuery(e.target.value)}
                          placeholder="Référence OE, marque ou pièce…"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 text-[14px] text-slate-900 placeholder-slate-400 focus-visible:border-cta focus-visible:ring-cta/10"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={!refQuery.trim()}
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

          {/* ====== TRUST STRIP ====== */}
          <div className="mx-auto mt-6 max-w-[960px]">
            <div className="flex flex-wrap justify-center gap-2 lg:gap-3">
              {HERO_TRUST.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 lg:px-4 lg:py-2.5"
                  >
                    <Icon size={14} className="shrink-0 text-cta-light" />
                    <span className="text-[12px] lg:text-[13px] font-medium text-white/70 whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
