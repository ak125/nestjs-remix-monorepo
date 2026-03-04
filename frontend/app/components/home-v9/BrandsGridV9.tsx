import { Link } from "@remix-run/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { type BrandItem } from "~/components/home/constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export default function BrandsGridV9({ brands }: { brands: BrandItem[] }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <section className="py-7 lg:py-10 bg-slate-50">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Par constructeur
          </h2>
          <Badge
            variant="outline"
            className="text-[12px] text-blue-600 bg-blue-50 border-blue-100 font-semibold"
          >
            {brands.length} marques auto
          </Badge>
        </div>

        <div className="grid grid-cols-4 lg:grid-cols-6 gap-2.5 lg:gap-3">
          {brands.map((b, idx) => (
            <Link
              key={b.name}
              to={`/constructeurs/${b.slug}-${b.id}.html`}
              className={`bg-white border border-slate-200 rounded-xl py-3.5 px-2 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 transition-all group block ${idx >= 16 && !showAll ? "hidden lg:block" : ""}`}
            >
              <div className="w-12 h-12 lg:w-14 lg:h-14 mx-auto mb-1.5 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center overflow-hidden transition-all">
                {b.logo ? (
                  <img
                    src={b.logo}
                    alt={b.name}
                    className="w-9 h-9 lg:w-11 lg:h-11 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-[14px] font-extrabold text-slate-500 group-hover:text-blue-600 transition-all font-v9-heading">
                    {b.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 group-hover:text-blue-700 transition-colors truncate">
                {b.name}
              </div>
            </Link>
          ))}
        </div>

        {!showAll && brands.length > 16 && (
          <Button
            variant="outline"
            onClick={() => setShowAll(true)}
            className="w-full mt-3.5 py-3 h-auto rounded-xl text-[13px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 lg:hidden"
          >
            Voir les {brands.length} marques{" "}
            <ChevronDown size={14} className="ml-1" />
          </Button>
        )}
      </div>
    </section>
  );
}
