import { useFetcher } from "@remix-run/react";
import { Info, Minus, Package, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { type CartItem as CartItemType } from "~/schemas/cart.schemas";
import { formatPrice, MAX_CART_QUANTITY } from "./cart-utils";

export function CartItemRow({ item }: { item: CartItemType }) {
  const updateFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const [currentQuantity, setCurrentQuantity] = useState(item.quantity);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmedQuantityRef = useRef(item.quantity);

  const isUpdating = updateFetcher.state !== "idle";
  const isRemoving = removeFetcher.state !== "idle";

  // Sync local quantity with server truth on revalidation
  useEffect(() => {
    setCurrentQuantity(item.quantity);
    confirmedQuantityRef.current = item.quantity;
  }, [item.quantity]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Rollback on error, sync navbar on success
  useEffect(() => {
    if (updateFetcher.state === "idle" && updateFetcher.data) {
      const data = updateFetcher.data as { success?: boolean; error?: string };
      if (data.error || data.success === false) {
        setCurrentQuantity(confirmedQuantityRef.current);
      }
      window.dispatchEvent(new Event("cart:updated"));
    }
  }, [updateFetcher.state, updateFetcher.data]);

  useEffect(() => {
    if (removeFetcher.state === "idle" && removeFetcher.data) {
      window.dispatchEvent(new Event("cart:updated"));
    }
  }, [removeFetcher.state, removeFetcher.data]);

  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      if (
        newQuantity < 1 ||
        newQuantity > MAX_CART_QUANTITY ||
        newQuantity === currentQuantity
      )
        return;

      setCurrentQuantity(newQuantity);

      // Debounce 300ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateFetcher.submit(
          {
            intent: "update",
            productId: String(item.product_id),
            quantity: String(newQuantity),
          },
          { method: "post" },
        );
      }, 300);
    },
    [currentQuantity, item.product_id, updateFetcher],
  );

  const handleRemove = useCallback(() => {
    removeFetcher.submit(
      {
        intent: "remove",
        productId: String(item.product_id),
      },
      { method: "post" },
    );
  }, [item.product_id, removeFetcher]);

  // Price calculation: prefer explicit fields, fallback to price as unit
  const unitPrice = Number(item.unit_price ?? item.price ?? 0);
  const totalPrice = Number(item.total_price ?? unitPrice * currentQuantity);

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm transition-all duration-300 overflow-hidden ${
        isUpdating || isRemoving
          ? "opacity-50 pointer-events-none"
          : "hover:shadow-md hover:border-slate-300"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-20 h-20 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
            {item.product_image &&
            item.product_image !== "/images/categories/default.svg" ? (
              <img
                src={item.product_image}
                alt={item.product_name || "Produit"}
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-8 w-8 text-slate-300" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight truncate">
              {item.product_name || item.name || "Produit sans nom"}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                R{"\u00e9"}f: {item.product_sku || item.product_id}
              </span>
              {item.product_brand &&
              item.product_brand !== "MARQUE INCONNUE" &&
              item.product_brand !== "Non sp\u00e9cifi\u00e9e" ? (
                <Badge variant="secondary" size="sm">
                  {item.product_brand}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  size="sm"
                  className="text-slate-400 border-slate-200"
                >
                  Marque {"\u00e0"} v{"\u00e9"}rifier
                </Badge>
              )}
              {item.has_consigne && (item.consigne_unit ?? 0) > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 cursor-help">
                        +{formatPrice(item.consigne_unit!)} consigne
                        <Info className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[200px] text-xs">
                        La consigne est remboursable {"\u00e0"} la restitution
                        de l'ancienne pi{"\u00e8"}ce.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={isUpdating || isRemoving}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              aria-label="Supprimer cet article"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3 py-2 min-h-[44px] text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="px-3 py-2 min-h-[44px] text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isRemoving ? "..." : "Confirmer"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden md:inline">
              Quantit{"\u00e9"}:
            </span>
            <div className="flex items-center border rounded-lg overflow-hidden bg-slate-50">
              <button
                onClick={() => handleQuantityChange(currentQuantity - 1)}
                disabled={isUpdating || isRemoving || currentQuantity <= 1}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Diminuer la quantit\u00e9"
              >
                <Minus className="h-4 w-4 text-slate-600" />
              </button>
              <span className="px-4 py-2 font-bold text-lg bg-white min-w-[50px] text-center border-x">
                {currentQuantity}
              </span>
              <button
                onClick={() => handleQuantityChange(currentQuantity + 1)}
                disabled={
                  isUpdating ||
                  isRemoving ||
                  currentQuantity >= MAX_CART_QUANTITY
                }
                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Augmenter la quantit\u00e9"
              >
                <Plus className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-navy">
              {formatPrice(totalPrice)}
            </div>
            <div className="text-xs text-slate-500">
              {currentQuantity > 1
                ? `${currentQuantity} x ${formatPrice(unitPrice)}`
                : `Prix unitaire : ${formatPrice(unitPrice)}`}
            </div>
          </div>
        </div>

        {(isUpdating || isRemoving) && (
          <div className="mt-3 flex items-center justify-center gap-2 text-cta text-sm">
            <div className="animate-spin w-4 h-4 border-2 border-cta border-t-transparent rounded-full"></div>
            <span>{isUpdating ? "Mise \u00e0 jour..." : "Suppression..."}</span>
          </div>
        )}

        {updateFetcher.state === "idle" &&
          (updateFetcher.data as { error?: string } | undefined)?.error && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 rounded px-3 py-1.5">
              {(updateFetcher.data as { error: string }).error}
            </p>
          )}
      </div>
    </div>
  );
}
