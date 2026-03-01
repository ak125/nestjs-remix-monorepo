import { useNavigate } from "@remix-run/react";
import { Car, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import VehicleSelector from "~/components/vehicle/VehicleSelector";

export default function HeroSearchSection() {
  const navigate = useNavigate();
  const [mineCode, setMineCode] = useState("");
  const [refQuery, setRefQuery] = useState("");

  return (
    <>
      {/* Skip to main content */}
      <a
        href="#hero-search"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-cta focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      {/* Promo banner */}
      <div className="bg-cta text-white text-center py-2 px-page text-xs sm:text-sm font-semibold relative overflow-hidden leading-snug">
        <div className="shimmer-anim animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className="relative z-10">
          Livraison GRATUITE d&egrave;s 150&euro; d&apos;achat &bull; Retours 30
          jours
        </span>
      </div>

      {/* Hero */}
      <section
        id="hero-search"
        className="relative overflow-hidden py-section-md bg-gradient-to-br from-navy via-navy-mid to-navy-light"
      >
        <div
          className="absolute top-[10%] -right-[5%] w-48 sm:w-72 h-48 sm:h-72 rounded-full bg-cta/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative container mx-auto px-page max-w-[780px] text-center">
          <h1 className="text-xl sm:text-2xl md:text-[32px] font-extrabold text-white leading-tight mb-1 sm:mb-2 tracking-tight text-balance">
            Pi&egrave;ces d&eacute;tach&eacute;es auto{" "}
            <span className="bg-gradient-to-r from-cta to-cta-lighter bg-clip-text text-transparent">
              pas cher
            </span>{" "}
            <span className="text-white/70">&mdash; Toutes marques</span>
          </h1>

          <div className="bg-white/[0.07] border border-white/[0.12] rounded-2xl overflow-hidden">
            <Tabs
              defaultValue="vehicule"
              aria-label="Rechercher par véhicule, type mine ou référence"
            >
              <TabsList className="w-full h-auto rounded-none bg-black/15 p-0 gap-0">
                <TabsTrigger
                  value="vehicule"
                  className="flex-1 rounded-none min-h-[44px] gap-1.5 text-xs sm:text-sm font-semibold text-white/45 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-none border-0 px-2 sm:px-5"
                >
                  <Car className="w-3.5 h-3.5 flex-shrink-0" /> Par
                  v&eacute;hicule
                </TabsTrigger>
                <TabsTrigger
                  value="mine"
                  className="flex-1 rounded-none min-h-[44px] gap-1.5 text-xs sm:text-sm font-semibold text-white/45 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-none border-0 px-2 sm:px-5"
                >
                  🔢 Type Mine
                </TabsTrigger>
                <TabsTrigger
                  value="reference"
                  className="flex-1 rounded-none min-h-[44px] gap-1.5 text-xs sm:text-sm font-semibold text-white/45 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-none border-0 px-2 sm:px-5"
                >
                  <Search className="w-3.5 h-3.5 flex-shrink-0" />{" "}
                  R&eacute;f&eacute;rence
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="vehicule"
                className="mt-0 bg-white p-4 sm:p-5"
              >
                <VehicleSelector
                  mode="compact"
                  className="flex-wrap gap-2"
                  context="homepage"
                />
              </TabsContent>

              <TabsContent value="mine" className="mt-0 bg-white p-4 sm:p-5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  <span className="w-[18px] h-[18px] rounded-full bg-navy text-white text-[9px] font-bold grid place-items-center flex-shrink-0">
                    1
                  </span>
                  Num&eacute;ro de Type Mine ou CNIT
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mineCode.length >= 5) {
                      navigate(`/search/mine?code=${mineCode.toUpperCase()}`);
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="relative flex-1">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                    <Input
                      value={mineCode}
                      onChange={(e) =>
                        setMineCode(e.target.value.toUpperCase())
                      }
                      placeholder="Ex : M10RENVP0A5G35"
                      maxLength={20}
                      className="min-h-[44px] pl-10 bg-slate-50 border-slate-200 rounded-xl text-[15px] font-bold tracking-[2.5px] font-mono uppercase focus-visible:border-cta focus-visible:ring-cta/10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={mineCode.length < 5}
                    className="min-h-[46px] rounded-xl px-6 font-bold text-sm uppercase tracking-wide bg-cta hover:bg-cta-hover text-white shadow-[0_4px_14px_rgba(232,89,12,0.3)] whitespace-nowrap disabled:opacity-50"
                  >
                    <Search className="w-[18px] h-[18px] mr-2" /> Rechercher
                  </Button>
                </form>
                <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1">
                  💡 Trouvez ce num&eacute;ro sur votre carte grise,
                  rep&egrave;re D.2.1
                </p>
              </TabsContent>

              <TabsContent
                value="reference"
                className="mt-0 bg-white p-4 sm:p-5"
              >
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  <Search className="w-3.5 h-3.5" /> Rechercher par
                  r&eacute;f&eacute;rence ou nom de pi&egrave;ce
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (refQuery.trim()) {
                      navigate(
                        `/recherche?q=${encodeURIComponent(refQuery.trim())}`,
                      );
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={refQuery}
                      onChange={(e) => setRefQuery(e.target.value)}
                      placeholder="Référence OE, marque ou nom de pièce…"
                      className="min-h-[44px] pl-10 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:border-cta focus-visible:ring-cta/10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!refQuery.trim()}
                    className="min-h-[46px] rounded-xl px-6 font-bold text-sm uppercase tracking-wide bg-cta hover:bg-cta-hover text-white shadow-[0_4px_14px_rgba(232,89,12,0.3)] whitespace-nowrap disabled:opacity-50"
                  >
                    <Search className="w-[18px] h-[18px] mr-2" /> Rechercher
                  </Button>
                </form>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {[
                    "7701208265",
                    "P68050",
                    "Plaquettes Clio 4",
                    "KD457.74",
                    "Filtre huile Golf 7",
                  ].map((ex) => (
                    <Button
                      key={ex}
                      variant="ghost"
                      size="sm"
                      className="px-2.5 py-1 h-auto bg-slate-100 rounded-full text-[10px] font-semibold text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors border-0"
                      onClick={() => {
                        setRefQuery(ex);
                        navigate(`/recherche?q=${encodeURIComponent(ex)}`);
                      }}
                    >
                      {ex}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Separator */}
      <Separator className="h-px bg-gradient-to-r from-transparent via-cta/25 to-transparent border-0" />
    </>
  );
}
