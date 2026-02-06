import { Tag, ShoppingCart, ArrowDown } from "lucide-react";

interface PricePreviewProduct {
  piece_id: number;
  name: string;
  ref: string;
  price: number;
  brand_id: number;
  brand_name: string;
  brand_logo: string;
  has_img: boolean;
}

interface PricePreviewData {
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  product_count: number;
  brand_count: number;
  products: PricePreviewProduct[];
}

interface GammePricePreviewProps {
  pricePreview: PricePreviewData;
  gammeName?: string;
}

function formatPrice(price: number): { whole: string; cents: string } {
  const parts = price.toFixed(2).split(".");
  return { whole: parts[0], cents: parts[1] };
}

function ProductPreviewCard({ product }: { product: PricePreviewProduct }) {
  const { whole, cents } = formatPrice(product.price);

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
      <div className="flex items-center gap-2 mb-2">
        {product.brand_logo ? (
          <img
            src={`/img/brand/${product.brand_logo}`}
            alt={product.brand_name}
            className="h-5 w-auto object-contain"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <span className="text-xs font-semibold text-gray-600 truncate">
          {product.brand_name}
        </span>
      </div>
      <p className="text-xs text-gray-500 truncate mb-1.5" title={product.name}>
        {product.name}
      </p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-bold text-gray-900">{whole}</span>
        <span className="text-sm font-semibold text-gray-400">,{cents} €</span>
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5">Réf: {product.ref}</p>
    </div>
  );
}

export function GammePricePreview({
  pricePreview,
  gammeName,
}: GammePricePreviewProps) {
  if (!pricePreview?.min_price) return null;

  const { whole, cents } = formatPrice(pricePreview.min_price);

  const handleScrollToSelector = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof document === "undefined" || typeof window === "undefined")
      return;
    const el = document.getElementById("vehicle-selector");
    if (el) {
      const offset = 80;
      const pos = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: pos - offset, behavior: "smooth" });
    }
  };

  return (
    <section
      id="prices"
      className="container mx-auto px-4 -mt-6 relative z-20 mb-4"
    >
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden max-w-4xl mx-auto">
        {/* Price anchor */}
        <div className="p-5 pb-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100 mb-3">
            <Tag className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
              Prix indicatifs
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-1">
            {gammeName || "Pièces auto"}
          </p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-sm text-gray-500">À partir de</span>
            <span className="text-3xl font-bold text-gray-900">{whole}</span>
            <span className="text-lg font-semibold text-gray-400">
              ,{cents} €
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
            <span>
              {pricePreview.brand_count} marque
              {pricePreview.brand_count > 1 ? "s" : ""}
            </span>
            <span className="text-gray-300">·</span>
            <span>
              {pricePreview.product_count.toLocaleString("fr-FR")} référence
              {pricePreview.product_count > 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-[11px] text-amber-600 mt-1.5">
            Prix TTC hors livraison — Sélectionnez votre véhicule pour vérifier
            la compatibilité
          </p>
        </div>

        {/* Product grid */}
        {pricePreview.products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 px-4 pb-3 pt-1">
            {pricePreview.products.map((product) => (
              <ProductPreviewCard key={product.piece_id} product={product} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="p-4 pt-2 text-center">
          <a
            href="#vehicle-selector"
            onClick={handleScrollToSelector}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            Voir les prix pour mon véhicule
            <ArrowDown className="w-3.5 h-3.5 opacity-60" />
          </a>
        </div>
      </div>
    </section>
  );
}
