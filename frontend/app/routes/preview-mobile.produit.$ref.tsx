/**
 * Preview Mobile — Produit (/preview-mobile/produit/:ref)
 *
 * Validation visuelle de la fiche produit avec gallery navy + OEM mono jaune,
 * fitment card sombre, specs, cross-sell, sticky CTA stepper + ajout panier.
 */

import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Check, Heart, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { MV5Badge, MV5StickyCTA } from "~/components/mobile-v5/atoms";
import { MV5Header } from "~/components/mobile-v5/Header";
import {
  findPreviewProduct,
  MV5_PREVIEW_VEHICLE,
  MV5_PRODUCTS,
} from "~/components/mobile-v5/preview-fixtures";
import { MV5ProductCard } from "~/components/mobile-v5/ProductCard";
import { MV5QuantityStepper } from "~/components/mobile-v5/QuantityStepper";
import { usePreviewCart } from "~/components/mobile-v5/usePreviewCart";

export const loader = ({ params }: LoaderFunctionArgs) => {
  const ref = params.ref ?? "";
  const product = findPreviewProduct(decodeURIComponent(ref));
  if (!product) {
    throw new Response("Produit introuvable", { status: 404 });
  }
  const cross = MV5_PRODUCTS.filter(
    (p) => p.cat === product.cat && p.ref !== product.ref,
  ).slice(0, 3);
  return json({ product, cross });
};

export default function PreviewMobileProduit() {
  const navigate = useNavigate();
  const { product, cross } = useLoaderData<typeof loader>();
  const cart = usePreviewCart();
  const [qty, setQty] = useState(1);

  const total = (product.price * qty).toFixed(2);
  const promoPct =
    product.priceOld != null
      ? Math.round(
          ((product.priceOld - product.price) / product.priceOld) * 100,
        )
      : null;
  const cartBadge = cart.count > 0 ? cart.count : null;

  return (
    <>
      <MV5Header
        title=" "
        leftIcon="back"
        light
        onLeft={() => navigate("/preview-mobile/catalog")}
        rightIcons={[
          { icon: Heart, label: "Ajouter aux favoris" },
          {
            icon: ShoppingCart,
            label: "Panier",
            badge: cartBadge,
            onClick: () => navigate("/preview-mobile/panier"),
          },
        ]}
      />

      <main className="flex-1 pb-32">
        <div className="mv5-gallery">
          <span className="mv5-gallery-mono" aria-hidden="true">
            {product.ref}
          </span>
          {product.badge && (
            <span className="mv5-gallery-badge">
              <MV5Badge variant={product.badgeVariant ?? "promo"}>
                {product.badge}
              </MV5Badge>
            </span>
          )}
          <span className="mv5-gallery-dots" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`mv5-gallery-dot${i === 0 ? " is-active" : ""}`}
              />
            ))}
          </span>
        </div>

        <div className="flex flex-col gap-4 px-4 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <MV5Badge variant="dark">{product.brand}</MV5Badge>
              <MV5Badge variant="success">
                <Check size={10} strokeWidth={3} aria-hidden="true" />{" "}
                Compatible
              </MV5Badge>
            </div>
            <h1 className="mv5-h2">{product.name}</h1>
            <span className="mv5-mono mv5-text-soft text-xs">
              Réf. OE · {product.ref}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="mv5-num text-3xl">
              {product.price.toFixed(2)}€
            </span>
            {product.priceOld != null && (
              <>
                <span className="mv5-product-price-old text-sm">
                  {product.priceOld.toFixed(2)}€
                </span>
                {promoPct != null && promoPct > 0 && (
                  <MV5Badge variant="promo">−{promoPct}%</MV5Badge>
                )}
              </>
            )}
          </div>

          <div className="mv5-card mv5-card-dark">
            <div className="mv5-card-body">
              <div className="flex items-center gap-3">
                <Check
                  size={22}
                  strokeWidth={2.5}
                  className="text-signatureYellow"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1">
                  <span className="mv5-eyebrow text-signatureYellow">
                    Compatible
                  </span>
                  <span className="text-sm font-bold">
                    {MV5_PREVIEW_VEHICLE.label}
                  </span>
                  <span className="text-xs text-white/70">
                    {MV5_PREVIEW_VEHICLE.sub}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="mv5-h3">Caractéristiques</h2>
            <div className="mv5-card">
              <dl className="flex flex-col">
                {[
                  ["Fabricant", product.brand],
                  ["Référence OE", product.ref],
                  ["Type", "Plaquettes avant"],
                  ["Diamètre", "Ø 283 mm"],
                  ["Garantie", "2 ans"],
                ].map(([k, v]) => (
                  <div key={k} className="mv5-spec-row">
                    <dt className="mv5-spec-key">{k}</dt>
                    <dd className="mv5-spec-val">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {cross.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="mv5-h3">Souvent achetés ensemble</h2>
              <div className="grid grid-cols-3 gap-3">
                {cross.map((p) => (
                  <MV5ProductCard
                    key={p.ref}
                    product={p}
                    onAdd={(prod) => cart.add(prod)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <MV5StickyCTA>
        <MV5QuantityStepper value={qty} onChange={setQty} />
        <button
          type="button"
          className="mv5-btn mv5-btn-primary mv5-btn-md flex-1"
          onClick={() => {
            cart.add(product, qty);
            navigate("/preview-mobile/panier");
          }}
          disabled={product.stock === 0}
        >
          <ShoppingCart size={18} aria-hidden="true" />
          {product.stock === 0 ? "Indisponible" : `Ajouter — ${total}€`}
        </button>
      </MV5StickyCTA>
    </>
  );
}
