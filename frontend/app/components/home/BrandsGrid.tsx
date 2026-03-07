import { Link } from "@remix-run/react";
import { type BrandItem } from "~/components/home/constants";
import { Section, SectionHeader } from "~/components/layout";

export default function BrandsGrid({ brands }: { brands: BrandItem[] }) {
  return (
    <Section variant="slate" spacing="md" id="marques">
      <SectionHeader
        title="Par constructeur"
        sub={`${brands.length} marques auto`}
      />
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2.5 sm:gap-3">
        {brands.map((b) => (
          <Link
            key={b.name}
            to={`/constructeurs/${b.slug}-${b.id}.html`}
            className="group rounded-[22px] border border-slate-200 bg-white px-2 pb-3 pt-2 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-cta hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="flex h-[72px] items-center justify-center rounded-[18px] bg-slate-50 overflow-hidden group-hover:bg-orange-50 transition-colors">
              {b.logo ? (
                <img
                  src={b.logo}
                  alt={b.name}
                  className="max-h-12 max-w-[56px] object-contain"
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
      <div className="mt-4 lg:hidden">
        <Link
          to="/constructeurs"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.25)] transition active:scale-[0.99]"
        >
          Voir toutes les marques
        </Link>
      </div>
    </Section>
  );
}
