import { Link } from "@remix-run/react";
import { Section, SectionHeader } from "~/components/layout";
import { Card, CardContent } from "~/components/ui/card";
import { type BrandItem } from "./constants";

export default function BrandsGridSection({ brands }: { brands: BrandItem[] }) {
  return (
    <Section variant="slate" spacing="md" id="marques">
      <SectionHeader
        title="Par constructeur"
        sub={`${brands.length} marques auto`}
      />
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2.5 sm:gap-3">
        {brands.map((b) => (
          <Link key={b.name} to={`/constructeurs/${b.slug}-${b.id}.html`}>
            <Card className="group hover:border-cta hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 rounded-2xl border-[1.5px]">
              <CardContent className="flex flex-col items-center justify-center py-3 px-2 gap-1.5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden group-hover:bg-orange-50 transition-colors">
                  {b.logo ? (
                    <img
                      src={b.logo}
                      alt={b.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                      loading="lazy"
                      width={64}
                      height={64}
                    />
                  ) : (
                    <span className="text-base sm:text-lg font-bold text-navy">
                      {b.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-500 text-center truncate w-full group-hover:text-cta transition-colors">
                  {b.name}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </Section>
  );
}
