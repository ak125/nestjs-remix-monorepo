import { Info, Package, ShoppingBag, Truck } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { type CartSummary as CartSummaryType } from "~/schemas/cart.schemas";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "./cart-utils";

export function CartSummaryBlock({
  summary,
  children,
  isUpdating,
}: {
  summary: CartSummaryType;
  children?: React.ReactNode;
  isUpdating?: boolean;
}) {
  const total =
    summary.total_price ||
    summary.subtotal +
      (summary.consigne_total || 0) +
      summary.tax_amount +
      summary.shipping_cost -
      (summary.discount_amount || 0);
  const isEligibleFreeShipping = summary.subtotal >= FREE_SHIPPING_THRESHOLD;
  const isLite =
    summary.total_items <= 3 &&
    !(summary.consigne_total > 0) &&
    !(summary.discount_amount && summary.discount_amount > 0);

  return (
    <div
      className={`bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden transition-all ${
        isUpdating ? "opacity-50 scale-[0.98]" : "hover:shadow-2xl"
      }`}
    >
      <div className="bg-navy text-white px-4 sm:px-6 py-3 sm:py-4">
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5" />R{"\u00e9"}sum{"\u00e9"} de la commande
          {isUpdating && (
            <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full ml-auto"></div>
          )}
        </h2>
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {!isLite && (
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-700 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-navy" />
              Articles
            </span>
            <Badge variant="info" size="sm" className="text-sm px-3 py-0.5">
              {summary.total_items}
            </Badge>
          </div>
        )}

        <div className="flex justify-between items-center py-3 border-b border-slate-100">
          <span className="text-slate-600">Sous-total produits</span>
          <span className="font-semibold text-lg">
            {formatPrice(summary.subtotal)}
          </span>
        </div>

        {(summary.consigne_total ?? 0) > 0 && (
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
            <span className="text-amber-800 font-medium flex items-center gap-2">
              <span className="text-xl">&#9851;</span>
              Consignes
              <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                remboursables
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[220px] text-xs">
                      Rembours{"\u00e9"}e apr{"\u00e8"}s retour de l'ancienne pi
                      {"\u00e8"}ce usag{"\u00e9"}e.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-bold text-amber-700">
              +{formatPrice(summary.consigne_total)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center py-3 border-b border-slate-100">
          <span className="text-slate-600 flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Livraison
          </span>
          {isEligibleFreeShipping ? (
            <span className="font-bold text-green-600">OFFERTE</span>
          ) : summary.shipping_cost > 0 ? (
            <span className="font-medium">
              {formatPrice(summary.shipping_cost)}
            </span>
          ) : (
            <span className="text-sm text-slate-400 italic">
              Offerte d{"\u00e8"}s 150{"\u00a0"}
              {"\u20ac"}
            </span>
          )}
        </div>

        {summary.tax_amount > 0 && (
          <div className="flex justify-between py-3 border-b border-slate-100">
            <span className="text-slate-600">TVA incluse</span>
            <span className="font-medium">
              {formatPrice(summary.tax_amount)}
            </span>
          </div>
        )}

        {(summary.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border-2 border-green-200">
            <span className="text-green-700 font-medium flex items-center gap-2">
              <span className="text-xl">&#127873;</span>
              Remise appliqu{"\u00e9"}e
            </span>
            <span className="font-bold text-green-700">
              -{formatPrice(summary.discount_amount!)}
            </span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t-2 border-slate-200">
          <div className="flex justify-between items-center p-5 bg-cta rounded-xl shadow-lg">
            <span className="font-bold text-lg text-white">Total TTC</span>
            <span className="font-extrabold text-3xl text-white">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </div>

      {children && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
