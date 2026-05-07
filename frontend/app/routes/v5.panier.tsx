/**
 * V5 Panier — /v5/panier
 * Récap panier mock localStorage (ship 1).
 */

import { type MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { ChevronRight, ShoppingCart, Tag, Trash2 } from "lucide-react";

import { V5CheckoutSteps, V5StickyCTA } from "~/components/v5/atoms";
import { V5Header } from "~/components/v5/Header";
import { useV5Cart } from "~/components/v5/hooks/useV5Cart";
import { useV5Vehicle } from "~/components/v5/hooks/useV5Vehicle";
import { V5QuantityStepper } from "~/components/v5/QuantityStepper";

export const meta: MetaFunction = () => [
  { title: "AutoMecanik · Panier mobile" },
];

export default function V5PanierRoute() {
  const navigate = useNavigate();
  const { label } = useV5Vehicle();
  const { items, setQty, remove, subtotal, shipping, total, count } =
    useV5Cart();

  const hasItems = items.length > 0;
  const mainClass = hasItems ? "v5-main-with-cta-dark" : "v5-main";

  return (
    <>
      <V5Header
        title={`Panier · ${count}`}
        leftIcon="back"
        light
        onLeft={() => navigate("/v5")}
      />

      <main className={`${mainClass} flex-1`}>
        <V5CheckoutSteps
          steps={["Panier", "Livraison", "Paiement"]}
          active={0}
        />

        {label && hasItems && (
          <div className="v5-fitment-band">
            <span className="v5-fitment-band-value" style={{ flex: 1 }}>
              ✓ Toutes les pièces compatibles avec {label}
            </span>
          </div>
        )}

        <div className="px-4 pt-4 flex flex-col gap-3">
          {!hasItems ? (
            <div className="v5-card">
              <div className="v5-card-body flex flex-col items-center gap-3 py-8 text-center">
                <ShoppingCart
                  size={32}
                  strokeWidth={1.5}
                  style={{ color: "var(--c-ink-faint)" }}
                  aria-hidden="true"
                />
                <span style={{ color: "var(--c-ink-soft)" }}>
                  Votre panier est vide
                </span>
                <button
                  type="button"
                  className="v5-btn v5-btn-primary v5-btn-md"
                  onClick={() => navigate("/v5/liste")}
                >
                  Voir le catalogue
                </button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((it) => (
                <li key={it.ref} className="v5-card">
                  <div className="flex items-start gap-3 p-3">
                    <div className="v5-cart-item-img" aria-hidden="true">
                      {it.ref}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <span className="v5-product-brand">{it.brand}</span>
                      <span
                        className="text-[13px] font-semibold leading-snug"
                        style={{ color: "var(--c-ink)" }}
                      >
                        {it.name}
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <V5QuantityStepper
                          value={it.qty}
                          onChange={(v) => setQty(it.ref, v)}
                          label="Quantité"
                        />
                        <span className="v5-num" style={{ fontSize: 16 }}>
                          {(it.price * it.qty).toFixed(2)}€
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="v5-icon-btn"
                      onClick={() => remove(it.ref)}
                      aria-label={`Supprimer ${it.brand} ${it.name} du panier`}
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        color: "var(--c-ink-soft)",
                      }}
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
                className="v5-card flex w-full items-center justify-between px-4 py-3 text-left"
                aria-label="Saisir un code promo"
              >
                <span className="flex items-center gap-2">
                  <Tag
                    size={18}
                    style={{ color: "var(--c-cta)" }}
                    aria-hidden="true"
                  />
                  <span
                    className="font-semibold"
                    style={{ color: "var(--c-ink)" }}
                  >
                    Code promo
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  style={{ color: "var(--c-ink-soft)" }}
                  aria-hidden="true"
                />
              </button>

              <div className="v5-card">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span style={{ color: "var(--c-ink)" }}>Sous-total</span>
                    <span
                      className="font-semibold"
                      style={{ color: "var(--c-ink)" }}
                    >
                      {subtotal.toFixed(2)}€
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 pb-3">
                    <span style={{ color: "var(--c-ink)" }}>Livraison</span>
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          shipping === 0 ? "var(--c-success)" : "var(--c-ink)",
                      }}
                    >
                      {shipping === 0 ? "Offerte" : `${shipping.toFixed(2)}€`}
                    </span>
                  </div>
                  <hr
                    style={{
                      height: 1,
                      background: "var(--c-line)",
                      border: 0,
                      margin: 0,
                    }}
                  />
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="v5-h3">Total</span>
                    <span className="v5-num" style={{ fontSize: 22 }}>
                      {total.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {hasItems && (
        <V5StickyCTA
          variant="dark"
          total={{ label: "Total", value: `${total.toFixed(2)}€` }}
        >
          <button
            type="button"
            className="v5-btn v5-btn-primary v5-btn-md"
            onClick={() => navigate("/v5/panier")}
          >
            Commander <ChevronRight size={16} aria-hidden="true" />
          </button>
        </V5StickyCTA>
      )}
    </>
  );
}
