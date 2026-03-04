import { useNavigate } from "@remix-run/react";
import {
  BookOpen,
  Car,
  Gauge,
  Phone,
  Search,
  Shield,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import VehicleSelector from "~/components/vehicle/VehicleSelector";

const TAB_ITEMS = [
  { label: "Par véhicule", icon: Gauge },
  { label: "Type Mine", icon: BookOpen },
  { label: "Référence", icon: Search },
];

export default function HeroSectionV9() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [mineCode, setMineCode] = useState("");
  const [refQuery, setRefQuery] = useState("");

  return (
    <>
      {/* Skip link */}
      <a
        href="#hero-v9"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-blue-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      <section
        id="hero-v9"
        className="bg-gradient-to-b from-[var(--v9-navy)] to-[var(--v9-navy-light)]"
      >
        {/* Trust strip */}
        <div className="flex items-center justify-center gap-3 py-2.5 text-[11px] font-semibold border-b border-white/[0.06]">
          <span className="flex items-center gap-1 text-emerald-300">
            <Truck size={12} /> Livraison gratuite dès 150€
          </span>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-1 text-emerald-300">
            <Shield size={12} /> Garantie 2 ans
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/40">Retours 30j</span>
          <span className="text-white/15 hidden lg:inline">·</span>
          <a
            href="tel:+33970193419"
            className="hidden lg:flex items-center gap-1 text-white/60 hover:text-white transition-colors"
          >
            <Phone size={11} /> 09 70 19 34 19
          </a>
        </div>

        <div className="px-5 pt-6 pb-4 lg:pt-10 lg:pb-10 max-w-[1280px] mx-auto lg:px-8">
          <h1 className="text-[28px] lg:text-[42px] font-extrabold leading-[1.1] tracking-tight font-v9-heading text-white lg:text-center">
            Votre panne, <span className="text-orange-400">nos pièces.</span>
          </h1>

          {/* Vehicle Selector */}
          <div className="mt-5 lg:mt-8 lg:max-w-2xl lg:mx-auto">
            <div className="rounded-2xl border border-white/[0.1] overflow-hidden bg-white/[0.05] backdrop-blur-sm">
              {/* Tabs */}
              <div className="flex">
                {TAB_ITEMS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setActiveTab(i)}
                      className={`flex-1 py-3.5 text-center text-[11.5px] font-semibold flex items-center justify-center gap-1.5 relative transition-all ${
                        activeTab === i
                          ? "text-white bg-white/[0.06]"
                          : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      <Icon size={12} />
                      {t.label}
                      {activeTab === i && (
                        <span className="absolute bottom-0 left-[15%] w-[70%] h-[2.5px] bg-blue-400 rounded" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-4 pt-3.5">
                {activeTab === 0 && (
                  <div>
                    <VehicleSelector
                      mode="compact"
                      className="flex-wrap gap-2"
                      context="homepage"
                    />
                  </div>
                )}

                {activeTab === 1 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (mineCode.length >= 5) {
                        navigate(`/search/mine?code=${mineCode.toUpperCase()}`);
                      }
                    }}
                  >
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                      <Car size={12} /> Numéro de Type Mine ou CNIT
                    </label>
                    <Input
                      value={mineCode}
                      onChange={(e) =>
                        setMineCode(e.target.value.toUpperCase())
                      }
                      placeholder="Ex : M10RENVP0A5G35"
                      maxLength={20}
                      className="bg-white/[0.06] border-white/[0.1] rounded-xl text-white text-[13px] font-bold tracking-[2px] font-mono uppercase placeholder-white/30 focus-visible:border-blue-400 focus-visible:ring-blue-400/10 mb-2.5"
                    />
                    <Button
                      type="submit"
                      disabled={mineCode.length < 5}
                      className="w-full py-3.5 h-auto bg-blue-500 rounded-xl text-white text-[14px] font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-400 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      <Search size={15} className="mr-2" /> Rechercher
                    </Button>
                    <p className="text-[11px] text-white/30 mt-2 flex items-center gap-1">
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
                  >
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                      <Search size={12} /> Référence ou nom de pièce
                    </label>
                    <Input
                      value={refQuery}
                      onChange={(e) => setRefQuery(e.target.value)}
                      placeholder="Référence OE, marque ou pièce…"
                      className="bg-white/[0.06] border-white/[0.1] rounded-xl text-white text-[13px] placeholder-white/30 focus-visible:border-blue-400 focus-visible:ring-blue-400/10 mb-2.5"
                    />
                    <Button
                      type="submit"
                      disabled={!refQuery.trim()}
                      className="w-full py-3.5 h-auto bg-blue-500 rounded-xl text-white text-[14px] font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-400 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      <Search size={15} className="mr-2" /> Rechercher
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
