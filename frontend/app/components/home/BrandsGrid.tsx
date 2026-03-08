import { Link } from "@remix-run/react";
import { useState } from "react";
import { type BrandItem } from "~/components/home/constants";
import { Section, SectionHeader } from "~/components/layout";

interface BrandsGridProps {
  brands: BrandItem[];
  equipementiers?: { name: string; logo?: string }[];
}

export default function BrandsGrid({
  brands,
  equipementiers = [],
}: BrandsGridProps) {
  const equipList = equipementiers.filter((e) => e.logo);
  const [showAllBrands, setShowAllBrands] = useState(false);

  return (
    <Section variant="slate" spacing="md" id="marques">
      <SectionHeader
        title="Par constructeur"
        sub="Accédez rapidement aux pièces compatibles par constructeur, modèle et motorisation."
      />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2.5 sm:gap-3">
        {/* Mobile: all brands, Desktop: limited */}
        {brands.map((b, i) => (
          <Link
            key={b.name}
            to={`/constructeurs/${b.slug}-${b.id}.html`}
            className={`group rounded-[22px] border border-slate-200 bg-white px-2 pb-3 pt-2 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-cta hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]${
              !showAllBrands && i >= 12 ? " hidden lg:hidden" : ""
            }${!showAllBrands && i >= 9 && i < 12 ? " hidden sm:block" : ""}`}
          >
            <div className="flex h-[80px] items-center justify-center rounded-[18px] bg-slate-50 overflow-hidden group-hover:bg-orange-50 transition-colors">
              {b.logo ? (
                <img
                  src={b.logo}
                  alt={b.name}
                  className="max-h-16 max-w-[72px] object-contain"
                  loading="lazy"
                  width={64}
                  height={64}
                />
              ) : (
                <span className="text-base sm:text-lg font-bold text-navy font-v9-heading">
                  {b.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="mt-2 block truncate text-center text-[0.78rem] font-medium leading-tight text-slate-700 group-hover:text-cta transition-colors">
              {b.name}
            </span>
          </Link>
        ))}
      </div>

      {!showAllBrands && brands.length > 12 && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setShowAllBrands(true)}
            className="px-6 py-3 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors tracking-[-0.03em]"
          >
            Voir les {brands.length - 12} marques restantes
          </button>
        </div>
      )}

      {showAllBrands && (
        <div className="mt-4 lg:hidden">
          <Link
            to="/constructeurs"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.25)] transition active:scale-[0.99]"
          >
            Voir toutes les marques
          </Link>
        </div>
      )}

      {/* Équipementiers marquee */}
      {equipList.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
            Équipementiers partenaires
          </p>
          <div
            className="w-full overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
            }}
          >
            <div className="flex animate-marquee items-center gap-10 sm:gap-14 lg:gap-16 w-max">
              {[...equipList, ...equipList].map((e, i) => (
                <div
                  key={`${e.name}-${i}`}
                  className="flex-shrink-0 h-10 sm:h-12"
                >
                  <img
                    src={e.logo}
                    alt={e.name}
                    title={e.name}
                    className="h-full w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-200"
                    loading="lazy"
                    width={120}
                    height={48}
                    onError={(ev) => {
                      ev.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          {equipList.length > 12 && (
            <p className="text-center mt-3">
              <Link
                to="#marques"
                className="text-[12px] text-slate-500 hover:text-cta font-medium transition-colors"
              >
                Voir les {equipList.length} équipementiers
              </Link>
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
