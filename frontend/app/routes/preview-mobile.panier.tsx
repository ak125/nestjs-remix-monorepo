/**
 * Preview Mobile — Panier (/preview-mobile/panier)
 *
 * Validation visuelle du panier avec checkout steps, fitment band,
 * stepper inline sur items, sticky CTA dark navy + total jaune.
 */

import { useNavigate } from "@remix-run/react";
import { ChevronRight, ShoppingCart, Tag, Trash2 } from "lucide-react";

import { MV5CheckoutSteps, MV5StickyCTA } from "~/components/mobile-v5/atoms";
import { MV5Header } from "~/components/mobile-v5/Header";
import { MV5_PREVIEW_VEHICLE } from "~/components/mobile-v5/preview-fixtures";
import { MV5QuantityStepper } from "~/components/mobile-v5/QuantityStepper";
import { usePreviewCart } from "~/components/mobile-v5/usePreviewCart";

export default function PreviewMobilePanier() {
  const navigate = useNavigate();
  const { items, setQty, remove, subtotal, shipping, total, count } =
    usePreviewCart();

  const hasItems = items.length > 0;
  const mainBottomPadding = hasItems ? "pb-40" : "pb-24";

  return (
    <>
      <MV5Header
        title={`Panier · ${count}`}
        leftIcon="back"
        light
        onLeft={() => navigate("/preview-mobile")}
      />

      <main className={`flex-1 ${mainBottomPadding}`}>
        <MV5CheckoutSteps
          steps={["Panier", "Livraison", "Paiement"]}
          active={0}
        />

        {hasItems && (
          <div className="mv5-fitment-band">
            <span className="mv5-fitment-band-value flex-1">
              ✓ Toutes les pièces compatibles avec {MV5_PREVIEW_VEHICLE.label}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 px-4 pt-4">
          {!hasItems ? (
            <div className="mv5-card">
              <div className="mv5-card-body flex flex-col items-center gap-3 py-8 text-center">
                <ShoppingCart
                  size={32}
                  strokeWidth={1.5}
                  className="mv5-text-faint"
                  aria-hidden="true"
                />
                <span className="mv5-text-soft">Votre panier est vide</span>
                <button
                  type="button"
                  className="mv5-btn mv5-btn-primary mv5-btn-md"
                  onClick={() => navigate("/preview-mobile/catalog")}
                >
                  Voir le catalogue
                </button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((it) => (
                <li key={it.ref} className="mv5-card">
                  <div className="flex items-start gap-3 p-3">
                    <div className="mv5-cart-item-img" aria-hidden="true">
                      {it.ref}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="mv5-product-brand">{it.brand}</span>
                      <span className="text-[13px] font-semibold leading-snug">
                        {it.name}
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <MV5QuantityStepper
                          value={it.qty}
                          onChange={(v) => setQty(it.ref, v)}
                          label="Quantité"
                        />
                        <span className="mv5-num text-base">
                          {(it.price * it.qty).toFixed(2)}€
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mv5-icon-btn mv5-text-soft"
                      onClick={() => remove(it.ref)}
                      aria-label={`Supprimer ${it.brand} ${it.name} du panier`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {hasItems && (
            <>
              <button
                type="button"
                className="mv5-card flex w-full items-center justify-between px-4 py-3 text-left"
                aria-label="Saisir un code promo"
              >
                <span className="flex items-center gap-2">
                  <Tag size={18} className="text-cta" aria-hidden="true" />
                  <span className="font-semibold">Code promo</span>
                </span>
                <ChevronRight
                  size={16}
                  className="mv5-text-soft"
                  aria-hidden="true"
                />
              </button>

              <div className="mv5-card">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span>Sous-total</span>
                    <span className="font-semibold">
                      {subtotal.toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 pb-3">
                    <span>Livraison</span>
                    <span
                      className={`font-semibold ${
                        shipping === 0 ? "text-success" : ""
                      }`}
                    >
                      {shipping === 0 ? "Offerte" : `${shipping.toFixed(2)}€`}
                    </span>
                  </div>
                  <hr className="mv5-divider" />
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="mv5-h3">Total</span>
                    <span className="mv5-num text-xl">{total.toFixed(2)}€</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {hasItems && (
        <MV5StickyCTA
          variant="dark"
          total={{ label: "Total", value: `${total.toFixed(2)}€` }}
        >
          <button type="button" className="mv5-btn mv5-btn-primary mv5-btn-md">
            Commander <ChevronRight size={16} aria-hidden="true" />
          </button>
        </MV5StickyCTA>
      )}
    </>
  );
}
